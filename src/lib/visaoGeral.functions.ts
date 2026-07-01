// Server function da aba Painel (Visão Geral, admin) — extraído de
// VisaoGeralTab.tsx (Fase 9).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/repository/authz";
import type { Plan, Profile, Settings } from "@/components/admin/visaoGeral/types";

// Substitui VisaoGeralTab.load()
export const loadVisaoGeralData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [{ data: profs }, { data: pls }, { data: roles }, { data: s }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id,nome,email,status,is_test," +
            "plano1_id,plano1_preco_brl," +
            "plano2_id,plano2_preco_brl," +
            "bonus_id,bonus_preco_brl",
        ),
      supabaseAdmin
        .from("plans")
        .select("id,codigo,limite_imagens,limite_renders,limite_geracoes")
        .eq("ativo", true),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin
        .from("app_settings")
        .select(
          "image_price_usd,render_price_usd,geracao_price_usd,usd_brl_rate,falai_balance_usd,openai_balance_usd",
        )
        .eq("id", true)
        .maybeSingle(),
    ]);

    return {
      profiles: (profs || []) as unknown as Profile[],
      plans: (pls || []) as Plan[],
      adminIds: (roles || []).filter((r) => r.role === "admin").map((r) => r.user_id),
      settings: s ? (s as unknown as Settings) : null,
    };
  });
