import { useEffect, useRef, useState } from 'react';
import { Lightbulb, Zap, Camera, Layers, Shuffle, VolumeX, type LucideIcon } from 'lucide-react';
import { BrandKit, ImageKit, MoodCode, PostUnicoDirecao, PostUnicoFormData, PostUnicoObjetivo, PostUnicoVisualSelection } from '../../types';
import { generatePostUnicoCopy, type PostUnicoCopy } from '../../services/postUnico';
import PostUnicoComposicaoVisual from './PostUnicoComposicaoVisual';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { IDEIAS_ASSUNTOS } from '@/data/ideiasAssuntos';

interface Props {
  data: PostUnicoFormData;
  kit: BrandKit;
  imageKit: ImageKit;
  visualSelection: PostUnicoVisualSelection;
  onVisualSelectionChange: (next: PostUnicoVisualSelection) => void;
  onChange: (data: PostUnicoFormData) => void;
  onGenerate: (copy?: PostUnicoCopy) => void;
  onClear?: () => void;
  loading: boolean;
  geracoesRestantes?: number;
  geracoesTotal?: number;
  imgsRestantes?: number;
  imgsTotal?: number;
  semPlano?: boolean;
  isAdmin?: boolean;
  hasPostPlano?: boolean;
  puSlot?: string;
}

const OBJETIVOS: { code: PostUnicoObjetivo; label: string; desc: string }[] = [
  { code: 'nenhum',        label: 'Nenhum',        desc: 'Sem conceito visual' },
  { code: 'institucional', label: 'Institucional',  desc: 'Posicionamento, propósito, marca' },
  { code: 'aviso',         label: 'Aviso',          desc: 'Comunicado institucional' },
  { code: 'homenagem',     label: 'Homenagem',      desc: 'Pessoa, data, conquista' },
  { code: 'oportunidade',  label: 'Oportunidade',   desc: 'Momento único, urgência' },
  { code: 'promocao',      label: 'Promoção',       desc: 'Oferta, campanha comercial' },
];

const MOODS: { code: MoodCode; label: string }[] = [
  { code: 'OP-01', label: 'Clareza' },
  { code: 'OP-04', label: 'Fragmento' },
  { code: 'OP-03', label: 'Instante' },
  { code: 'OP-05', label: 'Desvio' },
  { code: 'OP-02', label: 'Impacto' },
  { code: 'OP-06', label: 'Silêncio' },
];

const MOOD_ICONS: Record<MoodCode, LucideIcon> = {
  'OP-01': Lightbulb,
  'OP-02': Zap,
  'OP-03': Camera,
  'OP-04': Layers,
  'OP-05': Shuffle,
  'OP-06': VolumeX,
};

