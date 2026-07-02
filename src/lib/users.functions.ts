import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin, isAdmin } from "@/repository/authz";
import type { Tables } from "@/integrations/supabase/types";

const BUCKET = "user-assets";
const ELEVENLABS_API = "https://api.elevenlabs.io/v1";

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

    if (await isAdmin(data.id)) {
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
        } catch (e) {
          console.error(`deleteUser: falha ao apagar voz ElevenLabs ${v.external_voice_id}`, e);
        }
      }
      if (v.sample_path) {
        try {
          await supabaseAdmin.storage.from("voice-samples").remove([v.sample_path]);
        } catch (e) {
          console.error(`deleteUser: falha ao apagar amostra de voz ${v.sample_path}`, e);
        }
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

const SlotKeySchema = z.enum(["plano1", "plano2", "bonus"]);

export interface UsersListPlan {
  id: string;
  nome: string;
  codigo: string;
  elegivel_bonus: boolean;
  tipo: string;
  limite_imagens: number;
  limite_renders: number;
  limite_geracoes: number;
  preco_maximo_brl: number;
}

export interface UsersListRow extends Omit<Tables<"profiles">, "segmento"> {
  segmento: "SERVIÇOS" | "VAREJO" | "MARCA" | null;
  is_admin: boolean;
}

export interface UsersListCosts {
  imageRef: number;
  video: number;
  content: number;
}

// Substitui UsersTab.load() — profiles + plans + roles + custos, numa só chamada.
export const loadUsersList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [{ data: profs }, { data: pls }, { data: roles }, { data: s }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("is_test", false)
        .order("ultimo_login", { ascending: false, nullsFirst: false }),
      supabaseAdmin
        .from("plans")
        .select(
          "id,nome,codigo,elegivel_bonus,tipo,limite_imagens,limite_renders,limite_geracoes,preco_maximo_brl",
        )
        .eq("ativo", true)
        .order("nome"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin
        .from("app_settings")
        .select("usd_brl_rate,image_price_usd,render_price_usd,geracao_price_usd")
        .eq("id", true)
        .maybeSingle(),
    ]);

    const adminSet = new Set((roles || []).filter((r) => r.role === "admin").map((r) => r.user_id));
    const rows: UsersListRow[] = (profs || []).map((p) => ({
      ...p,
      segmento: p.segmento as UsersListRow["segmento"],
      is_admin: adminSet.has(p.id),
    }));
    const costs: UsersListCosts = {
      imageRef: Number(s?.image_price_usd) || 0.08,
      video: Number(s?.render_price_usd) || 1.6,
      content: Number(s?.geracao_price_usd) || 0.013,
    };
    const usdRate = Number(s?.usd_brl_rate) || 5.8;

    return { rows, plans: (pls as UsersListPlan[]) || [], costs, usdRate };
  });

// Substitui UsersTab.changeNome()
export const updateUserNome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid(), nome: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ nome: data.nome.trim() || null })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Substitui UsersTab.changePreco()
export const updateUserSlotPreco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ userId: z.string().uuid(), slot: SlotKeySchema, val: z.number().nullable() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const col = data.slot === "bonus" ? "bonus_preco_brl" : `${data.slot}_preco_brl`;
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ [col]: data.val } as never)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Substitui UsersTab.toggleStatus()
export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), status: z.enum(["ativo", "bloqueado"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ status: data.status })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Substitui UsersTab.toggleAdmin()
export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), makeAdmin: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.makeAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: "admin" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// Substitui UsersTab.changeSegmento()
export const updateUserSegmento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), segmento: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ segmento: data.segmento || null })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Substitui UsersTab.resetCounters()
export const resetUserCounters = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        plano1_imgs_usadas: 0,
        plano1_renders_usados: 0,
        plano1_geracoes_usadas: 0,
        plano2_imgs_usadas: 0,
        plano2_renders_usados: 0,
        plano2_geracoes_usadas: 0,
        bonus_imgs_usadas: 0,
        bonus_renders_usados: 0,
        bonus_geracoes_usadas: 0,
      })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Substitui UsersTab.toggleVoiceAvatar()
export const setUserVoiceAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        slot: z.union([z.literal(1), z.literal(2)]),
        enabled: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const col = data.slot === 1 ? "voice_avatar1_enabled" : "voice_avatar2_enabled";
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ [col]: data.enabled } as never)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
