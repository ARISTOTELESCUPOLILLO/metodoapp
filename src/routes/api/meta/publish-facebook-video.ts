import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/usage.server";
import { META_VERSION, resolveMetaDestino, getPageAccessToken } from "@/lib/meta.server";

/**
 * PUBLICA O FILME NA PÁGINA DO FACEBOOK.
 *
 * ⚠ ESCOLHA DELIBERADA: publica como VÍDEO da página (`/videos`), não como Reels
 * do Facebook. O Reels do FB exige um envio em três etapas com sessão de upload
 * — mais peças para quebrar, e o ganho é de posicionamento, não de alcance
 * garantido. O vídeo da página aceita `file_url` numa chamada só, e a Meta busca
 * o arquivo sozinha, exatamente como já fazemos com foto.
 *
 * ⚠ O TEXTO VAI EM `description`. No `/photos` o campo é `message`, e usar o
 * errado faz o Graph aceitar a chamada e publicar SEM TEXTO — defeito real já
 * vivido neste projeto em 27/07/2026, no caminho da foto. Aqui o campo certo é
 * `description`; `message` seria silenciosamente ignorado.
 *
 * ⚠ TOKEN: System User da BM trocado por Page Access Token, igual à foto em
 * test-publish.ts. A tabela `meta_connections` (OAuth por cliente) nunca entrou
 * no ar e não serve de fonte aqui.
 */
export const Route = createFileRoute("/api/meta/publish-facebook-video")({
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

        const { videoUrl, text, titulo } = (await request.json()) as {
          videoUrl?: string;
          text?: string;
          titulo?: string;
        };
        if (!videoUrl) return Response.json({ error: "videoUrl obrigatório" }, { status: 400 });

        try {
          const pageToken = await getPageAccessToken(token, destino.pageId);
          const res = await fetch(
            `https://graph.facebook.com/${META_VERSION}/${destino.pageId}/videos`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                file_url: videoUrl,
                description: text || "",
                ...(titulo ? { title: titulo } : {}),
                access_token: pageToken,
              }),
            },
          );
          const data = (await res.json()) as { id?: string; error?: { message: string } };
          if (!data.id) throw new Error(data.error?.message || "Falha ao publicar no Facebook");
          console.info(
            "[meta/publish-facebook-video] userId=%s destino=%s id=%s",
            userId,
            destino.nome,
            data.id,
          );
          return Response.json({ ok: true, id: data.id });
        } catch (e) {
          return Response.json({ error: (e as Error)?.message || "falha" }, { status: 500 });
        }
      },
    },
  },
});
