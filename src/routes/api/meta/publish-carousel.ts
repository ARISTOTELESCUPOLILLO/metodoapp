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

// Carrossel nativo: um post único com N imagens na ordem gerada, com a legenda
// do carrossel. Diferente de test-publish.ts, que publica UMA foto por chamada.
// Instagram aceita de 2 a 10 itens por carrossel.
const MIN_ITENS = 2;
const MAX_ITENS = 10;

// Instagram — 3 etapas: containers filhos, container pai CAROUSEL, publicação.
// A legenda vai só no container pai (os filhos não levam caption).
async function postCarouselToInstagram(
  token: string,
  destino: MetaDestino,
  imageUrls: string[],
  caption: string,
) {
  // Filhos em paralelo: são containers de imagem, ficam prontos rápido, e em
  // série a espera somaria demais com 5 cards.
  const childIds = await Promise.all(
    imageUrls.map(async (imageUrl, i) => {
      const res = await fetch(
        `https://graph.facebook.com/${META_VERSION}/${destino.igUserId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: imageUrl,
            is_carousel_item: true,
            access_token: token,
          }),
        },
      );
      const data = (await res.json()) as { id?: string; error?: { message: string } };
      if (!data.id) {
        throw new Error(data.error?.message || `Falha ao criar o card ${i + 1} do carrossel`);
      }
      return data.id;
    }),
  );

  const parentRes = await fetch(
    `https://graph.facebook.com/${META_VERSION}/${destino.igUserId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption,
        access_token: token,
      }),
    },
  );
  const parent = (await parentRes.json()) as { id?: string; error?: { message: string } };
  if (!parent.id) throw new Error(parent.error?.message || "Falha ao montar o carrossel");

  await pollContainerStatus(parent.id, token);

  const pubRes = await fetch(
    `https://graph.facebook.com/${META_VERSION}/${destino.igUserId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: parent.id, access_token: token }),
    },
  );
  const pub = (await pubRes.json()) as { id?: string; error?: { message: string } };
  if (!pub.id) throw new Error(pub.error?.message || "Falha ao publicar o carrossel no Instagram");

  return { success: true as const, platform: "instagram" as const, post_id: pub.id };
}

// Facebook — não existe "carrossel" orgânico de página: o equivalente é um post
// único com várias fotos. Sobe cada foto como published=false e depois anexa
// todas ao post via attached_media, preservando a ordem.
async function postCarouselToFacebook(
  token: string,
  destino: MetaDestino,
  imageUrls: string[],
  caption: string,
) {
  const pageToken = await getPageAccessToken(token, destino.pageId);

  const mediaFbids = await Promise.all(
    imageUrls.map(async (url, i) => {
      const res = await fetch(
        `https://graph.facebook.com/${META_VERSION}/${destino.pageId}/photos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, published: false, access_token: pageToken }),
        },
      );
      const data = (await res.json()) as { id?: string; error?: { message: string } };
      if (!data.id) {
        throw new Error(data.error?.message || `Falha ao subir a foto ${i + 1} do carrossel`);
      }
      return data.id;
    }),
  );

  const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${destino.pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: caption,
      attached_media: mediaFbids.map((media_fbid) => ({ media_fbid })),
      access_token: pageToken,
    }),
  });
  const data = (await res.json()) as { id?: string; error?: { message: string } };
  if (!data.id) throw new Error(data.error?.message || "Falha ao publicar o carrossel no Facebook");

  return { success: true as const, platform: "facebook" as const, post_id: data.id };
}

export const Route = createFileRoute("/api/meta/publish-carousel")({
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

        const { imageDataUrls, target, caption } = (await request.json()) as {
          imageDataUrls: string[];
          target: "instagram" | "facebook" | "both";
          caption?: string;
        };

        if (!Array.isArray(imageDataUrls) || imageDataUrls.length < MIN_ITENS)
          return Response.json(
            { error: `Um carrossel precisa de pelo menos ${MIN_ITENS} imagens` },
            { status: 400 },
          );
        if (imageDataUrls.length > MAX_ITENS)
          return Response.json(
            { error: `O Instagram aceita no máximo ${MAX_ITENS} imagens por carrossel` },
            { status: 400 },
          );
        if (!["instagram", "facebook", "both"].includes(target))
          return Response.json(
            { error: 'target deve ser "instagram", "facebook" ou "both"' },
            { status: 400 },
          );

        try {
          // Sobe as imagens preservando a ordem dos cards — é ela que define a
          // ordem de leitura do carrossel.
          const imageUrls = await Promise.all(
            imageDataUrls.map((d) => uploadImageToMetaBucket(userId, d)),
          );
          const cap = caption || "";

          if (target === "both") {
            const [igResult, fbResult] = await Promise.allSettled([
              postCarouselToInstagram(token, destino, imageUrls, cap),
              postCarouselToFacebook(token, destino, imageUrls, cap),
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
              "[meta/publish-carousel] both userId=%s destino=%s cards=%d ig=%s fb=%s",
              userId,
              destino.nome,
              imageUrls.length,
              igResult.status,
              fbResult.status,
            );
            return Response.json({ success: true, instagram, facebook });
          }

          const result =
            target === "instagram"
              ? await postCarouselToInstagram(token, destino, imageUrls, cap)
              : await postCarouselToFacebook(token, destino, imageUrls, cap);
          console.info(
            "[meta/publish-carousel] %s ok userId=%s destino=%s cards=%d post_id=%s",
            target,
            userId,
            destino.nome,
            imageUrls.length,
            result.post_id,
          );
          return Response.json(result);
        } catch (err) {
          console.error("[meta/publish-carousel]", (err as Error).message);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
