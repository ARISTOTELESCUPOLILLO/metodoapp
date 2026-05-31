import { useEffect, useState } from 'react';
import { downloadDataUrl } from '../../utils/canvasComposer';
import { mopName } from '../../utils/file';
import { useIsMobile } from '../../hooks/use-mobile';
import { useImageGenAlert } from './PreImageAlert';
import { ArchiveButton } from './ArchiveButton';
import { MetaPublish } from './MetaPublish';
import type { PostUnicoCaption } from '../../services/postUnico';

const MOOD_NAMES: Record<string, string> = {
  'OP-01': 'Clareza', 'OP-02': 'Impacto', 'OP-03': 'Instante',
  'OP-04': 'Fragmento', 'OP-05': 'Desvio', 'OP-06': 'Silêncio',
};

interface Props {
  imageDataUrl?: string;
  companyName?: string;
  onRegenerate?: () => void;
  regenerating?: boolean;
  caption?: PostUnicoCaption;
  captionLoading?: boolean;
  captionError?: string;
  onRegenerateCaption?: () => void;
  onClear?: () => void;
  started?: boolean;
  /** Slot do plano que será usado ao arquivar (plano1 | plano2 | bonus). */
  slot?: 'plano1' | 'plano2' | 'bonus';
  direcao?: 'livre' | 'mood';
  mood?: string;
}

