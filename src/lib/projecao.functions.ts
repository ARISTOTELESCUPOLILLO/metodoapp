// Server functions da aba Projeção (admin) — extraído de ProjecaoTab.tsx (Fase 9).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/repository/authz";
import type { Plan, Profile, Settings } from "@/components/admin/projecao/types";

const DEFAULT_SETTINGS: Settings = {
  usd_brl_rate: 5.8,
  falai_balance_usd: 0,
  openai_balance_usd: 0,
  image_price_usd: 0.08,
  render_price_usd: 1.6,
  geracao_price_usd: 0.013,
};

const PROFILE_COLUMNS =
  "id,nome,email,is_test," +
  "plano1_id,plano1_inicio,plano1_imgs_usadas,plano1_imgs_limite,plano1_renders_usados,plano1_renders_limite,plano1_geracoes_usadas,plano1_geracoes_limite,plano1_preco_brl," +
  "plano2_id,plano2_inicio,plano2_imgs_usadas,plano2_imgs_limite,plano2_renders_usados,plano2_renders_limite,plano2_geracoes_usadas,plano2_geracoes_limite,plano2_preco_brl," +
  "bonus_id,bonus_inicio,bonus_imgs_usadas,bonus_imgs_limite,bonus_renders_usados,bonus_renders_limite,bonus_geracoes_usadas,bonus_geracoes_limite,bonus_preco_brl";

// Substitui ProjecaoTab.load() — settings + perfis + planos ativos + admins,
// numa só chamada.
export const loadProjecaoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [{ data: s }, { data: profs }, { data: pls }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("app_settings")
        .select(
          "usd_brl_rate,image_price_usd,render_price_usd,geracao_price_usd,falai_balance_usd,openai_balance_usd",
        )
        .eq("id", true)
        .maybeSingle(),
      supabaseAdmin.from("profiles").select(PROFILE_COLUMNS),
      supabaseAdmin.from("plans").select("id,codigo,nome,tipo").eq("ativo", true),
      supabaseAdmin.from("user_roles").select("user_id,role"),
    ]);

    const settings: Settings = {
      usd_brl_rate: Number(s?.usd_brl_rate ?? DEFAULT_SETTINGS.usd_brl_rate),
      falai_balance_usd: Number(s?.falai_balance_usd ?? 0),
      openai_balance_usd: Number(s?.openai_balance_usd ?? 0),
      image_price_usd: Number(s?.image_price_usd ?? DEFAULT_SETTINGS.image_price_usd),
      render_price_usd: Number(s?.render_price_usd ?? DEFAULT_SETTINGS.render_price_usd),
      geracao_price_usd: Number(s?.geracao_price_usd ?? DEFAULT_SETTINGS.geracao_price_usd),
    };
    const adminIds = (roles || []).filter((r) => r.role === "admin").map((r) => r.user_id);

    return {
      settings,
      profiles: (profs as unknown as Profile[]) || [],
      plans: (pls as unknown as Plan[]) || [],
      adminIds,
    };
  });

// Substitui ProjecaoTab.addBalance()
export const updateSupplierBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ supplier: z.enum(["falai", "openai"]), val: z.number().positive() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const update =
      data.supplier === "falai"
        ? { falai_balance_usd: data.val }
        : { openai_balance_usd: data.val };
    const { error } = await supabaseAdmin.from("app_settings").update(update).eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
