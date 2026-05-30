import { createFileRoute } from '@tanstack/react-router';
import { getUserIdFromRequest } from '@/lib/usage.server';
import { META_VERSION, uploadImageToMetaBucket, pollContainerStatus } from '@/lib/meta.server';

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  return r.json() as Promise<T>;
}

type PageEntry = { id: string; name: string; access_token: string };

async function resolvePages(devToken: string): Promise<PageEntry[]> {
  const pagesRes = await getJson<{ data?: PageEntry[] }>(
    `https://graph.facebook.com/${META_VERSION}/me/accounts?access_token=${devToken}`
  );
  let pageList = pagesRes.data || [];

  if (pageList.length === 0) {
    const pageCheck = await getJson<{ id?: string; name?: string; instagram_business_account?: { id: string }; error?: { code?: number; message: string } }>(
      `https://graph.facebook.com/${META_VERSION}/me?fields=id,name,instagram_business_account&access_token=${devToken}`
    );
    const isPersonalProfile = pageCheck.error?.message?.includes('nonexisting field') || pageCheck.error?.code === 100;
    if (isPersonalProfile || !pageCheck.id)
      throw new Error('Nenhuma Página do Facebook encontrada para este token. Gere um User Token com pages_show_list e selecione a Página correta, depois copie o Page Access Token da Página.');
    pageList = [{ id: pageCheck.id, name: pageCheck.name || '', access_token: devToken }];
  }

  return pageList;
}

async function postToInstagram(pageList: PageEntry[], imageUrl: string, caption: string) {
  let igUserId: string | null = null;
  let pageToken: string | null = null;

  for (const page of pageList) {
    const ig = await getJson<{ instagram_business_account?: { id: string } }>(
      `https://graph.facebook.com/${META_VERSION}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
    );
    if (ig.instagram_business_account?.id) {
      igUserId = ig.instagram_business_account.id;
      pageToken = page.access_token;
      break;
    }
  }

  if (!igUserId || !pageToken)
    throw new Error('Página encontrada mas sem Instagram Business conectado. Conecte o Instagram à página no Meta Business Suite.');

  const createRes = await fetch(`https://graph.facebook.com/${META_VERSION}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: pageToken }),
  });
  const createData = await createRes.json() as { id?: string; error?: { message: string } };
  if (!createData.id) throw new Error(createData.error?.message || 'Falha ao criar container IG');

  await pollContainerStatus(createData.id, pageToken);

  const pubRes = await fetch(`https://graph.facebook.com/${META_VERSION}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: createData.id, access_token: pageToken }),
  });
  const pubData = await pubRes.json() as { id?: string; error?: { message: string } };
  if (!pubData.id) throw new Error(pubData.error?.message || 'Falha ao publicar no Instagram');

  return { success: true as const, platform: 'instagram' as const, post_id: pubData.id };
}

async function postToFacebook(pageList: PageEntry[], imageUrl: string, caption: string) {
  const page = pageList[0];
  const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${page.id}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: imageUrl, caption, access_token: page.access_token }),
  });
  const data = await res.json() as { id?: string; post_id?: string; error?: { message: string } };
  if (!data.id && !data.post_id) throw new Error(data.error?.message || 'Falha ao publicar no Facebook');

  return { success: true as const, platform: 'facebook' as const, post_id: data.post_id || data.id! };
}

export const Route = createFileRoute('/api/meta/test-publish')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: 'Não autenticado' }, { status: 401 });

        const devToken = process.env.META_ACCESS_TOKEN;
        if (!devToken) return Response.json({ error: 'META_ACCESS_TOKEN não configurado no servidor' }, { status: 403 });

        const { imageDataUrl, target, caption } = await request.json() as {
          imageDataUrl: string;
          target: 'instagram' | 'facebook' | 'both';
          caption?: string;
        };

        if (!imageDataUrl) return Response.json({ error: 'imageDataUrl obrigatório' }, { status: 400 });
        if (!['instagram', 'facebook', 'both'].includes(target))
          return Response.json({ error: 'target deve ser "instagram", "facebook" ou "both"' }, { status: 400 });

        try {
          const pageList = await resolvePages(devToken);
          const imageUrl = await uploadImageToMetaBucket(userId, imageDataUrl);
          const cap = caption || '';

          if (target === 'both') {
            const [igResult, fbResult] = await Promise.allSettled([
              postToInstagram(pageList, imageUrl, cap),
              postToFacebook(pageList, imageUrl, cap),
            ]);
            const instagram = igResult.status === 'fulfilled' ? igResult.value : { error: (igResult.reason as Error)?.message };
            const facebook  = fbResult.status === 'fulfilled'  ? fbResult.value  : { error: (fbResult.reason as Error)?.message };
            console.info('[meta/test-publish] both userId=%s ig=%s fb=%s', userId, igResult.status, fbResult.status);
            return Response.json({ success: true, instagram, facebook });
          }

          if (target === 'instagram') {
            const result = await postToInstagram(pageList, imageUrl, cap);
            console.info('[meta/test-publish] Instagram ok userId=%s post_id=%s', userId, result.post_id);
            return Response.json(result);
          }

          const result = await postToFacebook(pageList, imageUrl, cap);
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
