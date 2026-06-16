// Seletor de Imagens de Referência (IMG_RF) por peça/dia.
//
// Substitui o antigo PersonalizacaoBadge. Toggle default OFF; quando o
// usuário liga, vê as miniaturas do Kit Imagem PERMITIDAS para o
// (segmento, formato, modelo OP) atual e a frase "Você pode escolher: ...".
// Marca as imagens, clica "Gerar com referências" → chama regenerateWithKit.
//
// Custo: GRÁTIS dentro do plano. O extra só entra para liberar uma
// combinação que o plano não cobre (SERVIÇO/MARCA + produtos no carrossel).

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { BrandKit, ImageKit, MoodCode } from '../../types';
import { regenerateWithKit } from '../../services/regenerateWithKit';
import { cenarioLabel } from '../../utils/imageKitStorage';
import type { ModeloOP, SlotFormato, SlotPersonalizacao } from '../../core/personalizacaoMop';
import {
  descrevePolicy,
  policyComExtras,
  policyPorFormato,
  type RefPolicy,
} from '../../core/referenciasPolicy';

interface Props {
  segmento: BrandKit['segment'];
  modelo: ModeloOP | null;
  formato: SlotFormato;
  // Posição da peça (1-based). Usado só para o slot sintético.
  posicao: number;
  // Card do carrossel (1..5), quando aplicável.
  cardCarrossel?: number;
  // Extras de carrossel já agregados (P1+P2+B). > 0 libera produtos para
  // SERVIÇO/MARCA no carrossel.
  extrasCarrossel: number;
  kit: BrandKit;
  imageKit: ImageKit;
  mood: MoodCode;
  // Conteúdo atual da peça (forwarded ao motor para queimar o lettering).
  titulo?: string;
  texto?: string;
  imagePrompt?: string;
  leituraCenica?: {
    intencao?: string; personagem?: string; ambiente?: string;
    expressao?: string; clima?: string; composicao?: string;
  };
  // Override explícito do alvo da geração (post|reels). Quando ausente,
  // infere por formato (reels → reels, demais → post).
  formatoOverride?: 'post' | 'reels';
  // Disparado após a geração com sucesso — recebe a dataURL final.
  // Quando o uso debitou extra carrossel-produto, `cobrouCarrosselProduto` = true.
  onGerou: (dataUrl: string, info: { cobrouCarrosselProduto: boolean; produtoNum?: number }) => void;
  // Persistência do estado UI por peça (localStorage key).
  storageKey: string;
  // Modo compacto: esconde o botão "Gerar com referências" interno.
  // Usado quando o disparo vem de um botão externo (ex.: "Gerar 5 cards com refs"
  // no carrossel). Os checkboxes continuam editáveis e persistidos.
  compact?: boolean;
  // Ação customizada renderizada DENTRO da caixa, no lugar do botão interno
  // "Gerar com referências" — usado quando o disparo precisa de uma lógica
  // própria (ex.: "Gerar N cards com refs" do carrossel, que itera os cards
  // em sequência em vez de gerar uma única imagem via handleGerar).
  footerAction?: React.ReactNode;
}

