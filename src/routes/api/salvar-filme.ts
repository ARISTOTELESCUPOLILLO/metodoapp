import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/usage.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Teto do arquivo aceito — o mesmo do arquivamento, por coerência. */
const MAX_BYTES = 25 * 1024 * 1024;

/** O mesmo balde PRIVADO onde o Histórico guarda as peças. */
const BUCKET = "user-assets";

/** Validade do endereço: folga larga para publicar e arquivar sem correria. */
const VALIDADE_S = 60 * 60 * 24;

/**
 * DÁ UM ENDEREÇO AO FILME MONTADO.
 *
 * ⚠ POR QUE É A BASE DE TUDO (11/09/2026): a montagem roda no navegador e o
 * resultado é um arquivo local. Local não serve para NADA fora da aba — nem para
 * o Histórico, que arquiva baixando de um endereço, nem para a Meta, que BUSCA o
 * vídeo num endereço para publicar. Enquanto o filme só existisse no navegador,
 * o Histórico guardava a versão CRUA (sem capa, sem legenda, sem assinatura) e
 * publicar era impossível.
 *
 * ⚠ BALDE PRIVADO, ENDEREÇO ASSINADO. A Meta baixa um endereço assinado como
 * qualquer outro, e o arquivamento também. Balde público transformaria esta rota
 * em hospedagem grátis e permanente: qualquer conta autenticada poderia deixar
 * 25 MB por clique num endereço eterno sob o domínio do projeto.
 *
 * ⚠ Recebe os BYTES CRUS no corpo, não base64: o filme tem ~6 MB e base64
 * inflaria para ~8 MB de texto à toa.
 */
export const Route = createFileRoute("/api/salvar-filme")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request);
          if (!userId) return Response.json({ error: "Não autenticado" }, { status: 401 });

          // Confere o tamanho ANTES de ler o corpo: sem isso um envio de 200 MB
          // seria carregado inteiro na memória só para ser recusado depois.
          const anunciado = Number(request.headers.get("content-length") || 0);
          if (anunciado > MAX_BYTES) {
            return Response.json(
              { error: `Filme grande demais (${(anunciado / 1048576).toFixed(1)} MB > 25 MB).` },
              { status: 413 },
            );
          }

          const bytes = new Uint8Array(await request.arrayBuffer());
          if (!bytes.byteLength) return Response.json({ error: "Arquivo vazio" }, { status: 400 });
          if (bytes.byteLength > MAX_BYTES) {
            return Response.json(
              {
                error: `Filme grande demais (${(bytes.byteLength / 1048576).toFixed(1)} MB > 25 MB).`,
              },
              { status: 413 },
            );
          }
          // Confere que é mesmo um MP4: os bytes 4..8 de um MP4 são "ftyp".
          const assinatura = String.fromCharCode(...bytes.slice(4, 8));
          if (assinatura !== "ftyp") {
            return Response.json({ error: "O arquivo não é um MP4." }, { status: 400 });
          }

          const path = `${userId}/filmes/${Date.now()}.mp4`;
          const { error } = await supabaseAdmin.storage
            .from(BUCKET)
            .upload(path, bytes, { contentType: "video/mp4", upsert: true });
          if (error) throw new Error(error.message);

          const { data, error: eAssinatura } = await supabaseAdmin.storage
            .from(BUCKET)
            .createSignedUrl(path, VALIDADE_S);
          if (!data?.signedUrl) throw new Error(eAssinatura?.message || "falha ao assinar");

          return Response.json({ url: data.signedUrl, bytes: bytes.byteLength });
        } catch (e) {
          return Response.json({ error: (e as Error)?.message || "falha" }, { status: 500 });
        }
      },
    },
  },
});
