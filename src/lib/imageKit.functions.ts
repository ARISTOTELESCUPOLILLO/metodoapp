// Server functions para carregar/salvar o Kit Imagem por usuário.
// O Kit fica em duas peças: linha em public.user_image_kits (com os paths)
// + arquivos no bucket privado "image-kits".

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

// Copia um arquivo dentro do bucket; fallback download+reupload se copy() falhar
async function copyStorageFile(src: string, dest: string): Promise<boolean> {
  const { error } = await supabaseAdmin.storage.from(BUCKET).copy(src, dest);
  if (!error) return true;
  // fallback
  const { data: blob } = await supabaseAdmin.storage.from(BUCKET).download(src);
  if (!blob) return false;
  const { error: upErr } = await supabaseAdmin.storage
    .from(BUCKET).upload(dest, blob, { upsert: true });
  return !upErr;
}

const BUCKET = 'image-kits';
const SIGNED_URL_TTL = 60 * 60; // 1h é suficiente — o front segura em memória
const CENARIO_SLOTS = 2;

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
      .select('avatar_path, avatar_path_2, fachada_path, fato_path, venda_path, cenarios_paths, produtos_paths')
      .eq('user_id', targetId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!row) {
      return {
        userId: targetId,
        avatar: null,
        avatar2: null,
        fachada: null,
        cenarios: Array.from({ length: CENARIO_SLOTS }, () => null) as (string | null)[],
        produtos: [null, null, null, null, null, null, null, null] as (string | null)[],
        fato: null,
        venda: null,
      };
    }

    const cenariosArr = (row.cenarios_paths || []) as string[];
    const produtosArr = (row.produtos_paths || []) as string[];

    const [avatarUrl, avatar2Url, fachadaUrl, fatoUrl, vendaUrl, ...cenariosUrls] = await Promise.all([
      signPath(row.avatar_path),
      signPath((row as any).avatar_path_2 || null),
      signPath((row as any).fachada_path || null),
      signPath((row as any).fato_path || null),
      signPath((row as any).venda_path || null),
      ...Array.from({ length: CENARIO_SLOTS }, (_, i) => signPath(cenariosArr[i] || null)),
    ]);
    const produtosUrls = await Promise.all(
      Array.from({ length: 8 }, (_, i) => signPath(produtosArr[i] || null)),
    );

    return {
      userId: targetId,
      avatar: avatarUrl,
      avatar2: avatar2Url,
      fachada: fachadaUrl,
      cenarios: cenariosUrls,
      produtos: produtosUrls,
      fato: fatoUrl,
      venda: vendaUrl,
    };
  });

// ---------- MIGRATE (copia kit de perfil de teste para usuário real) ----------