export default function UsoReferenciasDia(props: Props) {
  const {
    segmento, modelo, formato, posicao, cardCarrossel,
    extrasCarrossel, kit, imageKit, mood,
    titulo, texto, imagePrompt, leituraCenica, formatoOverride,
    onGerou, storageKey, compact, footerAction,
  } = props;

  // Policy efetiva (com extras de carrossel quando se aplica)
  const policyBase = useMemo(
    () => policyPorFormato(segmento, formato, modelo),
    [segmento, formato, modelo],
  );
  const policy: RefPolicy = useMemo(
    () => policyComExtras(policyBase, { segmento, formato, modelo, extrasCarrossel }),
    [policyBase, segmento, formato, modelo, extrasCarrossel],
  );
  // (extra de carrossel já está embutido na `policy.produtos` via policyComExtras)


  // Disponibilidade real no Kit
  const cenariosDisp = useMemo(
    () => imageKit.cenarios.map((c, i) => (c ? i + 1 : null)).filter((n): n is number => n !== null),
    [imageKit.cenarios],
  );
  const produtosDisp = useMemo(
    () => imageKit.produtos.map((p, i) => (p ? i + 1 : null)).filter((n): n is number => n !== null),
    [imageKit.produtos],
  );
  const temAlguma =
    (policy.avatar && (!!imageKit.avatar || !!imageKit.avatar2)) ||
    (policy.cenarios > 0 && cenariosDisp.length > 0) ||
    (policy.produtos > 0 && produtosDisp.length > 0);

  // Estado UI persistido
  const [enabled, setEnabled] = useState<boolean>(false);
  // Qual avatar está marcado (1, 2 ou nenhum). Único — só 1 avatar por geração.
  const [avatarNum, setAvatarNum] = useState<number | null>(null);
  const [cenarioNum, setCenarioNum] = useState<number | null>(null);
  const [produtosNums, setProdutosNums] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate do localStorage
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.enabled === 'boolean') setEnabled(s.enabled);
        if (typeof s.avatarNum === 'number' || s.avatarNum === null) {
          setAvatarNum(s.avatarNum);
        } else if (typeof s.usarAvatar === 'boolean') {
          // Migração do formato antigo (boolean) → avatarNum (1|2|null).
          setAvatarNum(s.usarAvatar ? 1 : null);
        }
        if (typeof s.cenarioNum === 'number' || s.cenarioNum === null) setCenarioNum(s.cenarioNum);
        if (Array.isArray(s.produtosNums)) setProdutosNums(s.produtosNums);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(storageKey, JSON.stringify({ enabled, avatarNum, cenarioNum, produtosNums }));
      window.dispatchEvent(new CustomEvent('uso-ref:changed', { detail: { key: storageKey } }));
    } catch { /* ignore */ }
  }, [enabled, avatarNum, cenarioNum, produtosNums, storageKey]);

  function toggleProduto(n: number) {
    setProdutosNums((prev) => {
      if (prev.includes(n)) return prev.filter((x) => x !== n);
      if (prev.length >= policy.produtos) {
        // Substitui o mais antigo se já está no limite
        return [...prev.slice(1), n];
      }
      return [...prev, n];
    });
  }

  const totalSelecionado =
    (avatarNum != null ? 1 : 0) + (cenarioNum != null ? 1 : 0) + produtosNums.length;
  const podeGerar = !busy && enabled && totalSelecionado > 0;

  // Carrossel: 1 produto por card. Quando este componente está num card
  // específico, restringe `produtosNums` ao card.
  const produtosNumsParaUso = useMemo(() => {
    if (formato === 'carrossel' && cardCarrossel) {
      // Card N usa o N-ésimo produto selecionado (se houver), senão o 1º.
      const pick = produtosNums[cardCarrossel - 1] ?? produtosNums[0];
      return pick ? [pick] : [];
    }
    return produtosNums;
  }, [produtosNums, formato, cardCarrossel]);

  async function handleGerar() {
    if (!podeGerar) return;
    setBusy(true); setError(null);
    try {
      const slot: SlotPersonalizacao = {
        formato,
        posicao,
        elemento: 'avatar', // ignorado pois selecaoDireta tem precedência
        cardCarrossel,
        motivo: '',
      };
      const url = await regenerateWithKit({
        slot,
        kit,
        imageKit,
        mood,
        keyInfo: `${titulo || ''}. ${imagePrompt || ''}`.slice(0, 500),
        titulo, texto, imagePrompt, leituraCenica,
        formato: formatoOverride,
        selecaoDireta: {
          usarAvatar: avatarNum != null,
          avatarNum: avatarNum as 1 | 2 | null,
          cenarioNum: cenarioNum,
          produtosNums: produtosNumsParaUso,
        },
      });
      onGerou(url, {
        cobrouCarrosselProduto: false,
        produtoNum: produtosNumsParaUso[0],
      });
    } catch (e) {
      setError((e as Error).message || 'Falha ao gerar com referências.');
    } finally {
      setBusy(false);
    }
  }

  // Política não permite NENHUMA imagem para este formato/segmento → não mostra nada.
  const policyAllowsAny = policy.avatar || policy.cenarios > 0 || policy.produtos > 0;
  if (!policyAllowsAny) return null;

  // Política permite imagens mas o Kit está vazio → mostra orientação.
  if (!temAlguma) {
    const itemsFaltando: string[] = [];
    if (policy.avatar && !imageKit.avatar && !imageKit.avatar2) itemsFaltando.push('avatar');
    if (policy.cenarios > 0 && cenariosDisp.length === 0) itemsFaltando.push('cenário');
    if (policy.produtos > 0 && produtosDisp.length === 0) itemsFaltando.push('produtos');
    return (
      <div style={{
        background: '#fefce8', border: '1px solid #fde047', borderRadius: 10,
        padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#713f12',
      }}>
        📦 Esta peça aceita <strong>imagens de referência</strong> ({descrevePolicy(policy)}).
        Adicione {itemsFaltando.join(', ')} ao <strong>Kit Imagem</strong> para poder gerar com referências.
      </div>
    );
  }

  // Aviso amarelo se a política permite o tipo mas o Kit não tem a imagem.
  const faltaAvatar = policy.avatar && !imageKit.avatar && !imageKit.avatar2;
  const faltaCenario = policy.cenarios > 0 && cenariosDisp.length === 0;
  const faltaProduto = policy.produtos > 0 && produtosDisp.length === 0;
  const algumFaltando = faltaAvatar || faltaCenario || faltaProduto;

  const borderColor = enabled ? '#67e8f9' : '#e2e8f0';
  const bg = enabled ? '#ecfeff' : '#f8fafc';

  return (
    <div style={{
      background: bg,
      border: `1px solid ${borderColor}`,
      borderRadius: 10,
      padding: '8px 10px',
      marginBottom: 10,
      fontSize: 12,
      color: enabled ? '#0e7490' : '#334155',
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, userSelect: 'none' }}>
        <input
          type="checkbox"
          style={{ margin: 0, flexShrink: 0, cursor: 'pointer' }}
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Usar Imagens de Referência
      </label>

      {enabled && (
        <div style={{ marginTop: 8 }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, opacity: 0.85 }}>
            Você pode escolher: <b>{descrevePolicy(policy)}</b>.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))',
            gap: 6,
          }}>
            {policy.avatar && imageKit.avatar && (
              <Tile
                checked={avatarNum === 1}
                onToggle={() => setAvatarNum((cur) => (cur === 1 ? null : 1))}
                url={imageKit.avatar}
                label={imageKit.avatar2 ? 'Avatar 1' : 'Avatar'}
              />
            )}
            {policy.avatar && imageKit.avatar2 && (
              <Tile
                checked={avatarNum === 2}
                onToggle={() => setAvatarNum((cur) => (cur === 2 ? null : 2))}
                url={imageKit.avatar2}
                label="Avatar 2"
              />
            )}
            {policy.cenarios > 0 && cenariosDisp.map((n) => (
              <Tile
                key={`c${n}`}
                checked={cenarioNum === n}
                onToggle={() => setCenarioNum((cur) => (cur === n ? null : n))}
                url={imageKit.cenarios[n - 1] || undefined}
                label={cenarioLabel(imageKit, n)}
              />
            ))}
            {policy.produtos > 0 && produtosDisp.map((n) => {
              const ordem = produtosNums.indexOf(n);
              const isCarrossel = formato === 'carrossel';
              return (
                <Tile
                  key={`p${n}`}
                  checked={produtosNums.includes(n)}
                  onToggle={() => toggleProduto(n)}
                  url={imageKit.produtos[n - 1] || undefined}
                  label={`Produto ${n}`}
                  badge={isCarrossel && ordem >= 0 ? ordem + 1 : undefined}
                />
              );
            })}
          </div>

          {algumFaltando && (
            <div style={{
              marginTop: 8, background: '#fffbeb', border: '1px solid #fcd34d',
              color: '#92400e', borderRadius: 6, padding: '6px 8px', fontSize: 11,
            }}>
              ⚠️ {faltaAvatar && 'Adicione um avatar no Kit Imagem para usar. '}
              {faltaCenario && 'Adicione cenários no Kit Imagem para usar. '}
              {faltaProduto && 'Adicione produtos no Kit Imagem para usar.'}
            </div>
          )}

          {footerAction ? (
            <div style={{ marginTop: 8 }}>{footerAction}</div>
          ) : !compact && (
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleGerar}
                disabled={!podeGerar}
                style={{
                  background: podeGerar ? '#0891b2' : '#94a3b8',
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '6px 12px', fontSize: 12, fontWeight: 700,
                  cursor: podeGerar ? 'pointer' : 'not-allowed',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? 'Gerando…' : '✨ Gerar com referências'}
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p style={{ margin: '6px 0 0', color: '#b91c1c', fontSize: 11 }}>{error}</p>
      )}
    </div>
  );
}

