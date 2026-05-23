// Server functions para carregar/salvar o Kit Imagem por usuário.
// O Kit fica em duas peças: linha em public.user_image_kits (com os paths)
// + arquivos no bucket privado "image-kits".

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const BUCKET = 'image-kits';
const SIGNED_URL_TTL = 60 * 60; // 1h é suficiente — o front segura em memória

// ---------- helpers ----------

function decodeBase64DataUrl(input: string): { bytes: Uint8Array; mime: string } {
  // Aceita "data:image/webp;base64,xxx" OU só "xxx" (base64 puro).
  const m = input.match(/^data:([^;]+);base64,(.+)$/);
  const mime = m ? m[1] : 'image/webp';
  const b64 = m ? m[2] : input;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, mime };
}

async function uploadImage(path: string, dataUrl: string): Promise<string> {
  const { bytes, mime } = decodeBase64DataUrl(dataUrl);
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  return path;
}

async function signPath(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

async function removePath(path: string | null | undefined) {
  if (!path) return;
  await supabaseAdmin.storage.from(BUCKET).remove([path]).catch(() => {});
}

// ---------- LOAD ----------

export const loadImageKitFor = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const callerId = context.userId;
    const isAdmin = (context.claims as any)?.app_metadata?.role === 'admin'
      || (context.claims as any)?.user_role === 'admin';

    // Quem está sendo carregado: o próprio caller por padrão.
    let targetId = data.userId || callerId;

    // Só admin pode pedir o Kit de outro usuário.
    if (targetId !== callerId) {
      // Confere via tabela user_roles (admin client bypassa RLS).
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', callerId)
        .eq('role', 'admin');
      if (!roles || roles.length === 0) {
        if (!isAdmin) targetId = callerId; // fallback silencioso
      }
    }

    const { data: row, error } = await supabaseAdmin
      .from('user_image_kits')
      .select('avatar_path, avatar_path_2, cenarios_paths, produtos_paths')
      .eq('user_id', targetId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!row) {
      return {
        userId: targetId,
        avatar: null,
        avatar2: null,
        cenarios: [null, null, null] as (string | null)[],
        produtos: [null, null, null, null, null, null, null, null] as (string | null)[],
      };
    }

    const cenariosArr = (row.cenarios_paths || []) as string[];
    const produtosArr = (row.produtos_paths || []) as string[];

    const [avatarUrl, avatar2Url, ...cenariosUrls] = await Promise.all([
      signPath(row.avatar_path),
      signPath((row as any).avatar_path_2 || null),
      ...Array.from({ length: 3 }, (_, i) => signPath(cenariosArr[i] || null)),
    ]);
    const produtosUrls = await Promise.all(
      Array.from({ length: 8 }, (_, i) => signPath(produtosArr[i] || null)),
    );

    return {
      userId: targetId,
      avatar: avatarUrl,
      avatar2: avatar2Url,
      cenarios: cenariosUrls,
      produtos: produtosUrls,
    };
  });

// ---------- SAVE ----------

// Cada slot aceita:
//   - undefined: não mexer (mantém o que já estava)
//   - null: limpar o slot (remove arquivo + zera path)
//   - string dataURL: subir novo arquivo
const SlotInput = z.union([z.string(), z.null(), z.undefined()]);

export const saveImageKitFor = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      userId: z.string().uuid().optional(),
      avatar: SlotInput,
      avatar2: SlotInput,
      cenarios: z.array(SlotInput).max(3).optional(),
      produtos: z.array(SlotInput).max(8).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const callerId = context.userId;
    let targetId = data.userId || callerId;

    if (targetId !== callerId) {
      const { data: roles } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', callerId)
        .eq('role', 'admin');
      if (!roles || roles.length === 0) targetId = callerId;
    }

    // Carrega o que já existe pra saber o que apagar.
    const { data: existing } = await supabaseAdmin
      .from('user_image_kits')
      .select('avatar_path, cenarios_paths, produtos_paths')
      .eq('user_id', targetId)
      .maybeSingle();

    const oldAvatar = existing?.avatar_path || null;
    const oldCenarios = (existing?.cenarios_paths || []) as string[];
    const oldProdutos = (existing?.produtos_paths || []) as string[];

    // Avatar 1
    let newAvatar: string | null = oldAvatar;
    if (data.avatar === null) {
      await removePath(oldAvatar);
      newAvatar = null;
    } else if (typeof data.avatar === 'string' && data.avatar.length > 0) {
      const path = `${targetId}/avatar.webp`;
      await uploadImage(path, data.avatar);
      newAvatar = path;
    }

    // Avatar 2
    const oldAvatar2 = (existing as any)?.avatar_path_2 || null;
    let newAvatar2: string | null = oldAvatar2;
    if (data.avatar2 === null) {
      await removePath(oldAvatar2);
      newAvatar2 = null;
    } else if (typeof data.avatar2 === 'string' && data.avatar2.length > 0) {
      const path = `${targetId}/avatar2.webp`;
      await uploadImage(path, data.avatar2);
      newAvatar2 = path;
    }

    // Cenários (3 slots)
    const newCenarios: (string | null)[] = [
      oldCenarios[0] || null, oldCenarios[1] || null, oldCenarios[2] || null,
    ];
    if (data.cenarios) {
      for (let i = 0; i < 3; i++) {
        const v = data.cenarios[i];
        if (v === null) {
          await removePath(newCenarios[i]);
          newCenarios[i] = null;
        } else if (typeof v === 'string' && v.length > 0) {
          const path = `${targetId}/cenarios/${i}.webp`;
          await uploadImage(path, v);
          newCenarios[i] = path;
        }
      }
    }

    // Produtos (8 slots)
    const newProdutos: (string | null)[] = Array.from(
      { length: 8 },
      (_, i) => oldProdutos[i] || null,
    );
    if (data.produtos) {
      for (let i = 0; i < 8; i++) {
        const v = data.produtos[i];
        if (v === null) {
          await removePath(newProdutos[i]);
          newProdutos[i] = null;
        } else if (typeof v === 'string' && v.length > 0) {
          const path = `${targetId}/produtos/${i}.webp`;
          await uploadImage(path, v);
          newProdutos[i] = path;
        }
      }
    }

    // Compacta cenários/produtos pra arrays (mantendo a posição via length).
    const cenariosForDb = newCenarios.map((c) => c || '').slice(0, 3);
    const produtosForDb = newProdutos.map((p) => p || '').slice(0, 8);
    // Array do Postgres não aceita null direto em text[] sem definir explicitamente,
    // então usamos string vazia como sentinela e o leitor trata como null.
    // Mas para simplificar, podemos filtrar pra remover trailing vazios sem perder posição:
    // optamos por manter o array exatamente do tamanho dos slots.

    const { error: upErr } = await supabaseAdmin
      .from('user_image_kits')
      .upsert(
        {
          user_id: targetId,
          avatar_path: newAvatar,
          avatar_path_2: newAvatar2,
          cenarios_paths: cenariosForDb,
          produtos_paths: produtosForDb,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (upErr) throw new Error(upErr.message);

    // Re-sign para devolver URLs prontos
    const [avatarUrl, avatar2Url, ...cenariosUrls] = await Promise.all([
      signPath(newAvatar),
      signPath(newAvatar2),
      ...newCenarios.map((p) => signPath(p)),
    ]);
    const produtosUrls = await Promise.all(newProdutos.map((p) => signPath(p)));

    return {
      userId: targetId,
      avatar: avatarUrl,
      avatar2: avatar2Url,
      cenarios: cenariosUrls,
      produtos: produtosUrls,
    };
  });
