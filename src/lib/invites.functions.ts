// Server functions da aba Convites (admin) — extraído de InvitesTab.tsx (Fase 9).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertAdmin } from "@/repository/authz";
import type {
  DirectProfile,
  Invite,
  Plan,
  ProfileSlots,
  TestProfile,
} from "@/components/admin/invites/types";

// Substitui InvitesTab.load() — convites + planos ativos + perfis de teste +
// perfis (pra cruzar slots reais x convite e achar cadastros diretos), numa
// só chamada.
export const loadInvitesData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [{ data: inv }, { data: pls }, { data: tp }, { data: profs }] = await Promise.all([
      supabaseAdmin.from("invited_emails").select("*").order("created_at", { ascending: false }),
      supabaseAdmin
        .from("plans")
        .select("id,codigo,nome,elegivel_bonus")
        .eq("ativo", true)
        .order("nome"),
      supabaseAdmin.from("profiles").select("id,nome,email").eq("is_test", true).order("nome"),
      supabaseAdmin.from("profiles").select("id,nome,email,plano1_id,plano2_id,bonus_id"),
    ]);

    const rows = (inv as Invite[]) || [];
    const profileList = (profs as (ProfileSlots & { id: string; nome: string | null })[]) || [];
    const profByEmail: Record<string, ProfileSlots> = {};
    profileList.forEach((p) => {
      if (p.email) profByEmail[p.email.toLowerCase()] = p;
    });
    const invitedSet = new Set(rows.map((r) => r.email.toLowerCase()));
    const directProfs = profileList.filter(
      (p) =>
        p.email &&
        !invitedSet.has(p.email.toLowerCase()) &&
        (p.plano1_id || p.plano2_id || p.bonus_id),
    ) as unknown as DirectProfile[];

    return {
      rows,
      plans: (pls as Plan[]) || [],
      testProfiles: (tp as TestProfile[]) || [],
      profByEmail,
      directProfs,
    };
  });

// Substitui InvitesTab.invite()
export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        nome: z.string().min(1),
        email: z.string().email(),
        segment: z.enum(["SERVIÇOS", "VAREJO", "MARCA"]),
        plano1Id: z.string().uuid().nullable(),
        plano2Id: z.string().uuid().nullable(),
        bonusId: z.string().uuid().nullable(),
        sourceTestProfileId: z.string().uuid().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("invited_emails").insert({
      nome: data.nome,
      email: data.email,
      segment: data.segment,
      plano1_id: data.plano1Id,
      plano2_id: data.plano2Id,
      bonus_id: data.bonusId,
      source_test_profile_id: data.sourceTestProfileId,
      invited_by: context.userId,
    });
    if (error) {
      if (error.code === "23505") throw new Error("Este e-mail já foi convidado.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

// Substitui InvitesTab.setStatus()
export const setInviteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ inviteId: z.string().uuid(), status: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("invited_emails")
      .update({ status: data.status })
      .eq("id", data.inviteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Substitui InvitesTab.remove()
export const deleteInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ inviteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("invited_emails").delete().eq("id", data.inviteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
