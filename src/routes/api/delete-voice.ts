// Remove a voz clonada do usuário: apaga registro voice_clones e amostra do bucket.
// Não precisa chamar API externa — fal MiniMax expira voice_id em 7 dias sozinho.

import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { getUserIdFromRequest } from '@/lib/usage.server';

export const Route = createFileRoute('/api/delete-voice')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const userId = await getUserIdFromRequest(request);
          if (!userId) return Response.json({ error: 'Não autenticado.' }, { status: 401 });

          const { data: existing } = await supabaseAdmin
            .from('voice_clones' as any)
            .select('sample_path')
            .eq('user_id', userId)
            .maybeSingle();

          const samplePath = (existing as any)?.sample_path as string | undefined;
          if (samplePath) {
            try { await supabaseAdmin.storage.from('voice-samples').remove([samplePath]); } catch {}
          }
          await supabaseAdmin.from('voice_clones' as any).delete().eq('user_id', userId);

          return Response.json({ ok: true });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
