import { createFileRoute } from '@tanstack/react-router';
import { getUserIdFromRequest } from '@/lib/usage.server';
import { META_VERSION, META_PUBLISH_ALLOWED_EMAILS, getEmailFromJwt, uploadImageToMetaBucket, pollContainerStatus } from '@/lib/meta.server';

// IDs fixos da OPropaganda — não mudam
const IG_USER_ID = '17841403020053112';
const PAGE_ID    = '144773495865295';

async function postToInstagram(token: string, imageUrl: string, caption: string) {
  const createRes = await fetch(`https://graph.facebook.com/${META_VERSION}/${IG_USER_ID}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
  });
  const createData = await createRes.json() as { id?: string; error?: { message: string } };
  if (!createData.id) throw new Error(createData.error?.message || 'Falha ao criar container IG');

  await pollContainerStatus(createData.id, token);

  const pubRes = await fetch(`https://graph.facebook.com/${META_VERSION}/${IG_USER_ID}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: createData.id, access_token: token }),
  });
  const pubData = await pubRes.json() as { id?: string; error?: { message: string } };
  if (!pubData.id) throw new Error(pubData.error?.message || 'Falha ao publicar no Instagram');

  return { success: true as const, platform: 'instagram' as const, post_id: pubData.id };
}

async function postToFacebook(token: string, imageUrl: string, caption: string) {
  // 1. Troca System User token por Page Access Token
  const pageTokenRes = await fetch(
    `https://graph.facebook.com/${META_VERSION}/${PAGE_ID}?fields=access_token&access_token=${token}`
  );
  const pageTokenData = await pageTokenRes.json() as { access_token?: string; error?: { message: string } };

  if (!pageTokenData.access_token) {
    throw new Error(pageTokenData.error?.message || 'Falha ao obter Page Access Token');
  }

  // 2. Posta foto usando Page Token
  const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${PAGE_ID}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: imageUrl,
      message: caption,
      access_token: pageTokenData.access_token
    }),
  });

  const data = await res.json() as { id?: string; post_id?: string; error?: { message: string } };
  if (!data.id && !data.post_id) {
    throw new Error(data.error?.message || 'Falha ao publicar no Facebook');
  }

  return { success: true as const, platform: 'facebook' as const, post_id: data.post_id || data.id! };
}

export const Route = createFileRoute('/api/meta/test-publish')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: 'Não autenticado' }, { status: 401 });
        if (!META_PUBLISH_ALLOWED_EMAILS.includes(getEmailFromJwt(request) ?? '')) return Response.json({ error: 'Acesso não autorizado' }, { status: 403 });

        const token = process.env.META_ACCESS_TOKEN;
        if (!token) return Response.json({ error: 'META_ACCESS_TOKEN não configurado no servidor' }, { status: 403 });

        const { imageDataUrl, target, caption } = await request.json() as {
          imageDataUrl: string;
          target: 'instagram' | 'facebook' | 'both';
          caption?: string;
        };

        if (!imageDataUrl) return Response.json({ error: 'imageDataUrl obrigatório' }, { status: 400 });
        if (!['instagram', 'facebook', 'both'].includes(target))
          return Response.json({ error: 'target deve ser "instagram", "facebook" ou "both"' }, { status: 400 });

        try {
          const imageUrl = await uploadImageToMetaBucket(userId, imageDataUrl);
          const cap = caption || '';

          if (target === 'both') {
            const [igResult, fbResult] = await Promise.allSettled([
              postToInstagram(token, imageUrl, cap),
              postToFacebook(token, imageUrl, cap),
            ]);
            const instagram = igResult.status === 'fulfilled' ? igResult.value : { error: (igResult.reason as Error)?.message };
            const facebook  = fbResult.status === 'fulfilled'  ? fbResult.value  : { error: (fbResult.reason as Error)?.message };
            console.info('[meta/test-publish] both userId=%s ig=%s fb=%s', userId, igResult.status, fbResult.status);
            return Response.json({ success: true, instagram, facebook });
          }

          if (target === 'instagram') {
            const result = await postToInstagram(token, imageUrl, cap);
            console.info('[meta/test-publish] Instagram ok userId=%s post_id=%s', userId, result.post_id);
            return Response.json(result);
          }

          const result = await postToFacebook(token, imageUrl, cap);
          console.info('[meta/test-publish] Facebook ok userId=%s post_id=%s', userId, result.post_id);
          return Response.json(result);

        } catch (err) {
          console.error('[meta/test-publish]', (err as Error).message);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
