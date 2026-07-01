// Server function da aba Divulgação (admin) — extraído de DivulgacaoTab.tsx (Fase 9.1).
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/repository/authz";
import type { Plan } from "@/components/admin/divulgacao/types";

// Substitui DivulgacaoTab.useEffect(load plans)
export const loadDivulgacaoPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("plans")
      .select("id,codigo,nome,tipo,ativo,preco_maximo_brl")
      .order("codigo");
    return { plans: (data as unknown as Plan[]) || [] };
  });
