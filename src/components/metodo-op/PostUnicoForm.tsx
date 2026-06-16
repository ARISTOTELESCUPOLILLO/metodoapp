import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Lightbulb, Zap, Camera, Layers, Shuffle, VolumeX, type LucideIcon } from 'lucide-react';
import { BrandKit, ImageKit, MoodCode, PostUnicoDirecao, PostUnicoFormData, PostUnicoObjetivo, PostUnicoVisualSelection } from '../../types';
import { generatePostUnicoCopy, type PostUnicoCopy } from '../../services/postUnico';
import { regenerateBlock } from '../../services/regenerateBlock';
import { autoRegenerateFlaggedPostUnico } from '../../services/autoRegenerate';
import { judgeAndRegeneratePostUnico } from '../../services/judgeContent';
import { getAuthHeaders } from '../../services/authHeaders';
import PostUnicoComposicaoVisual from './PostUnicoComposicaoVisual';
import ProductsChecklist from './ProductsChecklist';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { IDEIAS_ASSUNTOS } from '@/data/ideiasAssuntos';
import { truncateWords } from '@/core/textValidation';
import { useTextCorrection } from '@/hooks/useTextCorrection';

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
  /** Contadores de regeneração de título/texto, elevados ao app para
   *  persistirem entre trocas de aba (o componente desmonta e remontaria zerado). */
  tituloRegenCount?: number;
  textoRegenCount?: number;
  onTituloRegen?: () => void;
  onTextoRegen?: () => void;
  /** Zera os contadores de regeneração de título/texto (ao limpar/gerar novo copy). */
  onResetCopyRegen?: () => void;
  /** Título/texto gerados, elevados ao app para persistirem entre trocas de aba
   *  (o componente desmonta e remontaria com copy=null). Estado controlado. */
  copy: PostUnicoCopy | null;
  copyOriginal: PostUnicoCopy | null;
  onCopyChange: Dispatch<SetStateAction<PostUnicoCopy | null>>;
  onCopyOriginalChange: Dispatch<SetStateAction<PostUnicoCopy | null>>;
}

