// Único ponto de verificação de papel admin no projeto.
// Usa rpc("has_role") — nunca from("user_roles") diretamente.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  return data === true;
}

export async function assertAdmin(userId: string): Promise<void> {
  if (!(await isAdmin(userId))) {
    throw new Error("Apenas administradores podem executar esta ação.");
  }
}
