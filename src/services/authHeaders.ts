import { supabase } from "@/integrations/supabase/client";
import { getImpersonation } from "@/hooks/useImpersonation";

export async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const imp = getImpersonation();
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(imp ? { "X-Impersonate-User-Id": imp.userId } : {}),
    };
  } catch {
    return {};
  }
}
