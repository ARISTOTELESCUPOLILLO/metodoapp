import { createFileRoute } from '@tanstack/react-router';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

function verifyMetaState(state: string, secret: string): string | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;
    const [userId, ts, sig] = parts;
    if (Date.now() - parseInt(ts) > 15 * 60 * 1000) return null; // expira em 15 min
    const expected = createHmac('sha256', secret).update(`${userId}:${ts}`).digest('hex');
    return sig === expected ? userId : null;
  } catch {
    return null;
  }
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  return r.json() as Promise<T>;
}

export const Route = createFileRoute('/auth/meta/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const redirect = (path: string) =>
          new Response(null, { status: 302, headers: { Location: path } });

        const u = new URL(request.url);
        const code = u.searchParams.get('code');
        const state = u.searchParams.get('state');
        if (u.searchParams.get('error') || !code || !state)
          return redirect('/conta?meta_error=cancelado');

        const appId = process.env.META_APP_ID;
        const secret = process.env.META_APP_SECRET;
        const redirectUri = process.env.META_REDIRECT_URI;
        if (!appId || !secret || !redirectUri) return redirect('/conta?meta_error=config');

        const userId = verifyMetaState(state, secret);
        if (!userId) return redirect('/conta?meta_error=estado_invalido');

        try {
          // 1. Código → token curto
          const tok = await getJson<{ access_token?: string; error?: unknown }>(
            `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&client_secret=${secret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`
          );
          if (!tok.access_token) return redirect('/conta?meta_error=token');

          // 2. Token curto → token longo (60 dias)
          const ll = await getJson<{ access_token?: string; expires_in?: number }>(
            `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${secret}&fb_exchange_token=${tok.access_token}`
          );
          const longToken = ll.access_token || tok.access_token;
          const expiresAt = ll.expires_in
            ? new Date(Date.now() + ll.expires_in * 1000).toISOString()
            : null;

          // 3. Páginas do Facebook
          const pages = await getJson<{ data?: Array<{ id: string; name: string; access_token: string }> }>(
            `https://graph.facebook.com/v21.0/me/accounts?access_token=${longToken}`
          );
          const pageList = pages.data || [];

          let fbPageId: string | null = null;
          let fbPageName: string | null = null;
          let fbPageToken: string | null = null;
          let igUserId: string | null = null;
          let igUsername: string | null = null;

          // 4. Encontra a primeira página com conta do Instagram Business
          for (const page of pageList) {
            const ig = await getJson<{ instagram_business_account?: { id: string } }>(
              `https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`
            );
            if (ig.instagram_business_account?.id) {
              fbPageId = page.id;
              fbPageName = page.name;
              fbPageToken = page.access_token;
              igUserId = ig.instagram_business_account.id;
              const igUser = await getJson<{ username?: string }>(
                `https://graph.facebook.com/v21.0/${igUserId}?fields=username&access_token=${page.access_token}`
              );
              igUsername = igUser.username || null;
              break;
            }
          }

          // Se nenhuma página tem Instagram, pega a primeira para Facebook apenas
          if (!fbPageId && pageList.length > 0) {
            fbPageId = pageList[0].id;
            fbPageName = pageList[0].name;
            fbPageToken = pageList[0].access_token;
          }

          // 5. Salva / atualiza no Supabase
          const { error: dbErr } = await (supabaseAdmin as any)
            .from('meta_connections')
            .upsert(
              {
                user_id: userId,
                ig_user_id: igUserId,
                ig_username: igUsername,
                fb_page_id: fbPageId,
                fb_page_name: fbPageName,
                fb_page_access_token: fbPageToken,
                user_access_token: longToken,
                long_lived_token: longToken,
                token_expires_at: expiresAt,
                scopes: 'pages_show_list,pages_manage_posts,instagram_basic,instagram_content_publish',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id' }
            );

          if (dbErr) {
            console.error('[Meta callback] DB error:', dbErr);
            return redirect('/conta?meta_error=db');
          }

          return redirect('/conta?meta_connected=1');
        } catch (err) {
          console.error('[Meta callback] Erro:', err);
          return redirect('/conta?meta_error=servidor');
        }
      },
    },
  },
  component: () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <p>Conectando à Meta…</p>
    </div>
  ),
});
