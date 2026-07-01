import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/repository/authz";
import type { Plan, Row } from "@/components/admin/testUsers/types";

const SegmentoEnum = z.enum(["SERVIÇOS", "VAREJO", "MARCA"]);
const SlotKeyEnum = z.enum(["plano1", "plano2", "bonus"]);

// Substitui TestUsersTab.load()
export const loadTestUsersData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [{ data: profs }, { data: pls }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id,nome,email,client_code,segmento,created_at,plano1_id,plano1_imgs_usadas,plano1_imgs_limite,plano1_renders_usados,plano1_renders_limite,plano1_geracoes_usadas,plano1_geracoes_limite,plano2_id,plano2_imgs_usadas,plano2_imgs_limite,plano2_renders_usados,plano2_renders_limite,plano2_geracoes_usadas,plano2_geracoes_limite,bonus_id,bonus_imgs_usadas,bonus_imgs_limite,bonus_renders_usados,bonus_renders_limite,bonus_geracoes_usadas,bonus_geracoes_limite",
        )
        .eq("is_test", true)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("plans")
        .select("id,codigo,nome,elegivel_bonus")
        .eq("ativo", true)
        .order("nome"),
    ]);

    return {
      rows: (profs as Row[]) || [],
      plans: (pls as Plan[]) || [],
    };
  });

// Substitui TestUsersTab.changeSeg()
export const updateTestSegmento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), segmento: SegmentoEnum.nullable() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ segmento: data.segmento })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Substitui TestUsersTab.changeSlot()
export const updateTestSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        slot: SlotKeyEnum,
        planId: z.string().uuid().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const update =
      data.slot === "plano1"
        ? { plano1_id: data.planId }
        : data.slot === "plano2"
          ? { plano2_id: data.planId }
          : { bonus_id: data.planId };
    const { error } = await supabaseAdmin.from("profiles").update(update).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Substitui TestUsersTab.resetCounters()
export const resetTestCounters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        plano1_imgs_usadas: 0,
        plano1_renders_usados: 0,
        plano1_geracoes_usadas: 0,
        plano2_imgs_usadas: 0,
        plano2_renders_usados: 0,
        plano2_geracoes_usadas: 0,
        bonus_imgs_usadas: 0,
        bonus_renders_usados: 0,
        bonus_geracoes_usadas: 0,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createTestUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        nome: z.string().trim().min(1).max(120),
        segmento: SegmentoEnum,
        plano1_id: z.string().uuid().nullable().optional(),
        plano2_id: z.string().uuid().nullable().optional(),
        bonus_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    const email = `teste-${suffix}@local.test`;
    const password = crypto.randomUUID() + crypto.randomUUID();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { is_test: true, nome: data.nome },
    });
    if (createErr || !created.user) {
      throw new Error(`Falha ao criar usuário: ${createErr?.message || "desconhecido"}`);
    }

    const newId = created.user.id;

    // O trigger handle_new_user já criou o profile com is_test=true.
    // Aplicamos segmento e planos via UPDATE (triggers apply_slot_limits cuidam dos limites).
    const { error: updErr } = await supabaseAdmin
      .from("profiles")
      .update({
        nome: data.nome,
        segmento: data.segmento,
        plano1_id: data.plano1_id ?? null,
        plano2_id: data.plano2_id ?? null,
        bonus_id: data.bonus_id ?? null,
        created_by: context.userId,
        is_test: true,
      })
      .eq("id", newId);
    if (updErr) {
      // Rollback do auth user para não deixar lixo
      await supabaseAdmin.auth.admin.deleteUser(newId).catch(() => {});
      throw new Error(`Falha ao configurar perfil: ${updErr.message}`);
    }

    return { id: newId, email };
  });

export const deleteTestUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Verificar que é mesmo um usuário de teste antes de apagar
    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, is_test")
      .eq("id", data.id)
      .maybeSingle();
    if (profErr) throw new Error(profErr.message);
    if (!prof) throw new Error("Perfil não encontrado.");
    if (!prof.is_test) throw new Error("Este usuário não é de teste; ação bloqueada.");

    await supabaseAdmin.from("brand_kits").delete().eq("user_id", data.id);
    await supabaseAdmin.from("user_sequences").delete().eq("user_id", data.id);

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (delErr) throw new Error(`Falha ao excluir auth user: ${delErr.message}`);

    return { ok: true };
  });
