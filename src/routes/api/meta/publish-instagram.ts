import { createFileRoute } from '@tanstack/react-router';
import { getUserIdFromRequest } from '@/lib/usage.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { META_VERSION, META_PUBLISH_ALLOWED_EMAILS, getEmailFromJwt, uploadImageToMetaBucket, pollContainerStatus } from '@/lib/meta.server';

export const Route = createFileRoute('/api/meta/publish-instagram')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: 'Não autenticado' }, { status: 401 });
        if (!META_PUBLISH_ALLOWED_EMAILS.includes(getEmailFromJwt(request) ?? '')) return Response.json({ error: 'Acesso não autorizado' }, { status: 403 });

        const { imageDataUrl, caption } = await request.json() as { imageDataUrl: string; caption: string };
        if (!imageDataUrl) return Response.json({ error: 'imageDataUrl obrigatório' }, { status: 400 });

        const { data: conn } = await (supabaseAdmin as any)
          .from('meta_connections')
          .select('ig_user_id, fb_page_access_token, token_expires_at')
          .eq('user_id', userId)
          .maybeSingle();

        if (!conn?.ig_user_id)
          return Response.json({ error: 'Instagram não conectado. Conecte em Conta > Redes Sociais.' }, { status: 422 });
        if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date())
          return Response.json({ error: 'Token expirado. Reconecte sua conta em Conta > Redes Sociais.' }, { status: 422 });

        try {
          const imageUrl = await uploadImageToMetaBucket(userId, imageDataUrl);
          const token = conn.fb_page_access_token;
          const igId = conn.ig_user_id;

          const createRes = await fetch(`https://graph.facebook.com/${META_VERSION}/${igId}/media`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: imageUrl, caption: caption || '', access_token: token }),
          });
          const createData = await createRes.json() as { id?: string; error?: { message: string } };
          if (!createData.id) throw new Error(createData.error?.message || 'Falha ao criar container');

          await pollContainerStatus(createData.id, token);

          const pubRes = await fetch(`https://graph.facebook.com/${META_VERSION}/${igId}/media_publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creation_id: createData.id, access_token: token }),
          });
          const pubData = await pubRes.json() as { id?: string; error?: { message: string } };
          if (!pubData.id) throw new Error(pubData.error?.message || 'Falha ao publicar');

          return Response.json({ success: true, post_id: pubData.id });
        } catch (err) {
          console.error('[meta/publish-instagram]', (err as Error).message);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
