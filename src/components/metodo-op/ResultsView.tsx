import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { BrandKit, CarouselCard, FeedItem, ImageKit, MethodOpResult, MoodCode, ReelsGuide, StoriesSequence } from '../../types';
import { downloadDataUrl, downloadBlob, composeFeedPng, composeFinalPng, composeReelsPng, composeReelsTitlePng } from '../../utils/canvasComposer';
import { burnTitleIntoVideo } from '../../utils/burnTitleIntoVideo';
import { generatePostImage } from '../../services/api';
import { generateSequencePdf } from '../../utils/generatePdf';
import { mopName } from '../../utils/file';
import { regenerateBlock, type RegenKind } from '../../services/regenerateBlock';
import {
  resolveModelo,
  ZERO_COTA,
  type CotaPorTipo,
  type ModeloOP,
} from '../../core/personalizacaoMop';
import { emptyImageKit } from '../../utils/imageKitStorage';
import UsoReferenciasDia, { useRefSelection } from './UsoReferenciasDia';
import { regenerateWithKit } from '../../services/regenerateWithKit';
import { useProfile } from '../../hooks/useProfile';

import { useImageGenAlert } from './PreImageAlert';
import { useIsMobile } from '../../hooks/use-mobile';
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
  imageKit?: ImageKit;
  sequenceSize?: 3 | 6 | 9;
}

const REGEN_MAX = 1;

// Props comuns para o seletor de Imagens de Referência nos cards.
interface RefSelectorProps {
  segmento: BrandKit['segment'];
  modelo: ModeloOP | null;
  imageKit?: ImageKit;
  extrasCarrossel: number;
}