export default function PostUnicoResult({
  imageDataUrl,
  companyName,
  onRegenerate,
  regenerating,
  caption,
  captionLoading,
  captionError,
  onRegenerateCaption,
  onClear,
  started,
  slot,
  direcao,
  mood,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [captionRegens, setCaptionRegens] = useState(0);
  const [editedCaption, setEditedCaption] = useState<string | null>(null);
  const [captionHistory, setCaptionHistory] = useState<PostUnicoCaption[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const isMobile = useIsMobile();
  const { guard, dialog } = useImageGenAlert();
  const CAPTION_MAX = 2;
  const captionExhausted = captionRegens >= CAPTION_MAX;

  // Reseta contador e histórico de legenda a cada nova imagem gerada.
  useEffect(() => {
    setCaptionRegens(0);
    setCaptionHistory([]);
    setSelectedIdx(0);
    setEditedCaption(null);
  }, [imageDataUrl]);

  // Mantém histórico de até 2 legendas (inicial + 1 regerada).
  useEffect(() => {
    if (!caption) return;
    setCaptionHistory((prev) => {
      if (prev.some((c) => c.full === caption.full)) {
        const idx = prev.findIndex((c) => c.full === caption.full);
        setSelectedIdx(idx);
        setEditedCaption(null);
        return prev;
      }
      const next = prev.length >= 2 ? [prev[0], caption] : [...prev, caption];
      setSelectedIdx(next.length - 1);
      setEditedCaption(null);
      return next;
    });
  }, [caption]);

  const hasAnything = !!imageDataUrl || !!caption || captionLoading || !!captionError || !!started || !!regenerating;
  if (!hasAnything) return null;

  const isReady = !!imageDataUrl;
  const activeCaption = captionHistory[selectedIdx] ?? caption;
  const captionText = editedCaption ?? activeCaption?.full ?? '';

  const filename = mopName({ company: companyName, tipo: 'pu01', ext: 'png' });
  const txtFilename = mopName({ company: companyName, tipo: 'pu01_legenda', ext: 'txt' });

  async function handleCopy() {
    if (!captionText) return;
    try {
      await navigator.clipboard.writeText(captionText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }

  function handleDownloadTxt() {
    if (!captionText) return;
    const blob = new Blob([captionText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = txtFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleRegenCaption() {
    if (captionExhausted || !onRegenerateCaption) return;
    setCaptionRegens((c) => c + 1);
    setEditedCaption(null);
    onRegenerateCaption();
  }

  return (
    <section className="panel">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">{isReady ? 'Peça pronta' : 'Em geração'}</span>
          <h2>{isReady ? 'Post Único gerado' : 'Gerando peça...'}</h2>
          {(direcao || mood) && (
            <span style={{ display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 600, letterSpacing: 0.4, color: '#92400e', background: 'rgba(244,176,0,.12)', border: '1px solid rgba(244,176,0,.35)', borderRadius: 6, padding: '2px 8px' }}>
              {direcao === 'livre' ? 'Livre — IA' : `${MOOD_NAMES[mood ?? ''] ?? mood} · ${mood}`}
            </span>
          )}
        </div>
        <p>1080×1350px e logo aplicada. Pronta para o feed.</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        {imageDataUrl && (
          <img
            src={imageDataUrl}
            alt="Post único gerado"
            style={{ width: '100%', maxWidth: 480, borderRadius: 16, boxShadow: '0 14px 40px rgba(15,23,42,.12)' }}
          />
        )}

        <div style={{ width: '100%', maxWidth: 480, marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="eyebrow">Legenda sugerida</span>
            {onRegenerateCaption && !captionLoading && !captionExhausted && (
              <button
                type="button"
                onClick={handleRegenCaption}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                Gerar outra legenda ({captionRegens}/{CAPTION_MAX})
              </button>
            )}
            {captionExhausted && !captionLoading && (
              <span style={{ fontSize: 11, color: '#64748b' }}>Limite atingido — edite manualmente</span>
            )}
          </div>

          {captionLoading && (
            <div style={{ padding: 14, borderRadius: 12, background: '#f1f5f9', color: '#64748b', fontSize: 14 }}>
              Gerando legenda…
            </div>
          )}

          {!captionLoading && captionError && (
            <div style={{ padding: 14, borderRadius: 12, background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>
              Legenda indisponível. {onRegenerateCaption && !captionExhausted && (
                <button
                  type="button"
                  onClick={handleRegenCaption}
                  style={{ background: 'none', border: 'none', color: '#b91c1c', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                >
                  Tentar de novo
                </button>
              )}
            </div>
          )}

          {!captionLoading && !captionError && activeCaption && (
            <>
              {captionHistory.length > 1 && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  {captionHistory.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setSelectedIdx(i); setEditedCaption(null); }}
                      style={{
                        padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer',
                        border: `1px solid ${selectedIdx === i ? '#0f172a' : '#cbd5e1'}`,
                        background: selectedIdx === i ? '#0f172a' : '#fff',
                        color: selectedIdx === i ? '#fff' : '#0f172a',
                      }}
                    >
                      Legenda {i + 1}{i === 0 ? ' (inicial)' : ''}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                value={captionText}
                onChange={(e) => setEditedCaption(e.target.value)}
                rows={6}
                style={{
                  width: '100%', padding: 12, borderRadius: 12,
                  border: `1px solid ${captionExhausted ? '#fcd34d' : '#e2e8f0'}`,
                  fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5, resize: 'vertical',
                  background: captionExhausted ? '#fffbeb' : '#fafafa', color: '#0f172a',
                }}
              />
            </>
          )}
        </div>

        {/* Barra única de ações — todos os botões juntos */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 480 }}>
          {(() => {
            const lightBtn = {
              background: '#f8fafc',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              padding: '10px 16px',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              whiteSpace: 'nowrap' as const,
            };
            return (
              <>
                {imageDataUrl && (
                  <>
                    <button className="primaryBtn" type="button" style={{ width: 'auto' }} onClick={() => downloadDataUrl(imageDataUrl, filename)}>
                      Baixar PNG
                    </button>
                    <ArchiveButton
                      tipo="PU"
                      formato="estatico"
                      slot={slot}
                      legenda={captionText}
                      titulo={companyName ? `Post Único — ${companyName}` : 'Post Único'}
                      imageDataUrls={[imageDataUrl]}
                      disabledReason="Gere o Post Único antes de arquivar"
                    />
                  </>
                )}
                {onRegenerate && (
                  <button type="button" onClick={() => guard({ hasPreview: true, tipo: 'Estático', run: onRegenerate })} disabled={regenerating} style={{ ...lightBtn, opacity: regenerating ? 0.6 : 1, cursor: regenerating ? 'not-allowed' : 'pointer' }}>
                    {regenerating ? 'Gerando…' : 'Gerar outra imagem'}
                  </button>
                )}
                {caption && !captionLoading && !captionError && (
                  <>
                    <button className="primaryBtn" type="button" style={{ width: 'auto' }} onClick={handleCopy}>
                      {copied ? '✓ Copiado!' : 'Copiar legenda'}
                    </button>
                    <button type="button" style={lightBtn} onClick={handleDownloadTxt}>
                      Baixar legenda
                    </button>
                    {isMobile && (
                      <button
                        type="button"
                        style={{ ...lightBtn, background: '#25D366', color: '#fff', border: '1px solid #1ebe5d' }}
                        onClick={() => {
                          const d = new Date();
                          const p = (n: number) => String(n).padStart(2, '0');
                          const data = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
                          const text = `Legenda Post Único – ${data}\n\n${captionText.trim()}`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                        }}
                      >
                        Compartilhar no WhatsApp
                      </button>
                    )}
                  </>
                )}
                {imageDataUrl && (
                  <MetaPublish
                    imageDataUrl={imageDataUrl}
                    caption={captionText}
                  />
                )}
                {onClear && (
                  <button type="button" onClick={onClear} disabled={regenerating} style={{ ...lightBtn, opacity: regenerating ? 0.6 : 1, cursor: regenerating ? 'not-allowed' : 'pointer' }}>
                    Limpar conteúdo
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </div>
      {dialog}
    </section>
  );
}
