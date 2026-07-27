import { createFileRoute } from "@tanstack/react-router";
import { META_VERSION } from "@/lib/meta.server";

export const Route = createFileRoute("/api/meta/autopost-facebook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const systemToken = process.env.ACCESS_TOKEN;
        const pageId = "144773495865295";

        if (!systemToken)
          return Response.json(
            { success: false, error: "ACCESS_TOKEN não configurado" },
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
          const pageTokenRes = await fetch(
            `https://graph.facebook.com/${META_VERSION}/${pageId}?fields=access_token&access_token=${systemToken}`,
          );
          const pageTokenData = (await pageTokenRes.json()) as {
            access_token?: string;
            error?: { message: string };
          };
          if (!pageTokenData.access_token)
            throw new Error(pageTokenData.error?.message || "Falha ao obter Page Access Token");

          const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${pageId}/photos`, {
            method: "POST",
            body: new URLSearchParams({
              access_token: pageTokenData.access_token,
              url: image_url,
              // `message`, não `caption` — ver publish-facebook.ts.
              message: fullCaption,
              published: "true",
            }),
          });
          const data = (await res.json()) as {
            id?: string;
            post_id?: string;
            error?: { message: string };
          };
          if (!data.id && !data.post_id)
            throw new Error(data.error?.message || "Falha ao publicar no Facebook");

          return Response.json({
            success: true,
            platform: "facebook",
            post_id: data.post_id || data.id,
          });
        } catch (err) {
          return Response.json({ success: false, error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
