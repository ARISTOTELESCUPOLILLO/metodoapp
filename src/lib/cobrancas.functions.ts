// Server functions da aba Cobranças (admin) — extraído de CobrancasTab.tsx (Fase 9).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/repository/authz";
import type { Plan, Row } from "@/components/admin/cobrancas/types";

// Substitui CobrancasTab.load() — perfis (não-teste) + planos + admins.
export const loadCobrancasData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [{ data: profs }, { data: pls }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id,nome,email,client_code,plano1_id,plano1_inicio,plano1_last_charged_at,plano1_contrato_fim,plano1_meses_contrato,plano2_id,plano2_inicio,plano2_last_charged_at,plano2_contrato_fim,plano2_meses_contrato,bonus_id,bonus_inicio,bonus_last_charged_at,bonus_contrato_fim,bonus_meses_contrato",
        )
        .eq("is_test", false),
      supabaseAdmin.from("plans").select("id,codigo"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
    ]);

    return {
      profiles: (profs as Row[]) || [],
      plans: (pls as Plan[]) || [],
      adminIds: (roles || []).filter((r) => r.role === "admin").map((r) => r.user_id),
    };
  });

const slotSchema = z.object({
  userId: z.string().uuid(),
  slot: z.enum(["plano1", "plano2", "bonus"]),
});

// Substitui CobrancasTab.markCharged()
export const markCharged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => slotSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const now = new Date().toISOString();
    const update =
      data.slot === "plano1"
        ? { plano1_last_charged_at: now }
        : data.slot === "plano2"
          ? { plano2_last_charged_at: now }
          : { bonus_last_charged_at: now };
    const { error } = await supabaseAdmin.from("profiles").update(update).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Substitui CobrancasTab.renewCycle()
export const renewCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => slotSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const now = new Date().toISOString();
    const update =
      data.slot === "plano1"
        ? { plano1_inicio: now }
        : data.slot === "plano2"
          ? { plano2_inicio: now }
          : { bonus_inicio: now };
    const { error } = await supabaseAdmin.from("profiles").update(update).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Estende o fim do contrato — diferente de renewCycle (que mexe em `inicio` e
// só afeta o ciclo mensal): aqui incrementamos `meses_contrato`, o que o
// trigger apply_slot_limits usa pra recalcular `contrato_fim` a partir do
// `inicio` atual, sem tocar em consumo nem no ciclo mensal.
export const renewContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        slot: z.enum(["plano1", "plano2", "bonus"]),
        mesesAdicionais: z.number().int().min(1).default(3),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const col = `${data.slot}_meses_contrato` as const;
    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select(col)
      .eq("id", data.userId)
      .maybeSingle();
    if (profErr) throw new Error(profErr.message);
    const atual = Number((prof as Record<string, number> | null)?.[col] ?? 1);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ [col]: atual + data.mesesAdicionais } as never)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
