import { supabaseAdmin } from '@/integrations/supabase/client.server';

export const META_VERSION = 'v25.0';
export const META_BUCKET = 'meta-publish';

export async function ensureMetaBucket(): Promise<void> {
  const { error } = await supabaseAdmin.storage.createBucket(META_BUCKET, { public: true });
  if (error && !error.message.toLowerCase().includes('already exist')) {
    console.warn('[meta] createBucket warning:', error.message);
  }
}

export async function uploadImageToMetaBucket(userId: string, dataUrl: string): Promise<string> {
  if (dataUrl.startsWith('https://')) return dataUrl;
  await ensureMetaBucket();
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(base64, 'base64');
  const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(META_BUCKET)
    .upload(path, buf, { contentType: `image/${ext}`, upsert: true });
  if (error) throw new Error(`Upload falhou: ${error.message}`);
  const supabaseUrl = process.env.SUPABASE_URL!.replace(/\/$/, '');
  return `${supabaseUrl}/storage/v1/object/public/${META_BUCKET}/${path}`;
}

export async function pollContainerStatus(containerId: string, token: string): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await fetch(
      `https://graph.facebook.com/${META_VERSION}/${containerId}?fields=status_code&access_token=${token}`
    );
    const d = await r.json() as { status_code?: string };
    if (d.status_code === 'FINISHED') return;
    if (d.status_code === 'ERROR') throw new Error('Meta rejeitou o container de mídia.');
  }
  throw new Error('Timeout aguardando container de mídia (24 s).');
}
