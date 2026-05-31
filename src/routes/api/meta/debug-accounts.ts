import { createFileRoute } from '@tanstack/react-router';
import { getUserIdFromRequest } from '@/lib/usage.server';

const META_VERSION = 'v25.0';

// IDs fixos da OPropaganda
const IG_USER_ID = '17841403020053112';
const PAGE_ID    = '144773495865295';

export const Route = createFileRoute('/api/meta/debug-accounts')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: 'Não autenticado' }, { status: 401 });

        const devToken = process.env.META_ACCESS_TOKEN;
        if (!devToken) return Response.json({ error: 'META_ACCESS_TOKEN não configurado' }, { status: 403 });

        try {
          // Testa o token diretamente contra os IDs conhecidos (Page Access Token)
          const [pageRes, igRes] = await Promise.all([
            fetch(`https://graph.facebook.com/${META_VERSION}/${PAGE_ID}?fields=id,name&access_token=${devToken}`),
            fetch(`https://graph.facebook.com/${META_VERSION}/${IG_USER_ID}?fields=id,username&access_token=${devToken}`),
          ]);

          const page = await pageRes.json() as { id?: string; name?: string; error?: { code?: number; message: string } };
          const ig   = await igRes.json()   as { id?: string; username?: string; error?: { code?: number; message: string } };

          return Response.json({
            tokenType: 'PAGE_ACCESS_TOKEN',
            pageId: PAGE_ID,
            pageName: page.name || null,
            pageOk: !!page.id && !page.error,
            pageError: page.error?.message || null,
            igUserId: IG_USER_ID,
            igUsername: ig.username || null,
            igOk: !!ig.id && !ig.error,
            igError: ig.error?.message || null,
          });
        } catch (err) {
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