function Tile({ checked, onToggle, url, label, badge }: {
  checked: boolean; onToggle: () => void; url?: string; label: string; badge?: number;
}) {
  return (
    <label
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: 4, borderRadius: 8, cursor: 'pointer',
        background: checked ? '#cffafe' : '#fff',
        border: `1px solid ${checked ? '#0891b2' : '#e2e8f0'}`,
        fontSize: 10,
      }}
    >
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '1 / 1',
        borderRadius: 6, overflow: 'hidden', background: '#fff',
        border: '1px solid #cbd5e1',
      }}>
        {url ? (
          <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 10, color: '#94a3b8',
          }}>—</span>
        )}
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          style={{ position: 'absolute', top: 4, left: 4, margin: 0, cursor: 'pointer' }}
        />
        {badge !== undefined && (
          <span style={{
            position: 'absolute', top: 4, right: 4,
            minWidth: 18, height: 18, padding: '0 5px',
            borderRadius: 9, background: '#0891b2', color: '#fff',
            fontSize: 11, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,.25)',
          }}>{badge}</span>
        )}
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', textAlign: 'center', lineHeight: 1.15 }}>{label}</span>
    </label>
  );
}

// Hook reaproveitável: lê o estado de seleção persistido por uma peça
// (mesma `storageKey` usada pelo <UsoReferenciasDia>) e re-renderiza
// quando muda (mesma aba via evento custom, outras abas via 'storage').
export interface RefSelectionState {
  enabled: boolean;
  // Qual avatar está marcado (1, 2 ou nenhum).
  avatarNum: number | null;
  cenarioNum: number | null;
  produtosNums: number[];
  hasAny: boolean;
}

