// Confirma ou descarta a voz clonada que está em pendente_aprovacao.
// Aprovar: marca como 'ready' e debita 1 render (admin não é debitado).
// Descartar: apaga o registro e o arquivo do bucket. Sem cobrança.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserIdFromRequest, debitUsage } from "@/lib/usage.server";

export const Route = createFileRoute("/api/confirm-voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request);
          if (!userId) {
            return Response.json({ code: "unauthorized", message: "Faça login." }, { status: 401 });
          }
          const body = await request.json();
          const decisao = String(body?.decisao || "");
          if (decisao !== "aprovar" && decisao !== "descartar") {
            return Response.json(
              { code: "bad_request", message: "decisao inválida." },
              { status: 400 },
            );
          }
          const avatarSlot = Number(body?.avatarSlot ?? 1) === 2 ? 2 : 1;

          const { data: existing, error: selErr } = await supabaseAdmin
            .from("voice_clones" as any)
            .select("*")
            .eq("user_id", userId)
            .eq("avatar_slot", avatarSlot)
            .maybeSingle();
          if (selErr) {
            return Response.json(
              { code: "load_failed", message: "Não encontramos sua voz." },
              { status: 500 },
            );
          }
          if (!existing) {
            return Response.json(
              { code: "not_found", message: "Nenhuma voz para confirmar." },
              { status: 404 },
            );
          }
          const row = existing as any;

          if (decisao === "descartar") {
            if (row.sample_path) {
              try {
                await supabaseAdmin.storage.from("voice-samples").remove([row.sample_path]);
              } catch {}
            }
            const { error: delErr } = await supabaseAdmin
              .from("voice_clones" as any)
              .delete()
              .eq("user_id", userId)
              .eq("avatar_slot", avatarSlot);
            if (delErr) {
              return Response.json(
                { code: "delete_failed", message: "Não conseguimos descartar." },
                { status: 500 },
              );
            }
            return Response.json({ ok: true, discarded: true });
          }

          // aprovar
          if (row.status === "ready") {
            // já aprovado, idempotente
            return Response.json({ ok: true, voice: row });
          }
          if (row.status !== "pendente_aprovacao") {
            return Response.json(
              { code: "bad_state", message: `Estado inválido (${row.status}).` },
              { status: 400 },
            );
          }

          // Debita 1 render (admin não é debitado por debit_usage RPC).
          let slot: string | null = null;
          try {
            const r = await debitUsage(userId, 0, 1, {
              evento: "voice.train",
              modulo: "kit-avatar",
              payload: { external_voice_id: row.external_voice_id, duration_s: row.duration_s },
            });
            slot = r.slot;
          } catch (e) {
            console.warn("[confirm-voice] debit", (e as Error).message);
            return Response.json(
              { code: "no_balance", message: "Saldo insuficiente para aprovar a voz agora." },
              { status: 402 },
            );
          }

          const { data: updated, error: updErr } = await supabaseAdmin
            .from("voice_clones" as any)
            .update({ status: "ready", updated_at: new Date().toISOString() })
            .eq("user_id", userId)
            .eq("avatar_slot", avatarSlot)
            .select("*")
            .single();
          if (updErr) {
            return Response.json(
              { code: "save_failed", message: "Falha ao salvar." },
              { status: 500 },
            );
          }

          return Response.json({ ok: true, voice: updated, slot });
        } catch (e) {
          console.error("[confirm-voice] fatal", e);
          return Response.json({ code: "unknown", message: "Algo deu errado." }, { status: 500 });
        }
      },
    },
  },
});
