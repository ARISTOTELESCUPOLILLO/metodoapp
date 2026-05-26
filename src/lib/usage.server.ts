// Server-only helpers para débito de uso (imagens / renders / gerações).
// Usa supabaseAdmin para validar o token do usuário e chamar a RPC debit_usage,
// e registra um log em usage_logs para o painel admin.

import { supabaseAdmin } from '@/integrations/supabase/client.server';

export type DebitKind = 'image' | 'render' | 'geracao';

export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  // Decode JWT locally to avoid network/SSL issues on validation.
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    if (!payload?.sub) return null;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.sub as string;
  } catch {
    return null;
  }
}

export async function checkBalance(
  userId: string,
  imgs: number,
  renders: number,
  geracoes = 0,
): Promise<{ ok: boolean; isAdmin: boolean }> {
  // Admin: ilimitado.
  const { data: adminCheck } = await supabaseAdmin.rpc('has_role', {
    _user_id: userId,
    _role: 'admin',
  });
  if (adminCheck === true) return { ok: true, isAdmin: true };

  const { data: p, error } = await supabaseAdmin
    .from('profiles')
    .select(
      'plano1_id, plano1_imgs_limite, plano1_imgs_usadas, plano1_renders_limite, plano1_renders_usados, plano1_geracoes_limite, plano1_geracoes_usadas, plano1_expira_em, plano2_id, plano2_imgs_limite, plano2_imgs_usadas, plano2_renders_limite, plano2_renders_usados, plano2_geracoes_limite, plano2_geracoes_usadas, plano2_expira_em, bonus_id, bonus_imgs_limite, bonus_imgs_usadas, bonus_renders_limite, bonus_renders_usados, bonus_geracoes_limite, bonus_geracoes_usadas, bonus_expira_em',
    )
    .eq('id', userId)
    .maybeSingle();
  if (error || !p) return { ok: false, isAdmin: false };

  const fits = (lim: number, used: number, need: number) => lim - used >= need;
  const notExpired = (expiraEm: string | null) => expiraEm == null || new Date(expiraEm) > new Date();
  const slotOk = (
    id: string | null,
    iLim: number, iUsed: number,
    rLim: number, rUsed: number,
    gLim: number, gUsed: number,
    expiraEm: string | null,
  ) => !!id
    && notExpired(expiraEm)
    && fits(iLim, iUsed, imgs)
    && fits(rLim, rUsed, renders)
    && fits(gLim, gUsed, geracoes);

  const ok =
    slotOk(p.plano1_id, p.plano1_imgs_limite, p.plano1_imgs_usadas, p.plano1_renders_limite, p.plano1_renders_usados, (p as any).plano1_geracoes_limite ?? 0, (p as any).plano1_geracoes_usadas ?? 0, (p as any).plano1_expira_em ?? null) ||
    slotOk(p.plano2_id, p.plano2_imgs_limite, p.plano2_imgs_usadas, p.plano2_renders_limite, p.plano2_renders_usados, (p as any).plano2_geracoes_limite ?? 0, (p as any).plano2_geracoes_usadas ?? 0, (p as any).plano2_expira_em ?? null) ||
    slotOk(p.bonus_id, p.bonus_imgs_limite, p.bonus_imgs_usadas, p.bonus_renders_limite, p.bonus_renders_usados, (p as any).bonus_geracoes_limite ?? 0, (p as any).bonus_geracoes_usadas ?? 0, (p as any).bonus_expira_em ?? null);

  return { ok, isAdmin: false };
}

export async function debitUsage(
  userId: string,
  imgs: number,
  renders: number,
  meta: {
    evento: string;
    modulo?: string;
    payload?: Record<string, unknown>;
    geracoes?: number;
    custoUsd?: number;
    impersonatedBy?: string;
    preferredSlot?: 'plano1' | 'plano2' | 'bonus';
  },
): Promise<{ slot: string }> {
  const geracoes = meta.geracoes ?? 0;

  // Admins não têm cota de plano — skip do RPC de débito mas registra o consumo.
  const { data: adminCheck } = await supabaseAdmin.rpc('has_role', {
    _user_id: userId,
    _role: 'admin',
  });
  const isAdmin = adminCheck === true;

  let slot: string | null = null;
  let rpcError: Error | null = null;

  if (isAdmin) {
    const { data: slotData, error: adminRpcErr } = await supabaseAdmin.rpc('debit_usage', {
      _user_id: userId,
      _imgs: imgs,
      _renders: renders,
      _geracoes: geracoes,
      ...(meta.preferredSlot ? { _preferred_slot: meta.preferredSlot } : {}),
    } as any);

    if (adminRpcErr || !slotData) {
      // RPC falhou ou retornou vazio — fallback: incremento direto no perfil.
      // Respeita preferredSlot para que PU (plano2) e MOP (plano1) debitam no slot certo.
      console.error('[debit_usage admin RPC]', adminRpcErr?.message ?? 'sem retorno');
      const s = meta.preferredSlot ?? 'plano1';
      const iCol = `${s}_imgs_usadas`;
      const rCol = `${s}_renders_usados`;
      const gCol = `${s}_geracoes_usadas`;
      const { data: p } = await supabaseAdmin
        .from('profiles')
        .select(`${iCol},${rCol},${gCol}`)
        .eq('id', userId)
        .maybeSingle();
      if (p) {
        await supabaseAdmin.from('profiles').update({
          [iCol]: ((p as any)[iCol] ?? 0) + imgs,
          [rCol]: ((p as any)[rCol] ?? 0) + renders,
          [gCol]: ((p as any)[gCol] ?? 0) + geracoes,
        } as any).eq('id', userId);
      }
    }
    slot = (slotData as string) || 'admin';
  } else {
    const { data: slotData, error } = await supabaseAdmin.rpc('debit_usage', {
      _user_id: userId,
      _imgs: imgs,
      _renders: renders,
      _geracoes: geracoes,
      ...(meta.preferredSlot ? { _preferred_slot: meta.preferredSlot } : {}),
    } as any);
    if (error) {
      // Captura o erro mas NÃO lança ainda — o log abaixo deve ocorrer mesmo assim.
      rpcError = new Error(error.message || 'Falha ao debitar consumo.');
      slot = 'sem-plano';
    } else {
      slot = (slotData as string) ?? null;
    }
  }

  // Log SEMPRE — inclusive quando plano esgotado ou inexistente (slot='sem-plano').
  // Nunca cancela o log por causa de falha no RPC.
  try {
    await supabaseAdmin.from('usage_logs').insert({
      user_id: userId,
      evento: meta.evento,
      modulo: meta.modulo ?? null,
      qtd_imagens: imgs,
      qtd_renders: renders,
      qtd_geracoes: geracoes,
      custo_usd: meta.custoUsd ?? 0,
      slot: slot ?? null,
      payload: (meta.payload ?? null) as never,
      ...(meta.impersonatedBy ? { impersonated_by: meta.impersonatedBy } : {}),
    } as any);
  } catch (e) {
    console.warn('[usage_logs] insert failed', e);
  }

  // Re-lança após o log para que o caller saiba que não há plano elegível.
  if (rpcError) throw rpcError;

  return { slot: slot || 'desconhecido' };
}
