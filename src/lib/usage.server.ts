// Server-only helpers para débito de uso (imagens / renders / gerações).
// Usa supabaseAdmin para validar o token do usuário e chamar a RPC debit_usage,
// e registra um log em usage_logs para o painel admin.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: callerUserId,
      _role: "admin",
    });
    if (isAdmin === true) {
      return { userId: rawImpersonate, impersonatedBy: callerUserId };
    }
  }

  return { userId: callerUserId };
}

const RATE_LIMIT_PER_HOUR = 15;

export async function checkRateLimit(
  userId: string,
): Promise<{ ok: boolean; usedLastHour: number }> {
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (isAdmin === true) return { ok: true, usedLastHour: 0 };

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

export async function checkBalance(
  userId: string,
  imgs: number,
  renders: number,
  geracoes = 0,
  preferredSlot?: "plano1" | "plano2" | "bonus",
): Promise<{ ok: boolean; isAdmin: boolean }> {
  const { data: p, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "plano1_id, plano1_imgs_limite, plano1_imgs_usadas, plano1_renders_limite, plano1_renders_usados, plano1_geracoes_limite, plano1_geracoes_usadas, plano1_expira_em, plano2_id, plano2_imgs_limite, plano2_imgs_usadas, plano2_renders_limite, plano2_renders_usados, plano2_geracoes_limite, plano2_geracoes_usadas, plano2_expira_em, bonus_id, bonus_imgs_limite, bonus_imgs_usadas, bonus_renders_limite, bonus_renders_usados, bonus_geracoes_limite, bonus_geracoes_usadas, bonus_expira_em",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error || !p) return { ok: false, isAdmin: false };

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
    expiraEm: string | null,
  ) =>
    !!id &&
    notExpired(expiraEm) &&
    fits(iLim, iUsed, imgs) &&
    fits(rLim, rUsed, renders) &&
    fits(gLim, gUsed, geracoes);

  // Cada plano é independente: checar apenas o slot preferido.
  // Sem fallback para outros slots — se esgotou, esgotou.
  if (preferredSlot === "plano1") {
    return {
      ok: slotOk(
        p.plano1_id,
        p.plano1_imgs_limite,
        p.plano1_imgs_usadas,
        p.plano1_renders_limite,
        p.plano1_renders_usados,
        p.plano1_geracoes_limite ?? 0,
        p.plano1_geracoes_usadas ?? 0,
        p.plano1_expira_em ?? null,
      ),
      isAdmin: false,
    };
  }
  if (preferredSlot === "plano2") {
    return {
      ok: slotOk(
        p.plano2_id,
        p.plano2_imgs_limite,
        p.plano2_imgs_usadas,
        p.plano2_renders_limite,
        p.plano2_renders_usados,
        p.plano2_geracoes_limite ?? 0,
        p.plano2_geracoes_usadas ?? 0,
        p.plano2_expira_em ?? null,
      ),
      isAdmin: false,
    };
  }
  if (preferredSlot === "bonus") {
    return {
      ok: slotOk(
        p.bonus_id,
        p.bonus_imgs_limite,
        p.bonus_imgs_usadas,
        p.bonus_renders_limite,
        p.bonus_renders_usados,
        p.bonus_geracoes_limite ?? 0,
        p.bonus_geracoes_usadas ?? 0,
        p.bonus_expira_em ?? null,
      ),
      isAdmin: false,
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
      p.bonus_expira_em ?? null,
    );

  return { ok, isAdmin: false };
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
    custoUsd?: number;
    impersonatedBy?: string;
    preferredSlot?: "plano1" | "plano2" | "bonus";
  },
): Promise<{ slot: string }> {
  const geracoes = meta.geracoes ?? 0;

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