// Botão "Gerar outra com refs" — só aparece se há seleção marcada.
// Aceita storageKey principal e opcionalmente uma fallbackKey (ex.: o storage
// consolidado do bloco do carrossel) usada quando o storage principal está vazio.
function RefsRegenButton({ storageKey, fallbackKey, busy, onRun }: { storageKey: string; fallbackKey?: string; busy: boolean; onRun: () => void }) {
  const sel = useRefSelection(storageKey);
  const selFb = useRefSelection(fallbackKey || storageKey);
  const has = sel.hasAny || selFb.hasAny;
  if (!has) return null;
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
  ctxBuilder: () => Parameters<typeof regenerateBlock>[0];
  multiline?: boolean;
}) {
  const { label, value, original, count, onChange, onRegenStart, onRegenDone, ctxBuilder, multiline, kind } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const exhausted = count >= REGEN_MAX;
  const changed = value !== original;

  async function handleRegen() {
    if (exhausted || busy) return;
    setBusy(true); setError(null);
    onRegenStart();
    try {
      const next = await regenerateBlock(ctxBuilder());
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
            title={exhausted ? 'Limite de 1 regeneração atingido' : `Gerar outra ${kind} com IA`}
            style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 600, color: '#0f172a', cursor: busy || exhausted ? 'not-allowed' : 'pointer', opacity: busy || exhausted ? 0.5 : 1 }}
          >
            {busy ? 'Gerando…' : exhausted ? `✨ 1/1` : `✨ Gerar outro (${count}/${REGEN_MAX})`}
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
      {error && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#b91c1c' }}>{error}</p>}
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

function FeedCard({ item, kit, mood, dayNumber, keyInfo, guard, segmento, modelo, imageKit, extrasCarrossel }: { item: FeedItem; kit: BrandKit; mood: MoodCode; dayNumber: number; keyInfo: string; guard: ReturnType<typeof useImageGenAlert>['guard'] } & RefSelectorProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const storageKey = `uso-ref:estatico:${item.dia}`;
  const sel = useRefSelection(storageKey);

  const [titulo, setTitulo] = useState(item.titulo);
  const [texto, setTexto] = useState(item.texto);
  const [legenda, setLegenda] = useState(item.legenda);
  const [tCount, setTCount] = useState(0);
  const [xCount, setXCount] = useState(0);
  const [lCount, setLCount] = useState(0);

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
        mood, vertical: 'post', logoPosition: kit.logoPosition,
        leituraCenica: (item as any).leituraCenica,
      });
      const final = await composeFeedPng(kit, { ...item, titulo, texto, legenda }, url);
      setPreview(final);
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  function handleGenerate() { guard({ hasPreview: !!preview, tipo: 'Estático', run: runGenerate }); }

  async function runGenerateWithRefs() {
    if (!sel.hasAny) return;
    setBusy(true);
    try {
      const url = await regenerateWithKit({
        slot: { formato: 'estatico', posicao: dayNumber, elemento: 'avatar', motivo: '' },
        kit, imageKit: imageKit ?? emptyImageKit, mood,
        keyInfo: `${item.titulo || ''}. ${item.imagem || ''}`.slice(0, 500),
        titulo, texto, imagePrompt: item.imagem, leituraCenica: (item as any).leituraCenica,
        formato: 'post',
        selecaoDireta: { usarAvatar: sel.usarAvatar, cenarioNum: sel.cenarioNum, produtosNums: sel.produtosNums },
      });
      const final = await composeFeedPng(kit, { ...item, titulo, texto, legenda }, url);
      setPreview(final);
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }



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
                setPreview(final);
              } catch {
                setPreview(url);
              }
            }}
          />
          <EditableField label="Título" kind="titulo" value={titulo} original={item.titulo} count={tCount} onChange={setTitulo} onRegenStart={() => setTCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('titulo')} />
          <EditableField label="Texto" kind="texto" value={texto} original={item.texto} count={xCount} onChange={setTexto} onRegenStart={() => setXCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('texto')} multiline />
          <EditableField label="Legenda" kind="legenda" value={legenda} original={item.legenda} count={lCount} onChange={setLegenda} onRegenStart={() => setLCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('legenda')} multiline />
          {legenda.trim() && isMobile && (
            <button className="downloadBtn" type="button" style={{ width: '100%', minHeight: 44, fontSize: 15, marginTop: 4 }} onClick={() => shareLegendaWhatsApp('Estático', legenda)}>
              📲 Compartilhar legenda no WhatsApp
            </button>
          )}
          {preview && <div className="previewWrapper"><img src={preview} alt="Preview" className="previewImg" /></div>}
          <div className="cardActions">
            <button className="generateBtn" type="button" onClick={handleGenerate} disabled={busy}>
              {busy ? 'Gerando...' : preview ? '↻ Gerar outra (sem refs)' : '⬇ Gerar post'}
            </button>
            {preview && sel.hasAny && (
              <button className="generateBtn" type="button" onClick={runGenerateWithRefs} disabled={busy} title="Gerar outra usando as referências marcadas acima">
                {busy ? 'Gerando...' : '↻ Gerar outra com refs'}
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

function FinalCard({ item, kit, mood, dayNumber, keyInfo, guard, segmento, modelo, imageKit, extrasCarrossel }: { item: FeedItem; kit: BrandKit; mood: MoodCode; dayNumber: number; keyInfo: string; guard: ReturnType<typeof useImageGenAlert>['guard'] } & RefSelectorProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const storageKey = `uso-ref:estatico_final:${item.dia}`;
  const sel = useRefSelection(storageKey);

  const [titulo, setTitulo] = useState(item.titulo);
  const [texto, setTexto] = useState(item.texto);
  const [legenda, setLegenda] = useState(item.legenda);
  const [tCount, setTCount] = useState(0);
  const [xCount, setXCount] = useState(0);
  const [lCount, setLCount] = useState(0);

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
        mood, vertical: 'estatico_final', logoPosition: kit.logoPosition,
        leituraCenica: (item as any).leituraCenica,
      });
      const final = await composeFinalPng(kit, { ...item, titulo, texto, legenda }, url);
      setPreview(final);
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }
  function handleGenerate() { guard({ hasPreview: !!preview, tipo: 'Estático Final', run: runGenerate }); }

  async function runGenerateWithRefs() {
    if (!sel.hasAny) return;
    setBusy(true);
    try {
      const url = await regenerateWithKit({
        slot: { formato: 'estatico_final', posicao: dayNumber, elemento: 'avatar', motivo: '' },
        kit, imageKit: imageKit ?? emptyImageKit, mood,
        keyInfo: `${item.titulo || ''}. ${item.imagem || ''}`.slice(0, 500),
        titulo, texto, imagePrompt: item.imagem, leituraCenica: (item as any).leituraCenica,
        formato: 'post',
        selecaoDireta: { usarAvatar: sel.usarAvatar, cenarioNum: sel.cenarioNum, produtosNums: sel.produtosNums },
      });
      const final = await composeFinalPng(kit, { ...item, titulo, texto, legenda }, url);
      setPreview(final);
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }


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
                setPreview(final);
              } catch {
                setPreview(url);
              }
            }}
          />
          <EditableField label="Título" kind="titulo" value={titulo} original={item.titulo} count={tCount} onChange={setTitulo} onRegenStart={() => setTCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('titulo')} />
          <EditableField label="Texto" kind="texto" value={texto} original={item.texto} count={xCount} onChange={setTexto} onRegenStart={() => setXCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('texto')} multiline />
          <EditableField label="Legenda" kind="legenda" value={legenda} original={item.legenda} count={lCount} onChange={setLegenda} onRegenStart={() => setLCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('legenda')} multiline />
          {legenda.trim() && isMobile && (
            <button className="downloadBtn" type="button" style={{ width: '100%', minHeight: 44, fontSize: 15, marginTop: 4 }} onClick={() => shareLegendaWhatsApp('Estático Final', legenda)}>
              📲 Compartilhar legenda no WhatsApp
            </button>
          )}
          {preview && <div className="previewWrapper"><img src={preview} alt="Preview" className="previewImg" /></div>}
          <div className="cardActions">
            <button className="generateBtn" type="button" onClick={handleGenerate} disabled={busy}>
              {busy ? 'Gerando...' : preview ? '↻ Gerar outra (sem refs)' : '⬇ Gerar fechamento'}
            </button>
            {preview && sel.hasAny && (
              <button className="generateBtn" type="button" onClick={runGenerateWithRefs} disabled={busy} title="Gerar outra usando as referências marcadas acima">
                {busy ? 'Gerando...' : '↻ Gerar outra com refs'}
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


function CarouselCardBlock({ cards, kit, mood, dayNumber, keyInfo, guard, segmento, modelo, imageKit, extrasCarrossel }: { cards: CarouselCard[]; kit: BrandKit; mood: MoodCode; dayNumber: number; keyInfo: string; guard: ReturnType<typeof useImageGenAlert>['guard'] } & RefSelectorProps) {
  const [open, setOpen] = useState(false);
  const [previews, setPreviews] = useState<(string | null)[]>(cards.map(() => null));
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [busyAllMode, setBusyAllMode] = useState<'refs' | 'noref' | null>(null);
  const busyAll = busyAllMode !== null;
  const [allProgress, setAllProgress] = useState<{ done: number; total: number } | null>(null);
  const isMobile = useIsMobile();
  const blockStorageKey = `uso-ref:carrossel:${dayNumber}:bloco`;
  const blockSel = useRefSelection(blockStorageKey);

  // Estado por card: titulo/texto/legenda editáveis + contadores
  const [titulos, setTitulos] = useState(cards.map(c => c.titulo));
  const [textos, setTextos] = useState(cards.map(c => c.texto));
  const [legendas, setLegendas] = useState(cards.map(c => c.legenda || ''));
  const [tCounts, setTCounts] = useState(cards.map(() => 0));
  const [xCounts, setXCounts] = useState(cards.map(() => 0));
  const [lCounts, setLCounts] = useState(cards.map(() => 0));

  async function runGenerate(index: number) {
    setBusyIndex(index);
    try {
      const card = cards[index];
      const url = await generatePostImage({
        imagePrompt: card.imagePrompt,
        titulo: titulos[index], texto: textos[index],
        companyName: kit.companyName,
        primaryColor: kit.primaryColor,
        accentColor: kit.accentColor || '#f4b000',
        fontFamily: kit.fontPair || 'Montserrat',
        mood, vertical: 'post', logoPosition: kit.logoPosition,
        leituraCenica: (card as any).leituraCenica,
      });
      const item: FeedItem = { dia: dayNumber, formato: 'Carrossel', titulo: titulos[index], texto: textos[index], legenda: '', imagem: card.imagePrompt };
      const final = await composeFeedPng(kit, item, url);
      setPreviews(prev => prev.map((p, i) => i === index ? final : p));
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusyIndex(null); }
  }

  function handleGenerate(index: number) {
    guard({ hasPreview: !!previews[index], tipo: 'Carrossel', run: () => runGenerate(index) });
  }

  // Lê seleção efetiva para um card: prefere storage do bloco (consolidado)
  // mapeando card[i] → produto[i]; fallback para storage individual por card.
  function selecaoParaCard(index: number): { usarAvatar: boolean; cenarioNum: number | null; produtosNums: number[] } | null {
    const card = cards[index];
    // 1) Bloco consolidado
    try {
      const raw = localStorage.getItem(blockStorageKey);
      if (raw) {
        const j = JSON.parse(raw);
        if (j.enabled) {
          const produtos: number[] = Array.isArray(j.produtosNums) ? j.produtosNums.filter((n: unknown) => typeof n === 'number') : [];
          const pick = produtos[index] ?? produtos[0] ?? null;
          return {
            usarAvatar: !!j.usarAvatar,
            cenarioNum: typeof j.cenarioNum === 'number' ? j.cenarioNum : null,
            produtosNums: pick ? [pick] : [],
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
      return {
        usarAvatar: !!j.usarAvatar,
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
      });
      const item: FeedItem = { dia: dayNumber, formato: 'Carrossel', titulo: titulos[index], texto: textos[index], legenda: '', imagem: card.imagePrompt };
      const final = await composeFeedPng(kit, item, url);
      setPreviews(prev => prev.map((p, i) => i === index ? final : p));
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusyIndex(null); }
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
    setAllProgress({ done: 0, total });
    try {
      for (let i = 0; i < total; i++) {
        setAllProgress({ done: i, total });
        setBusyIndex(i);
        const card = cards[i];
        try {
          const url = await generatePostImage({
            imagePrompt: card.imagePrompt,
            titulo: titulos[i], texto: textos[i],
            companyName: kit.companyName,
            primaryColor: kit.primaryColor,
            accentColor: kit.accentColor || '#f4b000',
            fontFamily: kit.fontPair || 'Montserrat',
            mood, vertical: 'post', logoPosition: kit.logoPosition,
            leituraCenica: (card as any).leituraCenica,
          });
          const item: FeedItem = { dia: dayNumber, formato: 'Carrossel', titulo: titulos[i], texto: textos[i], legenda: '', imagem: card.imagePrompt };
          const final = await composeFeedPng(kit, item, url);
          setPreviews(prev => prev.map((p, j) => j === i ? final : p));
        } catch (err) {
          console.error(`Falha card ${i + 1}:`, err);
          failures.push(i + 1);
        }
      }
      setAllProgress({ done: total, total });
      if (failures.length) {
        alert(`${failures.length} de ${total} card(s) falharam (cards ${failures.join(', ')}). Use "⬇ Gerar card" no card para tentar de novo.`);
      }
    } finally {
      setBusyIndex(null);
      setBusyAllMode(null);
      setTimeout(() => setAllProgress(null), 1500);
    }
  }

  // Gera os N cards em sequência usando refs consolidadas do bloco.
  async function runGenerateAllWithRefs() {
    if (!blockSel.hasAny) return;
    setBusyAllMode('refs');
    const total = cards.length;
    const failures: number[] = [];
    setAllProgress({ done: 0, total });
    try {
      for (let i = 0; i < total; i++) {
        setAllProgress({ done: i, total });
        setBusyIndex(i);
        const s = selecaoParaCard(i);
        if (!s) continue;
        const card = cards[i];
        try {
          const url = await regenerateWithKit({
            slot: { formato: 'carrossel', posicao: dayNumber, elemento: 'avatar', cardCarrossel: card.card, motivo: '' },
            kit, imageKit: imageKit ?? emptyImageKit, mood,
            keyInfo: `${card.titulo || ''}. ${card.imagePrompt || ''}`.slice(0, 500),
            titulo: titulos[i], texto: textos[i],
            imagePrompt: card.imagePrompt,
            leituraCenica: (card as any).leituraCenica,
            formato: 'post',
            selecaoDireta: s,
          });
          const item: FeedItem = { dia: dayNumber, formato: 'Carrossel', titulo: titulos[i], texto: textos[i], legenda: '', imagem: card.imagePrompt };
          const final = await composeFeedPng(kit, item, url);
          setPreviews(prev => prev.map((p, j) => j === i ? final : p));
        } catch (err) {
          console.error(`Falha card ${i + 1}:`, err);
          failures.push(i + 1);
        }
      }
      setAllProgress({ done: total, total });
      if (failures.length) {
        alert(`Geração com referências: ${failures.length} de ${total} card(s) falharam (cards ${failures.join(', ')}). Use o botão "↻ Gerar outra com refs" no card para tentar de novo.`);
      }
    } finally {
      setBusyIndex(null);
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
          />
          {/* Botão: Gerar todos sem refs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 6px', flexWrap: 'wrap' }}>
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

          {blockSel.hasAny && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 10px', flexWrap: 'wrap' }}>
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
              <span style={{ fontSize: 11, color: '#475569' }}>
                Cada card recebe o produto na ordem marcada (card 1 → produto 1, …).
              </span>
            </div>
          )}
          {cards.map((card, index) => {
            const ctx = (kind: RegenKind) => ({
              kind, companyName: kit.companyName, mainActivity: kit.mainActivity, keyInfo,
              formato: `Carrossel — Card ${card.card}`, tituloAtual: titulos[index], textoAtual: textos[index], legendaAtual: legendas[index],
            });
            return (
              <div key={card.card} className="carouselCardBlock">
                <span className="cardTag">Card {card.card}</span>
                <EditableField label="Título do card" kind="titulo" value={titulos[index]} original={card.titulo} count={tCounts[index]} onChange={(v) => setTitulos(prev => prev.map((p,i) => i === index ? v : p))} onRegenStart={() => setTCounts(prev => prev.map((c,i) => i === index ? c + 1 : c))} onRegenDone={() => {}} ctxBuilder={() => ctx('titulo')} />
                <EditableField label="Texto do card" kind="texto" value={textos[index]} original={card.texto} count={xCounts[index]} onChange={(v) => setTextos(prev => prev.map((p,i) => i === index ? v : p))} onRegenStart={() => setXCounts(prev => prev.map((c,i) => i === index ? c + 1 : c))} onRegenDone={() => {}} ctxBuilder={() => ctx('texto')} multiline />
                {index === cards.length - 1 && (
                  <>
                    <EditableField label="Legenda do card" kind="legenda" value={legendas[index]} original={card.legenda || ''} count={lCounts[index]} onChange={(v) => setLegendas(prev => prev.map((p,i) => i === index ? v : p))} onRegenStart={() => setLCounts(prev => prev.map((c,i) => i === index ? c + 1 : c))} onRegenDone={() => {}} ctxBuilder={() => ctx('legenda')} multiline />
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
                    {busyIndex === index && !busyAll ? 'Gerando...' : previews[index] ? '↻ Gerar outra (sem refs)' : '⬇ Gerar card'}
                  </button>
                  {previews[index] && (
                    <RefsRegenButton
                      storageKey={`uso-ref:carrossel:${dayNumber}:c${card.card}`}
                      fallbackKey={blockStorageKey}
                      busy={busyIndex === index || busyAll}
                      onRun={() => runGenerateWithRefs(index)}
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


// Modos de renderização de vídeo:
// 'portugues'   → Veo3 gera vídeo com áudio TTS em pt-BR nativo
// 'kit-voz'     → Veo3 gera vídeo silencioso + TTS voz clonada + lipsync
// 'sinalizacao' → Veo3 gera vídeo silencioso + título queimado no canvas via FFmpeg
type VideoMode = 'portugues' | 'kit-voz' | 'sinalizacao';

function ReelsCard({ reels, kit, mood, dayNumber, track, keyInfo, guard, segmento, modelo, imageKit, extrasCarrossel }: { reels: ReelsGuide; kit: BrandKit; mood: MoodCode; dayNumber: number; track?: string; keyInfo: string; guard: ReturnType<typeof useImageGenAlert>['guard'] } & RefSelectorProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  // previewBase = mesma imagem do preview SEM a logo aplicada pelo canvas.
  // É o que mandamos para o gpt-image-2/edit como referência da capa, para
  // que o modelo aplique apenas o lettering do título e não tente redesenhar
  // a logomarca (a logo final é reaplicada por canvas em cima da capa).
  const [previewBase, setPreviewBase] = useState<string | null>(null);
  const [busyVideo, setBusyVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  // Resultado real do backend de vídeo (lipsync efetivamente concluído ou não).
  const [usedClonedVoice, setUsedClonedVoice] = useState<boolean | null>(null);
  const [requestedClonedVoice, setRequestedClonedVoice] = useState<boolean>(false);
  const [coverPng, setCoverPng] = useState<string | null>(null);
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

  // Limpa blob URL ao desmontar (evita vazamento de memória).
  useEffect(() => {
    return () => {
      if (burnedBlobUrlRef.current) {
        URL.revokeObjectURL(burnedBlobUrlRef.current);
      }
    };
  }, []);

  // Garante que o modo kit-voz só fica ativo quando há voz treinada.
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
    if (videoMode === 'kit-voz') {
      if (videoElapsed < 90) return 'Etapa 1/3: Gerando o vídeo (Veo)…';
      if (videoElapsed < 130) return 'Etapa 2/3: Sintetizando sua voz…';
      return 'Etapa 3/3: Sincronizando a boca com o áudio…';
    }
    if (videoMode === 'sinalizacao') {
      return videoElapsed > 60 ? 'Etapa 2/2: Aplicando sinalização visual…' : 'Etapa 1/2: Gerando vídeo (Veo)…';
    }
    return 'Gerando vídeo…';
  })();
  const videoProgressPct = (() => {
    if (!busyVideo) return 0;
    if (videoMode === 'kit-voz') {
      return Math.min(95, Math.round((videoElapsed / 180) * 95));
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
  const [hook, setHook] = useState(reels.hook);
  const [script, setScript] = useState(reels.script);
  const [legenda, setLegenda] = useState((reels.legenda || reels.script || '').trim());
  const [hCount, setHCount] = useState(0);
  const [sCount, setSCount] = useState(0);
  const [lCount, setLCount] = useState(0);

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
      const url = await generatePostImage({
        imagePrompt: reels.imagePrompt,
        titulo: '', texto: '',
        companyName: kit.companyName,
        primaryColor: kit.primaryColor,
        accentColor: kit.accentColor || '#f4b000',
        fontFamily: kit.fontPair || 'Montserrat',
        mood, vertical: 'reels',
        logoDataUrl: kit.logoDataUrl,
        logoPosition: kit.logoPosition,
      });
      setPreview(url);
      // Sem refs: o frame do reels já vem com a logo embutida pela IA, então
      // o frame "sem logo" não existe separado — usamos o mesmo como base.
      setPreviewBase(url);
      setVideoUrl(null);
      setCoverPng(null);
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }
  function handleGenerate() { guard({ hasPreview: !!preview, tipo: 'Reels', run: runGenerate }); }

  async function runGenerateWithRefs() {
    const storageKey = `uso-ref:reels:${dayNumber}`;
    let s: { usarAvatar: boolean; cenarioNum: number | null; produtosNums: number[] };
    try {
      const raw = localStorage.getItem(storageKey);
      const j = raw ? JSON.parse(raw) : {};
      s = {
        usarAvatar: !!j.usarAvatar,
        cenarioNum: typeof j.cenarioNum === 'number' ? j.cenarioNum : null,
        produtosNums: Array.isArray(j.produtosNums) ? j.produtosNums : [],
      };
    } catch { return; }
    setBusy(true);
    try {
      const url = await regenerateWithKit({
        slot: { formato: 'reels', posicao: dayNumber, elemento: 'avatar', motivo: '' },
        kit, imageKit: imageKit ?? emptyImageKit, mood,
        keyInfo: `${reels.imagePrompt || ''}`.slice(0, 500),
        imagePrompt: reels.imagePrompt,
        leituraCenica: (reels as any).leituraCenica,
        formato: 'reels',
        selecaoDireta: s,
      });
      const final = await composeReelsPng(kit, url);
      setPreview(final);
      // url = imagem do reels antes do canvas aplicar a logo → base ideal para o /edit da capa.
      setPreviewBase(url);
      setVideoUrl(null);
      setCoverPng(null);
    } catch (e) { alert(`Erro: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }


  async function submitVideoRequest(): Promise<{ videoUrl: string; usedClonedVoice: boolean; requestedClonedVoice: boolean }> {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    const res = await fetch('/api/generate-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        imageBase64: preview,
        script,
        videoMode,
        // Backward compat para versões anteriores do backend.
        useClonedVoice: videoMode === 'kit-voz',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao gerar vídeo');
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
        setCoverPng(coverRes.value);
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
      const url = await generatePostImage({
        imagePrompt: reels.imagePrompt,
        titulo: titleText,
        texto: '',
        companyName: kit.companyName,
        primaryColor: kit.primaryColor,
        accentColor: kit.accentColor || '#f4b000',
        fontFamily: kit.fontPair || 'Montserrat',
        mood,
        vertical: 'reels_cover',
        logoDataUrl: kit.logoDataUrl,
        logoPosition: kit.logoPosition,
        // Ref = frame sem logo quando disponível; fallback = preview com logo.
        // Logo é reaplicada por canvas após o /edit retornar.
        referenceImages: (previewBase || preview) ? [(previewBase || preview) as string] : undefined,
      });
      const withLogo = kit.logoDataUrl ? await composeReelsPng(kit, url) : url;
      setCoverPng(withLogo);
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
                setPreview(withLogo);
                // url = frame SEM logo → base ideal para o /edit da capa.
                setPreviewBase(url);
              } catch {
                setPreview(url);
                setPreviewBase(url);
              }
              setVideoUrl(null);
              setCoverPng(null);
            }}
          />

          <EditableField label="Hook / Título do reels" kind="titulo" value={hook} original={reels.hook} count={hCount} onChange={setHook} onRegenStart={() => setHCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('titulo')} />
          <EditableField label="Roteiro falado (TTS ou voz clonada)" kind="texto" value={script} original={reels.script} count={sCount} onChange={setScript} onRegenStart={() => setSCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('texto')} multiline />
          <EditableField label="Legenda" kind="legenda" value={legenda} original={(reels.legenda || reels.script || '').trim()} count={lCount} onChange={setLegenda} onRegenStart={() => setLCount(c => c + 1)} onRegenDone={() => {}} ctxBuilder={() => ctx('legenda')} multiline />

          {legenda && (
            <div className="cardActions" style={{ marginBottom: 4 }}>
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
            <button className="generateBtn" type="button" onClick={handleGenerate} disabled={busy || busyVideo}>
              {busy ? 'Gerando...' : preview ? '↻ Gerar novamente (sem refs)' : '⬇ Gerar imagem pura'}
            </button>
            {preview && (
              <RefsRegenButton
                storageKey={`uso-ref:reels:${dayNumber}`}
                busy={busy || busyVideo}
                onRun={runGenerateWithRefs}
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
              {/* Seletor dos 2 modos de renderização de vídeo */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {(
                  [
                    {
                      mode: 'portugues' as VideoMode,
                      icon: '🎙️',
                      label: 'Voz aplicativo',
                      desc: 'Áudio automático',
                      disabled: false,
                      title: 'Gera vídeo com voz do aplicativo em português.',
                    },
                    {
                      mode: 'kit-voz' as VideoMode,
                      icon: '🎤',
                      label: 'Kit de Voz',
                      desc: hasClonedVoice ? 'Voz clonada' : 'Configure no Kit',
                      disabled: !hasClonedVoice,
                      title: hasClonedVoice
                        ? 'Gera vídeo com sua voz clonada + sincronia labial (~3 min).'
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
                      <span style={{ fontSize: 10, opacity: 0.75 }}>{desc}</span>
                    </button>
                  );
                })}
              </div>

              {/* Dica por modo */}
              {!busyVideo && videoMode === 'kit-voz' && hasClonedVoice && (
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  ⏱️ Com voz clonada: ~3 min (vídeo + voz + sincronia da boca).
                </div>
              )}

              <button className="generateBtn" type="button" onClick={handleGenerateVideo} disabled={busyVideo || busy}>
                {busyVideo
                  ? (videoStepLabel || 'Gerando vídeo...')
                  : videoUrl
                  ? '↻ Gerar vídeo novamente'
                  : videoMode === 'kit-voz'
                  ? '🎤 Gerar vídeo com minha voz'
                  : '🎙️ Gerar vídeo (voz aplicativo)'}
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

export default function ResultsView({ result, kit, mood, onClear, imageKit, sequenceSize }: Props) {
  const [savingPdf, setSavingPdf] = useState(false);
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
    | { type: 'feed'; day: number; item: FeedItem }
    | { type: 'final'; day: number; item: FeedItem }
    | { type: 'carousel'; day: number; cards: CarouselCard[] }
    | { type: 'reels'; day: number; reels: ReelsGuide };

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
    if (estaticos[i]) sequence.push({ type: 'feed', day: day++, item: estaticos[i] });
    if (carousels[i]) sequence.push({ type: 'carousel', day: day++, cards: carousels[i] });
    if (reelsList[i]) sequence.push({ type: 'reels', day: day++, reels: reelsList[i] });
    if (estaticosFinais[i]) sequence.push({ type: 'final', day: day++, item: estaticosFinais[i] });
  }

  return (
    <section className="panel resultPanel">
      <div className="sectionHeader">
        <div>
          <span className="eyebrow">Saída</span>
          <h2>Resultado do Método OP</h2>
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

      {sequence.length > 0 && (
        <div className="resultBlock">
          <h3>Sequência do feed</h3>
          {estaticos.length > 0 && estaticosFinais.length > 0 && carousels.length === 0 && (
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 12px', margin: '8px 0 12px', fontSize: 13, color: '#92400e' }}>
              ⚠️ A geração veio sem o carrossel desta sequência. Isso geralmente acontece quando a IA trunca a resposta. Clique em <b>"Limpar conteúdo"</b> e gere novamente para receber a peça completa.
            </div>
          )}
          {sequence.map((item) => {
            if (item.type === 'feed') {
              return <FeedCard key={`feed-${item.day}`} item={item.item} kit={kit} mood={mood} dayNumber={item.day} keyInfo={keyInfo} guard={guard} segmento={kit.segment} modelo={modelo} imageKit={imageKit} extrasCarrossel={extrasCarrossel} />;
            }
            if (item.type === 'final') {
              return <FinalCard key={`final-${item.day}`} item={item.item} kit={kit} mood={mood} dayNumber={item.day} keyInfo={keyInfo} guard={guard} segmento={kit.segment} modelo={modelo} imageKit={imageKit} extrasCarrossel={extrasCarrossel} />;
            }
            if (item.type === 'carousel') {
              return <CarouselCardBlock key={`car-${item.day}`} cards={item.cards} kit={kit} mood={mood} dayNumber={item.day} keyInfo={keyInfo} guard={guard} segmento={kit.segment} modelo={modelo} imageKit={imageKit} extrasCarrossel={extrasCarrossel} />;
            }
            if (item.type === 'reels') {
              return <ReelsCard key={`reels-${item.day}`} reels={item.reels} kit={kit} mood={mood} dayNumber={item.day} track={(result as any).track} keyInfo={keyInfo} guard={guard} segmento={kit.segment} modelo={modelo} imageKit={imageKit} extrasCarrossel={extrasCarrossel} />;
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
