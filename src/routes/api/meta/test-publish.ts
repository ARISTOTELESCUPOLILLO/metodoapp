import { createFileRoute } from '@tanstack/react-router';
import { getUserIdFromRequest } from '@/lib/usage.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { META_VERSION, uploadImageToMetaBucket, pollContainerStatus } from '@/lib/meta.server';

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  return r.json() as Promise<T>;
}

export const Route = createFileRoute('/api/meta/test-publish')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Guard 1: autenticado
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: 'Não autenticado' }, { status: 401 });

        // Guard 2: META_ACCESS_TOKEN presente no servidor (o token só publica na conta de quem o gerou)
        const devToken = process.env.META_ACCESS_TOKEN;
        if (!devToken) return Response.json({ error: 'META_ACCESS_TOKEN não configurado no servidor' }, { status: 403 });

        const { imageDataUrl, target, caption } = await request.json() as {
          imageDataUrl: string;
          target: 'instagram' | 'facebook';
          caption?: string;
        };

        if (!imageDataUrl) return Response.json({ error: 'imageDataUrl obrigatório' }, { status: 400 });
        if (target !== 'instagram' && target !== 'facebook')
          return Response.json({ error: 'target deve ser "instagram" ou "facebook"' }, { status: 400 });

        try {
          // Resolve páginas a partir do User Token (nunca expostos ao front)
          const pages = await getJson<{ data?: Array<{ id: string; name: string; access_token: string }> }>(
            `https://graph.facebook.com/${META_VERSION}/me/accounts?access_token=${devToken}`
          );
          const pageList = pages.data || [];
          if (pageList.length === 0)
            return Response.json({ error: 'Nenhuma página Facebook encontrada para este token' }, { status: 422 });

          const imageUrl = await uploadImageToMetaBucket(userId, imageDataUrl);

          if (target === 'instagram') {
            // Encontra página com Instagram Business Account
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
              return Response.json({ error: 'Nenhuma conta Instagram Business encontrada nas páginas deste token' }, { status: 422 });

            const createRes = await fetch(`https://graph.facebook.com/${META_VERSION}/${igUserId}/media`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image_url: imageUrl, caption: caption || '', access_token: pageToken }),
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

            console.info('[meta/test-publish] Instagram ok userId=%s post_id=%s', userId, pubData.id);
            return Response.json({ success: true, platform: 'instagram', post_id: pubData.id });
          }

          // Facebook
          const page = pageList[0];
          const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${page.id}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: imageUrl, caption: caption || '', access_token: page.access_token }),
          });
          const data = await res.json() as { id?: string; post_id?: string; error?: { message: string } };
          if (!data.id && !data.post_id) throw new Error(data.error?.message || 'Falha ao publicar no Facebook');

          console.info('[meta/test-publish] Facebook ok userId=%s post_id=%s', userId, data.post_id || data.id);
          return Response.json({ success: true, platform: 'facebook', post_id: data.post_id || data.id });

        } catch (err) {
          console.error('[meta/test-publish]', (err as Error).message);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
