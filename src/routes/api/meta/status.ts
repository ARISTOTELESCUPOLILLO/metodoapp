import { createFileRoute } from '@tanstack/react-router';
import { getUserIdFromRequest } from '@/lib/usage.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { META_PUBLISH_ALLOWED_EMAIL, getEmailFromJwt } from '@/lib/meta.server';

export const Route = createFileRoute('/api/meta/status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ connected: false, devMode: false }, { status: 401 });
        if (getEmailFromJwt(request) !== META_PUBLISH_ALLOWED_EMAIL) return Response.json({ connected: false, devMode: false }, { status: 403 });

        // devMode: basta META_ACCESS_TOKEN estar configurado no servidor
        // O token só publica na conta de quem o gerou — é a proteção real
        const hasToken = !!process.env.META_ACCESS_TOKEN;
        const devMode = hasToken;

        // Tenta ler meta_connections — ignora erro graciosamente (tabela pode não existir ainda)
        let conn: Record<string, unknown> | null = null;
        try {
          const { data, error } = await (supabaseAdmin as any)
            .from('meta_connections')
            .select('ig_username, fb_page_name, ig_user_id, fb_page_id, token_expires_at')
            .eq('user_id', userId)
            .maybeSingle();
          if (error) {
            console.warn('[meta/status] meta_connections error:', error.message);
          } else {
            conn = data;
          }
        } catch (e) {
          console.error('[meta/status] meta_connections throw:', (e as Error).message);
        }

        if (!conn) return Response.json({ connected: false, devMode });

        const expired = conn.token_expires_at && new Date(conn.token_expires_at as string) < new Date();
        return Response.json({
          connected: true,
          expired: !!expired,
          devMode,
          ig_username: conn.ig_username,
          fb_page_name: conn.fb_page_name,
          has_instagram: !!conn.ig_user_id,
          has_facebook: !!conn.fb_page_id,
          token_expires_at: conn.token_expires_at,
        });
      },
    },
  },
});