export const migrateImageKitFor = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      inviteId: z.string().uuid(),
      sourceProfileId: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const callerId = context.userId;

    // Só admin pode executar
    const { data: roles } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', callerId).eq('role', 'admin');
    if (!roles || roles.length === 0) throw new Error('Acesso negado.');

    // Encontra o e-mail do convite
    const { data: invite } = await supabaseAdmin
      .from('invited_emails').select('email').eq('id', data.inviteId).maybeSingle();
    if (!invite) throw new Error('Convite não encontrado.');

    // Encontra o perfil do novo usuário pelo e-mail
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles').select('id').eq('email', invite.email).maybeSingle();
    if (!targetProfile) throw new Error('Usuário ainda não realizou o cadastro.');

    const sourceId = data.sourceProfileId;
    const targetId = targetProfile.id as string;

    // ── Kit Imagem — falha suave se não existir no teste ──────────────────
    const { data: sourceKit } = await supabaseAdmin
      .from('user_image_kits')
      .select('avatar_path, avatar_path_2, fachada_path, fato_path, venda_path, cenarios_paths, produtos_paths')
      .eq('user_id', sourceId).maybeSingle();

    const imageKitFound = !!sourceKit;
    let newAvatar: string | null = null;
    let newAvatar2: string | null = null;
    let newFachada: string | null = null;
    let newFato: string | null = null;
    let newVenda: string | null = null;
    let newCenarios: (string | null)[] = Array.from({ length: CENARIO_SLOTS }, () => null);
    let newProdutos: (string | null)[] = Array.from({ length: 8 }, () => null);

    if (sourceKit) {
      const cenariosArr = (sourceKit.cenarios_paths || []) as string[];
      const produtosArr = (sourceKit.produtos_paths || []) as string[];

      const swapId = (p: string | null | undefined) =>
        p ? p.replace(sourceId, targetId) : null;

      const copySlot = async (src: string | null | undefined): Promise<string | null> => {
        if (!src) return null;
        const dest = swapId(src)!;
        const ok = await copyStorageFile(src, dest);
        return ok ? dest : null;
      };

      newAvatar  = await copySlot(sourceKit.avatar_path);
      newAvatar2 = await copySlot((sourceKit as any).avatar_path_2);
      newFachada = await copySlot((sourceKit as any).fachada_path);
      newFato = await copySlot((sourceKit as any).fato_path);
      newVenda = await copySlot((sourceKit as any).venda_path);
      newCenarios = await Promise.all(
        Array.from({ length: CENARIO_SLOTS }, (_, i) => copySlot(cenariosArr[i] || null)),
      );
      newProdutos = await Promise.all(
        Array.from({ length: 8 }, (_, i) => copySlot(produtosArr[i] || null)),
      );

      await supabaseAdmin.from('user_image_kits').upsert(
        {
          user_id: targetId,
          avatar_path: newAvatar,
          avatar_path_2: newAvatar2,
          fachada_path: newFachada,
          fato_path: newFato,
          venda_path: newVenda,
          cenarios_paths: newCenarios.map((p) => p || ''),
          produtos_paths: newProdutos.map((p) => p || ''),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    }

    // ── Kit de Marca — sempre tenta, independente do Kit Imagem ───────────
    const { data: sourceBrandKit } = await supabaseAdmin
      .from('brand_kits').select('*').eq('user_id', sourceId).maybeSingle();

    const brandKitFound = !!sourceBrandKit;
    let brandKitCopied = false;
    if (sourceBrandKit) {
      const { id: _id, ...brandKitFields } = sourceBrandKit as any;
      const payload = {
        ...brandKitFields,
        user_id: targetId,
        updated_at: new Date().toISOString(),
      };

      // Verifica se o destino já tem um kit de marca
      const { data: existingTarget } = await supabaseAdmin
        .from('brand_kits').select('id').eq('user_id', targetId).maybeSingle();

      let bkErr: any = null;
      if (existingTarget?.id) {
        // UPDATE — sobrescreve o kit existente do destino
        const { error } = await supabaseAdmin
          .from('brand_kits').update(payload).eq('id', existingTarget.id);
        bkErr = error;
      } else {
        // INSERT — cria novo kit para o destino
        const { error } = await supabaseAdmin
          .from('brand_kits').insert({ ...payload, created_at: new Date().toISOString() });
        bkErr = error;
      }
      if (bkErr) console.error('[migrateBrandKit]', bkErr.message, bkErr.code);
      brandKitCopied = !bkErr;
    }

    // Marca o convite como migrado
    await supabaseAdmin
      .from('invited_emails')
      .update({ kit_migrated_at: new Date().toISOString() } as any)
      .eq('id', data.inviteId);

    return {
      ok: true,
      targetId,
      copied: {
        imageKitFound,
        avatar: !!newAvatar,
        cenarios: newCenarios.filter(Boolean).length,
        produtos: newProdutos.filter(Boolean).length,
        brandKit: brandKitCopied,
        brandKitFound,
      },
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
      fachada: SlotInput,
      cenarios: z.array(SlotInput).max(CENARIO_SLOTS).optional(),
      produtos: z.array(SlotInput).max(8).optional(),
      fato: SlotInput,
      venda: SlotInput,
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
      .select('avatar_path, avatar_path_2, fachada_path, fato_path, venda_path, cenarios_paths, produtos_paths')
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

    // Fachada — slot próprio (antes era um dos cenario_tipos).
    const oldFachada = (existing as any)?.fachada_path || null;
    let newFachada: string | null = oldFachada;
    if (data.fachada === null) {
      await removePath(oldFachada);
      newFachada = null;
    } else if (typeof data.fachada === 'string' && data.fachada.length > 0) {
      const path = `${targetId}/fachada.webp`;
      await uploadImage(path, data.fachada);
      newFachada = path;
    }

    // Fato — fotografia de um acontecimento (visita, confraternização, feira).
    const oldFato = (existing as any)?.fato_path || null;
    let newFato: string | null = oldFato;
    if (data.fato === null) {
      await removePath(oldFato);
      newFato = null;
    } else if (typeof data.fato === 'string' && data.fato.length > 0) {
      const path = `${targetId}/fato.webp`;
      await uploadImage(path, data.fato);
      newFato = path;
    }

    // Venda — fotografia de colaborador com o produto.
    const oldVenda = (existing as any)?.venda_path || null;
    let newVenda: string | null = oldVenda;
    if (data.venda === null) {
      await removePath(oldVenda);
      newVenda = null;
    } else if (typeof data.venda === 'string' && data.venda.length > 0) {
      const path = `${targetId}/venda.webp`;
      await uploadImage(path, data.venda);
      newVenda = path;
    }

    // Cenários (2 slots)
    const newCenarios: (string | null)[] = Array.from(
      { length: CENARIO_SLOTS },
      (_, i) => oldCenarios[i] || null,
    );
    if (data.cenarios) {
      for (let i = 0; i < CENARIO_SLOTS; i++) {
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
    const cenariosForDb = newCenarios.map((c) => c || '').slice(0, CENARIO_SLOTS);
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
          fachada_path: newFachada,
          fato_path: newFato,
          venda_path: newVenda,
          cenarios_paths: cenariosForDb,
          produtos_paths: produtosForDb,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    if (upErr) throw new Error(upErr.message);

    // Re-sign para devolver URLs prontos
    const [avatarUrl, avatar2Url, fachadaUrl, fatoUrl, vendaUrl, ...cenariosUrls] = await Promise.all([
      signPath(newAvatar),
      signPath(newAvatar2),
      signPath(newFachada),
      signPath(newFato),
      signPath(newVenda),
      ...newCenarios.map((p) => signPath(p)),
    ]);
    const produtosUrls = await Promise.all(newProdutos.map((p) => signPath(p)));

    return {
      userId: targetId,
      avatar: avatarUrl,
      avatar2: avatar2Url,
      fachada: fachadaUrl,
      cenarios: cenariosUrls,
      produtos: produtosUrls,
      fato: fatoUrl,
      venda: vendaUrl,
    };
  });
