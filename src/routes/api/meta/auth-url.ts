import { createFileRoute } from '@tanstack/react-router';
import { createHmac } from 'crypto';
import { getUserIdFromRequest } from '@/lib/usage.server';

export function signMetaState(userId: string, secret: string): string {
  const ts = Date.now().toString();
  const sig = createHmac('sha256', secret).update(`${userId}:${ts}`).digest('hex');
  return Buffer.from(`${userId}:${ts}:${sig}`).toString('base64url');
}

export const Route = createFileRoute('/api/meta/auth-url')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: 'Não autenticado' }, { status: 401 });

        const appId = process.env.META_APP_ID;
        const secret = process.env.META_APP_SECRET;
        const redirectUri = process.env.META_REDIRECT_URI;
        if (!appId || !secret || !redirectUri)
          return Response.json({ error: 'Variáveis META_* não configuradas' }, { status: 500 });

        const state = signMetaState(userId, secret);
        const scopes = 'pages_show_list,pages_manage_posts,instagram_basic,instagram_content_publish';

        const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
        url.searchParams.set('client_id', appId);
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('scope', scopes);
        url.searchParams.set('state', state);
        url.searchParams.set('response_type', 'code');

        return Response.json({ url: url.toString() });
      },
    },
  },
});
