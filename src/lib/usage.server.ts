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
      'plano1_id, plano1_imgs_limite, plano1_imgs_usadas, plano1_renders_limite, plano1_renders_usados, plano1_geracoes_limite, plano1_geracoes_usadas, plano2_id, plano2_imgs_limite, plano2_imgs_usadas, plano2_renders_limite, plano2_renders_usados, plano2_geracoes_limite, plano2_geracoes_usadas, bonus_id, bonus_imgs_limite, bonus_imgs_usadas, bonus_renders_limite, bonus_renders_usados, bonus_geracoes_limite, bonus_geracoes_usadas',
    )
    .eq('id', userId)
    .maybeSingle();
  if (error || !p) return { ok: false, isAdmin: false };

  const fits = (lim: number, used: number, need: number) => lim - used >= need;
  const slotOk = (
    id: string | null,
    iLim: number, iUsed: number,
    rLim: number, rUsed: number,
    gLim: number, gUsed: number,
  ) => !!id
    && fits(iLim, iUsed, imgs)
    && fits(rLim, rUsed, renders)
    && fits(gLim, gUsed, geracoes);

  const ok =
    slotOk(p.plano1_id, p.plano1_imgs_limite, p.plano1_imgs_usadas, p.plano1_renders_limite, p.plano1_renders_usados, (p as any).plano1_geracoes_limite ?? 0, (p as any).plano1_geracoes_usadas ?? 0) ||
    slotOk(p.plano2_id, p.plano2_imgs_limite, p.plano2_imgs_usadas, p.plano2_renders_limite, p.plano2_renders_usados, (p as any).plano2_geracoes_limite ?? 0, (p as any).plano2_geracoes_usadas ?? 0) ||
    slotOk(p.bonus_id, p.bonus_imgs_limite, p.bonus_imgs_usadas, p.bonus_renders_limite, p.bonus_renders_usados, (p as any).bonus_geracoes_limite ?? 0, (p as any).bonus_geracoes_usadas ?? 0);

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
  },
): Promise<{ slot: string }> {
  const geracoes = meta.geracoes ?? 0;
  const { data: slot, error } = await supabaseAdmin.rpc('debit_usage', {
    _user_id: userId,
    _imgs: imgs,
    _renders: renders,
    _geracoes: geracoes,
  } as any);
  if (error) throw new Error(error.message || 'Falha ao debitar consumo.');

  // Log (não bloqueia se falhar).
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

  return { slot: (slot as string) || 'desconhecido' };
}
