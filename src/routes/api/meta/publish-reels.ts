import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/usage.server";
import { META_VERSION, resolveMetaDestino } from "@/lib/meta.server";

/**
 * PUBLICA O FILME COMO REELS NO INSTAGRAM.
 *
 * ⚠ VÍDEO NÃO É IMAGEM, e a diferença está no TEMPO. Foto publica em uma
 * chamada; reels são três — cria o contêiner, ESPERA a Meta processar o vídeo, e
 * só então publica. O processamento leva de segundos a mais de um minuto, e é
 * por isso que este endpoint aceita `creationId`: se a espera estourar, o
 * contêiner JÁ EXISTE do lado da Meta, e a segunda tentativa publica sem subir
 * nem processar nada de novo. Sem isso, cada timeout jogaria fora um
 * processamento inteiro.
 *
 * ⚠ QUEM PUBLICA É O TOKEN DE SISTEMA DA BM, com o destino vindo da allowlist —
 * exatamente como a foto faz em test-publish.ts. A tabela `meta_connections` é
 * do OAuth por cliente, que NUNCA entrou no ar (0 linhas em produção): ler dela
 * aqui faria todo clique morrer em "Instagram não conectado".
 *
 * ⚠ E A META BUSCA O VÍDEO: `videoUrl` precisa ser um endereço que os servidores
 * dela alcancem — é para isso que existe /api/salvar-filme.
 */

/**
 * Espera o vídeo processar, por POUCO TEMPO.
 *
 * ⚠ CURTA DE PROPÓSITO. Esperar o processamento inteiro dentro da requisição
 * convida a rede do celular a derrubar a conexão DEPOIS que a Meta já aceitou —
 * o servidor seguiria e publicaria, o usuário veria erro, clicaria de novo e
 * sairiam DOIS reels iguais. Aqui a espera cabe folgada em qualquer rede; se não
 * terminou, devolvemos o contêiner e o próximo clique continua de onde parou.
 */
async function esperarVideo(
  containerId: string,
  token: string,
): Promise<{ pronto: boolean; motivo?: string }> {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(
      `https://graph.facebook.com/${META_VERSION}/${containerId}?fields=status_code,status&access_token=${token}`,
    );
    const d = (await r.json()) as { status_code?: string; status?: string };
    if (d.status_code === "FINISHED") return { pronto: true };
    // ERROR e EXPIRED são fim de linha: o contêiner não serve mais, e insistir
    // nele é esperar para sempre por algo que não vai mudar.
    if (d.status_code === "ERROR" || d.status_code === "EXPIRED")
      return { pronto: false, motivo: d.status || "A Meta rejeitou o vídeo." };
  }
  return { pronto: false };
}

export const Route = createFileRoute("/api/meta/publish-reels")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: "Não autenticado" }, { status: 401 });
        const destino = resolveMetaDestino(request);
        if (!destino) return Response.json({ error: "Acesso não autorizado" }, { status: 403 });

        const token = process.env.META_ACCESS_TOKEN;
        if (!token)
          return Response.json(
            { error: "META_ACCESS_TOKEN não configurado no servidor" },
            { status: 403 },
          );

        const { videoUrl, caption, creationId } = (await request.json()) as {
          videoUrl?: string;
          caption?: string;
          creationId?: string;
        };
        if (!videoUrl && !creationId)
          return Response.json({ error: "videoUrl obrigatório" }, { status: 400 });

        try {
          let container = creationId;

          if (!container) {
            const createRes = await fetch(
              `https://graph.facebook.com/${META_VERSION}/${destino.igUserId}/media`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  media_type: "REELS",
                  video_url: videoUrl,
                  caption: caption || "",
                  // Sem isto o reels não aparece no feed do perfil, só na aba
                  // de reels — e quem posta espera ver a peça no feed.
                  share_to_feed: true,
                  access_token: token,
                }),
              },
            );
            const createData = (await createRes.json()) as {
              id?: string;
              error?: { message: string };
            };
            if (!createData.id)
              throw new Error(createData.error?.message || "Falha ao criar o contêiner do reels");
            container = createData.id;
          }

          const espera = await esperarVideo(container, token);
          if (!espera.pronto) {
            // ⚠ O contêiner só volta quando AINDA DÁ para usá-lo. Devolver o id
            // de um contêiner rejeitado prenderia o usuário: todo clique
            // seguinte esperaria de novo por um contêiner morto, sem saída a
            // não ser recarregar a página.
            const morreu = !!espera.motivo;
            return Response.json(
              {
                error:
                  espera.motivo ||
                  "A Meta ainda está processando o vídeo. Clique em publicar de novo.",
                ...(morreu ? {} : { creationId: container }),
                aindaProcessando: !morreu,
              },
              { status: 202 },
            );
          }

          const pubRes = await fetch(
            `https://graph.facebook.com/${META_VERSION}/${destino.igUserId}/media_publish`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ creation_id: container, access_token: token }),
            },
          );
          const pubData = (await pubRes.json()) as { id?: string; error?: { message: string } };
          if (!pubData.id) throw new Error(pubData.error?.message || "Falha ao publicar o reels");

          console.info(
            "[meta/publish-reels] userId=%s destino=%s id=%s",
            userId,
            destino.nome,
            pubData.id,
          );
          return Response.json({ ok: true, id: pubData.id });
        } catch (e) {
          return Response.json({ error: (e as Error)?.message || "falha" }, { status: 500 });
        }
      },
    },
  },
});