const EMPTY_SEL: RefSelectionState = {
  enabled: false, avatarNum: null, cenarioNum: null, produtosNums: [], hasAny: false,
};

function readSel(storageKey: string): RefSelectionState {
  try {
    if (typeof window === 'undefined') return EMPTY_SEL;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return EMPTY_SEL;
    const s = JSON.parse(raw);
    const enabled = !!s.enabled;
    // Migração do formato antigo (usarAvatar boolean) → avatarNum (1|2|null).
    const avatarNum = (typeof s.avatarNum === 'number' || s.avatarNum === null)
      ? s.avatarNum
      : (s.usarAvatar ? 1 : null);
    const cenarioNum = (typeof s.cenarioNum === 'number') ? s.cenarioNum : null;
    const produtosNums = Array.isArray(s.produtosNums) ? s.produtosNums.filter((n: unknown) => typeof n === 'number') : [];
    const hasAny = enabled && (avatarNum != null || cenarioNum != null || produtosNums.length > 0);
    return { enabled, avatarNum, cenarioNum, produtosNums, hasAny };
  } catch {
    return EMPTY_SEL;
  }
}

// Cache simples por storageKey para o snapshot ser estável.
const selCache = new Map<string, RefSelectionState>();
function getSnapshot(storageKey: string): RefSelectionState {
  const fresh = readSel(storageKey);
  const cached = selCache.get(storageKey);
  if (cached
    && cached.enabled === fresh.enabled
    && cached.avatarNum === fresh.avatarNum
    && cached.cenarioNum === fresh.cenarioNum
    && cached.produtosNums.length === fresh.produtosNums.length
    && cached.produtosNums.every((n, i) => n === fresh.produtosNums[i])
  ) {
    return cached;
  }
  selCache.set(storageKey, fresh);
  return fresh;
}

export function useRefSelection(storageKey: string): RefSelectionState {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === 'undefined') return () => {};
      const onStorage = (e: StorageEvent) => { if (e.key === storageKey) cb(); };
      const onLocal = (e: Event) => {
        const ce = e as CustomEvent<{ key: string }>;
        if (ce.detail?.key === storageKey) cb();
      };
      window.addEventListener('storage', onStorage);
      window.addEventListener('uso-ref:changed', onLocal as EventListener);
      return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('uso-ref:changed', onLocal as EventListener);
      };
    },
    () => getSnapshot(storageKey),
    () => EMPTY_SEL,
  );
}
