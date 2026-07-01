// Server functions da aba Custos (admin) — extraído de CustosTab.tsx (Fase 9).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/repository/authz";

export interface CustosLog {
  user_id: string | null;
  evento: string;
  qtd_imagens: number;
  qtd_renders: number;
  qtd_geracoes: number;
  custo_usd: number;
  created_at: string;
}

export interface CustosAllTimeLog {
  evento: string;
  custo_usd: number;
  user_id: string | null;
}

export interface CustosPlan {
  id: string;
  codigo: string;
  nome: string;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
  preco_maximo_brl: number;
  ativo: boolean;
}

export interface CustosProfile {
  id: string;
  email: string;
  nome: string;
  is_test: boolean;
  plano1_id: string | null;
  plano2_id: string | null;
  bonus_id: string | null;
  plano1_preco_brl: number | null;
  plano2_preco_brl: number | null;
  bonus_preco_brl: number | null;
}

export interface CustosSettings {
  usd_brl_rate: number;
  falai_balance_usd: number;
  openai_balance_usd: number;
  image_base_price_usd: number;
  image_price_usd: number;
  render_price_usd: number;
  geracao_price_usd: number;
}

const DEFAULT_SETTINGS: CustosSettings = {
  usd_brl_rate: 5.8,
  falai_balance_usd: 0,
  openai_balance_usd: 0,
  image_base_price_usd: 0.046,
  image_price_usd: 0.058,
  render_price_usd: 1.6,
  geracao_price_usd: 0.013,
};

// Substitui CustosTab.load() — logs do período + histórico total + planos +
// perfis + admins + configurações, numa só chamada.
export const loadCustosData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ days: z.number().int().min(1).max(365) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const [
      { data: ls },
      { data: ps },
      { data: profs },
      { data: cfg },
      { data: roles },
      { data: allLogs },
    ] = await Promise.all([
      supabaseAdmin
        .from("usage_logs")
        .select("user_id,evento,qtd_imagens,qtd_renders,qtd_geracoes,custo_usd,created_at")
        .gte("created_at", since),
      supabaseAdmin
        .from("plans")
        .select(
          "id,codigo,nome,limite_imagens,limite_renders,limite_geracoes,preco_maximo_brl,ativo",
        ),
      supabaseAdmin
        .from("profiles")
        .select(
          "id,email,nome,is_test,plano1_id,plano2_id,bonus_id,plano1_preco_brl,plano2_preco_brl,bonus_preco_brl",
        ),
      supabaseAdmin
        .from("app_settings")
        .select(
          "usd_brl_rate,falai_balance_usd,openai_balance_usd,image_base_price_usd,image_price_usd,render_price_usd,geracao_price_usd",
        )
        .eq("id", true)
        .maybeSingle(),
      supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
      supabaseAdmin
        .from("usage_logs")
        .select("evento,custo_usd,user_id")
        .in("evento", ["image.generate", "video.generate", "gerar_conteudo_mop"]),
    ]);

    const settings: CustosSettings = cfg
      ? {
          usd_brl_rate: Number(cfg.usd_brl_rate) || DEFAULT_SETTINGS.usd_brl_rate,
          falai_balance_usd: Number(cfg.falai_balance_usd) || 0,
          openai_balance_usd: Number(cfg.openai_balance_usd) || 0,
          image_base_price_usd:
            Number(cfg.image_base_price_usd) || DEFAULT_SETTINGS.image_base_price_usd,
          image_price_usd: Number(cfg.image_price_usd) || DEFAULT_SETTINGS.image_price_usd,
          render_price_usd: Number(cfg.render_price_usd) || DEFAULT_SETTINGS.render_price_usd,
          geracao_price_usd: Number(cfg.geracao_price_usd) || DEFAULT_SETTINGS.geracao_price_usd,
        }
      : DEFAULT_SETTINGS;

    return {
      logs: (ls as CustosLog[]) || [],
      allTimeLogs: (allLogs as CustosAllTimeLog[]) || [],
      plans: (ps as unknown as CustosPlan[]) || [],
      profiles: (profs as unknown as CustosProfile[]) || [],
      adminIds: (roles || []).map((r) => r.user_id),
      settings,
    };
  });

// Substitui CustosTab.zerarConsumo() — a própria RPC também tem checagem de
// admin (ver migration 20260630120000), esta é a segunda camada de defesa.
export const resetAllUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.rpc("reset_all_usage");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Substitui CustosTab.saveMax()
export const updatePlanPrecoMaximo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ planId: z.string().uuid(), val: z.number() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("plans")
      .update({ preco_maximo_brl: data.val })
      .eq("id", data.planId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
