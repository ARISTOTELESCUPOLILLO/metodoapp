// Remove a voz clonada do usuário: apaga da API ElevenLabs, bucket e tabela.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserIdFromRequest } from "@/lib/usage.server";

const ELEVENLABS_API = "https://api.elevenlabs.io/v1";

async function deleteElevenLabsVoice(voiceId: string, elKey: string): Promise<void> {
  const res = await fetch(`${ELEVENLABS_API}/voices/${voiceId}`, {
    method: "DELETE",
    headers: { "xi-api-key": elKey },
  });
  if (!res.ok) {
    const txt = await res.text();
    console.warn("[delete-voice] elevenlabs delete", res.status, txt.slice(0, 200));
  }
}

export const Route = createFileRoute("/api/delete-voice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request);
          if (!userId) return Response.json({ error: "Não autenticado." }, { status: 401 });

          const body = (await request.json().catch(() => ({}))) as { avatarSlot?: unknown };
          const avatarSlot = Number(body?.avatarSlot ?? 1) === 2 ? 2 : 1;

          const { data: existing } = await supabaseAdmin
            .from("voice_clones")
            .select("sample_path, external_voice_id, provider")
            .eq("user_id", userId)
            .eq("avatar_slot", avatarSlot)
            .maybeSingle();

          const row = existing;

          // Apaga da ElevenLabs se for provider elevenlabs.
          if (row?.provider === "elevenlabs" && row.external_voice_id) {
            const elKey = process.env.ELEVENLABS_API_KEY;
            if (elKey) {
              try {
                await deleteElevenLabsVoice(row.external_voice_id, elKey);
              } catch (e) {
                console.error(
                  `delete-voice: falha ao apagar voz ElevenLabs ${row.external_voice_id}`,
                  e,
                );
              }
            }
          }

          // Apaga amostra do bucket.
          if (row?.sample_path) {
            try {
              await supabaseAdmin.storage.from("voice-samples").remove([row.sample_path]);
            } catch (e) {
              console.error(`delete-voice: falha ao apagar amostra ${row.sample_path}`, e);
            }
          }

          await supabaseAdmin
            .from("voice_clones")
            .delete()
            .eq("user_id", userId)
            .eq("avatar_slot", avatarSlot);

          return Response.json({ ok: true });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
