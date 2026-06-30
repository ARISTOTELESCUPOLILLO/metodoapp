// Acesso a dados de perfil + mapeamento de billing.
// Sem React, sem localStorage — só Supabase e tipos puros.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { computeCota, ZERO_COTA, type CotaPorTipo, type PlanoComExtras } from "@/core/personalizacaoMop";
import { isAdmin } from "./authz";

// ── Tipos exportados (canônicos — useProfile.ts re-exporta daqui) ──────────

export interface PlanInfo {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  base_estatico?: number;
  base_carrossel?: number;
  base_estatico_final?: number;
  base_reels?: number;
  limite_imgs_display?: number | null;
  limite_renders_display?: number | null;
  limite_geracoes_display?: number | null;
}

export interface SlotInfo {
  key: "plano1" | "plano2" | "bonus";
  label: string;
  plan: PlanInfo;
  inicio: string | null;
  expiraEm: string | null;
  imgsUsadas: number;
  imgsLimite: number;
  /** Limite exibido ao cliente na régua (Uso Normal). Pode ser menor que imgsLimite (Uso Estendido). */
  imgsLimiteDisplay: number;
  rendersUsados: number;
  rendersLimite: number;
  rendersLimiteDisplay: number;
  geracoesUsadas: number;
  geracoesLimite: number;
  geracoesLimiteDisplay: number;
}

export interface Profile {
  id: string;
  nome: string | null;
  email: string;
  client_code: string | null;
  status: "ativo" | "bloqueado";
  segmento: "SERVIÇOS" | "VAREJO" | "MARCA" | null;
  ultimo_login: string | null;
  is_test?: boolean | null;
  plano1_last_charged_at: string | null;
  plano2_last_charged_at: string | null;
  bonus_last_charged_at: string | null;
  plano1_id: string | null;
  plano1_inicio: string | null;
  plano1_expira_em: string | null;
  plano1_imgs_usadas: number;
  plano1_imgs_limite: number;
  plano1_renders_usados: number;
  plano1_renders_limite: number;
  plano1_geracoes_usadas: number;
  plano1_geracoes_limite: number;
  plano2_id: string | null;
  plano2_inicio: string | null;
  plano2_expira_em: string | null;
  plano2_imgs_usadas: number;
  plano2_imgs_limite: number;
  plano2_renders_usados: number;
  plano2_renders_limite: number;
  plano2_geracoes_usadas: number;
  plano2_geracoes_limite: number;
  bonus_id: string | null;
  bonus_inicio: string | null;
  bonus_expira_em: string | null;
  bonus_imgs_usadas: number;
  bonus_imgs_limite: number;
  bonus_renders_usados: number;
  bonus_renders_limite: number;
  bonus_geracoes_usadas: number;
  bonus_geracoes_limite: number;
  extra_p1_estatico: number;
  extra_p1_carrossel: number;
  extra_p1_estatico_final: number;
  extra_p1_reels: number;
  extra_p2_estatico: number;
  extra_p2_carrossel: number;
  extra_p2_estatico_final: number;
  extra_p2_reels: number;
  extra_b_estatico: number;
  extra_b_carrossel: number;
  extra_b_estatico_final: number;
  extra_b_reels: number;
}

export interface ProfileData {
  profile: Profile | null;
  isAdmin: boolean;
  isSelfAdmin: boolean;
  slots: SlotInfo[];
  cotaPersonalizados: CotaPorTipo;
}

// ── Mapeamento de billing (puro, sem IO) ───────────────────────────────────

