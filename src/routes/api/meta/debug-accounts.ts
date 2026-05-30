import { createFileRoute } from '@tanstack/react-router';
import { getUserIdFromRequest } from '@/lib/usage.server';

const META_VERSION = 'v21.0';

export const Route = createFileRoute('/api/meta/debug-accounts')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: 'Não autenticado' }, { status: 401 });

        const devToken = process.env.META_ACCESS_TOKEN;
        if (!devToken) return Response.json({ error: 'META_ACCESS_TOKEN não configurado' }, { status: 403 });

        try {
          // 1. Verifica o token
          const meRes = await fetch(`https://graph.facebook.com/${META_VERSION}/me?fields=id,name&access_token=${devToken}`);
          const me = await meRes.json() as { id?: string; name?: string; error?: { message: string } };

          // 2. Lista páginas
          const pagesRes = await fetch(`https://graph.facebook.com/${META_VERSION}/me/accounts?access_token=${devToken}`);
          const pagesData = await pagesRes.json() as { data?: Array<{ id: string; name: string; access_token: string }>; error?: { message: string } };
          const pages = pagesData.data || [];

          // 3. Para cada página, verifica instagram_business_account
          const pageDetails = await Promise.all(pages.map(async (page) => {
            const igRes = await fetch(`https://graph.facebook.com/${META_VERSION}/${page.id}?fields=instagram_business_account,name&access_token=${page.access_token}`);
            const igData = await igRes.json() as { instagram_business_account?: { id: string }; name?: string; error?: { message: string } };
            return {
              pageId: page.id,
              pageName: page.name,
              hasInstagram: !!igData.instagram_business_account?.id,
              igUserId: igData.instagram_business_account?.id || null,
              igError: igData.error?.message || null,
            };
          }));

          return Response.json({
            tokenUser: { id: me.id, name: me.name, tokenError: me.error?.message || null },
            pagesCount: pages.length,
            pagesError: pagesData.error?.message || null,
            pages: pageDetails,
          });
        } catch (err) {
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
