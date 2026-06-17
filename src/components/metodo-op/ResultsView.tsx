import { useEffect, useMemo, useRef, useState } from 'react';

function insertSignature(caption: string, signature: string): string {
  const trimmed = caption.trim();
  const lines = trimmed.split('\n');
  let hashStart = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line === '' || /^(#\w+\s*)+$/.test(line)) { hashStart = i; } else { break; }
  }
  if (hashStart === lines.length) return trimmed + '\n\n' + signature;
  const before = lines.slice(0, hashStart).join('\n').trimEnd();
  const hashBlock = lines.slice(hashStart).join('\n').trimStart();
  return before + '\n\n' + signature + '\n\n' + hashBlock;
}

function countWords(text: string, excludeTexts?: string[]): number {
  let processed = text.trim();
  if (excludeTexts) {
    for (const exc of excludeTexts) {
      if (exc) processed = processed.split(exc).join('');
    }
  }
  return processed.trim().split(/\s+/).filter(w => w.length > 0 && !w.startsWith('#')).length;
}

// Nº de imagens geradas em paralelo no "Gerar todas" do carrossel.
const GENERATE_ALL_CONCURRENCY = 3;

// Roda `worker` para cada item de `items` com no máximo `concurrency` em
// paralelo — usado em "Gerar todas" para não enfileirar as imagens 1 a 1.
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
}
import { Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getImpersonation } from '@/hooks/useImpersonation';
import { AnchoraVisual, BrandKit, CarouselCard, FeedItem, ImageKit, MethodOpResult, MoodCode, ReelsGuide, StoriesSequence } from '../../types';
import { downloadDataUrl, downloadBlob, composeFeedPng, composeFinalPng, composeReelsPng, composeReelsTitlePng } from '../../utils/canvasComposer';
import { burnTitleIntoVideo } from '../../utils/burnTitleIntoVideo';
import { generatePostImage } from '../../services/api';
import { detectForcedGenderFromCopy, PersonagemGender } from '../../core/visualDirection';
import { generateSequencePdf } from '../../utils/generatePdf';
import { mopName } from '../../utils/file';
import { regenerateBlockClean, type RegenKind } from '../../services/regenerateBlock';
import {
  resolveModelo,
  ZERO_COTA,
  type CotaPorTipo,
  type ModeloOP,
} from '../../core/personalizacaoMop';
import { emptyImageKit } from '../../utils/imageKitStorage';
import { policyPorFormato } from '../../core/referenciasPolicy';
import { getSessionImage, setSessionImage } from '../../utils/sessionImageCache';
import { loadCopyEdit, saveCopyEdit } from '../../utils/copyEditsStorage';
import UsoReferenciasDia, { useRefSelection } from './UsoReferenciasDia';
import { regenerateWithKit } from '../../services/regenerateWithKit';
import { useProfile } from '../../hooks/useProfile';

import { useImageGenAlert } from './PreImageAlert';
import { useIsMobile } from '../../hooks/use-mobile';
import { useTextCorrection } from '../../hooks/useTextCorrection';
import { ArchiveButton } from './ArchiveButton';