export function buildSlots(p: Profile, plansMap: Record<string, PlanInfo>): SlotInfo[] {
  const built: SlotInfo[] = [];

  function push(
    key: SlotInfo["key"],
    label: string,
    planId: string | null,
    inicio: string | null,
    expiraEm: string | null,
    iu: number, il: number,
    ru: number, rl: number,
    gu: number, gl: number,
  ) {
    if (!planId || !plansMap[planId]) return;
    const plan = plansMap[planId];
    built.push({
      key, label, plan, inicio, expiraEm,
      imgsUsadas: iu, imgsLimite: il,
      imgsLimiteDisplay: plan.limite_imgs_display ?? il,
      rendersUsados: ru, rendersLimite: rl,
      rendersLimiteDisplay: plan.limite_renders_display ?? rl,
      geracoesUsadas: gu, geracoesLimite: gl,
      geracoesLimiteDisplay: plan.limite_geracoes_display ?? gl,
    });
  }

  push("plano1", "Plano 1", p.plano1_id, p.plano1_inicio, p.plano1_expira_em ?? null,
    p.plano1_imgs_usadas, p.plano1_imgs_limite,
    p.plano1_renders_usados, p.plano1_renders_limite,
    p.plano1_geracoes_usadas ?? 0, p.plano1_geracoes_limite ?? 0);
  push("plano2", "Plano 2", p.plano2_id, p.plano2_inicio, p.plano2_expira_em ?? null,
    p.plano2_imgs_usadas, p.plano2_imgs_limite,
    p.plano2_renders_usados, p.plano2_renders_limite,
    p.plano2_geracoes_usadas ?? 0, p.plano2_geracoes_limite ?? 0);
  push("bonus", "Bônus", p.bonus_id, p.bonus_inicio, p.bonus_expira_em ?? null,
    p.bonus_imgs_usadas, p.bonus_imgs_limite,
    p.bonus_renders_usados, p.bonus_renders_limite,
    p.bonus_geracoes_usadas ?? 0, p.bonus_geracoes_limite ?? 0);

  return built;
}

export function buildCotaPersonalizados(p: Profile, plansMap: Record<string, PlanInfo>): CotaPorTipo {
  const entries: PlanoComExtras[] = [
    {
      plan: p.plano1_id ? (plansMap[p.plano1_id] ?? null) : null,
      extras: {
        estatico: p.extra_p1_estatico,
        carrossel: p.extra_p1_carrossel,
        estatico_final: p.extra_p1_estatico_final,
        reels: p.extra_p1_reels,
      },
    },
    {
      plan: p.plano2_id ? (plansMap[p.plano2_id] ?? null) : null,
      extras: {
        estatico: p.extra_p2_estatico,
        carrossel: p.extra_p2_carrossel,
        estatico_final: p.extra_p2_estatico_final,
        reels: p.extra_p2_reels,
      },
    },
    {
      plan: p.bonus_id ? (plansMap[p.bonus_id] ?? null) : null,
      extras: {
        estatico: p.extra_b_estatico,
        carrossel: p.extra_b_carrossel,
        estatico_final: p.extra_b_estatico_final,
        reels: p.extra_b_reels,
      },
    },
  ];
  return computeCota(entries);
}

// ── Fetch com supabaseAdmin (server-only) ──────────────────────────────────

export async function fetchProfileData(callerId: string, targetId: string): Promise<ProfileData> {
  const effectiveId = targetId || callerId;

  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", effectiveId)
    .maybeSingle();

  const p: Profile | null = prof
    ? { ...prof, status: prof.status as Profile["status"], segmento: prof.segmento as Profile["segmento"] }
    : null;

  const [targetIsAdmin, callerIsAdmin] = await Promise.all([
    isAdmin(effectiveId),
    effectiveId !== callerId ? isAdmin(callerId) : Promise.resolve(false),
  ]);

  const isSelfAdminResolved = effectiveId !== callerId ? callerIsAdmin : targetIsAdmin;

  if (!p) {
    return { profile: null, isAdmin: targetIsAdmin, isSelfAdmin: isSelfAdminResolved, slots: [], cotaPersonalizados: ZERO_COTA };
  }

  const ids = [p.plano1_id, p.plano2_id, p.bonus_id].filter(Boolean) as string[];
  let plansMap: Record<string, PlanInfo> = {};
  if (ids.length) {
    const { data: pls } = await supabaseAdmin
      .from("plans")
      .select(
        "id,codigo,nome,tipo,base_estatico,base_carrossel,base_estatico_final,base_reels,limite_imgs_display,limite_renders_display,limite_geracoes_display",
      )
      .in("id", ids);
    plansMap = Object.fromEntries((pls || []).map((pl) => [pl.id, pl as PlanInfo]));
  }

  return {
    profile: p,
    isAdmin: targetIsAdmin,
    isSelfAdmin: isSelfAdminResolved,
    slots: buildSlots(p, plansMap),
    cotaPersonalizados: buildCotaPersonalizados(p, plansMap),
  };
}
