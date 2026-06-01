import { useState, useRef, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { saveGeneration, updateGeneration } from '@/lib/assets.functions';
import { useImpersonation } from '@/hooks/useImpersonation';
import { dataUrlToWebpBase64 } from '@/utils/toWebp';

type Formato = 'estatico' | 'carrossel' | 'estatico_final' | 'reels';

interface Props {
  tipo: 'S3V' | 'PU';
  formato: Formato;
  dia?: number;
  legenda: string;
  /** dataURL(s) das imagens já com canvas/logo aplicado */
  imageDataUrls: (string | null)[];
  /** URL do MP4 final (somente reels) */
  videoUrl?: string | null;
  /** Slot ativo (plano1 | plano2 | bonus). Se omitido lê window.__opSlot. */
  slot?: 'plano1' | 'plano2' | 'bonus';
  /** Título opcional para o histórico. */
  titulo?: string;
  /** Desabilitar quando o usuário ainda não gerou a peça. */
  disabledReason?: string;
}

export function ArchiveButton({
  tipo,
  formato,
  dia,
  legenda,
  imageDataUrls,
  videoUrl,
  slot,
  titulo,
  disabledReason,
}: Props) {
  const saveFn = useServerFn(saveGeneration);
  const updateFn = useServerFn(updateGeneration);
  const impersonation = useImpersonation();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string>('');
  const [savedId, setSavedId] = useState<string | null>(null);

  // Reseta savedId quando as imagens mudam (nova geração detectada)
  const prevImagesRef = useRef(imageDataUrls);
  useEffect(() => {
    if (imageDataUrls !== prevImagesRef.current) {
      prevImagesRef.current = imageDataUrls;
      setSavedId(null);
      setState('idle');
      setMsg('');
    }
  }, [imageDataUrls]);

  const ready = imageDataUrls.some(Boolean) && (formato !== 'reels' || !!videoUrl);
  const disabled = !ready || state === 'busy';

  async function handle() {
    try {
      setState('busy');
      setMsg('');
      const resolvedSlot =
        slot ||
        ((typeof window !== 'undefined' && (window as any).__opSlot) as
          | 'plano1'
          | 'plano2'
          | 'bonus'
          | undefined) ||
        'plano1';

      const images = await Promise.all(
        imageDataUrls
          .filter((u): u is string => !!u)
          .map(async (u, i) => ({
            base64: await dataUrlToWebpBase64(u, 0.88, 1920),
            ordem: i + 1,
          })),
      );
      if (images.length === 0) throw new Error('Sem imagem para arquivar.');

      if (savedId) {
        // 2º clique em diante: substitui o registro já arquivado
        await updateFn({
          data: {
            generationId: savedId,
            legenda: (legenda || '').slice(0, 4000),
            titulo: titulo || '',
            images,
            ...(impersonation?.userId ? { asUserId: impersonation.userId } : {}),
          },
        });
        setState('done');
        setMsg('✓ Atualizado');
      } else {
        // 1º clique: cria novo registro
        const res: any = await saveFn({
          data: {
            tipo,
            slot: resolvedSlot,
            formato,
            dia,
            legenda: (legenda || '').slice(0, 4000),
            titulo: titulo || '',
            images,
            ...(videoUrl ? { videoUrl } : {}),
            ...(impersonation?.userId ? { asUserId: impersonation.userId } : {}),
          },
        });
        const evicted = res?.evicted || 0;
        setSavedId(res?.generationId || null);
        setState('done');
        setMsg(evicted > 0 ? `✓ Arquivado (${evicted} substituído)` : '✓ Arquivado');
      }

      setTimeout(() => {
        setState('idle');
        setMsg('');
      }, 5000);
    } catch (e: any) {
      setState('error');
      setMsg(e?.message || 'Falha ao arquivar');
      setTimeout(() => {
        setState('idle');
        setMsg('');
      }, 6000);
    }
  }

  const label =
    state === 'busy'
      ? 'Arquivando…'
      : state === 'done'
        ? msg
        : state === 'error'
          ? '⚠ Tentar de novo'
          : '📥 Arquivar';

  const bg =
    state === 'done' ? '#16a34a' : state === 'error' ? '#b91c1c' : '#0f213f';

  return (
    <button
      type="button"
      className="downloadBtn"
      onClick={handle}
      disabled={disabled}
      title={disabled && disabledReason ? disabledReason : 'Salvar imagem + legenda no histórico'}
      style={{
        background: bg,
        color: '#fff',
        opacity: disabled && state === 'idle' ? 0.55 : 1,
      }}
    >
      {label}
    </button>
  );
}
