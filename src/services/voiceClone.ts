// Acesso client-side à voz clonada do usuário.
// Persistência via Supabase (tabela voice_clones + bucket voice-samples).

import { supabase } from '@/integrations/supabase/client';

export interface VoiceClone {
  id: string;
  user_id: string;
  avatar_slot: number;
  external_voice_id: string;
  sample_path: string;
  duration_s: number;
  provider: string;
  status: string;
  last_used_at: string | null;
  created_at: string;
}

export async function ttsWithUserVoice(text: string, avatarSlot = 1): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const res = await fetch('/api/tts-voice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text, avatarSlot }),
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

export async function loadVoiceForUser(userId: string, avatarSlot = 1): Promise<VoiceClone | null> {
  const { data, error } = await supabase
    .from('voice_clones' as any)
    .select('*')
    .eq('user_id', userId)
    .eq('avatar_slot', avatarSlot)
    .maybeSingle();
  if (error) {
    console.warn('[loadVoiceForUser]', error.message);
    return null;
  }
  return (data as unknown as VoiceClone) || null;
}

export async function deleteVoiceForUser(_userId: string, avatarSlot = 1): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const res = await fetch('/api/delete-voice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ avatarSlot }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as any).error || 'Não foi possível apagar a voz.');
  }
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
  avatarSlot?: number;
}): Promise<{ voice: VoiceClone; previewAudioUrl: string }> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const res = await fetch('/api/clone-voice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...params, avatarSlot: params.avatarSlot ?? 1 }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.message || j.error || 'Falha ao clonar voz.');
  return { voice: j.voice as VoiceClone, previewAudioUrl: j.previewAudioUrl as string };
}

/**
 * Aprova ou descarta a voz que está pendente. Aprovar consome 1 render.
 */
export async function confirmVoice(decisao: 'aprovar' | 'descartar', avatarSlot = 1): Promise<VoiceClone | null> {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  const res = await fetch('/api/confirm-voice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ decisao, avatarSlot }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.message || j.error || 'Falha ao confirmar voz.');
  if (j.discarded) return null;
  return j.voice as VoiceClone;
}
