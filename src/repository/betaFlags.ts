// Flags de liberação controlada (server-only). Regra 6 do PLANO_V2: acesso a
// Supabase só em repository/ e server/.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Piloto do campo de intenção declarada (PU).
 *
 * O gate de interface não basta — o endpoint reconfere antes de usar o valor.
 * Não é proteção contra invasor: é proteção contra cache antigo, aba aberta há
 * dois dias e deploy no meio do uso. Sem esta checagem, um usuário fora do beta
 * pode gerar com um campo que não vê, e a saída dele muda sem explicação
 * possível.
 *
 * Falha fechada: qualquer erro de leitura devolve false, e a geração segue pelo
 * caminho de hoje (que é o comportamento correto para quem está fora).
 */
export async function hasBetaIntencao(userId: string): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("beta_intencao")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return false;
    return data.beta_intencao === true;
  } catch {
    return false;
  }
}
