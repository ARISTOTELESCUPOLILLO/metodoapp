// Acesso client-side à voz clonada do usuário.
// Persistência via Supabase (tabela voice_clones + bucket voice-samples).

import { supabase } from '@/integrations/supabase/client';

export interface VoiceClone {
  id: string;
  user_id: string;
  external_voice_id: string;
  sample_path: string;
  duration_s: number;
  provider: string;
  status: string;
  last_used_at: string | null;
  created_at: string;
}

export async function ttsWithUserVoice(text: string): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const res = await fetch('/api/tts-voice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || 'Falha no TTS.');
  return j.audioUrl as string;
}

export async function getVoiceSampleUrl(samplePath: string): Promise<string> {
  const { data, error } = await supabase
    .storage.from('voice-samples')
    .createSignedUrl(samplePath, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function loadVoiceForUser(userId: string): Promise<VoiceClone | null> {
  const { data, error } = await supabase
    .from('voice_clones' as any)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[loadVoiceForUser]', error.message);
    return null;
  }
  return (data as unknown as VoiceClone) || null;
}

export async function deleteVoiceForUser(userId: string): Promise<void> {
  // Apaga o registro; a amostra no bucket é apagada server-side se possível,
  // mas RLS permite o owner remover diretamente também.
  const existing = await loadVoiceForUser(userId);
  if (existing?.sample_path) {
    try { await supabase.storage.from('voice-samples').remove([existing.sample_path]); } catch {}
  }
  const { error } = await supabase
    .from('voice_clones' as any)
    .delete()
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/**
 * Envia uma amostra de áudio (data URL) para o servidor clonar a voz
 * via ElevenLabs (através do fal.ai). A voz volta como 'pendente_aprovacao'
 * acompanhada de uma prévia de áudio. O usuário precisa aprovar via
 * confirmVoice antes de ser cobrado.
 */
export async function cloneVoiceFromSample(params: {
  sampleDataUrl: string;
  durationS: number;
  name?: string;
}): Promise<{ voice: VoiceClone; previewAudioUrl: string }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const res = await fetch('/api/clone-voice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.message || j.error || 'Falha ao clonar voz.');
  return { voice: j.voice as VoiceClone, previewAudioUrl: j.previewAudioUrl as string };
}

/**
 * Aprova ou descarta a voz que está pendente. Aprovar consome 1 render.
 */
export async function confirmVoice(decisao: 'aprovar' | 'descartar'): Promise<VoiceClone | null> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const res = await fetch('/api/confirm-voice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ decisao }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.message || j.error || 'Falha ao confirmar voz.');
  if (j.discarded) return null;
  return j.voice as VoiceClone;
}