export default function PostUnicoForm({ data, kit, imageKit, visualSelection, onVisualSelectionChange, onChange, onGenerate, onClear, loading, geracoesRestantes, geracoesTotal, imgsRestantes, imgsTotal, semPlano, isAdmin, hasPostPlano, puSlot }: Props) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestCount, setSuggestCount] = useState(0);
  const [showIdeiasPanel, setShowIdeiasPanel] = useState(false);
  const initialKeyInfoRef = useRef<string | null>(null);
  const SUGGEST_MAX = 2;
  const suggestExhausted = suggestCount >= SUGGEST_MAX;
  const initialKeyInfo = initialKeyInfoRef.current;
  const canRevertInitial = initialKeyInfo !== null && data.keyInfo !== initialKeyInfo;

  // Etapa intermediária: título + texto gerados antes da imagem
  const [copy, setCopy] = useState<PostUnicoCopy | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copyRegenCount, setCopyRegenCount] = useState(0);
  const COPY_REGEN_MAX = 1;
  const copyKeyInfoRef = useRef<string>('');

  useEffect(() => {
    setSuggestCount(0);
    setSuggestions([]);
    setSuggestError(null);
    initialKeyInfoRef.current = null;
  }, [data.objetivo, kit.companyName]);

  useEffect(() => {
    if (!data.keyInfo) {
      setSuggestCount(0);
      setSuggestions([]);
      setSuggestError(null);
      initialKeyInfoRef.current = null;
    }
    // Se o keyInfo mudou em relação ao usado para gerar o copy, invalida o copy
    if (copy && data.keyInfo !== copyKeyInfoRef.current) {
      setCopy(null);
      setCopyError(null);
      setCopyRegenCount(0);
    }
  }, [data.keyInfo]);

  // Reseta copy quando o objetivo muda; NENHUM não suporta mood → força LIVRE
  useEffect(() => {
    setCopy(null);
    setCopyError(null);
    setCopyRegenCount(0);
    if (data.objetivo === 'nenhum' && data.direcao === 'mood') {
      onChange({ ...data, direcao: 'livre', mood: undefined });
    }
  }, [data.objetivo]);

  async function fetchCopy(isRegen: boolean) {
    if (copyLoading) return;
    if (isRegen && copyRegenCount >= COPY_REGEN_MAX) return;
    setCopyLoading(true);
    setCopyError(null);
    try {
      const result = await generatePostUnicoCopy({
        ...data,
        companyName: data.companyName || kit.companyName,
        mainActivity: data.mainActivity || kit.mainActivity || '',
      }, kit.brandVoice, kit.segment, puSlot);
      setCopy(result);
      copyKeyInfoRef.current = data.keyInfo;
      if (isRegen) setCopyRegenCount((c) => c + 1);
    } catch (e) {
      setCopyError((e as Error).message);
    } finally {
      setCopyLoading(false);
    }
  }

  function clearCopy() {
    setCopy(null);
    setCopyError(null);
    setCopyRegenCount(0);
  }

  const update = <K extends keyof PostUnicoFormData>(key: K, value: PostUnicoFormData[K]) =>
    onChange({ ...data, [key]: value });

  const setDirecao = (dir: PostUnicoDirecao) => {
    if (dir === 'mood') {
      onChange({ ...data, direcao: 'mood', mood: data.mood });
    } else {
      onChange({ ...data, direcao: 'livre', mood: undefined });
    }
  };

  async function fetchSuggestion() {
    if (suggestExhausted) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const res = await fetch('/api/suggest-keyinfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: data.companyName || kit.companyName,
          mainActivity: data.mainActivity || kit.mainActivity,
          objetivo: data.objetivo,
          hint: data.keyInfo.trim(),
          mode: 'postunico',
          previousSuggestions: suggestions,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Falha (${res.status})`);
      }
      const json = await res.json();
      const newSugg = String(json.sugestao || '').trim();
      if (newSugg) setSuggestions((arr) => [...arr, newSugg]);
      setSuggestCount((c) => c + 1);
    } catch (e) {
      setSuggestError((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  const isNenhum = data.objetivo === 'nenhum';
  const semGeracoes = typeof geracoesRestantes === 'number' && geracoesRestantes <= 0 && (geracoesTotal || 0) > 0;
  const semImagens  = typeof imgsRestantes === 'number' && imgsRestantes <= 0 && (imgsTotal || 0) > 0;
  const semRecursos = semGeracoes || semImagens;
  const semPlanoPost = !isAdmin && hasPostPlano === false;
  const canGenerateCopy = !isNenhum && !!data.keyInfo.trim() && !loading && !suggesting && !copyLoading && !semRecursos && !(!isAdmin && semPlano) && !semPlanoPost;
  const moodPendente = data.direcao === 'mood' && !data.mood;
  const livreSemCopy = data.direcao === 'livre' && !copy;
  const canGenerate = isNenhum
    ? !copy && data.direcao === 'livre' && !loading && !suggesting && !copyLoading && !semRecursos && !(!isAdmin && semPlano) && !semPlanoPost
    : (!!copy || data.direcao === 'livre') && !loading && !suggesting && !copyLoading && !semRecursos && !(!isAdmin && semPlano) && !moodPendente && !semPlanoPost
      && (data.direcao === 'livre' || !!data.keyInfo.trim());
  const hasLogo = !!kit.logoDataUrl;

  return (
    <section className="panel">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Trilha rápida · Independente</span>
          <h2>Post Único</h2>
        </div>
        
      </div>

      {semPlanoPost && (
        <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>
          Você não tem plano de Post Único (PU2/PU4/PU8) — fale com o admin para liberar.
        </div>
      )}

      <div className="grid2">
        <label>Nome da empresa
          <input
            value={data.companyName}
            readOnly
            tabIndex={-1}
            placeholder="Vem do Kit de Marca"
            style={{ background: '#f1f5f9', color: '#475569', cursor: 'not-allowed' }}
          />
        </label>
        <label>Atividade principal
          <input
            value={data.mainActivity}
            readOnly
            tabIndex={-1}
            placeholder="Vem do Kit de Marca"
            style={{ background: '#f1f5f9', color: '#475569', cursor: 'not-allowed' }}
          />
        </label>
      </div>
      <p style={{ margin: '-4px 0 4px', fontSize: 12, color: '#64748b' }}>
        Estes campos vêm do <strong>Kit de Marca</strong> — edite no painel ao lado.
      </p>

      <div className="formatBox">
        <strong>Objetivo da peça</strong>
        <div className="sequenceGrid">
          {OBJETIVOS.map(o => (
            <button
              key={o.code}
              type="button"
              className={`sequenceCard trackCard${data.objetivo === o.code ? ' active' : ''}`}
              onClick={() => update('objetivo', o.code)}
            >
              <span className="sequenceNum">{o.label}</span>
              <span className="trackDescription">{o.desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label style={{ margin: 0 }}>
            Informação-chave <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowIdeiasPanel(true)}
              title="Ver sugestões de assuntos para este segmento"
              style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
            >
              💡 Ideias de Assuntos
            </button>
            <button
              type="button"
              onClick={fetchSuggestion}
              disabled={suggesting || loading || suggestExhausted}
              title={suggestExhausted ? 'Limite de 1 regeneração atingido' : 'Sugerir/Refinar com IA'}
              style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: suggesting || loading || suggestExhausted ? 'not-allowed' : 'pointer', opacity: suggesting || loading || suggestExhausted ? 0.5 : 1 }}
            >
              {suggesting
                ? 'Gerando…'
                : suggestExhausted
                  ? '✨ 1/1'
                  : data.keyInfo.trim()
                    ? `✨ Refinar com IA (${suggestCount}/${SUGGEST_MAX})`
                    : `✨ Sugerir com IA (${suggestCount}/${SUGGEST_MAX})`}
            </button>
            {data.keyInfo.trim() && (
              <button
                type="button"
                onClick={() => update('keyInfo', '')}
                title="Limpar texto"
                style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
              >
                🗑 Limpar
              </button>
            )}
            {canRevertInitial && (
              <button
                type="button"
                onClick={() => update('keyInfo', initialKeyInfo ?? '')}
                title="Voltar ao texto inicial"
                style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
              >
                ↺ Inicial
              </button>
            )}
          </div>
        </div>
        <textarea
          value={data.keyInfo}
          onChange={(e) => update('keyInfo', e.target.value)}
          placeholder="Ex.: 30% de desconto em todos os tratamentos clareadores até sexta-feira."
          rows={4}
          style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${suggestExhausted ? '#fcd34d' : '#e2e8f0'}`, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.45, resize: 'vertical', background: suggestExhausted ? '#fffbeb' : '#fff', color: '#0f172a' }}
        />
        {suggestExhausted && (
          <p style={{ margin: '4px 0 0', fontSize: 11, color: '#92400e' }}>Limite atingido — edite manualmente ou volte ao inicial.</p>
        )}

        {(suggesting || suggestions.length > 0 || suggestError) && (
          <div
            style={{
              marginTop: 10,
              padding: 14,
              borderRadius: 12,
              background: suggestError ? '#fef2f2' : '#f8fafc',
              border: `1px solid ${suggestError ? '#fecaca' : '#e2e8f0'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="eyebrow" style={{ color: suggestError ? '#b91c1c' : '#0f172a' }}>
                {suggesting ? 'Gerando sugestão…' : suggestError ? 'Erro' : suggestions.length > 1 ? 'Sugestões da IA' : 'Sugestão da IA'}
              </span>
              {!suggesting && (
                <button
                  type="button"
                  onClick={() => { setSuggestions([]); setSuggestError(null); setSuggestCount(0); }}
                  style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
                  aria-label="Limpar sugestões"
                >
                  ✕ Limpar
                </button>
              )}
            </div>

            {suggesting && (
              <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Aguarde alguns segundos…</p>
            )}

            {!suggesting && suggestError && (
              <div>
                <p style={{ margin: '0 0 8px', fontSize: 13, color: '#b91c1c' }}>{suggestError}</p>
                <button
                  type="button"
                  onClick={fetchSuggestion}
                  style={{ background: 'none', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Tentar de novo
                </button>
              </div>
            )}

            {!suggesting && !suggestError && suggestions.length > 0 && (
              <div>
                {suggestions.length > 1 && (
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748b' }}>Compare as duas e escolha a que preferir.</p>
                )}
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: suggestions.length > 1 ? 'repeat(auto-fit, minmax(220px, 1fr))' : '1fr' }}>
                  {suggestions.map((sugg, idx) => (
                    <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {suggestions.length > 1 && (
                        <span className="eyebrow" style={{ fontSize: 10, color: '#64748b' }}>Sugestão {idx + 1}</span>
                      )}
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: '#0f172a', flex: 1 }}>{sugg}</p>
                      <button
                        type="button"
                        onClick={() => { if (initialKeyInfoRef.current === null) initialKeyInfoRef.current = data.keyInfo || ''; update('keyInfo', sugg); setSuggestions([]); }}
                        style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}
                      >
                        Usar esta
                      </button>
                    </div>
                  ))}
                </div>
                {!suggestExhausted && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={fetchSuggestion}
                      style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Gerar outra ({suggestCount}/{SUGGEST_MAX})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Etapa: Título e texto da peça */}
      <div className="formatBox" style={{ borderColor: copy ? '#10b981' : isNenhum ? '#e2e8f0' : undefined, opacity: isNenhum ? 0.6 : 1 }}>
        <strong>Título e texto da peça {data.direcao === 'livre' && !isNenhum && <span style={{ fontWeight: 500, fontSize: 12, color: '#64748b' }}>(opcional no modo Livre)</span>}</strong>
        <p style={{ margin: '4px 0 10px', fontSize: 12, color: isNenhum ? '#94a3b8' : '#64748b' }}>
          {isNenhum
            ? 'Desabilitado no objetivo Nenhum — a IA cria o texto livremente a partir da informação-chave e do Kit de Marca.'
            : data.direcao === 'livre'
              ? 'No modo Livre este passo é opcional. Se gerar, o título e o texto viram tipografia obrigatória na peça. Se pular, a IA decide se haverá texto, qual e onde.'
              : 'A IA cria o título e o texto que aparecerão tipografados na peça, a partir da informação-chave. Confirme antes de gerar a imagem.'}
        </p>

        {!copy && !copyLoading && (
          <button
            type="button"
            onClick={() => fetchCopy(false)}
            disabled={!canGenerateCopy}
            style={{
              background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10,
              padding: '10px 16px', fontWeight: 700, fontSize: 14,
              cursor: canGenerateCopy ? 'pointer' : 'not-allowed', opacity: canGenerateCopy ? 1 : 0.55,
            }}
          >
            ✨ Gerar título e texto
          </button>
        )}

        {copyLoading && (
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Gerando título e texto…</p>
        )}

        {copyError && !copyLoading && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, color: '#b91c1c' }}>{copyError}</p>
            <button
              type="button"
              onClick={() => fetchCopy(false)}
              style={{ background: 'none', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Tentar de novo
            </button>
          </div>
        )}

        {copy && !copyLoading && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
            <div style={{ marginBottom: 10 }}>
              <span className="eyebrow" style={{ fontSize: 10, color: '#64748b' }}>Título</span>
              <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{copy.titulo}</p>
            </div>
            <div style={{ marginBottom: 10 }}>
              <span className="eyebrow" style={{ fontSize: 10, color: '#64748b' }}>Texto de apoio</span>
              <p style={{ margin: '2px 0 0', fontSize: 14, color: '#334155', lineHeight: 1.4 }}>{copy.texto}</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => fetchCopy(true)}
                disabled={copyRegenCount >= COPY_REGEN_MAX || copyLoading}
                style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: copyRegenCount >= COPY_REGEN_MAX ? 'not-allowed' : 'pointer', opacity: copyRegenCount >= COPY_REGEN_MAX ? 0.55 : 1 }}
                title={copyRegenCount >= COPY_REGEN_MAX ? 'Limite de 1 regeneração atingido' : undefined}
              >
                ↻ Regenerar ({copyRegenCount}/{COPY_REGEN_MAX})
              </button>
              <button
                type="button"
                onClick={clearCopy}
                style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                ↺ Voltar à inicial
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="formatBox">
        <strong>Direção visual</strong>
        <div className="radioRow">
          <label className="radioLabel">
            <input type="radio" name="direcao" checked={data.direcao === 'livre'} onChange={() => setDirecao('livre')} />
            Livre — IA decide tudo
          </label>
          <label className="radioLabel" style={{ opacity: isNenhum ? 0.4 : 1, cursor: isNenhum ? 'not-allowed' : 'pointer' }}>
            <input type="radio" name="direcao" checked={data.direcao === 'mood'} onChange={() => { if (!isNenhum) setDirecao('mood'); }} disabled={isNenhum} />
            Com Mood
          </label>
        </div>

        {data.direcao === 'mood' && (
          <>
            {!data.mood && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
                Escolha um mood abaixo para liberar a geração.
              </p>
            )}
            <div className="sequenceGrid" style={{ marginTop: 12 }}>
              {MOODS.map(m => (
                <button
                  key={m.code}
                  type="button"
                  className={`sequenceCard${data.mood === m.code ? ' active' : ''}`}
                  onClick={() => update('mood', m.code)}
                >
                  <span className="sequenceNum" style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                    {m.label}
                    {(() => { const Icon = MOOD_ICONS[m.code]; return Icon ? <Icon size={12} strokeWidth={1.8} /> : null; })()}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <PostUnicoComposicaoVisual
        imageKit={imageKit}
        selection={visualSelection}
        onChange={onVisualSelectionChange}
      />

      {!hasLogo && (
        <p className="trackNote" style={{ marginBottom: 12 }}>
          Sem logomarca enviada. Use o painel <strong>Kit de Marca</strong> ao lado para enviar a logo — ela será aplicada automaticamente na posição escolhida ({(
            kit.logoPosition === 'top-center' ? 'topo central' :
            kit.logoPosition === 'bottom-center' ? 'inferior central' :
            'canto inferior direito'
          )}).
        </p>
      )}


      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        <button
          className="primaryBtn"
          type="button"
          onClick={() => onGenerate(copy || undefined)}
          disabled={!canGenerate}
          title={semPlanoPost ? 'Você não tem plano de Post Único — fale com o admin' : (!data.keyInfo.trim() && data.direcao !== 'livre') ? 'Preencha a informação-chave' : moodPendente ? 'Escolha um mood antes de gerar' : (data.direcao === 'mood' && !copy) ? 'Gere o título e o texto antes de gerar a peça (modo Mood)' : semRecursos ? 'Limite do plano atingido — fale com o admin' : (!isAdmin && semPlano) ? 'Sem plano ativo — fale com o admin' : undefined}
          style={{ flex: 1 }}
        >
          {loading ? 'Gerando peça...' : isNenhum ? 'Gerar peça (criação livre)' : livreSemCopy ? 'Gerar peça (IA livre)' : copy ? 'Gerar peça' : 'Gere o título e o texto primeiro'}
        </button>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={loading}
            style={{
              background: '#f8fafc',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.55 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            Limpar Post Único
          </button>
        )}
      </div>
      <Sheet open={showIdeiasPanel} onOpenChange={setShowIdeiasPanel}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader style={{ marginBottom: 20 }}>
            <SheetTitle style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              Ideias de Assuntos
              <span style={{ background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                {kit.segment === 'SERVIÇOS' ? 'Serviços' : kit.segment === 'VAREJO' ? 'Varejo' : 'Marca'}
              </span>
            </SheetTitle>
          </SheetHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {IDEIAS_ASSUNTOS[kit.segment].map((cat) => (
              <div key={cat.titulo}>
                <div style={{ marginBottom: 6 }}>
                  <strong style={{ fontSize: 14, color: '#0f172a' }}>{cat.titulo}</strong>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>({cat.subtitulo})</div>
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {cat.itens.map((item, i) => (
                    <li key={i} style={{ fontSize: 13, color: '#334155', lineHeight: 1.5 }}>{item}</li>
                  ))}
                </ul>
                <div style={{ marginTop: 20, borderBottom: '1px solid #f1f5f9' }} />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
