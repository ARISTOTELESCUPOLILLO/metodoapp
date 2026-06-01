import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const BUCKET = 'user-assets';
const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25 MB

const FormatoEnum = z.enum(['estatico', 'carrossel', 'estatico_final', 'reels']);

const SaveSchema = z.object({
  tipo: z.enum(['S3V', 'PU']),
  slot: z.enum(['plano1', 'plano2', 'bonus']),
  formato: FormatoEnum,
  dia: z.number().int().min(1).max(30).optional(),
  legenda: z.string().max(4000).default(''),
  titulo: z.string().max(200).default(''),
  images: z
    .array(
      z.object({
        base64: z.string().min(10),
        ordem: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(10),
  videoUrl: z.string().url().optional(),
  asUserId: z.string().uuid().optional(),
});

async function resolveTargetUserId(
  callerId: string,
  asUserId: string | undefined,
): Promise<string> {
  if (!asUserId || asUserId === callerId) return callerId;
  const { data: isAdmin } = await supabaseAdmin.rpc('has_role' as never, {
    _user_id: callerId,
    _role: 'admin',
  } as never);
  if (!isAdmin) throw new Error('Forbidden: somente admin pode atuar como outro usuário');
  return asUserId;
}

export const saveGeneration = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => SaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const targetUserId = await resolveTargetUserId(context.userId, data.asUserId);

    // 1. Eviction (3 por user/slot/tipo/formato)
    const { data: toEvict, error: evictErr } = await supabaseAdmin.rpc(
      'list_generations_to_evict' as never,
      {
        _user_id: targetUserId,
        _slot: data.slot,
        _tipo: data.tipo,
        _formato: data.formato,
      } as never,
    );
    if (evictErr) throw new Error('Falha ao verificar limite: ' + evictErr.message);

    const evictedIds: string[] = (toEvict as { id?: string }[] | string[] | null || [])
      .map((row) => (typeof row === 'string' ? row : row?.id || '')) as string[];

    let evictedCount = 0;
    for (const id of evictedIds.filter(Boolean)) {
      await deleteGenerationInternal(id, targetUserId, true);
      evictedCount += 1;
    }

    // 2. Cria a geração
    const { data: gen, error: insErr } = await supabaseAdmin
      .from('user_generations')
      .insert({
        user_id: targetUserId,
        tipo: data.tipo,
        slot: data.slot,
        formato: data.formato,
        dia: data.dia ?? null,
        legenda: data.legenda || '',
        titulo: data.titulo || '',
      })
      .select('id, created_at, expires_at')
      .single();
    if (insErr || !gen) throw new Error('Falha ao criar geração: ' + (insErr?.message || ''));

    // 3. Upload de imagens WebP
    const assetRows: {
      generation_id: string;
      user_id: string;
      ordem: number;
      storage_path: string;
      bytes: number;
    }[] = [];
    for (const img of data.images) {
      const bytes = Buffer.from(img.base64, 'base64');
      const path = `${targetUserId}/${gen.id}/img-${String(img.ordem).padStart(2, '0')}.webp`;
      const { error: upErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: 'image/webp', upsert: true });
      if (upErr) throw new Error('Falha ao subir imagem: ' + upErr.message);
      assetRows.push({
        generation_id: gen.id,
        user_id: targetUserId,
        ordem: img.ordem,
        storage_path: path,
        bytes: bytes.length,
      });
    }
    if (assetRows.length) {
      const { error: aErr } = await supabaseAdmin.from('user_assets').insert(assetRows);
      if (aErr) throw new Error('Falha ao registrar assets: ' + aErr.message);
    }

    // 4. Vídeo (reels)
    let videoPath: string | null = null;
    if (data.videoUrl) {
      try {
        const head = await fetch(data.videoUrl, { method: 'HEAD' });
        const lenHeader = head.headers.get('content-length');
        const len = lenHeader ? Number(lenHeader) : 0;
        if (len && len > MAX_VIDEO_BYTES) {
          throw new Error(`Vídeo grande demais para arquivar (${(len / 1024 / 1024).toFixed(1)} MB > 25 MB).`);
        }
        const res = await fetch(data.videoUrl);
        if (!res.ok) throw new Error('Falha ao baixar vídeo (' + res.status + ')');
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length > MAX_VIDEO_BYTES) {
          throw new Error(`Vídeo grande demais para arquivar (${(buf.length / 1024 / 1024).toFixed(1)} MB > 25 MB).`);
        }
        videoPath = `${targetUserId}/${gen.id}/video.mp4`;
        const { error: vErr } = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(videoPath, buf, { contentType: 'video/mp4', upsert: true });
        if (vErr) throw new Error('Falha ao subir vídeo: ' + vErr.message);
        await supabaseAdmin
          .from('user_generations')
          .update({ video_path: videoPath })
          .eq('id', gen.id);
      } catch (e: any) {
        // Rollback: apaga a geração para não deixar reels sem vídeo
        await deleteGenerationInternal(gen.id, targetUserId, true);
        throw new Error(e?.message || 'Falha ao arquivar vídeo');
      }
    }

    return {
      ok: true,
      generationId: gen.id,
      expiresAt: gen.expires_at,
      evicted: evictedCount,
    };
  });

