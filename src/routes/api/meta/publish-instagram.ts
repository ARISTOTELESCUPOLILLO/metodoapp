import { createFileRoute } from '@tanstack/react-router';
import { getUserIdFromRequest } from '@/lib/usage.server';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const META_VERSION = 'v21.0';
const BUCKET = 'meta-publish';

async function ensureBucket() {
  const { error } = await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
  // Ignora erro se o bucket já existe
  if (error && !error.message.toLowerCase().includes('already exist')) {
    console.warn('[meta-publish] createBucket warning:', error.message);
  }
}

async function uploadImage(userId: string, dataUrl: string): Promise<string> {
  await ensureBucket();
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(base64, 'base64');
  const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: `image/${ext}`, upsert: true });
  if (error) throw new Error(`Upload falhou: ${error.message}`);
  const supabaseUrl = process.env.SUPABASE_URL!.replace(/\/$/, '');
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function pollContainer(containerId: string, token: string): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await fetch(
      `https://graph.facebook.com/${META_VERSION}/${containerId}?fields=status_code&access_token=${token}`
    );
    const d = await r.json() as { status_code?: string };
    if (d.status_code === 'FINISHED') return;
    if (d.status_code === 'ERROR') throw new Error('Meta rejeitou o container de mídia.');
  }
  throw new Error('Timeout aguardando container de mídia.');
}

export const Route = createFileRoute('/api/meta/publish-instagram')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return Response.json({ error: 'Não autenticado' }, { status: 401 });

        const { imageDataUrl, caption } = await request.json() as { imageDataUrl: string; caption: string };
        if (!imageDataUrl) return Response.json({ error: 'imageDataUrl obrigatório' }, { status: 400 });

        const { data: conn } = await (supabaseAdmin as any)
          .from('meta_connections')
          .select('ig_user_id, fb_page_access_token, token_expires_at')
          .eq('user_id', userId)
          .maybeSingle();

        if (!conn?.ig_user_id) return Response.json({ error: 'Instagram não conectado. Conecte em Conta > Redes Sociais.' }, { status: 422 });
        if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date())
          return Response.json({ error: 'Token expirado. Reconecte sua conta em Conta > Redes Sociais.' }, { status: 422 });

        try {
          const imageUrl = await uploadImage(userId, imageDataUrl);
          const token = conn.fb_page_access_token;
          const igId = conn.ig_user_id;

          // 1. Criar container de mídia
          const createRes = await fetch(
            `https://graph.facebook.com/${META_VERSION}/${igId}/media`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image_url: imageUrl, caption: caption || '', access_token: token }),
            }
          );
          const createData = await createRes.json() as { id?: string; error?: { message: string } };
          if (!createData.id) throw new Error(createData.error?.message || 'Falha ao criar container');

          // 2. Aguardar processamento
          await pollContainer(createData.id, token);

          // 3. Publicar
          const pubRes = await fetch(
            `https://graph.facebook.com/${META_VERSION}/${igId}/media_publish`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ creation_id: createData.id, access_token: token }),
            }
          );
          const pubData = await pubRes.json() as { id?: string; error?: { message: string } };
          if (!pubData.id) throw new Error(pubData.error?.message || 'Falha ao publicar');

          return Response.json({ success: true, post_id: pubData.id });
        } catch (err) {
          console.error('[meta/publish-instagram]', err);
          return Response.json({ error: (err as Error).message }, { status: 500 });
        }
      },
    },
  },
});
