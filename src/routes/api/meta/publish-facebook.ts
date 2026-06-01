import { createFileRoute } from '@tanstack/react-router';
import { getUserIdFromRequest } from '@/lib/usage.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { META_VERSION, META_PUBLISH_ALLOWED_EMAIL, getEmailFromJwt, uploadImageToMetaBucket } from '@/lib/meta.server';

export const Route = createFileRoute('/api/meta/publish-facebook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: 'Não autenticado' }, { status: 401 });
        if (getEmailFromJwt(request) !== META_PUBLISH_ALLOWED_EMAIL) return Response.json({ error: 'Acesso não autorizado' }, { status: 403 });

        const { imageDataUrl, text } = await request.json() as { imageDataUrl: string; text: string };
        if (!imageDataUrl) return Response.json({ error: 'imageDataUrl obrigatório' }, { status: 400 });

        const { data: conn } = await (supabaseAdmin as any)
          .from('meta_connections')
          .select('fb_page_id, fb_page_access_token, token_expires_at')
          .eq('user_id', userId)
          .maybeSingle();

        if (!conn?.fb_page_id)
          return Response.json({ error: 'Facebook não conectado. Conecte em Conta > Redes Sociais.' }, { status: 422 });
        if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date())
          return Response.json({ error: 'Token expirado. Reconecte sua conta em Conta > Redes Sociais.' }, { status: 422 });

        try {
          const imageUrl = await uploadImageToMetaBucket(userId, imageDataUrl);
          const token = conn.fb_page_access_token;
          const pageId = conn.fb_page_id;

          const res = await fetch(`https://graph.facebook.com/${META_VERSION}/${pageId}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: imageUrl, caption: text || '', access_token: token }),
          });
          const data = await res.json() as { id?: string; post_id?: string; error?: { message: string } };
          if (!data.id && !data.post_id) throw new Error(data.error?.message || 'Falha ao publicar no Facebook');

          return Response.json({ success: true, post_id: data.post_id || data.id });
        } catch (err) {
          console.error('[meta/publish-facebook]', (err as Error).message);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
