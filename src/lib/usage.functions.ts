// Server function da aba Consumo (admin) — extraído de UsageTab.tsx (Fase 9).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/repository/authz";
import type { Log, ProfileInfo } from "@/components/admin/usage/types";

interface ProfRow {
  id: string;
  email: string;
  nome: string | null;
  is_test: boolean;
  created_by?: string | null;
  bonus_assigned_by?: string | null;
}

// Substitui UsageTab.load()
export const loadUsageData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ days: z.number().int().min(1).max(365) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const [{ data: ls }, profsResult, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from("usage_logs")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin.from("profiles").select("id,email,nome,is_test,created_by,bonus_assigned_by"),
      supabaseAdmin.from("app_settings").select("usd_brl_rate").eq("id", true).maybeSingle(),
    ]);

    // Fallback para projetos onde as colunas de rastreio ainda não foram migradas
    const profs: ProfRow[] = profsResult.error
      ? (await supabaseAdmin.from("profiles").select("id,email,nome,is_test")).data || []
      : profsResult.data || [];

    const logs = (ls as Log[]) || [];
    const profileMap: Record<string, ProfileInfo> = {};
    const adminIds = new Set<string>();
    profs.forEach((p) => {
      profileMap[p.id] = {
        email: p.email,
        nome: p.nome,
        is_test: !!p.is_test,
        created_by: p.created_by ?? null,
        bonus_assigned_by: p.bonus_assigned_by ?? null,
      };
      if (p.created_by) adminIds.add(p.created_by);
      if (p.bonus_assigned_by) adminIds.add(p.bonus_assigned_by);
    });
    // Também coleta admins que geraram via impersonation (impersonated_by = admin que gerou).
    logs.forEach((l) => {
      if (l.impersonated_by) adminIds.add(l.impersonated_by);
    });

    const adminEmails: Record<string, string> = {};
    if (adminIds.size > 0) {
      const { data: adminProfs } = await supabaseAdmin
        .from("profiles")
        .select("id,email")
        .in("id", Array.from(adminIds));
      (adminProfs || []).forEach((a) => {
        adminEmails[a.id] = a.email;
      });
    }

    return {
      logs,
      profiles: profileMap,
      adminEmails,
      usdRate: settings ? Number(settings.usd_brl_rate) : 5.8,
    };
  });
