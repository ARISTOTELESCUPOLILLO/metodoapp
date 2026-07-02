// Cálculos derivados da aba Projeção — extraído de ProjecaoTab.tsx (Fase 9).
// Funções puras: recebem os dados brutos (perfis, planos, admins, configurações)
// e devolvem as projeções por slot + os totais agregados por janela de vencimento.
import { mopMonthlyCost, mopSequenceSize, planExtrasMonthlyCost } from "@/lib/costs";
import {
  BUCKETS,
  type Bucket,
  type BucketTotals,
  type Plan,
  type Profile,
  type SlotProj,
  type Settings,
} from "./types";

function calcEndDate(inicio: string | null, tipo: string): Date | null {
  if (!inicio) return null;
  const d = new Date(inicio);
  if (tipo === "mensal") {
    d.setMonth(d.getMonth() + 1);
    return d;
  }
  if (tipo === "anual") {
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  return null;
}

function toBucket(daysLeft: number | null): Bucket {
  if (daysLeft === null) return "sem_venc";
  if (daysLeft <= 30) return "0-30";
  if (daysLeft <= 60) return "31-60";
  if (daysLeft <= 90) return "61-90";
  return "90+";
}

export function buildProjections(
  profiles: Profile[],
  plans: Plan[],
  adminIds: Set<string>,
  s: Settings,
): SlotProj[] {
  const planMap = new Map(plans.map((p) => [p.id, p]));
  const now = new Date();
  const out: SlotProj[] = [];

  for (const prof of profiles) {
    const isTest = prof.is_test;
    const isAdmin = adminIds.has(prof.id);
    const slots = [
      {
        key: "Plano 1",
        planId: prof.plano1_id,
        inicio: prof.plano1_inicio,
        iu: prof.plano1_imgs_usadas,
        il: prof.plano1_imgs_limite,
        ru: prof.plano1_renders_usados,
        rl: prof.plano1_renders_limite,
        gu: prof.plano1_geracoes_usadas,
        gl: prof.plano1_geracoes_limite,
        rtu: prof.plano1_regen_texto_usadas,
        rtl: prof.plano1_regen_texto_limite,
        sgu: prof.plano1_sugestoes_usadas,
        sgl: prof.plano1_sugestoes_limite,
        pgu: prof.plano1_primeira_geracao_usadas,
        pgl: prof.plano1_primeira_geracao_limite,
        preco: prof.plano1_preco_brl || 0,
      },
      {
        key: "Plano 2",
        planId: prof.plano2_id,
        inicio: prof.plano2_inicio,
        iu: prof.plano2_imgs_usadas,
        il: prof.plano2_imgs_limite,
        ru: prof.plano2_renders_usados,
        rl: prof.plano2_renders_limite,
        gu: prof.plano2_geracoes_usadas,
        gl: prof.plano2_geracoes_limite,
        rtu: prof.plano2_regen_texto_usadas,
        rtl: prof.plano2_regen_texto_limite,
        sgu: prof.plano2_sugestoes_usadas,
        sgl: prof.plano2_sugestoes_limite,
        pgu: prof.plano2_primeira_geracao_usadas,
        pgl: prof.plano2_primeira_geracao_limite,
        preco: prof.plano2_preco_brl || 0,
      },
      {
        key: "Bônus",
        planId: prof.bonus_id,
        inicio: prof.bonus_inicio,
        iu: prof.bonus_imgs_usadas,
        il: prof.bonus_imgs_limite,
        ru: prof.bonus_renders_usados,
        rl: prof.bonus_renders_limite,
        gu: prof.bonus_geracoes_usadas,
        gl: prof.bonus_geracoes_limite,
        rtu: prof.bonus_regen_texto_usadas,
        rtl: prof.bonus_regen_texto_limite,
        sgu: prof.bonus_sugestoes_usadas,
        sgl: prof.bonus_sugestoes_limite,
        pgu: prof.bonus_primeira_geracao_usadas,
        pgl: prof.bonus_primeira_geracao_limite,
        preco: prof.bonus_preco_brl || 0,
      },
    ];
    for (const slot of slots) {
      if (!slot.planId) continue;
      const plan = planMap.get(slot.planId);
      if (!plan) continue;
      const remImgs = Math.max(0, slot.il - slot.iu);
      const remRenders = Math.max(0, slot.rl - slot.ru);
      const remGeracoes = Math.max(0, slot.gl - slot.gu);
      // Planos de Sequência (S3/S6/S9) guardam limite_geracoes=0 (convenção
      // "ilimitado por ciclo") — remGeracoes fica sempre 0 pra eles, então o
      // custo OpenAI real (ciclos MOP) usa mopMonthlyCost em vez do contador.
      const seqSize = mopSequenceSize(plan.codigo);
      // Custo restante dos 3 contadores de camada adicional (Gerar outro/
      // Sugestão/Primeira Geração) — reaproveita planExtrasMonthlyCost
      // passando a quantidade RESTANTE no lugar do limite total do plano
      // (a função só multiplica por custo unitário, funciona igual pra
      // "quanto ainda pode custar" quanto pra "quanto custa no total").
      const remExtrasCost = planExtrasMonthlyCost({
        codigo: plan.codigo,
        limite_regen_texto: Math.max(0, slot.rtl - slot.rtu),
        limite_sugestoes: Math.max(0, slot.sgl - slot.sgu),
        limite_primeira_geracao: Math.max(0, slot.pgl - slot.pgu),
      });
      const openaiCost =
        (seqSize ? mopMonthlyCost(seqSize) : remGeracoes * s.geracao_price_usd) + remExtrasCost;
      if (remImgs === 0 && remRenders === 0 && openaiCost === 0) continue;
      const endDate = calcEndDate(slot.inicio, plan.tipo);
      const daysLeft = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / 86400000) : null;
      const falCost = remImgs * s.image_price_usd + remRenders * s.render_price_usd;
      const revenueBrl = isTest || isAdmin ? 0 : slot.preco;
      out.push({
        userName: prof.nome || prof.email,
        userEmail: prof.email,
        isTest,
        isAdmin,
        slot: slot.key,
        planCodigo: plan.codigo,
        endDate,
        daysLeft,
        bucket: toBucket(daysLeft),
        remImgs,
        remRenders,
        remGeracoes,
        falCost,
        openaiCost,
        revenueBrl,
      });
    }
  }
  return out;
}

export function aggregate(projs: SlotProj[]): Record<Bucket, BucketTotals> {
  const init = (): BucketTotals => ({ fal: 0, openai: 0, revenue: 0, slots: 0 });
  const agg = Object.fromEntries(BUCKETS.map((b) => [b, init()])) as Record<Bucket, BucketTotals>;
  for (const p of projs) {
    agg[p.bucket].fal += p.falCost;
    agg[p.bucket].openai += p.openaiCost;
    agg[p.bucket].revenue += p.revenueBrl;
    agg[p.bucket].slots += 1;
  }
  return agg;
}
