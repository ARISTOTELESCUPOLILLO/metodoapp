import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "user-assets";
const ELEVENLABS_API = "https://api.elevenlabs.io/v1";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(`Falha ao verificar permissão: ${error.message}`);
  if (!data) throw new Error("Apenas administradores podem executar esta ação.");
}

async function deleteElevenLabsVoice(voiceId: string, elKey: string): Promise<void> {
  const res = await fetch(`${ELEVENLABS_API}/voices/${voiceId}`, {
    method: "DELETE",
    headers: { "xi-api-key": elKey },
  });
  if (!res.ok) {
    const txt = await res.text();
    console.warn("[deleteUser] elevenlabs delete", res.status, txt.slice(0, 200));
  }
}

// Exclusão permanente de um usuário e de todos os dados que não têm FK com
// cascade para auth.users: gerações + assets (storage), vozes clonadas
// (ElevenLabs + storage) e kit de marca. profiles/user_roles/user_sequences/
// plan_purchases têm ON DELETE CASCADE a partir de auth.users; usage_logs usa
// ON DELETE SET NULL e é preservado para histórico.
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    if (data.id === context.userId) {
      throw new Error("Você não pode excluir a própria conta.");
    }

    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.id)
      .eq("role", "admin")
      .maybeSingle();
    if (targetRole) {
      throw new Error("Não é possível excluir um administrador. Remova o papel de admin antes.");
    }

    const { data: prof, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", data.id)
      .maybeSingle();
    if (profErr) throw new Error(profErr.message);
    if (!prof) throw new Error("Usuário não encontrado.");

    // 1. Gerações + assets (registros e arquivos no storage)
    const { data: gens } = await supabaseAdmin
      .from("user_generations")
      .select("id, pdf_path, video_path")
      .eq("user_id", data.id);
    const genIds = (gens || []).map((g) => g.id);
    if (genIds.length) {
      const { data: assets } = await supabaseAdmin
        .from("user_assets")
        .select("storage_path")
        .in("generation_id", genIds);
      const paths = (assets || []).map((a) => a.storage_path);
      for (const g of gens || []) {
        if (g.pdf_path) paths.push(g.pdf_path);
        if (g.video_path) paths.push(g.video_path);
      }
      if (paths.length) {
        await supabaseAdmin.storage.from(BUCKET).remove(paths);
      }
      await supabaseAdmin.from("user_generations").delete().eq("user_id", data.id);
    }

    // 2. Vozes clonadas (ElevenLabs + amostras no storage)
    const { data: voices } = await supabaseAdmin
      .from("voice_clones")
      .select("sample_path, external_voice_id, provider")
      .eq("user_id", data.id);
    const elKey = process.env.ELEVENLABS_API_KEY;
    for (const v of voices || []) {
      if (v.provider === "elevenlabs" && v.external_voice_id && elKey) {
        try {
          await deleteElevenLabsVoice(v.external_voice_id, elKey);
        } catch {}
      }
      if (v.sample_path) {
        try {
          await supabaseAdmin.storage.from("voice-samples").remove([v.sample_path]);
        } catch {}
      }
    }
    if (voices && voices.length) {
      await supabaseAdmin.from("voice_clones").delete().eq("user_id", data.id);
    }

    // 3. Kit de marca
    await supabaseAdmin.from("brand_kits").delete().eq("user_id", data.id);

    // 4. Conta de autenticação — cascateia profiles/user_roles/user_sequences/plan_purchases
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (delErr) throw new Error(`Falha ao excluir usuário: ${delErr.message}`);

    return { ok: true };
  });
