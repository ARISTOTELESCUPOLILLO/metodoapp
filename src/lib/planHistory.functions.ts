import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  if (error) throw new Error(`Falha ao verificar permissão: ${error.message}`);
  if (!data) throw new Error('Apenas administradores podem executar esta ação.');
}

const SlotEnum = z.enum(['plano1', 'plano2', 'bonus']);

async function closeCycle(
  prof: Record<string, any>,
  slot: string,
  motivoFechamento: string,
  closedBy: string,
) {
  if (prof.is_test) return; // não registra histórico de usuários de teste
  const currentPlanId = prof[`${slot}_id`];
  if (!currentPlanId) return;

  const { data: plan } = await supabaseAdmin
    .from('plans')
    .select('codigo,nome')
    .eq('id', currentPlanId)
    .maybeSingle();

  await supabaseAdmin.from('plan_purchases').insert({
    user_id: prof.id,
    slot,
    plan_id: currentPlanId,
    plan_codigo: (plan as any)?.codigo ?? null,
    plan_nome: (plan as any)?.nome ?? null,
    inicio: prof[`${slot}_inicio`] ?? null,
    expira_em: prof[`${slot}_expira_em`] ?? null,
    preco_brl: prof[`${slot}_preco_brl`] ?? null,
    imgs_limite: prof[`${slot}_imgs_limite`] ?? 0,
    renders_limite: prof[`${slot}_renders_limite`] ?? 0,
    geracoes_limite: prof[`${slot}_geracoes_limite`] ?? 0,
    imgs_usadas_final: prof[`${slot}_imgs_usadas`] ?? 0,
    renders_usados_final: prof[`${slot}_renders_usados`] ?? 0,
    geracoes_usados_final: prof[`${slot}_geracoes_usadas`] ?? 0,
    motivo_fechamento: motivoFechamento,
    assigned_by: prof.bonus_assigned_by ?? null,
    closed_by: closedBy,
  } as any);
}

// Substitui UsersTab.assignSlot() — captura histórico antes de sobrescrever
export const assignPlanSlot = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      slot: SlotEnum,
      planId: z.string().uuid(),
      inicio: z.string(),
      resetCounters: z.boolean().default(true),
      extraPrefix: z.string(), // 'p1' | 'p2' | 'b'
      motivoFechamento: z.enum(['renovacao', 'troca_plano']).default('renovacao'),
      adminUserId: z.string().uuid().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // 1. Ler estado atual (ciclo que será fechado)
    const { data: prof, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.userId)
      .maybeSingle();
    if (profErr) throw new Error(profErr.message);

    // 2. Fechar ciclo anterior no histórico
    const existingPlanId = (prof as any)?.[`${data.slot}_id`];
    const motivo = existingPlanId === data.planId ? 'renovacao' : 'troca_plano';
    await closeCycle(prof as any, data.slot, motivo, context.userId);

    // 3. Buscar limites do novo plano
    const { data: plan, error: planErr } = await supabaseAdmin
      .from('plans')
      .select('limite_imagens,limite_renders,limite_geracoes')
      .eq('id', data.planId)
      .maybeSingle();
    if (planErr) throw new Error(planErr.message);

    // 4. Atualizar profiles (trigger apply_slot_limits cuida do expira_em)
    const patch: Record<string, any> = {
      [`${data.slot}_id`]: data.planId,
      [`${data.slot}_inicio`]: new Date(data.inicio + 'T12:00:00').toISOString(),
      [`${data.slot}_imgs_limite`]: (plan as any)?.limite_imagens ?? 0,
      [`${data.slot}_renders_limite`]: (plan as any)?.limite_renders ?? 0,
      [`${data.slot}_geracoes_limite`]: (plan as any)?.limite_geracoes ?? 0,
      ...(data.resetCounters ? {
        [`${data.slot}_imgs_usadas`]: 0,
        [`${data.slot}_renders_usados`]: 0,
        [`${data.slot}_geracoes_usadas`]: 0,
        [`extra_${data.extraPrefix}_estatico`]: 0,
        [`extra_${data.extraPrefix}_carrossel`]: 0,
        [`extra_${data.extraPrefix}_estatico_final`]: 0,
        [`extra_${data.extraPrefix}_reels`]: 0,
      } : {}),
      ...(data.slot === 'bonus' && data.adminUserId ? { bonus_assigned_by: data.adminUserId } : {}),
    };

    const { error: updErr } = await supabaseAdmin
      .from('profiles')
      .update(patch)
      .eq('id', data.userId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });

// Substitui UsersTab.removeSlot() — captura histórico antes de remover
export const removePlanSlot = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      slot: SlotEnum,
      extraPrefix: z.string(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // 1. Ler estado atual
    const { data: prof, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', data.userId)
      .maybeSingle();
    if (profErr) throw new Error(profErr.message);

    // 2. Fechar ciclo no histórico
    await closeCycle(prof as any, data.slot, 'remocao', context.userId);

    // 3. Remover slot
    const patch: Record<string, any> = {
      [`${data.slot}_id`]: null,
      [`${data.slot}_inicio`]: null,
      [`${data.slot}_imgs_limite`]: 0,
      [`${data.slot}_renders_limite`]: 0,
      [`${data.slot}_geracoes_limite`]: 0,
      [`${data.slot}_imgs_usadas`]: 0,
      [`${data.slot}_renders_usados`]: 0,
      [`${data.slot}_geracoes_usadas`]: 0,
      [`extra_${data.extraPrefix}_estatico`]: 0,
      [`extra_${data.extraPrefix}_carrossel`]: 0,
      [`extra_${data.extraPrefix}_estatico_final`]: 0,
      [`extra_${data.extraPrefix}_reels`]: 0,
    };

    const { error: updErr } = await supabaseAdmin
      .from('profiles')
      .update(patch)
      .eq('id', data.userId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });

// Lê histórico de compras para exibir na aba Histórico
export const loadPlanHistorico = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      search: z.string().optional(),
      offset: z.number().int().min(0).default(0),
      limit: z.number().int().min(1).max(100).default(50),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Busca histórico com join para nome/email do usuário (user_id tem FK)
    const { data: rows, count, error } = await supabaseAdmin
      .from('plan_purchases')
      .select('*, profiles!plan_purchases_user_id_fkey(nome, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (error) throw new Error(error.message);

    // Resolve nomes dos admins que fecharam ciclos (closed_by sem FK — busca separada)
    const closedByIds = [...new Set((rows ?? []).map((r: any) => r.closed_by).filter(Boolean))];
    let closerMap: Record<string, string> = {};
    if (closedByIds.length) {
      const { data: closers } = await supabaseAdmin
        .from('profiles')
        .select('id, nome, email')
        .in('id', closedByIds);
      closerMap = Object.fromEntries(
        (closers ?? []).map((c: any) => [c.id, c.nome || c.email])
      );
    }

    const enriched = (rows ?? []).map((r: any) => ({
      ...r,
      closer_nome: r.closed_by ? (closerMap[r.closed_by] ?? null) : null,
    }));

    return { rows: enriched, total: count ?? 0, offset: data.offset, limit: data.limit };
  });
