import { createFileRoute } from "@tanstack/react-router";
import { getUserIdFromRequest } from "@/lib/usage.server";
import {
  META_VERSION,
  resolveMetaDestino,
  getPageAccessToken,
  uploadImageToMetaBucket,
  pollContainerStatus,
} from "@/lib/meta.server";
import type { MetaDestino } from "@/lib/metaAllowlist";

async function postToInstagram(
  token: string,
  destino: MetaDestino,
  imageUrl: string,
  caption: string,
) {
  const createRes = await fetch(
    `https://graph.facebook.com/${META_VERSION}/${destino.igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
    },
  );
  const createData = (await createRes.json()) as { id?: string; error?: { message: string } };
  if (!createData.id) throw new Error(createData.error?.message || "Falha ao criar container IG");

  await pollContainerStatus(createData.id, token);

  const pubRes = await fetch(
    `https://graph.facebook.com/${META_VERSION}/${destino.igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: createData.id, access_token: token }),
    },
  );
  const pubData = (await pubRes.json()) as { id?: string; error?: { message: string } };
  if (!pubData.id) throw new Error(pubData.error?.message || "Falha ao publicar no Instagram");

  return { success: true as const, platform: "instagram" as const, post_id: pubData.id };
}

async function postToFacebook(
  token: string,
  destino: MetaDestino,
  imageUrl: string,
  caption: string,
) {
  // 1. Troca System User token por Page Access Token da Página do destino
  const pageToken = await getPageAccessToken(token, destino.pageId);

  // 2. Posta foto usando Page Token
  const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${destino.pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: imageUrl,
      message: caption,
      access_token: pageToken,
    }),
  });

  const data = (await res.json()) as { id?: string; post_id?: string; error?: { message: string } };
  if (!data.id && !data.post_id) {
    throw new Error(data.error?.message || "Falha ao publicar no Facebook");
  }

  return {
    success: true as const,
    platform: "facebook" as const,
    post_id: data.post_id || data.id!,
  };
}

export const Route = createFileRoute("/api/meta/test-publish")({
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

        const { imageDataUrl, target, caption } = (await request.json()) as {
          imageDataUrl: string;
          target: "instagram" | "facebook" | "both";
          caption?: string;
        };

        if (!imageDataUrl)
          return Response.json({ error: "imageDataUrl obrigatório" }, { status: 400 });
        if (!["instagram", "facebook", "both"].includes(target))
          return Response.json(
            { error: 'target deve ser "instagram", "facebook" ou "both"' },
            { status: 400 },
          );

        try {
          const imageUrl = await uploadImageToMetaBucket(userId, imageDataUrl);
          const cap = caption || "";

          if (target === "both") {
            const [igResult, fbResult] = await Promise.allSettled([
              postToInstagram(token, destino, imageUrl, cap),
              postToFacebook(token, destino, imageUrl, cap),
            ]);
            const instagram =
              igResult.status === "fulfilled"
                ? igResult.value
                : { error: (igResult.reason as Error)?.message };
            const facebook =
              fbResult.status === "fulfilled"
                ? fbResult.value
                : { error: (fbResult.reason as Error)?.message };
            console.info(
              "[meta/test-publish] both userId=%s destino=%s ig=%s fb=%s",
              userId,
              destino.nome,
              igResult.status,
              fbResult.status,
            );
            return Response.json({ success: true, instagram, facebook });
          }

          if (target === "instagram") {
            const result = await postToInstagram(token, destino, imageUrl, cap);
            console.info(
              "[meta/test-publish] Instagram ok userId=%s destino=%s post_id=%s",
              userId,
              destino.nome,
              result.post_id,
            );
            return Response.json(result);
          }

          const result = await postToFacebook(token, destino, imageUrl, cap);
          console.info(
            "[meta/test-publish] Facebook ok userId=%s destino=%s post_id=%s",
            userId,
            destino.nome,
            result.post_id,
          );
          return Response.json(result);
        } catch (err) {
          console.error("[meta/test-publish]", (err as Error).message);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
