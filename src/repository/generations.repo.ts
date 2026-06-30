// Acesso a dados de gerações expiradas (PDF/vídeo) + seus assets no Storage.
// Sem React — só Supabase. Consumido pelo cron job em routes/api/public/expire-generations.ts.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Apaga do banco e do Storage toda geração cujo expires_at já passou.
// Retorna a contagem de gerações removidas.
export async function expireGenerations(): Promise<number> {
  const { data: expired, error } = await supabaseAdmin
    .from("user_generations")
    .select("id, pdf_path, video_path")
    .lt("expires_at", new Date().toISOString());
  if (error) throw new Error(error.message);

  let removed = 0;
  for (const gen of expired || []) {
    const { data: assets } = await supabaseAdmin
      .from("user_assets")
      .select("storage_path")
      .eq("generation_id", gen.id);
    const paths = (assets || []).map((a) => a.storage_path);
    if (gen.pdf_path) paths.push(gen.pdf_path);
    if (gen.video_path) paths.push(gen.video_path);
    if (paths.length) {
      await supabaseAdmin.storage.from("user-assets").remove(paths);
    }
    await supabaseAdmin.from("user_generations").delete().eq("id", gen.id);
    removed += 1;
  }
  return removed;
}
