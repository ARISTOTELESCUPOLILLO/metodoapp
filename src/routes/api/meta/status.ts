import { createFileRoute } from '@tanstack/react-router';
import { getUserIdFromRequest } from '@/lib/usage.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const Route = createFileRoute('/api/meta/status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: 'Não autenticado' }, { status: 401 });

        // devMode: admin + META_ACCESS_TOKEN presente no servidor
        const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: userId, _role: 'admin' });
        const devMode = isAdmin === true && !!process.env.META_ACCESS_TOKEN;

        const { data } = await (supabaseAdmin as any)
          .from('meta_connections')
          .select('ig_username, fb_page_name, ig_user_id, fb_page_id, token_expires_at')
          .eq('user_id', userId)
          .maybeSingle();

        if (!data) return Response.json({ connected: false, devMode });

        const expired = data.token_expires_at && new Date(data.token_expires_at) < new Date();
        return Response.json({
          connected: true,
          expired: !!expired,
          devMode,
          ig_username: data.ig_username,
          fb_page_name: data.fb_page_name,
          has_instagram: !!data.ig_user_id,
          has_facebook: !!data.fb_page_id,
          token_expires_at: data.token_expires_at,
        });
      },
    },
  },
});
