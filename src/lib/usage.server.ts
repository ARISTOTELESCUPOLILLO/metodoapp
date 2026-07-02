// Server-only helpers para débito de uso (imagens / renders / gerações).
// Usa supabaseAdmin para validar o token do usuário e chamar a RPC debit_usage,
// e registra um log em usage_logs para o painel admin.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAdmin as checkIsAdmin } from "@/repository/authz";

export type DebitKind = "image" | "render" | "geracao";

export async function getUserIdFromRequest(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  // Valida o token de verdade contra o Supabase (assinatura + expiração + revogação) —
  // decodificar o payload localmente sem checar a assinatura permitia forjar um JWT
  // com qualquer `sub` (ex.: UUID de um admin) e ser aceito como autenticado.
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

// Resolve o usuário efetivo para débito e logs.
// Quando admin impersona um usuário teste, o débito vai para o teste (não para o admin),
// e impersonatedBy guarda o UUID do admin que gerou.
export async function resolveEffectiveUser(
  request: Request,
): Promise<{ userId: string; impersonatedBy?: string } | null> {
  const callerUserId = await getUserIdFromRequest(request);
  if (!callerUserId) return null;

  const rawImpersonate = request.headers.get("x-impersonate-user-id");
  if (rawImpersonate) {
    if (await checkIsAdmin(callerUserId)) {
      return { userId: rawImpersonate, impersonatedBy: callerUserId };
    }
  }

  return { userId: callerUserId };
}

const RATE_LIMIT_PER_HOUR = 15;

export async function checkRateLimit(
  userId: string,
): Promise<{ ok: boolean; usedLastHour: number }> {
  if (await checkIsAdmin(userId)) return { ok: true, usedLastHour: 0 };

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("usage_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gt("qtd_geracoes", 0)
    .gte("created_at", oneHourAgo);

  if (error) return { ok: true, usedLastHour: 0 }; // fail open
  const usedLastHour = count ?? 0;
  return { ok: usedLastHour < RATE_LIMIT_PER_HOUR, usedLastHour };
}

// Motivo de uma falha de saldo — permite que a UI/API diferencie "usuário sem
// plano atribuído" (configuração faltando, comum em usuário de teste recém-
// criado) de "plano esgotado" ou "plano expirado", em vez de uma mensagem
// genérica única que faz qualquer uma das três parecer bug do sistema.
export type BalanceFailReason =
  | "profile_not_found"
  | "no_plan_assigned"
  | "plan_expired"
  | "limit_exceeded";

export async function checkBalance(
  userId: string,
  imgs: number,
  renders: number,
  geracoes = 0,
  preferredSlot?: "plano1" | "plano2" | "bonus",
  // Novos contadores de texto: "Gerar outro" de bloco (regenTexto) e "Sugestão"
  // (sugestoes). Parâmetro no FINAL para não quebrar os chamadores existentes
  // (generate-content, generate-caption, generate-image, generate-pu-copy,
  // confirm-voice), que continuam chamando sem passá-lo.
  extra?: { regenTexto?: number; sugestoes?: number },
): Promise<{ ok: boolean; isAdmin: boolean; reason?: BalanceFailReason }> {
  const regenTexto = extra?.regenTexto ?? 0;
  const sugestoes = extra?.sugestoes ?? 0;
  const { data: p, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "plano1_id, plano1_imgs_limite, plano1_imgs_usadas, plano1_renders_limite, plano1_renders_usados, plano1_geracoes_limite, plano1_geracoes_usadas, plano1_regen_texto_limite, plano1_regen_texto_usadas, plano1_sugestoes_limite, plano1_sugestoes_usadas, plano1_expira_em, plano2_id, plano2_imgs_limite, plano2_imgs_usadas, plano2_renders_limite, plano2_renders_usados, plano2_geracoes_limite, plano2_geracoes_usadas, plano2_regen_texto_limite, plano2_regen_texto_usadas, plano2_sugestoes_limite, plano2_sugestoes_usadas, plano2_expira_em, bonus_id, bonus_imgs_limite, bonus_imgs_usadas, bonus_renders_limite, bonus_renders_usados, bonus_geracoes_limite, bonus_geracoes_usadas, bonus_regen_texto_limite, bonus_regen_texto_usadas, bonus_sugestoes_limite, bonus_sugestoes_usadas, bonus_expira_em",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error || !p) return { ok: false, isAdmin: false, reason: "profile_not_found" };

  const fits = (lim: number, used: number, need: number) => lim === 0 || lim - used >= need;
  const notExpired = (expiraEm: string | null) =>
    expiraEm == null || new Date(expiraEm) > new Date();
  const slotOk = (
    id: string | null,
    iLim: number,
    iUsed: number,
    rLim: number,
    rUsed: number,
    gLim: number,
    gUsed: number,
    rtLim: number,
    rtUsed: number,
    sgLim: number,
    sgUsed: number,
    expiraEm: string | null,
  ) =>
    !!id &&
    notExpired(expiraEm) &&
    fits(iLim, iUsed, imgs) &&
    fits(rLim, rUsed, renders) &&
    fits(gLim, gUsed, geracoes) &&
    fits(rtLim, rtUsed, regenTexto) &&
    fits(sgLim, sgUsed, sugestoes);
  // Classifica por que um slot específico não serve — usado só quando o slot
  // falhou em slotOk, para reportar a causa real em vez de "esgotado" genérico.
  const classifySlot = (id: string | null, expiraEm: string | null): BalanceFailReason =>
    !id ? "no_plan_assigned" : !notExpired(expiraEm) ? "plan_expired" : "limit_exceeded";

  // Cada plano é independente: checar apenas o slot preferido.
  // Sem fallback para outros slots — se esgotou, esgotou.
  if (preferredSlot === "plano1") {
    const ok = slotOk(
      p.plano1_id,
      p.plano1_imgs_limite,
      p.plano1_imgs_usadas,
      p.plano1_renders_limite,
      p.plano1_renders_usados,
      p.plano1_geracoes_limite ?? 0,
      p.plano1_geracoes_usadas ?? 0,
      p.plano1_regen_texto_limite ?? 0,
      p.plano1_regen_texto_usadas ?? 0,
      p.plano1_sugestoes_limite ?? 0,
      p.plano1_sugestoes_usadas ?? 0,
      p.plano1_expira_em ?? null,
    );
    return {
      ok,
      isAdmin: false,
      reason: ok ? undefined : classifySlot(p.plano1_id, p.plano1_expira_em ?? null),
    };
  }
  if (preferredSlot === "plano2") {
    const ok = slotOk(
      p.plano2_id,
      p.plano2_imgs_limite,
      p.plano2_imgs_usadas,
      p.plano2_renders_limite,
      p.plano2_renders_usados,
      p.plano2_geracoes_limite ?? 0,
      p.plano2_geracoes_usadas ?? 0,
      p.plano2_regen_texto_limite ?? 0,
      p.plano2_regen_texto_usadas ?? 0,
      p.plano2_sugestoes_limite ?? 0,
      p.plano2_sugestoes_usadas ?? 0,
      p.plano2_expira_em ?? null,
    );
    return {
      ok,
      isAdmin: false,
      reason: ok ? undefined : classifySlot(p.plano2_id, p.plano2_expira_em ?? null),
    };
  }
  if (preferredSlot === "bonus") {
    const ok = slotOk(
      p.bonus_id,
      p.bonus_imgs_limite,
      p.bonus_imgs_usadas,
      p.bonus_renders_limite,
      p.bonus_renders_usados,
      p.bonus_geracoes_limite ?? 0,
      p.bonus_geracoes_usadas ?? 0,
      p.bonus_regen_texto_limite ?? 0,
      p.bonus_regen_texto_usadas ?? 0,
      p.bonus_sugestoes_limite ?? 0,
      p.bonus_sugestoes_usadas ?? 0,
      p.bonus_expira_em ?? null,
    );
    return {
      ok,
      isAdmin: false,
      reason: ok ? undefined : classifySlot(p.bonus_id, p.bonus_expira_em ?? null),
    };
  }

  // Sem preferredSlot: compat retroativo — verifica qualquer slot disponível.
  const ok =
    slotOk(
      p.plano1_id,
      p.plano1_imgs_limite,
      p.plano1_imgs_usadas,
      p.plano1_renders_limite,
      p.plano1_renders_usados,
      p.plano1_geracoes_limite ?? 0,
      p.plano1_geracoes_usadas ?? 0,
      p.plano1_regen_texto_limite ?? 0,
      p.plano1_regen_texto_usadas ?? 0,
      p.plano1_sugestoes_limite ?? 0,
      p.plano1_sugestoes_usadas ?? 0,
      p.plano1_expira_em ?? null,
    ) ||
    slotOk(
      p.plano2_id,
      p.plano2_imgs_limite,
      p.plano2_imgs_usadas,
      p.plano2_renders_limite,
      p.plano2_renders_usados,
      p.plano2_geracoes_limite ?? 0,
      p.plano2_geracoes_usadas ?? 0,
      p.plano2_regen_texto_limite ?? 0,
      p.plano2_regen_texto_usadas ?? 0,
      p.plano2_sugestoes_limite ?? 0,
      p.plano2_sugestoes_usadas ?? 0,
      p.plano2_expira_em ?? null,
    ) ||
    slotOk(
      p.bonus_id,
      p.bonus_imgs_limite,
      p.bonus_imgs_usadas,
      p.bonus_renders_limite,
      p.bonus_renders_usados,
      p.bonus_geracoes_limite ?? 0,
      p.bonus_geracoes_usadas ?? 0,
      p.bonus_regen_texto_limite ?? 0,
      p.bonus_regen_texto_usadas ?? 0,
      p.bonus_sugestoes_limite ?? 0,
      p.bonus_sugestoes_usadas ?? 0,
      p.bonus_expira_em ?? null,
    );

  let reason: BalanceFailReason | undefined;
  if (!ok) {
    const slotIds = [p.plano1_id, p.plano2_id, p.bonus_id];
    if (slotIds.every((id) => !id)) {
      reason = "no_plan_assigned";
    } else {
      const expiraEms = [p.plano1_expira_em, p.plano2_expira_em, p.bonus_expira_em];
      const anyActive = slotIds.some((id, i) => !!id && notExpired(expiraEms[i] ?? null));
      reason = anyActive ? "limit_exceeded" : "plan_expired";
    }
  }

  return { ok, isAdmin: false, reason };
}

// Mensagem amigável por motivo de falha de saldo — usada pelas rotas generate-*
// em vez da mensagem genérica única ("Limite atingido"), que fazia "usuário de
// teste sem plano atribuído" parecer bug do sistema em vez de configuração
// faltando (admin esquece de atribuir plano em TestUsersTab antes de testar).
export function balanceFailMessage(reason?: BalanceFailReason): string {
  switch (reason) {
    case "no_plan_assigned":
      return "Este usuário não tem nenhum plano atribuído — atribua um plano (Plano 1, Plano 2 ou Bônus) antes de gerar.";
    case "plan_expired":
      return "O plano deste usuário expirou — atribua um novo plano ou renove a validade.";
    case "profile_not_found":
      return "Perfil do usuário não encontrado — verifique se o usuário existe.";
    case "limit_exceeded":
    default:
      return "Limite de gerações do plano atingido — fale com o admin.";
  }
}

export async function debitUsage(
  userId: string,
  imgs: number,
  renders: number,
  meta: {
    evento: string;
    modulo?: string;
    payload?: Record<string, unknown>;
    geracoes?: number;
    regenTexto?: number;
    sugestoes?: number;
    custoUsd?: number;
    impersonatedBy?: string;
    preferredSlot?: "plano1" | "plano2" | "bonus";
  },
): Promise<{ slot: string }> {
  const geracoes = meta.geracoes ?? 0;
  const regenTexto = meta.regenTexto ?? 0;
  const sugestoes = meta.sugestoes ?? 0;

  let slot: string | null = null;
  let rpcError: Error | null = null;

  // Admin e usuário comum: mesmo caminho — RPC verifica limites do slot preferido.
  // _preferred_slot é sempre enviado (null quando não informado) — omitir a chave
  // por completo deixa 2 overloads de debit_usage (4 e 5 args) igualmente válidos
  // pro Postgres, que aí recusa a chamada por ambiguidade ("Could not choose the
  // best candidate function"). Ex.: confirm-voice.ts nunca passava preferredSlot.
  const { data: slotData, error } = await supabaseAdmin.rpc("debit_usage", {
    _user_id: userId,
    _imgs: imgs,
    _renders: renders,
    _geracoes: geracoes,
    _preferred_slot: meta.preferredSlot ?? null,
    // Sempre enviados (mesmo 0) — omitir a chave deixaria 2 overloads de
    // debit_usage (5 e 7 args) igualmente válidos pro Postgres, que recusaria
    // a chamada por ambiguidade ("Could not choose the best candidate function").
    _regen_texto: regenTexto,
    _sugestoes: sugestoes,
  });
  if (error) {
    // Captura o erro mas NÃO lança ainda — o log abaixo deve ocorrer mesmo assim.
    rpcError = new Error(error.message || "Falha ao debitar consumo.");
    slot = "sem-plano";
  } else {
    slot = (slotData as string) ?? null;
  }

  // Log SEMPRE — inclusive quando plano esgotado ou inexistente (slot='sem-plano').
  // Nunca cancela o log por causa de falha no RPC.
  try {
    await supabaseAdmin.from("usage_logs").insert({
      user_id: userId,
      evento: meta.evento,
      modulo: meta.modulo ?? null,
      qtd_imagens: imgs,
      qtd_renders: renders,
      qtd_geracoes: geracoes,
      custo_usd: meta.custoUsd ?? null,
      slot: slot ?? null,
      payload: (meta.payload ?? null) as never,
      ...(meta.impersonatedBy ? { impersonated_by: meta.impersonatedBy } : {}),
    });
  } catch (e) {
    console.warn("[usage_logs] insert failed", e);
  }

  // Re-lança após o log para que o caller saiba que não há plano elegível.
  if (rpcError) throw rpcError;

  return { slot: slot || "desconhecido" };
}
