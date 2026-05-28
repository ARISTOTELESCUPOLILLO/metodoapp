import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

const SegmentoEnum = z.enum(['SERVIÇOS', 'VAREJO', 'MARCA']);

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

export const createTestUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      nome: z.string().trim().min(1).max(120),
      segmento: SegmentoEnum,
      plano1_id: z.string().uuid().nullable().optional(),
      plano2_id: z.string().uuid().nullable().optional(),
      bonus_id: z.string().uuid().nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    const email = `teste-${suffix}@local.test`;
    const password = crypto.randomUUID() + crypto.randomUUID();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { is_test: true, nome: data.nome },
    });
    if (createErr || !created.user) {
      throw new Error(`Falha ao criar usuário: ${createErr?.message || 'desconhecido'}`);
    }

    const newId = created.user.id;

    // O trigger handle_new_user já criou o profile com is_test=true.
    // Aplicamos segmento e planos via UPDATE (triggers apply_slot_limits cuidam dos limites).
    const { error: updErr } = await supabaseAdmin
      .from('profiles')
      .update({
        nome: data.nome,
        segmento: data.segmento,
        plano1_id: data.plano1_id ?? null,
        plano2_id: data.plano2_id ?? null,
        bonus_id: data.bonus_id ?? null,
        created_by: context.userId,
        is_test: true,
      })
      .eq('id', newId);
    if (updErr) {
      // Rollback do auth user para não deixar lixo
      await supabaseAdmin.auth.admin.deleteUser(newId).catch(() => {});
      throw new Error(`Falha ao configurar perfil: ${updErr.message}`);
    }

    return { id: newId, email };
  });

export const deleteTestUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Verificar que é mesmo um usuário de teste antes de apagar
    const { data: prof, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, is_test')
      .eq('id', data.id)
      .maybeSingle();
    if (profErr) throw new Error(profErr.message);
    if (!prof) throw new Error('Perfil não encontrado.');
    if (!prof.is_test) throw new Error('Este usuário não é de teste; ação bloqueada.');

    await supabaseAdmin.from('brand_kits').delete().eq('user_id', data.id);
    await supabaseAdmin.from('user_sequences').delete().eq('user_id', data.id);

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (delErr) throw new Error(`Falha ao excluir auth user: ${delErr.message}`);

    return { ok: true };
  });
