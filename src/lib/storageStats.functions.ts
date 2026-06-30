import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/repository/authz";

export interface StorageUserRow {
  user_id: string;
  bytes: number;
  files: number;
  nome: string | null;
  email: string | null;
  is_test: boolean;
}

export interface StorageStatsResult {
  totalBytes: number;
  totalFiles: number;
  byUser: StorageUserRow[];
}

export const getStorageStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StorageStatsResult> => {
    await assertAdmin(context.userId);

    const { data, error } = await supabaseAdmin.rpc("admin_storage_stats");
    if (error) throw new Error(`Falha ao buscar stats de storage: ${error.message}`);

    const raw = data as unknown as {
      total_bytes: number;
      total_files: number;
      by_user: { user_id: string; bytes: number; files: number }[] | null;
    } | null;

    const totalBytes = raw?.total_bytes ?? 0;
    const totalFiles = raw?.total_files ?? 0;
    const byUserRaw = raw?.by_user ?? [];

    const userIds = byUserRaw
      .map((u) => u.user_id)
      .filter((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

    const profileMap: Record<
      string,
      { nome: string | null; email: string | null; is_test: boolean }
    > = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, nome, email, is_test")
        .in("id", userIds);
      (profs ?? []).forEach((p) => {
        profileMap[p.id] = { nome: p.nome, email: p.email, is_test: !!p.is_test };
      });
    }

    const byUser: StorageUserRow[] = byUserRaw.map((u) => ({
      user_id: u.user_id,
      bytes: u.bytes,
      files: u.files,
      nome: profileMap[u.user_id]?.nome ?? null,
      email: profileMap[u.user_id]?.email ?? null,
      is_test: profileMap[u.user_id]?.is_test ?? false,
    }));

    return { totalBytes, totalFiles, byUser };
  });