function shareLegendaWhatsApp(tipo: 'Estático' | 'Estático Final' | 'Carrossel' | 'Reels', legenda: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const data = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  const text = `Legenda ${tipo} – ${data}\n\n${legenda.trim()}`;
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

interface Props {
  result?: MethodOpResult;
  kit: BrandKit;
  mood: MoodCode;
  onClear?: () => void;
  onRetry?: () => void;
  imageKit?: ImageKit;
  sequenceSize?: 3 | 6 | 9;
  onImageGenerated?: () => void;
  userId?: string | null;
}

// Verifica se o kit tem alguma imagem ENTRE AS PERMITIDAS pela política
// (policyPorFormato) para este (segmento, formato, modelo) — avatar/avatar2,
// cenário ou produto, conforme o que a política libera para o contexto.
function kitHasRefsForFormat(
  imageKit: ImageKit | undefined,
  formato: 'estatico' | 'carrossel' | 'estatico_final' | 'reels',
  segmento: BrandKit['segment'],
  modelo: ModeloOP | null,
): boolean {
  if (!imageKit) return false;
  const policy = policyPorFormato(segmento, formato, modelo);
  return (
    (policy.avatar && (!!imageKit.avatar || !!imageKit.avatar2)) ||
    (policy.cenarios > 0 && imageKit.cenarios.some((c) => !!c)) ||
    (policy.produtos > 0 && imageKit.produtos.some((p) => !!p))
  );
}

// Atribui o gênero do personagem para cada peça de um bloco (estático +
// carrossel + fechamento): peças cujo título/texto cite "mulher(es)"
// literalmente ficam com 'mulher' (B2); as demais são balanceadas para que o
// bloco não concentre 5+ das N peças no mesmo gênero por sorteios
// independentes. Resultado é calculado uma única vez por `result` (useMemo) e
// reutilizado em "gerar de novo" — gênero não muda por acaso ao regenerar.
function computeBlockGenders(pieces: { titulo: string; texto: string }[], anchorGender?: PersonagemGender): PersonagemGender[] {
  const assigned: (PersonagemGender | null)[] = pieces.map(p => detectForcedGenderFromCopy(p.titulo, p.texto));
  let countMulher = assigned.filter(g => g === 'mulher').length;
  let countHomem = assigned.filter(g => g === 'homem').length;
  for (let i = 0; i < assigned.length; i++) {
    if (assigned[i]) continue;
    let g: PersonagemGender;
    if (anchorGender) {
      g = anchorGender;
    } else if (countMulher < countHomem) {
      g = 'mulher';
    } else if (countHomem < countMulher) {
      g = 'homem';
    } else {
      g = Math.random() < 0.5 ? 'mulher' : 'homem';
    }
    assigned[i] = g;
    if (g === 'mulher') countMulher++; else countHomem++;
  }
  return assigned as PersonagemGender[];
}

const REGEN_MAX: Record<RegenKind, number> = { titulo: 2, texto: 2, legenda: 2 };

// Resincroniza um campo editável local com o valor vindo de cima (ex.: D2,
// o juiz semântico que corrige a peça em segundo plano depois que o card já
// foi montado/aberto) — só sobrescreve quando o usuário ainda não alterou o
// valor manualmente desde a última sincronização, pra não apagar uma edição
// em andamento.
function useSyncUpstream(upstream: string, current: string, setValue: (v: string) => void) {
  const prevRef = useRef(upstream);
  useEffect(() => {
    if (upstream !== prevRef.current) {
      if (current === prevRef.current) setValue(upstream);
      prevRef.current = upstream;
    }
  }, [upstream]);
}

const AGE_OPTIONS = ['18–28 anos', '25–35 anos', '30–40 anos', '35–45 anos', '40–55 anos', '50–65 anos'];

interface AnchorControl {
  ancoragem: AnchoraVisual;
  genderEffective: PersonagemGender;
  ageEffective: string;
  onFlipGender: () => void;
  onChangeAge: (age: string) => void;
}

function AnchorIndicator({ control, hideWhenAvatar }: { control?: AnchorControl; hideWhenAvatar: boolean }) {
  if (!control || hideWhenAvatar) return null;
  const sex = control.genderEffective === 'mulher' ? 'F' : 'M';
  const age = control.ageEffective.replace(' anos', '').replace(' ano', '');
  const currentAge = control.ageEffective;
  const ageInList = AGE_OPTIONS.includes(currentAge);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 10px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: '#475569', fontWeight: 700, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 9px', letterSpacing: 0.3 }}>
        {sex} · {age}
      </span>
      <button
        type="button"
        onClick={control.onFlipGender}
        style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
      >
        Trocar p/ {control.genderEffective === 'mulher' ? 'Masculino' : 'Feminino'}
      </button>
      <select
        value={currentAge}
        onChange={e => control.onChangeAge(e.target.value)}
        style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', color: '#475569', cursor: 'pointer' }}
      >
        {!ageInList && <option value={currentAge}>{currentAge}</option>}
        {AGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

// Props comuns para o seletor de Imagens de Referência nos cards.
interface RefSelectorProps {
  segmento: BrandKit['segment'];
  modelo: ModeloOP | null;
  imageKit?: ImageKit;
  extrasCarrossel: number;
}

// Botão "Gerar outra com refs" — só aparece se há seleção marcada E o kit tem imagens do tipo certo.
function RefsRegenButton({ storageKey, fallbackKey, busy, onRun, imageKit, formato, segmento, modelo }: { storageKey: string; fallbackKey?: string; busy: boolean; onRun: () => void; imageKit?: ImageKit; formato?: 'estatico' | 'carrossel' | 'estatico_final' | 'reels'; segmento: BrandKit['segment']; modelo: ModeloOP | null }) {
  const sel = useRefSelection(storageKey);
  const selFb = useRefSelection(fallbackKey || storageKey);
  const has = sel.hasAny || selFb.hasAny;
  if (!has) return null;
  if (!kitHasRefsForFormat(imageKit, formato || 'estatico', segmento, modelo)) return null;
  return (
    <button className="generateBtn" type="button" onClick={onRun} disabled={busy} title="Gerar outra usando as referências marcadas acima">
      {busy ? 'Gerando...' : '↻ Gerar outra com refs'}
    </button>
  );
}




/**
 * Campo editável com botões: regenerar IA (até 1x), editar manualmente,
 * voltar ao inicial. Aplica a regra de limite descrita no plano.
 */
function EditableField(props: {
  label: string;
  kind: RegenKind;
  value: string;
  original: string;
  count: number;
  onChange: (v: string) => void;
  onRegenStart: () => void;
  onRegenDone: () => void;
  ctxBuilder: () => Parameters<typeof regenerateBlockClean>[0];
  multiline?: boolean;
  maxWords?: number;
  excludeTexts?: string[];
}) {
  const { label, value, original, count, onChange, onRegenStart, onRegenDone, ctxBuilder, multiline, kind, maxWords, excludeTexts } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const correction = useTextCorrection();
  const exhausted = count >= REGEN_MAX[kind];
  const changed = value !== original;

  async function handleRegen() {
    if (exhausted || busy) return;
    setBusy(true); setError(null);
    onRegenStart();
    try {
      const next = await regenerateBlockClean(ctxBuilder());
      const trimmed = (next || '').trim();
      if (trimmed) setSuggestions((arr) => [...arr, trimmed]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false); onRegenDone();
    }
  }

  return (
    <div className="cardField" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span className="fieldLabel">{label}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleRegen}
            disabled={busy || exhausted}
            title={exhausted ? `Limite de ${REGEN_MAX[kind]} regenerações atingido` : `Gerar outra ${kind} com IA`}
            style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: busy || exhausted ? 'not-allowed' : 'pointer', opacity: busy || exhausted ? 0.5 : 1 }}
          >
            {busy ? 'Gerando…' : exhausted ? `✨ ${REGEN_MAX[kind]}/${REGEN_MAX[kind]}` : `✨ Gerar outro (${count}/${REGEN_MAX[kind]})`}
          </button>
          <button
            type="button"
            onClick={() => correction.correct(value, (corrected) => setSuggestions((arr) => [...arr, corrected]))}
            disabled={correction.correcting || !value.trim()}
            title="Corrige ortografia e gramática deste texto"
            style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: correction.correcting || !value.trim() ? 'not-allowed' : 'pointer', opacity: correction.correcting || !value.trim() ? 0.5 : 1 }}
          >
            {correction.correcting ? 'Corrigindo…' : '🔤 Corrigir português'}
          </button>
          {changed && (
            <button
              type="button"
              onClick={() => onChange(original)}
              title="Voltar ao texto inicial"
              style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}
            >
              ↺ Inicial
            </button>
          )}
        </div>
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${exhausted ? '#fcd34d' : '#e2e8f0'}`, fontFamily: 'inherit', fontSize: 14, lineHeight: 1.45, resize: 'vertical', background: exhausted ? '#fffbeb' : '#fff', color: '#0f172a' }}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${exhausted ? '#fcd34d' : '#e2e8f0'}`, fontFamily: 'inherit', fontSize: 14, background: exhausted ? '#fffbeb' : '#fff', color: '#0f172a' }}
        />
      )}
      {maxWords != null && (
        <div style={{ textAlign: 'right', fontSize: 11, marginTop: 2, color: countWords(value, excludeTexts) > maxWords ? '#dc2626' : '#94a3b8', fontWeight: countWords(value, excludeTexts) > maxWords ? 600 : 400 }}>
          {countWords(value, excludeTexts)}/{maxWords} palavras
        </div>
      )}
      {error && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#b91c1c' }}>{error}</p>}
      {correction.msg && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#16a34a' }}>{correction.msg}</p>}
      {correction.error && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#b91c1c' }}>{correction.error}</p>}
      {exhausted && !error && suggestions.length === 0 && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#92400e' }}>Limite atingido — edite manualmente ou volte ao inicial.</p>
      )}
      {suggestions.length > 0 && (
        <div style={{ marginTop: 8, padding: 10, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className="eyebrow" style={{ fontSize: 10, color: '#0f172a' }}>
              {suggestions.length > 1 ? 'Sugestões da IA' : 'Sugestão da IA'}
            </span>
            <button type="button" onClick={() => setSuggestions([])} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#64748b', padding: 0, lineHeight: 1 }} aria-label="Fechar">×</button>
          </div>
          {suggestions.length > 1 && (
            <p style={{ margin: '0 0 6px', fontSize: 11, color: '#64748b' }}>Compare e escolha a que preferir.</p>
          )}
          {kind === 'legenda' && (
            <p style={{ margin: '0 0 6px', fontSize: 11, color: '#92400e' }}>Pendente — clique em "Usar esta" para substituir a legenda atual.</p>
          )}
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: suggestions.length > 1 ? 'repeat(auto-fit, minmax(200px, 1fr))' : '1fr' }}>
            {suggestions.map((sugg, idx) => (
              <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {suggestions.length > 1 && (
                  <span className="eyebrow" style={{ fontSize: 9, color: '#64748b' }}>Sugestão {idx + 1}</span>
                )}
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, color: '#0f172a', flex: 1 }}>{sugg}</p>
                <button
                  type="button"
                  onClick={() => { onChange(sugg); setSuggestions([]); }}
                  style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}
                >
                  Usar esta
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FeedCard({ item, kit, mood, dayNumber, keyInfo, guard, segmento, modelo, imageKit, extrasCarrossel, onImageGenerated, userId, forcedGender, anchoraPersonagem, ancoragePapel }: { item: FeedItem; kit: BrandKit; mood: MoodCode; dayNumber: number; keyInfo: string; guard: ReturnType<typeof useImageGenAlert>['guard']; onImageGenerated?: () => void; userId?: string | null; forcedGender: PersonagemGender; anchoraPersonagem?: string; ancoragePapel?: string } & RefSelectorProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyRefs, setBusyRefs] = useState(false);
  const cacheKey = `feed:${dayNumber}`;
  const [preview, setPreview] = useState<string | null>(() => getSessionImage(userId, cacheKey));
  function updatePreview(value: string | null) {
    setPreview(value);
    setSessionImage(userId, cacheKey, value);
  }
  const isMobile = useIsMobile();
  const storageKey = `uso-ref:estatico:${item.dia}`;
  const sel = useRefSelection(storageKey);

  const savedCopyEdit = useMemo(() => loadCopyEdit(userId, cacheKey), [userId, cacheKey]);
  const [titulo, setTitulo] = useState(savedCopyEdit?.titulo ?? item.titulo);
  const [texto, setTexto] = useState(savedCopyEdit?.texto ?? item.texto);
  const [legenda, setLegenda] = useState(savedCopyEdit?.legenda ?? item.legenda);
  const [tCount, setTCount] = useState(savedCopyEdit?.tCount ?? 0);
  const [xCount, setXCount] = useState(savedCopyEdit?.xCount ?? 0);
  const [lCount, setLCount] = useState(savedCopyEdit?.lCount ?? 0);
  // Persiste edição/regeneração + contadores — sem isso, sair da página
  // (ex.: /historico) e voltar perdia o texto editado e zerava o contador.
  useEffect(() => {
    saveCopyEdit(userId, cacheKey, { titulo, texto, legenda, tCount, xCount, lCount });
  }, [userId, cacheKey, titulo, texto, legenda, tCount, xCount, lCount]);
  // D2 (juiz semântico) pode corrigir item.titulo/texto/legenda depois que o
  // card já foi montado/aberto — resincroniza se o usuário não editou.
  useSyncUpstream(item.titulo, titulo, setTitulo);
  useSyncUpstream(item.texto, texto, setTexto);
  useSyncUpstream(item.legenda, legenda, setLegenda);

  async function runGenerate() {
    setBusy(true);
    try {
      const url = await generatePostImage({
        imagePrompt: item.imagem,
        titulo, texto,
        companyName: kit.companyName,
        primaryColor: kit.primaryColor,
        accentColor: kit.accentColor || '#f4b000',
        fontFamily: kit.fontPair || 'Montserrat',
        secondaryFont: kit.secondaryFont,
        mood, vertical: 'post', logoPosition: kit.logoPosition,
        leituraCenica: (item as any).leituraCenica,
        forcedGender,
        anchoraPersonagem,
        ancoragePapel,
      });
      const final = await composeFeedPng(kit, { ...item, titulo, texto, legenda }, url);
      updatePreview(final);
      onImageGenerated?.();
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  function handleGenerate() { guard({ hasPreview: !!preview, tipo: 'Estático', run: runGenerate }); }

  async function runGenerateWithRefs() {
    if (!sel.hasAny) return;
    setBusyRefs(true);
    try {
      const url = await regenerateWithKit({
        slot: { formato: 'estatico', posicao: dayNumber, elemento: 'avatar', motivo: '' },
        kit, imageKit: imageKit ?? emptyImageKit, mood,
        keyInfo: `${item.titulo || ''}. ${item.imagem || ''}`.slice(0, 500),
        titulo, texto, imagePrompt: item.imagem, leituraCenica: (item as any).leituraCenica,
        formato: 'post',
        selecaoDireta: { usarAvatar: sel.avatarNum != null, avatarNum: sel.avatarNum as 1 | 2 | null, cenarioNum: sel.cenarioNum, produtosNums: sel.produtosNums },
        anchoraPersonagem, ancoragePapel,
      });
      const final = await composeFeedPng(kit, { ...item, titulo, texto, legenda }, url);
      updatePreview(final);
      onImageGenerated?.();
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusyRefs(false); }
  }

  function handleGenerateWithRefs() { guard({ hasPreview: true, tipo: 'Estático', run: runGenerateWithRefs }); }



  const ctx = (kind: RegenKind) => ({
    kind, companyName: kit.companyName, mainActivity: kit.mainActivity, keyInfo,
    formato: 'Estático', tituloAtual: titulo, textoAtual: texto, legendaAtual: legenda,
  });

  return (
    <article className="contentCard">
      <button className="cardHeader" type="button" onClick={() => setOpen(o => !o)}>
        <div className="cardHeaderLeft">
          <span className="cardTag">Dia {dayNumber} · Estático</span>
          <strong className="cardTitle">{titulo}</strong>
        </div>
        <span className="cardChevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="cardBody">
          <UsoReferenciasDia
            segmento={segmento}
            modelo={modelo}
            formato="estatico"
            posicao={dayNumber}
            extrasCarrossel={extrasCarrossel}
            kit={kit}
            imageKit={imageKit ?? emptyImageKit}
            mood={mood}
            titulo={titulo}
            texto={texto}
            imagePrompt={item.imagem}
            leituraCenica={(item as any).leituraCenica}
            storageKey={storageKey}
            onGerou={async (url) => {
              try {
                const final = await composeFeedPng(kit, { ...item, titulo, texto, legenda }, url);
                updatePreview(final);
              } catch {
                updatePreview(url);
              }
            }}
          />
          <EditableField label="Título" kind="titulo" value={titulo} original={item.titulo} count={tCount} onChange={setTitulo} onRegenStart={() => setTCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('titulo')} maxWords={6} />
          <EditableField label="Texto" kind="texto" value={texto} original={item.texto} count={xCount} onChange={setTexto} onRegenStart={() => setXCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('texto')} multiline maxWords={15} />
          <EditableField label="Legenda" kind="legenda" value={legenda} original={item.legenda} count={lCount} onChange={setLegenda} onRegenStart={() => setLCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('legenda')} multiline maxWords={40} excludeTexts={kit.assinatura ? [kit.assinatura] : undefined} />
          {legenda.trim() && isMobile && (
            <button className="downloadBtn" type="button" style={{ width: '100%', minHeight: 44, fontSize: 15, marginTop: 4 }} onClick={() => shareLegendaWhatsApp('Estático', legenda)}>
              📲 Compartilhar legenda no WhatsApp
            </button>
          )}
          {preview && <div className="previewWrapper"><img src={preview} alt="Preview" className="previewImg" /></div>}
          <div className="cardActions">
            <button
              type="button"
              disabled={!(kit.assinatura && !legenda.includes(kit.assinatura))}
              onClick={() => { if (kit.assinatura && !legenda.includes(kit.assinatura)) setLegenda(insertSignature(legenda, kit.assinatura)); }}
              style={{ padding: '6px 12px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: (kit.assinatura && !legenda.includes(kit.assinatura)) ? 'pointer' : 'default', background: (kit.assinatura && !legenda.includes(kit.assinatura)) ? '#0f172a' : '#e2e8f0', color: (kit.assinatura && !legenda.includes(kit.assinatura)) ? '#fff' : '#94a3b8' }}
            >
              Inserir Assinatura
            </button>
            <button className="generateBtn" type="button" onClick={handleGenerate} disabled={busy || busyRefs}>
              {busy ? 'Gerando...' : preview ? '↻ Gerar outra (sem refs)' : '⬇ Gerar post'}
            </button>
            {preview && sel.hasAny && kitHasRefsForFormat(imageKit, 'estatico', segmento, modelo) && (
              <button className="generateBtn" type="button" onClick={handleGenerateWithRefs} disabled={busy || busyRefs} title="Gerar outra usando as referências marcadas acima">
                {busyRefs ? 'Gerando...' : '↻ Gerar outra com refs'}
              </button>
            )}
            {preview && (
              <button className="downloadBtn" type="button" onClick={() => downloadDataUrl(preview, mopName({ company: kit.companyName, tipo: `est${String(dayNumber).padStart(2,'0')}`, ext: 'jpg' }))}>
                Baixar
              </button>
            )}
            <ArchiveButton
              tipo="S3V"
              formato="estatico"
              dia={dayNumber}
              legenda={legenda}
              imageDataUrls={[preview]}
              titulo={titulo}
              disabledReason="Gere o post antes de arquivar"
            />
          </div>
        </div>
      )}
    </article>
  );
}

function FinalCard({ item, kit, mood, dayNumber, keyInfo, guard, segmento, modelo, imageKit, extrasCarrossel, onImageGenerated, userId, forcedGender, anchoraPersonagem, ancoragePapel }: { item: FeedItem; kit: BrandKit; mood: MoodCode; dayNumber: number; keyInfo: string; guard: ReturnType<typeof useImageGenAlert>['guard']; onImageGenerated?: () => void; userId?: string | null; forcedGender: PersonagemGender; anchoraPersonagem?: string; ancoragePapel?: string } & RefSelectorProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyRefs, setBusyRefs] = useState(false);
  const cacheKey = `final:${dayNumber}`;
  const [preview, setPreview] = useState<string | null>(() => getSessionImage(userId, cacheKey));
  function updatePreview(value: string | null) {
    setPreview(value);
    setSessionImage(userId, cacheKey, value);
  }
  const isMobile = useIsMobile();
  const storageKey = `uso-ref:estatico_final:${item.dia}`;
  const sel = useRefSelection(storageKey);

  const savedCopyEdit = useMemo(() => loadCopyEdit(userId, cacheKey), [userId, cacheKey]);
  const [titulo, setTitulo] = useState(savedCopyEdit?.titulo ?? item.titulo);
  const [texto, setTexto] = useState(savedCopyEdit?.texto ?? item.texto);
  const [legenda, setLegenda] = useState(savedCopyEdit?.legenda ?? item.legenda);
  const [tCount, setTCount] = useState(savedCopyEdit?.tCount ?? 0);
  const [xCount, setXCount] = useState(savedCopyEdit?.xCount ?? 0);
  const [lCount, setLCount] = useState(savedCopyEdit?.lCount ?? 0);
  useEffect(() => {
    saveCopyEdit(userId, cacheKey, { titulo, texto, legenda, tCount, xCount, lCount });
  }, [userId, cacheKey, titulo, texto, legenda, tCount, xCount, lCount]);
  useSyncUpstream(item.titulo, titulo, setTitulo);
  useSyncUpstream(item.texto, texto, setTexto);
  useSyncUpstream(item.legenda, legenda, setLegenda);

  async function runGenerate() {
    setBusy(true);
    try {
      const url = await generatePostImage({
        imagePrompt: item.imagem,
        titulo, texto,
        companyName: kit.companyName,
        primaryColor: kit.primaryColor,
        accentColor: kit.accentColor || '#f4b000',
        fontFamily: kit.fontPair || 'Montserrat',
        secondaryFont: kit.secondaryFont,
        mood, vertical: 'estatico_final', logoPosition: kit.logoPosition,
        leituraCenica: (item as any).leituraCenica,
        forcedGender,
        anchoraPersonagem,
        ancoragePapel,
      });
      const final = await composeFinalPng(kit, { ...item, titulo, texto, legenda }, url);
      updatePreview(final);
      onImageGenerated?.();
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }
  function handleGenerate() { guard({ hasPreview: !!preview, tipo: 'Estático Final', run: runGenerate }); }

  async function runGenerateWithRefs() {
    if (!sel.hasAny) return;
    setBusyRefs(true);
    try {
      const url = await regenerateWithKit({
        slot: { formato: 'estatico_final', posicao: dayNumber, elemento: 'avatar', motivo: '' },
        kit, imageKit: imageKit ?? emptyImageKit, mood,
        keyInfo: `${item.titulo || ''}. ${item.imagem || ''}`.slice(0, 500),
        titulo, texto, imagePrompt: item.imagem, leituraCenica: (item as any).leituraCenica,
        formato: 'post',
        selecaoDireta: { usarAvatar: sel.avatarNum != null, avatarNum: sel.avatarNum as 1 | 2 | null, cenarioNum: sel.cenarioNum, produtosNums: sel.produtosNums },
        anchoraPersonagem, ancoragePapel,
      });
      const final = await composeFinalPng(kit, { ...item, titulo, texto, legenda }, url);
      updatePreview(final);
      onImageGenerated?.();
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusyRefs(false); }
  }

  function handleGenerateWithRefs() { guard({ hasPreview: true, tipo: 'Estático Final', run: runGenerateWithRefs }); }


  const ctx = (kind: RegenKind) => ({
    kind, companyName: kit.companyName, mainActivity: kit.mainActivity, keyInfo,
    formato: 'Estático Final', tituloAtual: titulo, textoAtual: texto, legendaAtual: legenda,
  });

  return (
    <article className="contentCard">
      <button className="cardHeader" type="button" onClick={() => setOpen(o => !o)}>
        <div className="cardHeaderLeft">
          <span className="cardTag">Dia {dayNumber} · Estático Final</span>
          <strong className="cardTitle">{titulo}</strong>
        </div>
        <span className="cardChevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="cardBody">
          <UsoReferenciasDia
            segmento={segmento}
            modelo={modelo}
            formato="estatico_final"
            posicao={dayNumber}
            extrasCarrossel={extrasCarrossel}
            kit={kit}
            imageKit={imageKit ?? emptyImageKit}
            mood={mood}
            titulo={titulo}
            texto={texto}
            imagePrompt={item.imagem}
            leituraCenica={(item as any).leituraCenica}
            storageKey={storageKey}
            onGerou={async (url) => {
              try {
                const final = await composeFinalPng(kit, { ...item, titulo, texto, legenda }, url);
                updatePreview(final);
              } catch {
                updatePreview(url);
              }
            }}
          />
          <EditableField label="Título" kind="titulo" value={titulo} original={item.titulo} count={tCount} onChange={setTitulo} onRegenStart={() => setTCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('titulo')} maxWords={6} />
          <EditableField label="Texto" kind="texto" value={texto} original={item.texto} count={xCount} onChange={setTexto} onRegenStart={() => setXCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('texto')} multiline maxWords={15} />
          <EditableField label="Legenda" kind="legenda" value={legenda} original={item.legenda} count={lCount} onChange={setLegenda} onRegenStart={() => setLCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('legenda')} multiline maxWords={40} excludeTexts={kit.assinatura ? [kit.assinatura] : undefined} />
          {legenda.trim() && isMobile && (
            <button className="downloadBtn" type="button" style={{ width: '100%', minHeight: 44, fontSize: 15, marginTop: 4 }} onClick={() => shareLegendaWhatsApp('Estático Final', legenda)}>
              📲 Compartilhar legenda no WhatsApp
            </button>
          )}
          {preview && <div className="previewWrapper"><img src={preview} alt="Preview" className="previewImg" /></div>}
          <div className="cardActions">
            <button
              type="button"
              disabled={!(kit.assinatura && !legenda.includes(kit.assinatura))}
              onClick={() => { if (kit.assinatura && !legenda.includes(kit.assinatura)) setLegenda(insertSignature(legenda, kit.assinatura)); }}
              style={{ padding: '6px 12px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: (kit.assinatura && !legenda.includes(kit.assinatura)) ? 'pointer' : 'default', background: (kit.assinatura && !legenda.includes(kit.assinatura)) ? '#0f172a' : '#e2e8f0', color: (kit.assinatura && !legenda.includes(kit.assinatura)) ? '#fff' : '#94a3b8' }}
            >
              Inserir Assinatura
            </button>
            <button className="generateBtn" type="button" onClick={handleGenerate} disabled={busy || busyRefs}>
              {busy ? 'Gerando...' : preview ? '↻ Gerar outra (sem refs)' : '⬇ Gerar fechamento'}
            </button>
            {preview && sel.hasAny && kitHasRefsForFormat(imageKit, 'estatico_final', segmento, modelo) && (
              <button className="generateBtn" type="button" onClick={handleGenerateWithRefs} disabled={busy || busyRefs} title="Gerar outra usando as referências marcadas acima">
                {busyRefs ? 'Gerando...' : '↻ Gerar outra com refs'}
              </button>
            )}
            {preview && (
              <button className="downloadBtn" type="button" onClick={() => downloadDataUrl(preview, mopName({ company: kit.companyName, tipo: `estf${String(dayNumber).padStart(2,'0')}`, ext: 'jpg' }))}>
                Baixar
              </button>
            )}
            <ArchiveButton
              tipo="S3V"
              formato="estatico_final"
              dia={dayNumber}
              legenda={legenda}
              imageDataUrls={[preview]}
              titulo={titulo}
              disabledReason="Gere o fechamento antes de arquivar"
            />
          </div>
        </div>
      )}
    </article>
  );
}


// Distribuição de fotos de produto selecionadas (Kit Imagem) pelos cards do
// carrossel de VAREJO — sem misturar produtos fora do conteúdo (só usa as
// fotos selecionadas pelo usuário para este bloco) e sem exigir muitas fotos:
// 1ª foto = card inicial (produto inteiro); última foto selecionada (até 4)
// = card final (produto inteiro); fotos do meio (se houver) são distribuídas
// entre os cards centrais em modo detalhe/recorte — se não houver foto
// dedicada para um card central, repete (round-robin) uma das fotos do meio
// (ou a única foto, se só 1 selecionada) em modo detalhe.
function distributeProduto(produtosNums: number[], index: number, total: number): { num: number; isFull: boolean } | null {
  const nums = produtosNums.slice(0, 4);
  if (!nums.length) return null;
  if (index === 0) return { num: nums[0], isFull: true };
  if (index === total - 1) return { num: nums[nums.length - 1], isFull: true };
  const middlePool = nums.length >= 3 ? nums.slice(1, -1) : nums;
  const m = index - 1;
  return { num: middlePool[m % middlePool.length], isFull: false };
}

function CarouselCardBlock({ cards, kit, mood, dayNumber, keyInfo, guard, segmento, modelo, imageKit, extrasCarrossel, onImageGenerated, userId, forcedGenders, anchoraPersonagem, ancoragePapel }: { cards: CarouselCard[]; kit: BrandKit; mood: MoodCode; dayNumber: number; keyInfo: string; guard: ReturnType<typeof useImageGenAlert>['guard']; onImageGenerated?: () => void; userId?: string | null; forcedGenders: PersonagemGender[]; anchoraPersonagem?: string; ancoragePapel?: string } & RefSelectorProps) {
  const [open, setOpen] = useState(false);
  const [previews, setPreviews] = useState<(string | null)[]>(() => cards.map((c) => getSessionImage(userId, `carousel:${dayNumber}:${c.card}`)));
  function updatePreview(index: number, value: string) {
    setPreviews(prev => prev.map((p, i) => i === index ? value : p));
    setSessionImage(userId, `carousel:${dayNumber}:${cards[index].card}`, value);
  }
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [busyMode, setBusyMode] = useState<'noref' | 'refs' | null>(null);
  const [busyAllMode, setBusyAllMode] = useState<'refs' | 'noref' | null>(null);
  const busyAll = busyAllMode !== null;
  const [allProgress, setAllProgress] = useState<{ done: number; total: number } | null>(null);
  const isMobile = useIsMobile();
  const blockStorageKey = `uso-ref:carrossel:${dayNumber}:bloco`;
  const blockSel = useRefSelection(blockStorageKey);

  // Estado por card: titulo/texto/legenda editáveis + contadores
  const cardCopyKey = (index: number) => `carousel:${dayNumber}:${cards[index].card}`;
  const savedCardEdits = useMemo(() => cards.map((c) => loadCopyEdit(userId, `carousel:${dayNumber}:${c.card}`)), [userId, dayNumber, cards]);
  const [titulos, setTitulos] = useState(cards.map((c, i) => savedCardEdits[i]?.titulo ?? c.titulo));
  const [textos, setTextos] = useState(cards.map((c, i) => savedCardEdits[i]?.texto ?? c.texto));
  const [legendas, setLegendas] = useState(cards.map((c, i) => savedCardEdits[i]?.legenda ?? c.legenda ?? ''));
  const [tCounts, setTCounts] = useState(cards.map((_, i) => savedCardEdits[i]?.tCount ?? 0));
  const [xCounts, setXCounts] = useState(cards.map((_, i) => savedCardEdits[i]?.xCount ?? 0));
  const [lCounts, setLCounts] = useState(cards.map((_, i) => savedCardEdits[i]?.lCount ?? 0));
  useEffect(() => {
    cards.forEach((_, i) => {
      saveCopyEdit(userId, cardCopyKey(i), {
        titulo: titulos[i], texto: textos[i], legenda: legendas[i],
        tCount: tCounts[i], xCount: xCounts[i], lCount: lCounts[i],
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dayNumber, titulos, textos, legendas, tCounts, xCounts, lCounts]);

  // D2 pode corrigir card.titulo/texto/legenda depois que o bloco já foi
  // montado/aberto — resincroniza por índice quem o usuário não editou.
  const prevUpstreamCardsRef = useRef(cards.map((c) => ({ titulo: c.titulo, texto: c.texto, legenda: c.legenda || '' })));
  useEffect(() => {
    const prev = prevUpstreamCardsRef.current;
    setTitulos((arr) => arr.map((cur, i) => (cards[i].titulo !== prev[i]?.titulo && cur === prev[i]?.titulo ? cards[i].titulo : cur)));
    setTextos((arr) => arr.map((cur, i) => (cards[i].texto !== prev[i]?.texto && cur === prev[i]?.texto ? cards[i].texto : cur)));
    setLegendas((arr) => arr.map((cur, i) => {
      const upstream = cards[i].legenda || '';
      return (upstream !== prev[i]?.legenda && cur === prev[i]?.legenda) ? upstream : cur;
    }));
    prevUpstreamCardsRef.current = cards.map((c) => ({ titulo: c.titulo, texto: c.texto, legenda: c.legenda || '' }));
  }, [cards]);

  async function runGenerate(index: number) {
    setBusyIndex(index);
    setBusyMode('noref');
    try {
      const card = cards[index];
      const url = await generatePostImage({
        imagePrompt: card.imagePrompt,
        titulo: titulos[index], texto: textos[index],
        companyName: kit.companyName,
        primaryColor: kit.primaryColor,
        accentColor: kit.accentColor || '#f4b000',
        fontFamily: kit.fontPair || 'Montserrat',
        secondaryFont: kit.secondaryFont,
        mood, vertical: 'post', logoPosition: kit.logoPosition,
        leituraCenica: (card as any).leituraCenica,
        forcedGender: forcedGenders[index],
        anchoraPersonagem,
        ancoragePapel,
      });
      const item: FeedItem = { dia: dayNumber, formato: 'Carrossel', titulo: titulos[index], texto: textos[index], legenda: '', imagem: card.imagePrompt };
      const final = await composeFeedPng(kit, item, url);
      updatePreview(index, final);
      onImageGenerated?.();
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusyIndex(null); setBusyMode(null); }
  }

  function handleGenerate(index: number) {
    guard({ hasPreview: !!previews[index], tipo: 'Carrossel', run: () => runGenerate(index) });
  }

  function handleGenerateWithRefs(index: number) {
    guard({ hasPreview: true, tipo: 'Carrossel', run: () => runGenerateWithRefs(index) });
  }

  // Lê seleção efetiva para um card: prefere storage do bloco (consolidado)
  // mapeando card[i] → produto[i]; fallback para storage individual por card.
  function selecaoParaCard(index: number): { usarAvatar: boolean; avatarNum: 1 | 2 | null; cenarioNum: number | null; produtosNums: number[]; produtoDetalhe?: boolean } | null {
    const card = cards[index];
    // Migração do formato antigo (usarAvatar boolean) → avatarNum (1|2|null).
    const avatarNumDe = (j: any): 1 | 2 | null =>
      (typeof j.avatarNum === 'number') ? j.avatarNum : (j.usarAvatar ? 1 : null);
    // 1) Bloco consolidado
    try {
      const raw = localStorage.getItem(blockStorageKey);
      if (raw) {
        const j = JSON.parse(raw);
        if (j.enabled) {
          const produtos: number[] = Array.isArray(j.produtosNums) ? j.produtosNums.filter((n: unknown) => typeof n === 'number') : [];
          const avatarNum = avatarNumDe(j);
          // VAREJO: distribui as fotos selecionadas pelos cards (1ª/última =
          // produto inteiro, meio = detalhe/recorte) — ver distributeProduto.
          if (segmento === 'VAREJO') {
            const d = distributeProduto(produtos, index, cards.length);
            return {
              usarAvatar: avatarNum != null,
              avatarNum,
              cenarioNum: typeof j.cenarioNum === 'number' ? j.cenarioNum : null,
              produtosNums: d ? [d.num] : [],
              produtoDetalhe: d ? !d.isFull : false,
            };
          }
          // Outros segmentos: 1 produto por card, revezando entre os
          // selecionados (round-robin) em vez de travar no produto[0] quando
          // há mais cards do que produtos selecionados.
          const pick = produtos.length ? produtos[index % produtos.length] : null;
          return {
            usarAvatar: avatarNum != null,
            avatarNum,
            cenarioNum: typeof j.cenarioNum === 'number' ? j.cenarioNum : null,
            produtosNums: pick != null ? [pick] : [],
          };
        }
      }
    } catch { /* ignore */ }
    // 2) Storage individual por card (legacy)
    try {
      const raw = localStorage.getItem(`uso-ref:carrossel:${dayNumber}:c${card.card}`);
      if (!raw) return null;
      const j = JSON.parse(raw);
      if (!j.enabled) return null;
      const avatarNum = avatarNumDe(j);
      return {
        usarAvatar: avatarNum != null,
        avatarNum,
        cenarioNum: typeof j.cenarioNum === 'number' ? j.cenarioNum : null,
        produtosNums: Array.isArray(j.produtosNums) ? j.produtosNums : [],
      };
    } catch { return null; }
  }

  async function runGenerateWithRefs(index: number) {
    const s = selecaoParaCard(index);
    if (!s) return;
    const card = cards[index];
    setBusyIndex(index);
    setBusyMode('refs');
    try {
      const url = await regenerateWithKit({
        slot: { formato: 'carrossel', posicao: dayNumber, elemento: 'avatar', cardCarrossel: card.card, motivo: '' },
        kit, imageKit: imageKit ?? emptyImageKit, mood,
        keyInfo: `${card.titulo || ''}. ${card.imagePrompt || ''}`.slice(0, 500),
        titulo: titulos[index], texto: textos[index],
        imagePrompt: card.imagePrompt,
        leituraCenica: (card as any).leituraCenica,
        formato: 'post',
        selecaoDireta: s,
        anchoraPersonagem, ancoragePapel,
      });
      const item: FeedItem = { dia: dayNumber, formato: 'Carrossel', titulo: titulos[index], texto: textos[index], legenda: '', imagem: card.imagePrompt };
      const final = await composeFeedPng(kit, item, url);
      updatePreview(index, final);
      onImageGenerated?.();
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusyIndex(null); setBusyMode(null); }
  }

  // Gera os N cards em sequência SEM imagens de referência.
  async function runGenerateAll() {
    const ok = window.confirm(
      `Gerar todos os ${cards.length} cards sem imagens de referência?\n\n` +
      `⚠️ Antes de confirmar: revise e ajuste os títulos e textos de cada card — ` +
      `eles serão usados exatamente como estão na geração.\n\n` +
      `Você ainda poderá regerar cards individualmente depois.`
    );
    if (!ok) return;
    setBusyAllMode('noref');
    const total = cards.length;
    const failures: number[] = [];
    let done = 0;
    setAllProgress({ done: 0, total });
    try {
      await runWithConcurrency(cards, GENERATE_ALL_CONCURRENCY, async (card, i) => {
        try {
          const url = await generatePostImage({
            imagePrompt: card.imagePrompt,
            titulo: titulos[i], texto: textos[i],
            companyName: kit.companyName,
            primaryColor: kit.primaryColor,
            accentColor: kit.accentColor || '#f4b000',
            fontFamily: kit.fontPair || 'Montserrat',
            secondaryFont: kit.secondaryFont,
            mood, vertical: 'post', logoPosition: kit.logoPosition,
            leituraCenica: (card as any).leituraCenica,
            forcedGender: forcedGenders[i],
            anchoraPersonagem,
            ancoragePapel,
          });
          const item: FeedItem = { dia: dayNumber, formato: 'Carrossel', titulo: titulos[i], texto: textos[i], legenda: '', imagem: card.imagePrompt };
          const final = await composeFeedPng(kit, item, url);
          updatePreview(i, final);
        } catch (err) {
          console.error(`Falha card ${i + 1}:`, err);
          failures.push(i + 1);
        } finally {
          done++;
          setAllProgress({ done, total });
        }
      });
      if (failures.length) {
        failures.sort((a, b) => a - b);
        alert(`${failures.length} de ${total} card(s) falharam (cards ${failures.join(', ')}). Use "⬇ Gerar card" no card para tentar de novo.`);
      } else {
        onImageGenerated?.();
      }
    } finally {
      setBusyAllMode(null);
      setTimeout(() => setAllProgress(null), 1500);
    }
  }

  // Gera os N cards em sequência usando refs consolidadas do bloco.
  async function runGenerateAllWithRefs() {
    if (!blockSel.hasAny) return;
    const ok = window.confirm(
      `Gerar todos os ${cards.length} cards com as referências selecionadas?\n\n` +
      `⚠️ Antes de confirmar: revise os títulos e textos — eles serão usados exatamente como estão na geração.\n\n` +
      `Você ainda poderá regerar cards individualmente depois.`
    );
    if (!ok) return;
    setBusyAllMode('refs');
    const total = cards.length;
    const failures: number[] = [];
    const skipped: number[] = [];
    let done = 0;
    setAllProgress({ done: 0, total });
    try {
      await runWithConcurrency(cards, GENERATE_ALL_CONCURRENCY, async (card, i) => {
        try {
          const s = selecaoParaCard(i);
          if (!s) { skipped.push(i + 1); return; }
          const url = await regenerateWithKit({
            slot: { formato: 'carrossel', posicao: dayNumber, elemento: 'avatar', cardCarrossel: card.card, motivo: '' },
            kit, imageKit: imageKit ?? emptyImageKit, mood,
            keyInfo: `${card.titulo || ''}. ${card.imagePrompt || ''}`.slice(0, 500),
            titulo: titulos[i], texto: textos[i],
            imagePrompt: card.imagePrompt,
            leituraCenica: (card as any).leituraCenica,
            formato: 'post',
            selecaoDireta: s,
            anchoraPersonagem, ancoragePapel,
          });
          const item: FeedItem = { dia: dayNumber, formato: 'Carrossel', titulo: titulos[i], texto: textos[i], legenda: '', imagem: card.imagePrompt };
          const final = await composeFeedPng(kit, item, url);
          updatePreview(i, final);
        } catch (err) {
          console.error(`Falha card ${i + 1}:`, err);
          failures.push(i + 1);
        } finally {
          done++;
          setAllProgress({ done, total });
        }
      });
      if (failures.length || skipped.length) {
        failures.sort((a, b) => a - b);
        skipped.sort((a, b) => a - b);
        const partes: string[] = [];
        if (failures.length) partes.push(`${failures.length} falharam (cards ${failures.join(', ')})`);
        if (skipped.length) partes.push(`${skipped.length} sem seleção de referência válida (cards ${skipped.join(', ')})`);
        alert(`Geração com referências: ${partes.join('; ')}. Use o botão "↻ Gerar outra com refs" no card para tentar de novo.`);
      } else {
        onImageGenerated?.();
      }
    } finally {
      setBusyAllMode(null);
      setTimeout(() => setAllProgress(null), 1500);
    }
  }





  return (
    <article className="contentCard">
      <button className="cardHeader" type="button" onClick={() => setOpen(o => !o)}>
        <div className="cardHeaderLeft">
          <span className="cardTag">Dia {dayNumber} · Carrossel · {cards.length} cards</span>
          <strong className="cardTitle">{titulos[0]}</strong>
        </div>
        <span className="cardChevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="cardBody">
          {/* Caixa CONSOLIDADA de Imagens de Referência para o carrossel inteiro.
              Marca-se 1 cenário + até N produtos aqui; card[i] usa produto[i]. */}
          <UsoReferenciasDia
            segmento={segmento}
            modelo={modelo}
            formato="carrossel"
            posicao={dayNumber}
            extrasCarrossel={extrasCarrossel}
            kit={kit}
            imageKit={imageKit ?? emptyImageKit}
            mood={mood}
            storageKey={blockStorageKey}
            compact
            onGerou={() => { /* disparo vem do botão "Gerar X cards com refs" */ }}
            footerAction={blockSel.hasAny && kitHasRefsForFormat(imageKit, 'carrossel', segmento, modelo) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span style={{ fontSize: 11, color: '#475569' }}>
                  Cada card recebe o produto na ordem marcada (card 1 → produto 1, …).
                </span>
                <button
                  type="button"
                  className="generateBtn"
                  onClick={runGenerateAllWithRefs}
                  disabled={busyAll || busyIndex !== null}
                  title="Gera os cards em sequência: card 1 com produto 1, card 2 com produto 2, e assim por diante"
                >
                  {busyAllMode === 'refs'
                    ? `Gerando ${(allProgress?.done ?? 0) + 1}/${allProgress?.total ?? cards.length}…`
                    : `✨ Gerar ${cards.length} cards com refs`}
                </button>
              </div>
            ) : undefined}
          />

          {/* Caixa separada: gerar todos os cards sem imagens de referência. */}
          <div style={{
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
            padding: '8px 10px', marginBottom: 10,
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          }}>
            <button
              type="button"
              className="generateBtn"
              onClick={runGenerateAll}
              disabled={busyAll || busyIndex !== null}
              title="Gera todos os cards em sequência sem imagem de referência. Revise os títulos e textos antes."
            >
              {busyAllMode === 'noref'
                ? `Gerando ${(allProgress?.done ?? 0) + 1}/${allProgress?.total ?? cards.length}…`
                : `✨ Gerar todos os ${cards.length} cards (sem refs)`}
            </button>
            <span style={{ fontSize: 11, color: '#64748b' }}>Revise títulos e textos antes de confirmar.</span>
          </div>
          {cards.map((card, index) => {
            const ctx = (kind: RegenKind) => ({
              kind, companyName: kit.companyName, mainActivity: kit.mainActivity, keyInfo,
              formato: `Carrossel — Card ${card.card}`, tituloAtual: titulos[index], textoAtual: textos[index], legendaAtual: legendas[index],
            });
            return (
              <div key={card.card} className="carouselCardBlock">
                <span className="cardTag">Card {card.card}</span>
                <EditableField label="Título do card" kind="titulo" value={titulos[index]} original={card.titulo} count={tCounts[index]} onChange={(v) => setTitulos(prev => prev.map((p,i) => i === index ? v : p))} onRegenStart={() => setTCounts(prev => prev.map((c,i) => i === index ? c + 1 : c))} onRegenDone={() => {}} ctxBuilder={() => ctx('titulo')} maxWords={6} />
                <EditableField label="Texto do card" kind="texto" value={textos[index]} original={card.texto} count={xCounts[index]} onChange={(v) => setTextos(prev => prev.map((p,i) => i === index ? v : p))} onRegenStart={() => setXCounts(prev => prev.map((c,i) => i === index ? c + 1 : c))} onRegenDone={() => {}} ctxBuilder={() => ctx('texto')} multiline maxWords={12} />
                {index === cards.length - 1 && (
                  <>
                    <EditableField label="Legenda do card" kind="legenda" value={legendas[index]} original={card.legenda || ''} count={lCounts[index]} onChange={(v) => setLegendas(prev => prev.map((p,i) => i === index ? v : p))} onRegenStart={() => setLCounts(prev => prev.map((c,i) => i === index ? c + 1 : c))} onRegenDone={() => {}} ctxBuilder={() => ctx('legenda')} multiline maxWords={40} excludeTexts={kit.assinatura ? [kit.assinatura] : undefined} />
                    <div style={{ marginTop: 4 }}>
                      <button
                        type="button"
                        disabled={!(kit.assinatura && !legendas[index].includes(kit.assinatura))}
                        onClick={() => { if (kit.assinatura && !legendas[index].includes(kit.assinatura)) setLegendas(prev => prev.map((p, i) => i === index ? insertSignature(p, kit.assinatura!) : p)); }}
                        style={{ padding: '6px 12px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: (kit.assinatura && !legendas[index].includes(kit.assinatura)) ? 'pointer' : 'default', background: (kit.assinatura && !legendas[index].includes(kit.assinatura)) ? '#0f172a' : '#e2e8f0', color: (kit.assinatura && !legendas[index].includes(kit.assinatura)) ? '#fff' : '#94a3b8' }}
                      >
                        Inserir Assinatura
                      </button>
                    </div>
                    {legendas[index].trim() && isMobile && (
                      <button className="downloadBtn" type="button" style={{ width: '100%', minHeight: 44, fontSize: 15, marginTop: 4 }} onClick={() => shareLegendaWhatsApp('Carrossel', legendas[index])}>
                        📲 Compartilhar legenda no WhatsApp
                      </button>
                    )}
                  </>
                )}
                {previews[index] && (
                  <div className="previewWrapper"><img src={previews[index]!} alt={`Card ${card.card}`} className="previewImg" /></div>
                )}
                <div className="cardActions">
                  <button className="generateBtn" type="button" onClick={() => handleGenerate(index)} disabled={busyIndex !== null || busyAll}>
                    {busyIndex === index && busyMode === 'noref' && !busyAll ? 'Gerando...' : previews[index] ? '↻ Gerar outra (sem refs)' : '⬇ Gerar card'}
                  </button>
                  {previews[index] && (
                    <RefsRegenButton
                      storageKey={`uso-ref:carrossel:${dayNumber}:c${card.card}`}
                      fallbackKey={blockStorageKey}
                      busy={(busyIndex === index && busyMode === 'refs') || busyAll}
                      onRun={() => handleGenerateWithRefs(index)}
                      imageKit={imageKit}
                      formato="carrossel"
                      segmento={segmento}
                      modelo={modelo}
                    />
                  )}
                  {previews[index] && (
                    <button className="downloadBtn" type="button" onClick={() => downloadDataUrl(previews[index]!, mopName({ company: kit.companyName, tipo: `car${String(dayNumber).padStart(2,'0')}_c${card.card}`, ext: 'jpg' }))}>
                      Baixar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
            <ArchiveButton
              tipo="S3V"
              formato="carrossel"
              dia={dayNumber}
              legenda={legendas[legendas.length - 1] || ''}
              imageDataUrls={previews}
              titulo={titulos[0]}
              disabledReason="Gere todos os cards do carrossel antes de arquivar"
            />
          </div>
        </div>
      )}
    </article>
  );
}


// Modos de renderização de vídeo (Veo3.1 Lite):
// 'portugues'   → áudio nativo do modelo em pt-BR
// 'kit-voz'     → TTS com voz clonada sincronizada via audio_url
// 'sinalizacao' → vídeo silencioso + título queimado no canvas via FFmpeg
type VideoMode = 'portugues' | 'kit-voz' | 'sinalizacao';

function ReelsCard({ reels, kit, mood, dayNumber, track, keyInfo, guard, segmento, modelo, imageKit, extrasCarrossel, onImageGenerated, userId, anchoraPersonagem, ancoragePapel }: { reels: ReelsGuide; kit: BrandKit; mood: MoodCode; dayNumber: number; track?: string; keyInfo: string; guard: ReturnType<typeof useImageGenAlert>['guard']; onImageGenerated?: () => void; userId?: string | null; anchoraPersonagem?: string; ancoragePapel?: string } & RefSelectorProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyRefs, setBusyRefs] = useState(false);
  const [preview, setPreview] = useState<string | null>(() => getSessionImage(userId, `reels-preview:${dayNumber}`));
  // previewBase = mesma imagem do preview SEM a logo aplicada pelo canvas.
  // É o que mandamos para o gpt-image-2/edit como referência da capa, para
  // que o modelo aplique apenas o lettering do título e não tente redesenhar
  // a logomarca (a logo final é reaplicada por canvas em cima da capa).
  const [previewBase, setPreviewBase] = useState<string | null>(() => getSessionImage(userId, `reels-previewBase:${dayNumber}`));
  const [busyVideo, setBusyVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  // Resultado real do backend de vídeo (lipsync efetivamente concluído ou não).
  const [usedClonedVoice, setUsedClonedVoice] = useState<boolean | null>(null);
  const [requestedClonedVoice, setRequestedClonedVoice] = useState<boolean>(false);
  const [coverPng, setCoverPng] = useState<string | null>(() => getSessionImage(userId, `reels-cover:${dayNumber}`));
  const [coverError, setCoverError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [retryingCover, setRetryingCover] = useState(false);
  const [retryingVideo, setRetryingVideo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasClonedVoice, setHasClonedVoice] = useState(false);
  const [videoMode, setVideoMode] = useState<VideoMode>('portugues');
  const [videoStartedAt, setVideoStartedAt] = useState<number | null>(null);
  const [videoElapsed, setVideoElapsed] = useState(0);
  const [burnProgress, setBurnProgress] = useState<string | null>(null);
  // Ref para limpar blob URLs de vídeos processados pelo FFmpeg (sinalização).
  const burnedBlobUrlRef = useRef<string | null>(null);
  // URL original do FAL (antes do burn) — usada para arquivamento, pois blob URLs
  // expiram ao fechar a página e não podem ser acessadas pelo servidor.
  const falVideoUrlRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLDivElement | null>(null);

  function updatePreview(value: string | null) {
    setPreview(value);
    setSessionImage(userId, `reels-preview:${dayNumber}`, value);
  }
  function updatePreviewBase(value: string | null) {
    setPreviewBase(value);
    setSessionImage(userId, `reels-previewBase:${dayNumber}`, value);
  }
  function updateCoverPng(value: string | null) {
    setCoverPng(value);
    setSessionImage(userId, `reels-cover:${dayNumber}`, value);
  }

  // Limpa blob URL ao desmontar (evita vazamento de memória).
  useEffect(() => {
    return () => {
      if (burnedBlobUrlRef.current) {
        URL.revokeObjectURL(burnedBlobUrlRef.current);
      }
    };
  }, []);

  // Garante que modos com voz clonada só ficam ativos quando há voz treinada.
  useEffect(() => {
    if (!hasClonedVoice && videoMode === 'kit-voz') {
      setVideoMode('portugues');
    }
  }, [hasClonedVoice, videoMode]);

  // Tick simulado de progresso enquanto o vídeo gera.
  useEffect(() => {
    if (!busyVideo || !videoStartedAt) return;
    const id = setInterval(() => {
      setVideoElapsed(Math.floor((Date.now() - videoStartedAt) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [busyVideo, videoStartedAt]);

  const videoStepLabel = (() => {
    if (!busyVideo) return null;
    if (burnProgress) return burnProgress;
    if (videoMode === 'sinalizacao') {
      return videoElapsed > 60 ? 'Aplicando sinalização visual…' : 'Gerando vídeo…';
    }
    return 'Gerando vídeo…';
  })();
  const videoProgressPct = (() => {
    if (!busyVideo) return 0;
    if (videoMode === 'kit-voz') {
      return Math.min(95, Math.round((videoElapsed / 120) * 95));
    }
    if (videoMode === 'sinalizacao') {
      return Math.min(95, Math.round((videoElapsed / 120) * 95));
    }
    return 0;
  })();
  const isMobile = useIsMobile();

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from('voice_clones' as any)
        .select('status')
        .eq('user_id', uid)
        .maybeSingle();
      if (alive && (data as any)?.status === 'ready') setHasClonedVoice(true);
    })();
    return () => { alive = false; };
  }, []);

  // Conteúdo editável do reels
  const reelsCopyKey = `reels:${dayNumber}`;
  const savedReelsCopyEdit = useMemo(() => loadCopyEdit(userId, reelsCopyKey), [userId, reelsCopyKey]);
  const [hook, setHook] = useState(savedReelsCopyEdit?.titulo ?? reels.hook);
  const [script, setScript] = useState(savedReelsCopyEdit?.texto ?? reels.script);
  const [legenda, setLegenda] = useState(savedReelsCopyEdit?.legenda ?? (reels.legenda || reels.script || '').trim());
  const [hCount, setHCount] = useState(savedReelsCopyEdit?.tCount ?? 0);
  const [sCount, setSCount] = useState(savedReelsCopyEdit?.xCount ?? 0);
  const [lCount, setLCount] = useState(savedReelsCopyEdit?.lCount ?? 0);
  useEffect(() => {
    saveCopyEdit(userId, reelsCopyKey, { titulo: hook, texto: script, legenda, tCount: hCount, xCount: sCount, lCount });
  }, [userId, reelsCopyKey, hook, script, legenda, hCount, sCount, lCount]);
  useSyncUpstream(reels.hook, hook, setHook);
  useSyncUpstream(reels.script, script, setScript);
  useSyncUpstream((reels.legenda || reels.script || '').trim(), legenda, setLegenda);

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (videoUrl && videoRef.current) {
      videoRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [videoUrl]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(legenda);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      alert('Não foi possível copiar. Selecione e copie manualmente.');
    }
  }

  async function handleShare() {
    if (canShare) {
      try {
        const isCine = track === 'cinematica';
        const baseTipo = isCine ? `s3c_${String(dayNumber).padStart(2,'0')}` : `rel${String(dayNumber).padStart(2,'0')}`;
        if (preview && typeof (navigator as any).canShare === 'function') {
          try {
            const blob = await (await fetch(preview)).blob();
            const file = new File([blob], mopName({ company: kit.companyName, tipo: `${baseTipo}_cp`, ext: 'jpg' }), { type: blob.type || 'image/jpeg' });
            if ((navigator as any).canShare({ files: [file] })) {
              await navigator.share({ text: legenda, files: [file] } as ShareData);
              return;
            }
          } catch { /* fallback abaixo */ }
        }
        await navigator.share({ text: legenda });
        return;
      } catch { /* cancelado */ }
    }
    handleCopy();
  }

  async function runGenerate() {
    setBusy(true);
    try {
      // Logo NÃO vai para a IA — gpt-image-2/edit com logo como referência ignorava o prompt
      // da cena. Logo é aplicada por canvas (igual ao path com refs do Kit Imagem).
      const url = await generatePostImage({
        imagePrompt: reels.imagePrompt,
        titulo: '', texto: '',
        companyName: kit.companyName,
        primaryColor: kit.primaryColor,
        accentColor: kit.accentColor || '#f4b000',
        fontFamily: kit.fontPair || 'Montserrat',
        secondaryFont: kit.secondaryFont,
        mood, vertical: 'reels',
        logoPosition: kit.logoPosition,
        anchoraPersonagem,
        ancoragePapel,
      });
      const final = kit.logoDataUrl ? await composeReelsPng(kit, url) : url;
      updatePreview(final);
      updatePreviewBase(url);  // frame limpo (sem logo) = base ideal para a capa
      setVideoUrl(null);
      updateCoverPng(null);
      onImageGenerated?.();
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }
  function handleGenerate() { guard({ hasPreview: !!preview, tipo: 'Reels', run: runGenerate }); }

  async function runGenerateWithRefs() {
    const storageKey = `uso-ref:reels:${dayNumber}`;
    let s: { usarAvatar: boolean; avatarNum: 1 | 2 | null; cenarioNum: number | null; produtosNums: number[] };
    try {
      const raw = localStorage.getItem(storageKey);
      const j = raw ? JSON.parse(raw) : {};
      // Migração do formato antigo (usarAvatar boolean) → avatarNum (1|2|null).
      const avatarNum: 1 | 2 | null = (typeof j.avatarNum === 'number') ? j.avatarNum : (j.usarAvatar ? 1 : null);
      s = {
        usarAvatar: avatarNum != null,
        avatarNum,
        cenarioNum: typeof j.cenarioNum === 'number' ? j.cenarioNum : null,
        produtosNums: Array.isArray(j.produtosNums) ? j.produtosNums : [],
      };
    } catch { return; }
    setBusyRefs(true);
    try {
      const url = await regenerateWithKit({
        slot: { formato: 'reels', posicao: dayNumber, elemento: 'avatar', motivo: '' },
        kit, imageKit: imageKit ?? emptyImageKit, mood,
        keyInfo: `${reels.imagePrompt || ''}`.slice(0, 500),
        imagePrompt: reels.imagePrompt,
        leituraCenica: (reels as any).leituraCenica,
        formato: 'reels',
        selecaoDireta: s,
        anchoraPersonagem, ancoragePapel,
      });
      const final = await composeReelsPng(kit, url);
      updatePreview(final);
      // url = imagem do reels antes do canvas aplicar a logo → base ideal para o /edit da capa.
      updatePreviewBase(url);
      setVideoUrl(null);
      updateCoverPng(null);
      onImageGenerated?.();
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusyRefs(false); }
  }

  function handleGenerateWithRefs() { guard({ hasPreview: true, tipo: 'Reels', run: runGenerateWithRefs }); }


  async function submitVideoRequest(): Promise<{ videoUrl: string; usedClonedVoice: boolean; requestedClonedVoice: boolean }> {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    const imp = getImpersonation();
    const res = await fetch('/api/generate-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(imp ? { 'X-Impersonate-User-Id': imp.userId } : {}),
      },
      body: JSON.stringify({
        imageBase64: preview,
        script,
        videoMode,
        useClonedVoice: videoMode === 'kit-voz',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao gerar vídeo');

    // Backend submete o job (Kling AI Avatar) e retorna imediatamente com statusUrl/responseUrl.
    // O frontend faz o poll via /api/fal-status a cada 5s até receber o vídeo.
    if (data.phase === 'pending' && data.statusUrl && data.responseUrl) {
      const deadline = Date.now() + 10 * 60 * 1000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5000));
        const statusRes = await fetch(
          `/api/fal-status?statusUrl=${encodeURIComponent(data.statusUrl)}&responseUrl=${encodeURIComponent(data.responseUrl)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        const s = await statusRes.json() as { status: string; videoUrl?: string; error?: string };
        if (s.status === 'done' && s.videoUrl) {
          return {
            videoUrl: s.videoUrl,
            usedClonedVoice: data.usedClonedVoice === true,
            requestedClonedVoice: data.requestedClonedVoice === true,
          };
        }
        if (s.status === 'failed') throw new Error(s.error || 'Geração falhou.');
        // status === 'processing': continua polling
      }
      throw new Error('Geração de vídeo não completou em 10 minutos. Tente novamente.');
    }

    return {
      videoUrl: data.videoUrl as string,
      usedClonedVoice: data.usedClonedVoice === true,
      requestedClonedVoice: data.requestedClonedVoice === true || videoMode === 'kit-voz',
    };
  }

  async function runGenerateVideo() {
    if (!preview) return;
    setBusyVideo(true);
    setVideoStartedAt(Date.now());
    setVideoElapsed(0);
    setBurnProgress(null);
    // Só limpa a capa se ainda não há uma gerada — preserva a capa existente nos retries.
    if (!coverPng) setCoverPng(null);
    setCoverError(null);
    setVideoError(null);
    try {
      // Título da capa = hook/título do reels.
      const titleText = hook.trim();

      // Ref da capa = frame sem logo quando disponível; fallback = preview com logo.
      const coverRefImage = previewBase || preview;

      // Só gera nova capa se ainda não há uma — em retries reutiliza a capa existente.
      // Frame (previewBase sem logo) como referência → gpt-image-2/edit preserva cena + aplica título.
      // Logo aplicada por canvas após geração (não vai para a IA).
      const coverPromise: Promise<string> = coverPng
        ? Promise.resolve(coverPng)
        : generatePostImage({
            imagePrompt: reels.imagePrompt,
            titulo: titleText,
            texto: '',
            companyName: kit.companyName,
            primaryColor: kit.primaryColor,
            accentColor: kit.accentColor || '#f4b000',
            fontFamily: kit.fontPair || 'Montserrat',
            secondaryFont: kit.secondaryFont,
            mood,
            vertical: 'reels_cover',
            logoDataUrl: kit.logoDataUrl,
            logoPosition: kit.logoPosition,
            referenceImages: coverRefImage ? [coverRefImage] : undefined,
          }).then(async (url) => (kit.logoDataUrl ? composeReelsPng(kit, url) : url));

      const videoPromise = submitVideoRequest();

      const [videoRes, coverRes] = await Promise.allSettled([videoPromise, coverPromise]);

      // PRIMEIRO trata capa.
      if (coverRes.status === 'fulfilled') {
        updateCoverPng(coverRes.value);
      } else {
        const msg = (coverRes.reason as Error)?.message || 'erro desconhecido';
        console.error('[runGenerateVideo] capa falhou:', coverRes.reason);
        setCoverError(msg);
      }

      // DEPOIS trata vídeo.
      if (videoRes.status === 'rejected') {
        const msg = (videoRes.reason as Error)?.message || 'erro desconhecido';
        console.error('[runGenerateVideo] vídeo falhou:', videoRes.reason);
        setVideoError(msg);
        return;
      }

      const falUrl = videoRes.value.videoUrl;
      falVideoUrlRef.current = falUrl;  // preserva URL FAL para arquivamento
      let finalVideoUrl = falUrl;
      setUsedClonedVoice(videoRes.value.usedClonedVoice);
      setRequestedClonedVoice(videoRes.value.requestedClonedVoice);

      // Modo Sinalização: queima o screenText como overlay visual usando FFmpeg.
      // O título aparece nos primeiros 4s do vídeo (metade do reels de 8s).
      if (videoMode === 'sinalizacao' && titleText) {
        try {
          setBurnProgress('Etapa 2/2: Carregando processador de sinalização…');
          const baseImg = previewBase || preview || undefined;
          const titlePng = await composeReelsTitlePng(kit, titleText, baseImg ?? undefined, mood);
          setBurnProgress('Etapa 2/2: Aplicando texto visual no vídeo…');
          const burnedBlob = await burnTitleIntoVideo(falUrl, titlePng, 4.0, (msg) => setBurnProgress(`Sinalização: ${msg}`));
          // Libera o blob anterior antes de criar o novo.
          if (burnedBlobUrlRef.current) {
            URL.revokeObjectURL(burnedBlobUrlRef.current);
          }
          const blobUrl = URL.createObjectURL(burnedBlob);
          burnedBlobUrlRef.current = blobUrl;
          finalVideoUrl = blobUrl;
        } catch (e) {
          // Falha no burn não impede o usuário de ver o vídeo base.
          console.warn('[runGenerateVideo] sinalizacao burn falhou:', (e as Error).message);
          setVideoError(`Sinalização visual falhou: ${(e as Error).message}. O vídeo base está disponível.`);
        }
        setBurnProgress(null);
      }

      setVideoUrl(finalVideoUrl);
      onImageGenerated?.();
    } finally {
      setBusyVideo(false);
      setVideoStartedAt(null);
      setBurnProgress(null);
    }
  }

  async function retryVideoOnly() {
    if (!preview || retryingVideo) return;
    setRetryingVideo(true);
    setVideoError(null);
    setVideoStartedAt(Date.now());
    setVideoElapsed(0);
    setBurnProgress(null);
    try {
      const r = await submitVideoRequest();
      const falUrl = r.videoUrl;
      falVideoUrlRef.current = falUrl;
      let finalVideoUrl = falUrl;

      if (videoMode === 'sinalizacao') {
        const titleText = hook.trim();
        if (titleText) {
          try {
            setBurnProgress('Aplicando sinalização visual…');
            const baseImg = previewBase || preview || undefined;
            const titlePng = await composeReelsTitlePng(kit, titleText, baseImg ?? undefined, mood);
            const burnedBlob = await burnTitleIntoVideo(falUrl, titlePng, 4.0, (msg) => setBurnProgress(msg));
            if (burnedBlobUrlRef.current) URL.revokeObjectURL(burnedBlobUrlRef.current);
            const blobUrl = URL.createObjectURL(burnedBlob);
            burnedBlobUrlRef.current = blobUrl;
            finalVideoUrl = blobUrl;
          } catch (e) {
            console.warn('[retryVideoOnly] sinalizacao burn falhou:', (e as Error).message);
          }
        }
      }

      setVideoUrl(finalVideoUrl);
      setUsedClonedVoice(r.usedClonedVoice);
      setRequestedClonedVoice(r.requestedClonedVoice);
      onImageGenerated?.();
    } catch (e) {
      const msg = (e as Error)?.message || 'erro desconhecido';
      console.error('[retryVideoOnly]', e);
      setVideoError(msg);
    } finally {
      setRetryingVideo(false);
      setVideoStartedAt(null);
      setBurnProgress(null);
    }
  }


  async function retryCover() {
    if (!preview || retryingCover) return;
    setRetryingCover(true);
    setCoverError(null);
    try {
      // Título da capa = hook/título do reels.
      const titleText = hook.trim();
      // Frame (previewBase sem logo) como referência → gpt-image-2/edit preserva cena + aplica título.
      // Logo aplicada por canvas após geração.
      const url = await generatePostImage({
        imagePrompt: reels.imagePrompt,
        titulo: titleText,
        texto: '',
        companyName: kit.companyName,
        primaryColor: kit.primaryColor,
        accentColor: kit.accentColor || '#f4b000',
        fontFamily: kit.fontPair || 'Montserrat',
        secondaryFont: kit.secondaryFont,
        mood,
        vertical: 'reels_cover',
        logoDataUrl: kit.logoDataUrl,
        logoPosition: kit.logoPosition,
        referenceImages: (previewBase || preview) ? [(previewBase || preview) as string] : undefined,
      });
      const withLogo = kit.logoDataUrl ? await composeReelsPng(kit, url) : url;
      updateCoverPng(withLogo);
    } catch (e) {
      setCoverError((e as Error)?.message || 'erro desconhecido');
    } finally {
      setRetryingCover(false);
    }
  }

  const ctx = (kind: RegenKind) => ({
    kind, companyName: kit.companyName, mainActivity: kit.mainActivity, keyInfo,
    formato: 'Reels', tituloAtual: hook, textoAtual: `Roteiro: ${script}`, legendaAtual: legenda,
  });

  function handleGenerateVideo() { guard({ hasPreview: !!videoUrl, tipo: 'Vídeo', run: runGenerateVideo }); }

  return (
    <article className="contentCard">
      <button className="cardHeader" type="button" onClick={() => setOpen(o => !o)}>
        <div className="cardHeaderLeft">
          <span className="cardTag">Dia {dayNumber} · Reels</span>
          <strong className="cardTitle">{hook}</strong>
        </div>
        <span className="cardChevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="cardBody">
          <UsoReferenciasDia
            segmento={segmento}
            modelo={modelo}
            formato="reels"
            posicao={dayNumber}
            extrasCarrossel={extrasCarrossel}
            kit={kit}
            imageKit={imageKit ?? emptyImageKit}
            mood={mood}
            imagePrompt={reels.imagePrompt}
            formatoOverride="reels"
            storageKey={`uso-ref:reels:${dayNumber}`}
            onGerou={async (url) => {
              // Reels: a imagem vem limpa do motor (cenário/avatar já
              // aplicados). Aqui só sobrepõe a logo via canvas.
              try {
                const withLogo = kit.logoDataUrl
                  ? await composeReelsPng(kit, url)
                  : url;
                updatePreview(withLogo);
                // url = frame SEM logo → base ideal para o /edit da capa.
                updatePreviewBase(url);
              } catch {
                updatePreview(url);
                updatePreviewBase(url);
              }
              setVideoUrl(null);
              updateCoverPng(null);
            }}
          />
          <EditableField label="Hook / Título do reels" kind="titulo" value={hook} original={reels.hook} count={hCount} onChange={setHook} onRegenStart={() => setHCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('titulo')} maxWords={6} />
          <EditableField label="Roteiro falado (TTS ou voz clonada)" kind="texto" value={script} original={reels.script} count={sCount} onChange={setScript} onRegenStart={() => setSCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('texto')} multiline maxWords={22} />
          <EditableField label="Legenda" kind="legenda" value={legenda} original={(reels.legenda || reels.script || '').trim()} count={lCount} onChange={setLegenda} onRegenStart={() => setLCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('legenda')} multiline maxWords={40} excludeTexts={kit.assinatura ? [kit.assinatura] : undefined} />

          {legenda && (
            <div className="cardActions" style={{ marginBottom: 4 }}>
              <button
                type="button"
                disabled={!(kit.assinatura && !legenda.includes(kit.assinatura))}
                onClick={() => { if (kit.assinatura && !legenda.includes(kit.assinatura)) setLegenda(insertSignature(legenda, kit.assinatura)); }}
                style={{ padding: '6px 12px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: (kit.assinatura && !legenda.includes(kit.assinatura)) ? 'pointer' : 'default', background: (kit.assinatura && !legenda.includes(kit.assinatura)) ? '#0f172a' : '#e2e8f0', color: (kit.assinatura && !legenda.includes(kit.assinatura)) ? '#fff' : '#94a3b8' }}
              >
                Inserir Assinatura
              </button>
              <button className="downloadBtn" type="button" onClick={handleCopy} style={{ minHeight: 44, fontSize: 15 }}>
                {copied ? '✓ Copiado!' : '📋 Copiar legenda'}
              </button>
              {isMobile && (
                <button className="downloadBtn" type="button" onClick={() => shareLegendaWhatsApp('Reels', legenda)} style={{ minHeight: 44, fontSize: 15 }}>
                  📲 Compartilhar no WhatsApp
                </button>
              )}
            </div>
          )}



          {preview && <div className="previewWrapper"><img src={preview} alt="Reels" className="previewImgReels" /></div>}
          <div className="cardActions">
            <button className="generateBtn" type="button" onClick={handleGenerate} disabled={busy || busyRefs || busyVideo}>
              {busy ? 'Gerando...' : preview ? '↻ Gerar novamente (sem refs)' : '⬇ Gerar imagem pura'}
            </button>
            {preview && (
              <RefsRegenButton
                storageKey={`uso-ref:reels:${dayNumber}`}
                busy={busyRefs || busyVideo}
                onRun={handleGenerateWithRefs}
                imageKit={imageKit}
                formato="reels"
                segmento={segmento}
                modelo={modelo}
              />
            )}
            {preview && (() => {
              const isCine = track === 'cinematica';
              const baseTipo = isCine ? `s3c_${String(dayNumber).padStart(2,'0')}` : `rel${String(dayNumber).padStart(2,'0')}`;
              return (
                <button className="downloadBtn" type="button" onClick={() => downloadDataUrl(preview, mopName({ company: kit.companyName, tipo: `${baseTipo}_cp`, ext: 'jpg' }))}>
                  Baixar
                </button>
              );
            })()}
          </div>
          {preview && (
            <div className="cardActions" style={{ marginTop: 8, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              {/* Seletor dos modos de renderização de vídeo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(
                  [
                    {
                      mode: 'portugues' as VideoMode,
                      icon: '🎙️',
                      label: 'Voz nativa',
                      desc: '',
                      disabled: false,
                      title: 'Gera vídeo com voz automática em português.',
                    },
                    {
                      mode: 'kit-voz' as VideoMode,
                      icon: '🎤',
                      label: 'Kit de Voz',
                      desc: hasClonedVoice ? '' : 'Configure no Kit',
                      disabled: !hasClonedVoice,
                      title: hasClonedVoice
                        ? 'Gera vídeo com sua voz clonada.'
                        : 'Treine e aprove sua voz no Kit Imagem primeiro.',
                    },
                  ] as Array<{ mode: VideoMode; icon: string; label: string; desc: string; disabled: boolean; title: string }>
                ).map(({ mode, icon, label, desc, disabled, title }) => {
                  const active = videoMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      title={title}
                      disabled={disabled || busyVideo}
                      onClick={() => setVideoMode(mode)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        gap: 2, padding: '8px 6px', borderRadius: 10, fontSize: 12,
                        fontWeight: active ? 700 : 500, cursor: disabled ? 'not-allowed' : 'pointer',
                        background: active ? '#123a63' : '#f8fafc',
                        color: active ? '#fff' : disabled ? '#94a3b8' : '#0f172a',
                        border: `1.5px solid ${active ? '#123a63' : '#e2e8f0'}`,
                        transition: 'all .15s',
                      }}
                    >
                      <span style={{ fontSize: 18 }}>{icon}</span>
                      <span>{label}</span>
                      {desc && <span style={{ fontSize: 10, opacity: 0.75 }}>{desc}</span>}
                    </button>
                  );
                })}
              </div>


              <button className="generateBtn" type="button" onClick={handleGenerateVideo} disabled={busyVideo || busy}>
                {busyVideo
                  ? (videoStepLabel || 'Gerando vídeo...')
                  : videoUrl
                  ? '↻ Gerar vídeo novamente'
                  : videoMode === 'kit-voz'
                  ? '🎤 Gerar vídeo com minha voz'
                  : '🎙️ Gerar vídeo'}
              </button>

              {busyVideo && videoMode === 'kit-voz' && (
                <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    width: `${videoProgressPct}%`, height: '100%', background: '#123a63',
                    transition: 'width 1s linear',
                  }} />
                </div>
              )}
            </div>
          )}
          {videoUrl && (() => {
            const isCine = track === 'cinematica';
            const baseTipo = isCine ? `s3c_${String(dayNumber).padStart(2,'0')}` : `rel${String(dayNumber).padStart(2,'0')}`;
            const videoFile = mopName({ company: kit.companyName, tipo: `${baseTipo}_vt`, ext: 'mp4' });
            const coverFile = mopName({ company: kit.companyName, tipo: `${baseTipo}_cp`, ext: 'png' });
            return (
              <div ref={videoRef} className="previewWrapper" style={{ marginTop: 12 }}>
                <video src={videoUrl} controls autoPlay style={{ width: '100%', borderRadius: 12 }} />
                {/* Badges de modo e resultado real do backend. */}
                {usedClonedVoice === true && (
                  <div style={{
                    marginTop: 8, padding: '6px 10px', borderRadius: 6,
                    background: '#ecfdf5', border: '1px solid #6ee7b7',
                    color: '#065f46', fontSize: 12, fontWeight: 600,
                  }}>🎤 Voz clonada aplicada</div>
                )}
                {usedClonedVoice === false && requestedClonedVoice && (
                  <div style={{
                    marginTop: 8, padding: '6px 10px', borderRadius: 6,
                    background: '#fffbeb', border: '1px solid #fcd34d',
                    color: '#78350f', fontSize: 12, fontWeight: 600,
                  }}>⚠ Vídeo gerado sem voz clonada (falha na sincronização — áudio do Veo no lugar)</div>
                )}
                {videoMode === 'sinalizacao' && (
                  <div style={{
                    marginTop: 8, padding: '6px 10px', borderRadius: 6,
                    background: '#f0f9ff', border: '1px solid #7dd3fc',
                    color: '#0c4a6e', fontSize: 12, fontWeight: 600,
                  }}>📝 Sinalização visual aplicada</div>
                )}
                <button
                  type="button"
                  className="downloadBtn"
                  style={{ display: 'block', marginTop: 8, textAlign: 'center', width: '100%' }}
                  onClick={async () => {
                    try {
                      const resp = await fetch(videoUrl);
                      const blob = await resp.blob();
                      const blobUrl = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = blobUrl;
                      a.download = videoFile;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
                    } catch (e) {
                      alert(`Não foi possível baixar o vídeo: ${(e as Error).message}`);
                    }
                  }}
                >
                  ⬇ Baixar vídeo
                </button>
                {coverPng && (
                  <div style={{ marginTop: 12, padding: 12, background: '#f0f9ff', border: '1px solid #7dd3fc', borderRadius: 8 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: '#0c4a6e', fontWeight: 600 }}>📸 Capa do Reels (use no Instagram)</p>
                    <p style={{ margin: '0 0 10px', fontSize: 12, color: '#0c4a6e' }}>No Instagram, ao postar o reels, toque em "Capa" → "Adicionar da galeria" e selecione esta imagem.</p>
                    <img src={coverPng} alt="Capa" style={{ width: 'min(80%, 320px)', borderRadius: 8, display: 'block', margin: '0 auto 8px' }} />
                    <a href={coverPng} download={coverFile} className="downloadBtn" style={{ display: 'block', textAlign: 'center' }}>⬇ Baixar capa</a>
                  </div>
                )}
                {!coverPng && coverError && (
                  <div style={{ marginTop: 12, padding: 12, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: '#78350f', fontWeight: 600 }}>⚠ Capa do Reels não foi gerada</p>
                    <p style={{ margin: '0 0 10px', fontSize: 12, color: '#78350f' }}>Não conseguimos finalizar a capa automática agora. O vídeo está pronto normalmente — você pode gerar a capa novamente abaixo.</p>
                    <button
                      type="button"
                      className="downloadBtn"
                      onClick={retryCover}
                      disabled={retryingCover}
                      style={{ display: 'block', margin: '0 auto' }}
                    >
                      {retryingCover ? 'Gerando capa…' : '🔄 Gerar capa novamente'}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
          {/* Painel de capa/erro do vídeo quando NÃO há vídeo (vídeo falhou) — capa é preservada e usuário pode tentar só o vídeo. */}
          {!videoUrl && (coverPng || coverError || videoError) && (() => {
            const isCine = track === 'cinematica';
            const baseTipo = isCine ? `s3c_${String(dayNumber).padStart(2,'0')}` : `rel${String(dayNumber).padStart(2,'0')}`;
            const coverFile = mopName({ company: kit.companyName, tipo: `${baseTipo}_cp`, ext: 'png' });
            return (
              <div style={{ marginTop: 12 }}>
                {videoError && (
                  <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, marginBottom: 12 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: '#78350f', fontWeight: 600 }}>⚠ Vídeo não foi gerado</p>
                    <p style={{ margin: '0 0 10px', fontSize: 12, color: '#78350f' }}>
                      {coverPng
                        ? 'Não conseguimos gerar o vídeo desta vez. A capa foi gerada normalmente — você pode tentar o vídeo de novo sem refazer a capa.'
                        : 'Não conseguimos gerar o vídeo desta vez. Tente novamente.'}
                    </p>
                    <button
                      type="button"
                      className="downloadBtn"
                      onClick={retryVideoOnly}
                      disabled={retryingVideo}
                      style={{ display: 'block', margin: '0 auto' }}
                    >
                      {retryingVideo ? 'Gerando vídeo…' : '🔄 Tentar gerar vídeo novamente'}
                    </button>
                  </div>
                )}
                {coverPng && (
                  <div style={{ padding: 12, background: '#f0f9ff', border: '1px solid #7dd3fc', borderRadius: 8 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: '#0c4a6e', fontWeight: 600 }}>📸 Capa do Reels (use no Instagram)</p>
                    <p style={{ margin: '0 0 10px', fontSize: 12, color: '#0c4a6e' }}>No Instagram, ao postar o reels, toque em "Capa" → "Adicionar da galeria" e selecione esta imagem.</p>
                    <img src={coverPng} alt="Capa" style={{ width: 'min(80%, 320px)', borderRadius: 8, display: 'block', margin: '0 auto 8px' }} />
                    <a href={coverPng} download={coverFile} className="downloadBtn" style={{ display: 'block', textAlign: 'center' }}>⬇ Baixar capa</a>
                  </div>
                )}
                {!coverPng && coverError && (
                  <div style={{ padding: 12, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8 }}>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: '#78350f', fontWeight: 600 }}>⚠ Capa do Reels não foi gerada</p>
                    <p style={{ margin: '0 0 10px', fontSize: 12, color: '#78350f' }}>Não conseguimos finalizar a capa automática agora.</p>
                    <button
                      type="button"
                      className="downloadBtn"
                      onClick={retryCover}
                      disabled={retryingCover}
                      style={{ display: 'block', margin: '0 auto' }}
                    >
                      {retryingCover ? 'Gerando capa…' : '🔄 Gerar capa novamente'}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
            <ArchiveButton
              tipo="S3V"
              formato="reels"
              dia={dayNumber}
              legenda={legenda}
              imageDataUrls={[coverPng || preview]}
              videoUrl={
                // Sinalizacao: blob URL expira; usa a URL FAL original para arquivamento.
                falVideoUrlRef.current || videoUrl
              }
              titulo={hook}
              disabledReason="Gere o vídeo (e a capa) antes de arquivar"
            />
          </div>
        </div>
      )}
    </article>
  );
}

function StoriesBlock({ seq }: { seq: StoriesSequence }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="contentCard">
      <button className="cardHeader" type="button" onClick={() => setOpen(o => !o)}>
        <div className="cardHeaderLeft">
          <span className="cardTag">Stories · Dia {seq.dia}</span>
          <strong className="cardTitle">{seq.sequencia}</strong>
        </div>
        <span className="cardChevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="cardBody">
          {seq.stories.map(story => (
            <div key={story.ordem} className="storyItem">
              <span className="storyTag">{story.ordem}. {story.tipo === 'vídeo' ? '🎬 Vídeo' : '📝 Post'}</span>
              <p>{story.texto}</p>
            </div>
          ))}
          <div className="cardActions">
            <small style={{ color: '#64748b' }}>Stories V1 — apenas conteúdo textual.</small>
          </div>
        </div>
      )}
    </article>
  );
}

const MOOD_NAMES: Record<string, string> = {
  'OP-01': 'Clareza', 'OP-02': 'Impacto', 'OP-03': 'Instante',
  'OP-04': 'Fragmento', 'OP-05': 'Desvio', 'OP-06': 'Silêncio',
};

export default function ResultsView({ result, kit, mood, onClear, onRetry, imageKit, sequenceSize, onImageGenerated, userId }: Props) {
  const [savingPdf, setSavingPdf] = useState(false);
  const [anchorGenderFlipped, setAnchorGenderFlipped] = useState(false);
  const [anchorAgeOverride, setAnchorAgeOverride] = useState<string | undefined>(undefined);
  const [anchorBannerOpen, setAnchorBannerOpen] = useState(false);
  const [anchorMode, setAnchorMode] = useState<'ancora' | 'livre'>('ancora');
  const { guard, dialog } = useImageGenAlert();
  const { cotaPersonalizados, isAdmin, refresh: refreshProfile } = useProfile();

  // Força um refresh ao montar — evita defasagem entre o que o admin acabou
  // de configurar (extras) e o que o app vê em cache.
  useEffect(() => { refreshProfile(); }, [refreshProfile]);

  const trackRaw = (result as any)?.track as ('cinematica' | 'visual' | 'experimentacao' | undefined);

  const allFeedAll = result?.feed || [];
  const inferredSize: 3 | 6 | 9 | undefined = sequenceSize ?? (
    allFeedAll.length >= 7 ? 9 : allFeedAll.length >= 4 ? 6 : allFeedAll.length >= 1 ? 3 : undefined
  );
  const hasFinal = allFeedAll.some((f) => f.formato === 'Estático Final');
  const hasReels = !!result?.reels;
  const trackResolved: 'cinematica' | 'visual' | 'experimentacao' | undefined =
    (hasFinal && !hasReels && trackRaw !== 'experimentacao') ? 'visual' : trackRaw;
  const modelo: ModeloOP | null = inferredSize ? resolveModelo(trackResolved, inferredSize) : null;

  // Extras de carrossel agregados — usado apenas como "flag de liberação" para
  // SERVIÇOS/MARCA exibirem produtos no carrossel. Não há débito por uso.
  const INF = 9999;
  const cotaPorTipo: CotaPorTipo = isAdmin
    ? { estatico: INF, carrossel: INF, estatico_final: INF, reels: INF }
    : (cotaPersonalizados || ZERO_COTA);
  const extrasCarrossel = cotaPorTipo.carrossel || 0;

  // ancora_visual gerada pela IA junto com a sequência. Mostra sempre que existir —
  // a supressão por avatar acontece POR CARD em regenerateWithKit (hasAvatarRef),
  // não aqui: ter avatar no kit ≠ avatar sendo usado nesta geração específica.
  const ancoragem: AnchoraVisual | undefined = (result as any)?.ancora_visual;
  const anchorAgeEffective = anchorAgeOverride ?? ancoragem?.faixa_etaria ?? '';
  // No modo 'livre' o gerador de imagem não recebe constraint de tipo —
  // gênero é balanceado livremente por peça (M/F alternados).
  const anchorGenderEffective: PersonagemGender | undefined = (ancoragem && anchorMode === 'ancora')
    ? (anchorGenderFlipped
        ? (ancoragem.genero === 'F' ? 'homem' : 'mulher')
        : (ancoragem.genero === 'F' ? 'mulher' : 'homem'))
    : undefined;
  const anchoraPersonagem: string | undefined = (ancoragem && anchorMode === 'ancora')
    ? [anchorAgeEffective].filter(Boolean).join(', ') || undefined
    : undefined;
  const ancoragePapel: string | undefined = ancoragem?.papel;
  const anchorControl: AnchorControl | undefined = ancoragem
    ? {
        ancoragem,
        genderEffective: anchorGenderEffective ?? (ancoragem.genero === 'F' ? 'mulher' : 'homem'),
        ageEffective: anchorAgeEffective,
        onFlipGender: () => setAnchorGenderFlipped(f => !f),
        onChangeAge: (age) => setAnchorAgeOverride(age),
      }
    : undefined;

  // Gênero do personagem por bloco (estático + carrossel + fechamento) — ver
  // computeBlockGenders. Memoizado em `result`: persiste entre re-renders e
  // entre "gerar de novo" de cada peça, e só recalcula quando um novo plano é
  // gerado (result muda de referência).
  const blockGenders = useMemo(() => {
    const feed = result?.feed || [];
    const estaticosM = feed.filter(f => f.formato !== 'Estático Final');
    const estaticosFinaisM = feed.filter(f => f.formato === 'Estático Final');
    const carouselsM: CarouselCard[][] = [];
    if (result?.carousel?.length) {
      for (let i = 0; i < result.carousel.length; i += 5) {
        carouselsM.push(result.carousel.slice(i, i + 5));
      }
    }
    const maxBlocksM = Math.max(estaticosM.length, carouselsM.length, estaticosFinaisM.length);
    const blocks: { estatico: PersonagemGender; carrossel: PersonagemGender[]; final: PersonagemGender }[] = [];
    for (let i = 0; i < maxBlocksM; i++) {
      const pieces: { titulo: string; texto: string }[] = [];
      if (estaticosM[i]) pieces.push({ titulo: estaticosM[i].titulo, texto: estaticosM[i].texto });
      (carouselsM[i] || []).forEach(c => pieces.push({ titulo: c.titulo, texto: c.texto }));
      if (estaticosFinaisM[i]) pieces.push({ titulo: estaticosFinaisM[i].titulo, texto: estaticosFinaisM[i].texto });
      const genders = computeBlockGenders(pieces, anchorGenderEffective);
      let p = 0;
      const estatico: PersonagemGender = estaticosM[i] ? genders[p++] : 'homem';
      const carrossel: PersonagemGender[] = (carouselsM[i] || []).map(() => genders[p++]);
      const final: PersonagemGender = estaticosFinaisM[i] ? genders[p++] : 'homem';
      blocks.push({ estatico, carrossel, final });
    }
    return blocks;
  }, [result, anchorGenderEffective]);

  if (!result) return null;


  const keyInfo = String((result as any).keyInfo || (result.raw as any)?.keyInfo || '');

  async function handlePdf() {
    setSavingPdf(true);
    try {
      const filename = mopName({ company: kit.companyName, tipo: 'plano', ext: 'pdf' });
      const bytes = generateSequencePdf(result!, kit, mood);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
      await fetch('/api/supabase-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: kit.companyName, pdfBase64: base64, filename }),
      });
      // Auto-arquivamento foi substituído por botão "Arquivar" em cada box.
      // O PDF continua disponível como download manual aqui.
    } catch (e) {
      console.error('Erro ao salvar PDF:', e);
    } finally {
      setSavingPdf(false);
    }
  }

  type DayItem =
    | { type: 'feed'; day: number; block: number; item: FeedItem }
    | { type: 'final'; day: number; block: number; item: FeedItem }
    | { type: 'carousel'; day: number; block: number; cards: CarouselCard[] }
    | { type: 'reels'; day: number; block: number; reels: ReelsGuide };

  const allFeed = result.feed || [];
  const estaticos = allFeed.filter(f => f.formato !== 'Estático Final');
  const estaticosFinais = allFeed.filter(f => f.formato === 'Estático Final');

  const sequence: DayItem[] = [];
  let day = 1;
  const reelsList: ReelsGuide[] = result.reels || [];
  const carousels: CarouselCard[][] = [];

  if (result.carousel?.length) {
    for (let i = 0; i < result.carousel.length; i += 5) {
      carousels.push(result.carousel.slice(i, i + 5));
    }
  }

  const maxBlocks = Math.max(estaticos.length, carousels.length, reelsList.length, estaticosFinais.length);
  for (let i = 0; i < maxBlocks; i++) {
    if (estaticos[i]) sequence.push({ type: 'feed', day: day++, block: i, item: estaticos[i] });
    if (carousels[i]) sequence.push({ type: 'carousel', day: day++, block: i, cards: carousels[i] });
    if (reelsList[i]) sequence.push({ type: 'reels', day: day++, block: i, reels: reelsList[i] });
    if (estaticosFinais[i]) sequence.push({ type: 'final', day: day++, block: i, item: estaticosFinais[i] });
  }

  return (
    <section className="panel resultPanel">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Saída</span>
          <h2>Resultado do Método OP</h2>
          <span style={{ display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 600, letterSpacing: 0.4, color: '#92400e', background: 'rgba(244,176,0,.12)', border: '1px solid rgba(244,176,0,.35)', borderRadius: 6, padding: '2px 8px' }}>
            {MOOD_NAMES[mood] ?? mood} · {mood}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onClear && (
            <button className="clearBtn" type="button" onClick={onClear}>Limpar conteúdo</button>
          )}
          <button className="pdfBtn" type="button" onClick={handlePdf} disabled={savingPdf}>
            {savingPdf ? 'Salvando...' : '📄 Baixar PDF'}
          </button>
        </div>
      </div>

      {anchorControl && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setAnchorBannerOpen(o => !o)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: '#f8fafc', border: 'none', cursor: 'pointer', fontSize: 12, color: '#475569' }}
          >
            <span>
              Personagem da sequência:&nbsp;
              {anchorMode === 'ancora'
                ? <strong style={{ color: '#0f172a' }}>{anchorControl.genderEffective === 'mulher' ? 'F' : 'M'} · {anchorControl.ageEffective.replace(' anos', '').replace(' ano', '')}</strong>
                : <strong style={{ color: '#64748b' }}>Livre</strong>
              }
            </span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{anchorBannerOpen ? '▲' : '▼'}</span>
          </button>
          {anchorBannerOpen && (
            <div style={{ padding: '8px 14px', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setAnchorMode(m => m === 'ancora' ? 'livre' : 'ancora')}
                style={{ fontSize: 12, padding: '4px 12px', border: '1px solid #e2e8f0', background: anchorMode === 'livre' ? '#f1f5f9' : '#0f172a', color: anchorMode === 'livre' ? '#475569' : '#fff', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
              >
                {anchorMode === 'ancora' ? 'Mudar p/ Livre' : 'Mudar p/ Âncora'}
              </button>
              {anchorMode === 'ancora' && (
                <>
                  <button
                    type="button"
                    onClick={anchorControl.onFlipGender}
                    style={{ fontSize: 12, padding: '4px 12px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Trocar p/ {anchorControl.genderEffective === 'mulher' ? 'Masculino' : 'Feminino'}
                  </button>
                  <select
                    value={anchorControl.ageEffective}
                    onChange={e => anchorControl.onChangeAge(e.target.value)}
                    style={{ fontSize: 12, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', color: '#475569', cursor: 'pointer' }}
                  >
                    {!AGE_OPTIONS.includes(anchorControl.ageEffective) && (
                      <option value={anchorControl.ageEffective}>{anchorControl.ageEffective}</option>
                    )}
                    {AGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {sequence.length > 0 && (
        <div className="resultBlock">
          <h3>Sequência do feed</h3>
          {estaticos.length > 0 && carousels.length === 0 && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 12px', margin: '8px 0 12px', fontSize: 13, color: '#92400e', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ flex: 1 }}>⚠️ A geração veio sem o carrossel desta sequência. Isso geralmente acontece quando a IA trunca a resposta. Clique em <b>"Tentar novamente"</b> para receber a sequência completa.</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  style={{ whiteSpace: 'nowrap', background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
                >
                  ↻ Tentar novamente
                </button>
              )}
            </div>
          )}
          {sequence.map((item) => {
            const bg = blockGenders[item.block];
            if (item.type === 'feed') {
              return <FeedCard key={`feed-${item.day}`} item={item.item} kit={kit} mood={mood} dayNumber={item.day} keyInfo={keyInfo} guard={guard} segmento={kit.segment} modelo={modelo} imageKit={imageKit} extrasCarrossel={extrasCarrossel} onImageGenerated={onImageGenerated} userId={userId} forcedGender={bg?.estatico ?? 'homem'} anchoraPersonagem={anchoraPersonagem} ancoragePapel={ancoragePapel} />;
            }
            if (item.type === 'final') {
              return <FinalCard key={`final-${item.day}`} item={item.item} kit={kit} mood={mood} dayNumber={item.day} keyInfo={keyInfo} guard={guard} segmento={kit.segment} modelo={modelo} imageKit={imageKit} extrasCarrossel={extrasCarrossel} onImageGenerated={onImageGenerated} userId={userId} forcedGender={bg?.final ?? 'homem'} anchoraPersonagem={anchoraPersonagem} ancoragePapel={ancoragePapel} />;
            }
            if (item.type === 'carousel') {
              return <CarouselCardBlock key={`car-${item.day}`} cards={item.cards} kit={kit} mood={mood} dayNumber={item.day} keyInfo={keyInfo} guard={guard} segmento={kit.segment} modelo={modelo} imageKit={imageKit} extrasCarrossel={extrasCarrossel} onImageGenerated={onImageGenerated} userId={userId} forcedGenders={bg?.carrossel ?? item.cards.map(() => 'homem' as PersonagemGender)} anchoraPersonagem={anchoraPersonagem} ancoragePapel={ancoragePapel} />;
            }
            if (item.type === 'reels') {
              return <ReelsCard key={`reels-${item.day}`} reels={item.reels} kit={kit} mood={mood} dayNumber={item.day} track={(result as any).track} keyInfo={keyInfo} guard={guard} segmento={kit.segment} modelo={modelo} imageKit={imageKit} extrasCarrossel={extrasCarrossel} onImageGenerated={onImageGenerated} userId={userId} anchoraPersonagem={anchoraPersonagem} ancoragePapel={ancoragePapel} />;
            }
            return null;
          })}
        </div>
      )}


      {(result.stories?.length ?? 0) > 0 && (
        <div className="resultBlock">
          <h3>Stories</h3>
          {result.stories!.map(seq => <StoriesBlock key={seq.dia} seq={seq} />)}
        </div>
      )}

      {onClear && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(0,0,0,.06)' }}>
          <button
            type="button"
            onClick={onClear}
            title="Limpar geração"
            aria-label="Limpar geração"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#f8fafc', color: '#0f172a',
              border: '1px solid #cbd5e1', borderRadius: 12,
              padding: '10px 18px', fontWeight: 700, fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <Trash2 size={16} />
            Limpar geração
          </button>
        </div>
      )}

      {dialog}
    </section>
  );
}