const OBJETIVOS: { code: PostUnicoObjetivo; label: string; desc: string }[] = [
  { code: 'nenhum',        label: 'Nenhum',        desc: 'Sem objetivo' },
  { code: 'institucional', label: 'Institucional',  desc: 'Posicionamento, propósito, marca' },
  { code: 'aviso',         label: 'Aviso',          desc: 'Comunicado institucional' },
  { code: 'homenagem',     label: 'Homenagem',      desc: 'Pessoa, data, conquista' },
  { code: 'oportunidade',  label: 'Oportunidade',   desc: 'Momento único, urgência' },
  { code: 'promocao',      label: 'Promoção',       desc: 'Oferta, campanha comercial' },
  { code: 'fatos',         label: 'Fatos',          desc: 'Registrar evento — foto real do momento' },
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

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export default function PostUnicoForm({ data, kit, imageKit, visualSelection, onVisualSelectionChange, onChange, onGenerate, onClear, loading, geracoesRestantes, geracoesTotal, imgsRestantes, imgsTotal, semPlano, isAdmin, hasPostPlano, puSlot, tituloRegenCount, textoRegenCount, onTituloRegen, onTextoRegen, onResetCopyRegen, copy, copyOriginal, onCopyChange: setCopy, onCopyOriginalChange: setCopyOriginal }: Props) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestCount, setSuggestCount] = useState(0);
  const [showIdeiasPanel, setShowIdeiasPanel] = useState(false);
  const initialKeyInfoRef = useRef<string | null>(null);
  const allSessionSuggestionsRef = useRef<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>(() => kit.products || []);
  const keyInfoCorrection = useTextCorrection();
  const copyTCorrection = useTextCorrection();
  const copyXCorrection = useTextCorrection();
  const SUGGEST_MAX = 3;
  const hasKeyInfo = !!data.keyInfo.trim();
  const suggestExhausted = !isAdmin && suggestCount >= SUGGEST_MAX;
  const canClear = hasKeyInfo || suggestCount > 0;
  const initialKeyInfo = initialKeyInfoRef.current;
  const canRevertInitial = initialKeyInfo !== null && data.keyInfo !== initialKeyInfo;

  // Etapa intermediária: título + texto gerados antes da imagem.
  // `copy`/`copyOriginal` são controlados pelo app (props) para sobreviverem à
  // troca de aba; `setCopy`/`setCopyOriginal` são os setters recebidos via props.
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  // Contagens persistidas no app (não resetam ao trocar de aba). Os incrementos
  // sobem por onTituloRegen/onTextoRegen; aqui só lemos o valor para render/limite.
  const copyTRegenCount = tituloRegenCount ?? 0;
  const copyXRegenCount = textoRegenCount ?? 0;
  const [copyTBusy, setCopyTBusy] = useState(false);
  const [copyXBusy, setCopyXBusy] = useState(false);
  const [copyTError, setCopyTError] = useState<string | null>(null);
  const [copyXError, setCopyXError] = useState<string | null>(null);
  const [copyTSuggs, setCopyTSuggs] = useState<string[]>([]);
  const [copyXSuggs, setCopyXSuggs] = useState<string[]>([]);
  const COPY_REGEN_MAX = 2;
  // Inicializado com o valor atual de keyInfo (não vazio) para que o efeito de
  // detecção de mudança não dispare falso-positivo ao remontar com copy já gerado.
  const copyKeyInfoRef = useRef<string>(data.keyInfo);
  // Marca quando o usuário interagiu com o título/texto gerado (leitura com o
  // dedo no mobile = focus/seleção, ou edição). Enquanto verdadeiro, a resposta
  // tardia do juiz D2 (até 15s em voo) NÃO sobrescreve o que está na tela —
  // era essa troca silenciosa, e não o swipe, que "mudava o título" no mobile.
  const copyTouchedRef = useRef(false);

  useEffect(() => {
    setSuggestCount(0);
    setSuggestions([]);
    setSuggestError(null);
    initialKeyInfoRef.current = null;
    allSessionSuggestionsRef.current = [];
  }, [data.objetivo, kit.companyName]);

  // Checklist de produtos/serviços — todos marcados por padrão; reseta
  // quando a lista do Kit de Marca muda (ex.: kit carregado ou editado).
  useEffect(() => {
    setSelectedProducts(kit.products || []);
  }, [kit.products]);

  useEffect(() => {
    if (!data.keyInfo) {
      setSuggestions([]);
      setSuggestError(null);
      initialKeyInfoRef.current = null;
      // suggestCount e allSessionSuggestionsRef NÃO são resetados — preservam
      // o rodízio de produto/lente entre pedidos de sugestão
    }
    if (copy && data.keyInfo !== copyKeyInfoRef.current) {
      clearCopy();
    }
  }, [data.keyInfo]);

  // Reseta copy quando o objetivo muda; NENHUM não suporta mood → força LIVRE.
  // prevObjetivoRef evita que o efeito dispare no mount (remontagem ao voltar
  // de outra aba não deve limpar o copy já gerado e persistido no app).
  const prevObjetivoRef = useRef<string>(data.objetivo);
  useEffect(() => {
    if (data.objetivo === prevObjetivoRef.current) return;
    prevObjetivoRef.current = data.objetivo;
    clearCopy();
    if (data.objetivo === 'nenhum' && data.direcao === 'mood') {
      onChange({ ...data, direcao: 'livre', mood: undefined });
    }
  }, [data.objetivo]);

  async function fetchCopy() {
    if (copyLoading) return;
    setCopyLoading(true);
    setCopyError(null);
    try {
      const companyName = data.companyName || kit.companyName;
      const mainActivity = data.mainActivity || kit.mainActivity || '';
      const generated = await generatePostUnicoCopy({
        ...data,
        companyName,
        mainActivity,
      }, kit.brandVoice, kit.segment, puSlot);
      // E3 — regenera título/texto flagados por D1 antes de exibir ao usuário.
      const result = await autoRegenerateFlaggedPostUnico(
        { titulo: generated.titulo, texto: generated.texto },
        generated.flags,
        { companyName, mainActivity, keyInfo: data.keyInfo }
      );
      copyTouchedRef.current = false;
      setCopy(result);
      setCopyOriginal(result);
      copyKeyInfoRef.current = data.keyInfo;

      // D2 — juiz semântico em lote, best-effort, fora do caminho crítico:
      // roda depois que o resultado já está na tela; se corrigir algo, atualiza.
      // Só aplica se o usuário ainda não tocou no título/texto — evita
      // sobrescrever, no meio da leitura/edição, o que ele já está lendo.
      judgeAndRegeneratePostUnico(result, {
        companyName,
        mainActivity,
        keyInfo: data.keyInfo,
        segment: kit.segment,
      }).then((updated) => {
        if (updated && !copyTouchedRef.current) {
          setCopy(updated);
          setCopyOriginal(updated);
        }
      });
    } catch (e) {
      setCopyError((e as Error).message);
    } finally {
      setCopyLoading(false);
    }
  }

  async function regenField(kind: 'titulo' | 'texto') {
    if (!copy) return;
    const isTitulo = kind === 'titulo';
    if (isTitulo) { if ((!isAdmin && copyTRegenCount >= COPY_REGEN_MAX) || copyTBusy) return; }
    else          { if ((!isAdmin && copyXRegenCount >= COPY_REGEN_MAX) || copyXBusy) return; }
    isTitulo ? setCopyTBusy(true) : setCopyXBusy(true);
    isTitulo ? setCopyTError(null) : setCopyXError(null);
    try {
      const next = await regenerateBlock({
        kind,
        companyName: data.companyName || kit.companyName,
        mainActivity: data.mainActivity || kit.mainActivity || '',
        keyInfo: data.keyInfo,
        formato: 'PostUnico',
        tituloAtual: copy.titulo,
        textoAtual: copy.texto,
      });
      const trimmed = next.trim();
      if (trimmed) {
        isTitulo ? setCopyTSuggs(s => [...s, trimmed]) : setCopyXSuggs(s => [...s, trimmed]);
      }
      isTitulo ? onTituloRegen?.() : onTextoRegen?.();
    } catch (e) {
      isTitulo ? setCopyTError((e as Error).message) : setCopyXError((e as Error).message);
    } finally {
      isTitulo ? setCopyTBusy(false) : setCopyXBusy(false);
    }
  }

  function clearCopy() {
    setCopy(null);
    setCopyOriginal(null);
    setCopyError(null);
    onResetCopyRegen?.();
    setCopyTError(null);
    setCopyXError(null);
    setCopyTSuggs([]);
    setCopyXSuggs([]);
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
    if (suggestExhausted || hasKeyInfo) return;
    setSuggesting(true);
    setSuggestError(null);
    const attempt = suggestCount;

    try {
      const auth = await getAuthHeaders();
      const res = await fetch('/api/suggest-keyinfo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          companyName: data.companyName || kit.companyName,
          mainActivity: data.mainActivity || kit.mainActivity,
          objetivo: data.objetivo,
          segment: kit.segment,
          brandVoice: kit.brandVoice || '',
          hint: '',
          mode: 'postunico',
          attempt,
          subMode: 'sugerir',
          previousSuggestions: allSessionSuggestionsRef.current,
          selectedProducts,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Falha (${res.status})`);
      }
      const json = await res.json();
      const newSugg = String(json.sugestao || '').trim();
      if (newSugg) {
        setSuggestions((arr) => [...arr, newSugg]);
        allSessionSuggestionsRef.current = [...allSessionSuggestionsRef.current, newSugg];
      }
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
              💡 Ideias
            </button>
            <button
              type="button"
              onClick={fetchSuggestion}
              disabled={suggesting || loading || hasKeyInfo || suggestExhausted}
              title={hasKeyInfo ? 'Limpe o campo para usar Sugestão' : suggestExhausted ? 'Limite atingido' : 'Sorteia categoria e sugere uma Informação-chave'}
              style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: suggesting || loading || hasKeyInfo || suggestExhausted ? 'not-allowed' : 'pointer', opacity: suggesting || loading || hasKeyInfo || suggestExhausted ? 0.4 : 1 }}
            >
              {suggesting ? 'Gerando…' : `✨ Sugestão${suggestCount > 0 ? ` (${suggestCount}/${SUGGEST_MAX})` : ''}`}
            </button>
            <button
              type="button"
              onClick={() => keyInfoCorrection.correct(data.keyInfo || '', (corrected) => {
                if (initialKeyInfoRef.current === null) initialKeyInfoRef.current = data.keyInfo || '';
                update('keyInfo', corrected);
              })}
              disabled={keyInfoCorrection.correcting || !hasKeyInfo}
              title="Corrige ortografia e gramática do texto"
              style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: keyInfoCorrection.correcting || !hasKeyInfo ? 'not-allowed' : 'pointer', opacity: keyInfoCorrection.correcting || !hasKeyInfo ? 0.4 : 1 }}
            >
              {keyInfoCorrection.correcting ? 'Corrigindo…' : '🔤 Corrigir'}
            </button>
            <button
              type="button"
              onClick={() => {
                update('keyInfo', '');
                setSuggestCount(0);
                setSuggestions([]);
                setSuggestError(null);
                initialKeyInfoRef.current = null;
              }}
              disabled={!canClear}
              title="Limpar texto e reiniciar"
              style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: !canClear ? 'not-allowed' : 'pointer', opacity: !canClear ? 0.4 : 1 }}
            >
              🗑 Limpar
            </button>
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
        <ProductsChecklist products={kit.products || []} selected={selectedProducts} onChange={setSelectedProducts} />
        <textarea
          value={data.keyInfo}
          onChange={(e) => update('keyInfo', e.target.value)}
          placeholder="Ex.: 30% de desconto em todos os tratamentos clareadores até sexta-feira."
          rows={4}
          style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${suggestExhausted ? '#fcd34d' : '#e2e8f0'}`, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.45, resize: 'vertical', minHeight: 84, background: suggestExhausted ? '#fffbeb' : '#fff', color: '#0f172a' }}
        />
        {keyInfoCorrection.msg && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#16a34a' }}>{keyInfoCorrection.msg}</p>}
        {keyInfoCorrection.error && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#b91c1c' }}>{keyInfoCorrection.error}</p>}
        {(suggesting || suggestions.length > 0 || suggestError) && (
          <div style={{ marginTop: 10, padding: 14, borderRadius: 12, background: suggestError ? '#fef2f2' : '#f8fafc', border: `1px solid ${suggestError ? '#fecaca' : '#e2e8f0'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="eyebrow" style={{ color: suggestError ? '#b91c1c' : '#0f172a' }}>
                {suggesting ? 'Gerando sugestão…' : suggestError ? 'Erro' : suggestions.length > 1 ? 'Sugestões OP' : 'Sugestão OP'}
              </span>
              {!suggesting && (
                <button type="button" onClick={() => { setSuggestions([]); setSuggestError(null); }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b', padding: 0, lineHeight: 1 }} aria-label="Fechar">×</button>
              )}
            </div>
            {suggesting && <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Aguarde alguns segundos…</p>}
            {!suggesting && suggestError && <p style={{ margin: 0, fontSize: 13, color: '#b91c1c' }}>{suggestError}</p>}
            {!suggesting && !suggestError && suggestions.length > 0 && (
              <div>
                {suggestions.length > 1 && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#64748b' }}>Compare e escolha a que preferir.</p>}
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: suggestions.length > 1 ? 'repeat(auto-fit, minmax(220px, 1fr))' : '1fr' }}>
                  {suggestions.map((sugg, idx) => (
                    <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {suggestions.length > 1 && <span className="eyebrow" style={{ fontSize: 10, color: '#64748b' }}>Sugestão {idx + 1}</span>}
                      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: '#0f172a', flex: 1 }}>{sugg}</p>
                      <button type="button" onClick={() => { if (initialKeyInfoRef.current === null) initialKeyInfoRef.current = data.keyInfo || ''; update('keyInfo', sugg); setSuggestions([]); }} style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}>
                        Usar esta
                      </button>
                    </div>
                  ))}
                </div>
                {!suggestExhausted && (
                  <div style={{ marginTop: 10 }}>
                    <button type="button" onClick={fetchSuggestion} disabled={hasKeyInfo} style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: hasKeyInfo ? 'not-allowed' : 'pointer', opacity: hasKeyInfo ? 0.4 : 1 }}>
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
            onClick={() => fetchCopy()}
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
              onClick={() => fetchCopy()}
              style={{ background: 'none', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Tentar de novo
            </button>
          </div>
        )}

        {copy && !copyLoading && (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>

            {/* Título */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span className="eyebrow" style={{ fontSize: 10, color: '#64748b' }}>Título</span>
                <span style={{ fontSize: 10, color: wordCount(copy.titulo) >= 6 ? '#f59e0b' : '#94a3b8' }}>
                  {wordCount(copy.titulo)}/6 palavras · máx 3 sílabas/palavra
                </span>
              </div>
              <input
                type="text"
                value={copy.titulo}
                onFocus={() => { copyTouchedRef.current = true; }}
                onChange={e => { copyTouchedRef.current = true; setCopy(c => c ? { ...c, titulo: e.target.value } : c); }}
                onBlur={e => setCopy(c => c ? { ...c, titulo: truncateWords(e.target.value, 6) } : c)}
                style={{
                  width: '100%', fontSize: 16, fontWeight: 800, color: '#0f172a',
                  border: `1px solid ${wordCount(copy.titulo) >= 6 ? '#fcd34d' : '#e2e8f0'}`,
                  background: wordCount(copy.titulo) >= 6 ? '#fffbeb' : '#fff',
                  borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => regenField('titulo')}
                  disabled={(!isAdmin && copyTRegenCount >= COPY_REGEN_MAX) || copyTBusy}
                  style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: (!isAdmin && copyTRegenCount >= COPY_REGEN_MAX) ? 'not-allowed' : 'pointer', opacity: (!isAdmin && copyTRegenCount >= COPY_REGEN_MAX) ? 0.55 : 1 }}
                  title={(!isAdmin && copyTRegenCount >= COPY_REGEN_MAX) ? 'Limite de 2 regenerações atingido' : undefined}
                >
                  {copyTBusy ? '…' : `✨ Gerar outro (${copyTRegenCount}/${COPY_REGEN_MAX})`}
                </button>
                <button
                  type="button"
                  onClick={() => copyTCorrection.correct(copy.titulo, (corrected) => setCopyTSuggs(s => [...s, corrected]))}
                  disabled={copyTCorrection.correcting || !copy.titulo.trim()}
                  title="Corrige ortografia e gramática do título"
                  style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: copyTCorrection.correcting || !copy.titulo.trim() ? 'not-allowed' : 'pointer', opacity: copyTCorrection.correcting || !copy.titulo.trim() ? 0.55 : 1 }}
                >
                  {copyTCorrection.correcting ? 'Corrigindo…' : '🔤 Corrigir português'}
                </button>
                {copyOriginal && copy.titulo !== copyOriginal.titulo && (
                  <button
                    type="button"
                    onClick={() => { setCopy(c => c ? { ...c, titulo: copyOriginal!.titulo } : c); setCopyTSuggs([]); }}
                    style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ↺ Inicial
                  </button>
                )}
                {copyTError && <span style={{ fontSize: 11, color: '#b91c1c' }}>{copyTError}</span>}
              </div>
              {copyTCorrection.msg && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#16a34a' }}>{copyTCorrection.msg}</p>}
              {copyTCorrection.error && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#b91c1c' }}>{copyTCorrection.error}</p>}
              {copyTSuggs.map((sugg, i) => (
                <div key={i} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', marginTop: 6, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700 }}>{sugg}</span>
                  <button
                    type="button"
                    onClick={() => { setCopy(c => c ? { ...c, titulo: sugg } : c); setCopyTSuggs([]); }}
                    style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Usar esta
                  </button>
                </div>
              ))}
            </div>

            {/* Texto de apoio */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span className="eyebrow" style={{ fontSize: 10, color: '#64748b' }}>Texto de apoio</span>
                <span style={{ fontSize: 10, color: wordCount(copy.texto) >= 14 ? '#f59e0b' : '#94a3b8' }}>
                  {wordCount(copy.texto)}/14 palavras
                </span>
              </div>
              <textarea
                value={copy.texto}
                onFocus={() => { copyTouchedRef.current = true; }}
                onChange={e => { copyTouchedRef.current = true; setCopy(c => c ? { ...c, texto: e.target.value } : c); }}
                onBlur={e => setCopy(c => c ? { ...c, texto: truncateWords(e.target.value, 14) } : c)}
                rows={2}
                style={{
                  width: '100%', fontSize: 14, color: '#334155',
                  border: `1px solid ${wordCount(copy.texto) >= 14 ? '#fcd34d' : '#e2e8f0'}`,
                  background: wordCount(copy.texto) >= 14 ? '#fffbeb' : '#fff',
                  borderRadius: 6, padding: '6px 8px', boxSizing: 'border-box', resize: 'vertical',
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => regenField('texto')}
                  disabled={(!isAdmin && copyXRegenCount >= COPY_REGEN_MAX) || copyXBusy}
                  style={{ background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: (!isAdmin && copyXRegenCount >= COPY_REGEN_MAX) ? 'not-allowed' : 'pointer', opacity: (!isAdmin && copyXRegenCount >= COPY_REGEN_MAX) ? 0.55 : 1 }}
                  title={(!isAdmin && copyXRegenCount >= COPY_REGEN_MAX) ? 'Limite de 2 regenerações atingido' : undefined}
                >
                  {copyXBusy ? '…' : `✨ Gerar outro (${copyXRegenCount}/${COPY_REGEN_MAX})`}
                </button>
                <button
                  type="button"
                  onClick={() => copyXCorrection.correct(copy.texto, (corrected) => setCopyXSuggs(s => [...s, corrected]))}
                  disabled={copyXCorrection.correcting || !copy.texto.trim()}
                  title="Corrige ortografia e gramática do texto"
                  style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: copyXCorrection.correcting || !copy.texto.trim() ? 'not-allowed' : 'pointer', opacity: copyXCorrection.correcting || !copy.texto.trim() ? 0.55 : 1 }}
                >
                  {copyXCorrection.correcting ? 'Corrigindo…' : '🔤 Corrigir português'}
                </button>
                {copyOriginal && copy.texto !== copyOriginal.texto && (
                  <button
                    type="button"
                    onClick={() => { setCopy(c => c ? { ...c, texto: copyOriginal!.texto } : c); setCopyXSuggs([]); }}
                    style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ↺ Inicial
                  </button>
                )}
                {copyXError && <span style={{ fontSize: 11, color: '#b91c1c' }}>{copyXError}</span>}
              </div>
              {copyXCorrection.msg && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#16a34a' }}>{copyXCorrection.msg}</p>}
              {copyXCorrection.error && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#b91c1c' }}>{copyXCorrection.error}</p>}
              {copyXSuggs.map((sugg, i) => (
                <div key={i} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', marginTop: 6, fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span>{sugg}</span>
                  <button
                    type="button"
                    onClick={() => { setCopy(c => c ? { ...c, texto: sugg } : c); setCopyXSuggs([]); }}
                    style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Usar esta
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={clearCopy}
              style={{ background: '#fff', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              ✕ Limpar e gerar novo
            </button>
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
        mood={data.direcao === 'mood' ? data.mood : undefined}
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
