// Server function da aba Clientes (Financeiro, admin) — extraído de
// ClientesFinanceiroTab.tsx (Fase 9).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/repository/authz";
import type { Plan, Profile } from "@/components/admin/clientesFinanceiro/types";

// Substitui ClientesFinanceiroTab.load()
export const loadClientesFinanceiroData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [{ data: profs }, { data: pls }, { data: roles }, { data: s }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id,nome,email,status,is_test,segmento," +
            "plano1_id,plano1_inicio,plano1_preco_brl," +
            "plano2_id,plano2_inicio,plano2_preco_brl," +
            "bonus_id,bonus_inicio,bonus_preco_brl",
        )
        .eq("is_test", false),
      supabaseAdmin
        .from("plans")
        .select("id,codigo,nome,tipo,limite_imagens,limite_renders,limite_geracoes")
        .eq("ativo", true),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin
        .from("app_settings")
        .select("usd_brl_rate,image_price_usd,render_price_usd,geracao_price_usd")
        .eq("id", true)
        .maybeSingle(),
    ]);

    const adminIds = (roles || []).filter((r) => r.role === "admin").map((r) => r.user_id);

    return {
      profiles: (profs || []) as unknown as Profile[],
      plans: (pls || []) as Plan[],
      adminIds,
      usdRate: Number(s?.usd_brl_rate) || 5.8,
      imgRef: Number(s?.image_price_usd) || 0.058,
      renderPrice: Number(s?.render_price_usd) || 1.6,
      geracaoPrice: Number(s?.geracao_price_usd) || 0.013,
    };
  });
