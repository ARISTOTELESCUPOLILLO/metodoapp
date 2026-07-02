// Server functions da aba Planos (admin) — extraído de PlansTab.tsx (Fase 9).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/repository/authz";
import type { Costs, Plan } from "@/components/admin/plans/types";

// Fallback só para quando a query de app_settings falhar/vier vazia — os
// valores reais vêm do banco (linha única, id=true). imageRef alinhado com
// COST_USD.image_edit (costs.ts) — 0.058 estava desatualizado em relação ao
// custo real debitado por imagem com referência (0.08).
const DEFAULT_COSTS: Costs = { imageRef: 0.08, video: 1.6, content: 0.013 };

// Substitui PlansTab.load()
export const loadPlansData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [{ data: p }, { data: s }] = await Promise.all([
      supabaseAdmin.from("plans").select("*").order("nome"),
      supabaseAdmin
        .from("app_settings")
        .select("usd_brl_rate,image_price_usd,render_price_usd,geracao_price_usd")
        .eq("id", true)
        .maybeSingle(),
    ]);

    const usdRate = Number(s?.usd_brl_rate) || 5.8;
    const costs: Costs = s
      ? {
          imageRef: Number(s.image_price_usd) || DEFAULT_COSTS.imageRef,
          video: Number(s.render_price_usd) || DEFAULT_COSTS.video,
          content: Number(s.geracao_price_usd) || DEFAULT_COSTS.content,
        }
      : DEFAULT_COSTS;

    return { plans: (p as Plan[]) || [], usdRate, costs };
  });

const planPayloadSchema = z.object({
  id: z.string().uuid().optional(),
  codigo: z.string().min(1),
  nome: z.string().min(1),
  tipo: z.string().min(1),
  limite_imagens: z.number(),
  limite_renders: z.number(),
  limite_geracoes: z.number(),
  limite_imgs_display: z.number().nullable(),
  limite_renders_display: z.number().nullable(),
  preco_maximo_brl: z.number(),
  ativo: z.boolean(),
  base_estatico: z.number(),
  base_carrossel: z.number(),
  base_estatico_final: z.number(),
  base_reels: z.number(),
});

// Substitui PlansTab.save()
export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => planPayloadSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { id, ...rest } = data;
    const payload = { ...rest, limite_geracoes_display: null };
    const { error } = id
      ? await supabaseAdmin.from("plans").update(payload).eq("id", id)
      : await supabaseAdmin.from("plans").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Substitui PlansTab.remove() — o check original consultava profiles.plano_id,
// coluna legada que desde a migração 20260513184112 nunca mais é escrita
// (dados reais ficam em plano1_id/plano2_id/bonus_id). Isso fazia a checagem
// de segurança sempre reportar "0 usuários" mesmo com clientes reais no
// plano — o DELETE só não corrompia nada porque a FK (profiles/invited_emails
// -> plans, sem ON DELETE) rejeitava a query no banco, mas sem mensagem
// nenhuma pro admin (erro nunca era capturado). Corrigido: conta uso real nas
// 3 colunas atuais, nas duas tabelas que referenciam plans.
export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ planId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const orFilter = `plano1_id.eq.${data.planId},plano2_id.eq.${data.planId},bonus_id.eq.${data.planId}`;
    const [profilesCount, invitesCount] = await Promise.all([
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).or(orFilter),
      supabaseAdmin
        .from("invited_emails")
        .select("id", { count: "exact", head: true })
        .or(orFilter),
    ]);
    const totalCount = (profilesCount.count || 0) + (invitesCount.count || 0);
    if (totalCount > 0) {
      throw new Error(
        `Não é possível excluir: ${totalCount} usuário(s)/convite(s) usando este plano.`,
      );
    }

    const { error } = await supabaseAdmin.from("plans").delete().eq("id", data.planId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