const UpdateSchema = z.object({
  generationId: z.string().uuid(),
  legenda: z.string().max(4000).default(''),
  titulo: z.string().max(200).default(''),
  images: z
    .array(
      z.object({
        base64: z.string().min(10),
        ordem: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(10),
  asUserId: z.string().uuid().optional(),
});

export const updateGeneration = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => UpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const targetUserId = await resolveTargetUserId(context.userId, data.asUserId);

    // Verifica propriedade
    const { data: gen, error: fetchErr } = await supabaseAdmin
      .from('user_generations')
      .select('id')
      .eq('id', data.generationId)
      .eq('user_id', targetUserId)
      .single();
    if (fetchErr || !gen) throw new Error('Geração não encontrada ou sem permissão');

    // Atualiza legenda + titulo
    const { error: updErr } = await supabaseAdmin
      .from('user_generations')
      .update({ legenda: data.legenda, titulo: data.titulo })
      .eq('id', data.generationId);
    if (updErr) throw new Error('Falha ao atualizar geração: ' + updErr.message);

    // Remove assets antigos e faz re-upload nos mesmos caminhos
    await supabaseAdmin.from('user_assets').delete().eq('generation_id', data.generationId);

    const assetRows: {
      generation_id: string;
      user_id: string;
      ordem: number;
      storage_path: string;
      bytes: number;
    }[] = [];
    for (const img of data.images) {
      const bytes = Buffer.from(img.base64, 'base64');
      const path = `${targetUserId}/${data.generationId}/img-${String(img.ordem).padStart(2, '0')}.webp`;
      const { error: upErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: 'image/webp', upsert: true });
      if (upErr) throw new Error('Falha ao subir imagem: ' + upErr.message);
      assetRows.push({
        generation_id: data.generationId,
        user_id: targetUserId,
        ordem: img.ordem,
        storage_path: path,
        bytes: bytes.length,
      });
    }
    if (assetRows.length) {
      const { error: aErr } = await supabaseAdmin.from('user_assets').insert(assetRows);
      if (aErr) throw new Error('Falha ao atualizar assets: ' + aErr.message);
    }

    return { ok: true };
  });

const ListSchema = z.object({
  asUserId: z.string().uuid().optional(),
}).optional();

export const listMyGenerations = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ListSchema.parse(input))
  .handler(async ({ data, context }) => {
    const targetUserId = await resolveTargetUserId(context.userId, data?.asUserId);
    const { data: gens, error } = await supabaseAdmin
      .from('user_generations')
      .select('id, tipo, slot, formato, dia, legenda, titulo, pdf_path, video_path, created_at, expires_at')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (gens || []).map((g) => g.id);
    const assetsByGen: Record<string, { id: string; ordem: number; url: string }[]> = {};
    if (ids.length) {
      const { data: assets } = await supabaseAdmin
        .from('user_assets')
        .select('id, generation_id, ordem, storage_path')
        .in('generation_id', ids)
        .order('ordem', { ascending: true });
      for (const a of assets || []) {
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(a.storage_path, 60 * 30);
        if (!signed?.signedUrl) continue;
        (assetsByGen[a.generation_id] ||= []).push({
          id: a.id,
          ordem: a.ordem,
          url: signed.signedUrl,
        });
      }
    }

    const pdfUrls: Record<string, string> = {};
    const videoUrls: Record<string, string> = {};
    for (const g of gens || []) {
      if (g.pdf_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(g.pdf_path, 60 * 30);
        if (signed?.signedUrl) pdfUrls[g.id] = signed.signedUrl;
      }
      if (g.video_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(g.video_path, 60 * 30);
        if (signed?.signedUrl) videoUrls[g.id] = signed.signedUrl;
      }
    }

    return (gens || []).map((g) => ({
      id: g.id,
      tipo: g.tipo as 'S3V' | 'PU',
      slot: g.slot as 'plano1' | 'plano2' | 'bonus',
      formato: g.formato as 'estatico' | 'carrossel' | 'estatico_final' | 'reels',
      dia: g.dia as number | null,
      legenda: g.legenda || '',
      titulo: g.titulo,
      createdAt: g.created_at,
      expiresAt: g.expires_at,
      pdfUrl: pdfUrls[g.id] || null,
      videoUrl: videoUrls[g.id] || null,
      assets: assetsByGen[g.id] || [],
    }));
  });

export const deleteGeneration = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), asUserId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const targetUserId = await resolveTargetUserId(context.userId, data.asUserId);
    await deleteGenerationInternal(data.id, targetUserId);
    return { ok: true };
  });

async function deleteGenerationInternal(generationId: string, userId: string, allowAny = false) {
  const { data: gen } = await supabaseAdmin
    .from('user_generations')
    .select('id, user_id, pdf_path, video_path')
    .eq('id', generationId)
    .maybeSingle();
  if (!gen) return;
  if (!allowAny && gen.user_id !== userId) return;

  const { data: assets } = await supabaseAdmin
    .from('user_assets')
    .select('storage_path')
    .eq('generation_id', generationId);
  const paths = (assets || []).map((a) => a.storage_path);
  if (gen.pdf_path) paths.push(gen.pdf_path);
  if (gen.video_path) paths.push(gen.video_path);
  if (paths.length) {
    await supabaseAdmin.storage.from(BUCKET).remove(paths);
  }
  await supabaseAdmin.from('user_generations').delete().eq('id', generationId);
}
