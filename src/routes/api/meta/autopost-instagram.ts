import { createFileRoute } from "@tanstack/react-router";
import { META_VERSION, pollContainerStatus } from "@/lib/meta.server";
import { getUserIdFromRequest } from "@/lib/usage.server";
import { isAdmin } from "@/repository/authz";

export const Route = createFileRoute("/api/meta/autopost-instagram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Publica no Instagram DA AGÊNCIA com o token de sistema — só admin.
        // Auditoria 14/09/2026: a rota não tinha autenticação nenhuma, e
        // qualquer POST anônimo publicava no perfil. O app não chama esta rota
        // (os botões usam publish-instagram, com login e conexão do usuário).
        const userId = await getUserIdFromRequest(request);
        if (!userId)
          return Response.json({ success: false, error: "Não autenticado" }, { status: 401 });
        if (!(await isAdmin(userId)))
          return Response.json({ success: false, error: "Acesso negado" }, { status: 403 });

        const token = process.env.ACCESS_TOKEN;
        const igId = process.env.IG_BUSINESS_ID;

        if (!token)
          return Response.json(
            { success: false, error: "ACCESS_TOKEN não configurado" },
            { status: 403 },
          );
        if (!igId)
          return Response.json(
            { success: false, error: "IG_BUSINESS_ID não configurado" },
            { status: 403 },
          );

        const { image_url, caption, hashtags } = (await request.json()) as {
          image_url: string;
          caption: string;
          hashtags?: string;
        };

        if (!image_url || !caption) {
          return Response.json(
            { success: false, error: "image_url e caption são obrigatórios" },
            { status: 400 },
          );
        }

        const fullCaption = hashtags ? `${caption}\n\n${hashtags}` : caption;

        try {
          const createRes = await fetch(
            `https://graph.facebook.com/${META_VERSION}/${igId}/media`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image_url, caption: fullCaption, access_token: token }),
            },
          );
          const createData = (await createRes.json()) as {
            id?: string;
            error?: { message: string };
          };
          if (!createData.id)
            throw new Error(createData.error?.message || "Falha ao criar container IG");

          await pollContainerStatus(createData.id, token);

          const pubRes = await fetch(
            `https://graph.facebook.com/${META_VERSION}/${igId}/media_publish`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ creation_id: createData.id, access_token: token }),
            },
          );
          const pubData = (await pubRes.json()) as { id?: string; error?: { message: string } };
          if (!pubData.id)
            throw new Error(pubData.error?.message || "Falha ao publicar no Instagram");

          return Response.json({ success: true, platform: "instagram", post_id: pubData.id });
        } catch (err) {
          return Response.json({ success: false, error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
