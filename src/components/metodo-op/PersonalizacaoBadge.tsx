// Badge de personalização recomendada pelo Método OP (Modo Personalizado).
// Aparece apenas em peças onde a tabela em src/core/personalizacaoMop.ts
// indica que aquele slot deve receber Kit Imagem.

import { useEffect, useMemo, useState } from 'react';
import type { BrandKit, ImageKit, MoodCode } from '../../types';
import {
  decomporElemento,
  kitTemElemento,
  nomeElemento,
  type ElementoAtomico,
  type ElementoPersonalizacao,
  type SlotPersonalizacao,
} from '../../core/personalizacaoMop';
import { produtosDisponiveis, cenariosDisponiveis } from '../../utils/imageKitStorage';
import { regenerateWithKit } from '../../services/regenerateWithKit';

interface Props {
  slot: SlotPersonalizacao;
  kit: BrandKit;
  imageKit: ImageKit;
  mood: MoodCode;
  keyInfo: string;
  // Conteúdo atual da peça — forwarded para regenerateWithKit pra que a
  // imagem-base saia já com o mesmo título/texto/cena do fluxo normal.
  titulo?: string;
  texto?: string;
  imagePrompt?: string;
  leituraCenica?: {
    intencao?: string;
    personagem?: string;
    ambiente?: string;
    expressao?: string;
    clima?: string;
    composicao?: string;
  };
  // chamado quando o regen termina com sucesso — passa a dataURL final
  onApplied: (dataUrl: string, productNum?: number) => void;
  // serve só pra label do botão: já aplicou alguma vez?
  applied?: boolean;
  // Override explícito de formato. Quando ausente, infere a partir do slot
  // (slot.formato === 'reels' → 'reels', caso contrário 'post').
  formato?: 'post' | 'reels';
  // Permite ao pai disparar o mesmo "Aplicar Kit" a partir de outro botão
  // (ex.: barra de ações embaixo do preview).
  onRegisterApply?: (fn: () => Promise<void>) => void;
  // Quantas aplicações ainda restam (cota do tipo - usadas). Quando 0,
  // bloqueia o botão. Quando undefined, comportamento legado (sempre liberado).
  cotaRestante?: number;
}

// Mapeia átomos para sub-elementos legais.
function atomoParaElemento(a: ElementoAtomico): ElementoPersonalizacao {
  return a; // 'avatar' | 'cenario' | 'produto' são valores válidos do union.
}

export default function PersonalizacaoBadge({
  slot, kit, imageKit, mood, keyInfo,
  titulo, texto, imagePrompt, leituraCenica,
  onApplied, applied, formato, onRegisterApply, cotaRestante,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productNum, setProductNum] = useState<number | null>(null);
  const [cenarioNum, setCenarioNum] = useState<number | null>(null);

  // Átomos disponíveis NESTE slot = interseção (átomos do elemento expandido) ∩ (átomos do Kit).
  const atomosSlot = useMemo(() => decomporElemento(slot.elemento), [slot.elemento]);
  const atomosDisponiveis = useMemo<ElementoAtomico[]>(() => {
    const out: ElementoAtomico[] = [];
    if (atomosSlot.includes('avatar') && imageKit.avatar) out.push('avatar');
    if (atomosSlot.includes('cenario') && imageKit.cenarios.some((c) => !!c)) out.push('cenario');
    if (atomosSlot.includes('produto') && imageKit.produtos.some((p) => !!p)) out.push('produto');
    return out;
  }, [atomosSlot, imageKit]);

  const [elementoEscolhido, setElementoEscolhido] = useState<ElementoAtomico | null>(null);
  const atomoAtivo: ElementoAtomico | null = elementoEscolhido ?? atomosDisponiveis[0] ?? null;
  const elementoEfetivo: ElementoPersonalizacao = atomoAtivo
    ? atomoParaElemento(atomoAtivo)
    : slot.elemento;

  const temElemento = atomosDisponiveis.length > 0 && kitTemElemento(elementoEfetivo, imageKit);
  const precisaProduto = atomoAtivo === 'produto';
  const precisaCenario = atomoAtivo === 'cenario';
  const produtosOk = useMemo(() => produtosDisponiveis(imageKit), [imageKit]);
  const cenariosOk = useMemo(() => cenariosDisponiveis(imageKit), [imageKit]);

  const effectiveProductNum = productNum ?? produtosOk[0] ?? null;
  const effectiveCenarioNum = cenarioNum ?? cenariosOk[0] ?? null;
  const semCota = typeof cotaRestante === 'number' && cotaRestante <= 0;

  async function handleApply() {
    if (busy || !temElemento || semCota) return;
    setBusy(true); setError(null);
    try {
      const slotEfetivo: SlotPersonalizacao = { ...slot, elemento: elementoEfetivo };
      const url = await regenerateWithKit({
        slot: slotEfetivo,
        kit,
        imageKit,
        mood,
        keyInfo,
        titulo,
        texto,
        imagePrompt,
        leituraCenica,
        formato,
        produtosSelecionados: precisaProduto && effectiveProductNum
          ? [effectiveProductNum]
          : undefined,
        cenarioSelecionado: precisaCenario ? effectiveCenarioNum : undefined,
      });
      onApplied(url, precisaProduto && effectiveProductNum ? effectiveProductNum : undefined);
    } catch (e) {
      setError((e as Error).message || 'Falha ao gerar com Kit Imagem.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    onRegisterApply?.(handleApply);
    // handleApply é redefinida a cada render — re-registramos sempre que
    // qualquer dependência do regen muda (cenário/produto selecionado etc.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  const labelEl = nomeElemento(elementoEfetivo);

  return (
    <div
      style={{
        background: temElemento ? '#ecfeff' : '#fef9c3',
        border: `1px solid ${temElemento ? '#67e8f9' : '#fde047'}`,
        borderRadius: 10,
        padding: '8px 10px',
        marginBottom: 10,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        color: temElemento ? '#0e7490' : '#854d0e',
      }}
    >
      <span style={{ fontWeight: 700 }}>★ Personalização recomendada:</span>
      <span title={slot.motivo}>
        usar <b>{labelEl}</b> do seu Kit Imagem
      </span>

      {/* Seletor de elemento quando há mais de uma opção disponível */}
      {atomosDisponiveis.length > 1 && (
        <div style={{ display: 'flex', gap: 4 }}>
          {atomosDisponiveis.map((a) => {
            const active = atomoAtivo === a;
            return (
              <button
                key={a}
                type="button"
                onClick={() => setElementoEscolhido(a)}
                style={{
                  background: active ? '#0891b2' : '#fff',
                  color: active ? '#fff' : '#0e7490',
                  border: `1px solid ${active ? '#0891b2' : '#67e8f9'}`,
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {nomeElemento(a)}
              </button>
            );
          })}
        </div>
      )}

      {precisaCenario && cenariosOk.length > 1 && (
        <ThumbPicker
          name={`cen-${slot.formato}-${slot.posicao}`}
          options={cenariosOk.map((n) => ({ num: n, url: imageKit.cenarios[n - 1] || undefined, label: `C${n}` }))}
          selected={effectiveCenarioNum}
          onChange={setCenarioNum}
        />
      )}

      {precisaProduto && produtosOk.length > 1 && (
        <ThumbPicker
          name={`prod-${slot.formato}-${slot.posicao}`}
          options={produtosOk.map((n) => ({ num: n, url: imageKit.produtos[n - 1] || undefined, label: `P${n}` }))}
          selected={effectiveProductNum}
          onChange={setProductNum}
        />
      )}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
        {typeof cotaRestante === 'number' && (
          <span style={{ fontSize: 11, opacity: 0.85 }}>
            {cotaRestante > 0 ? `${cotaRestante} restantes` : 'cota esgotada'}
          </span>
        )}
        {temElemento ? (
          <button
            type="button"
            onClick={handleApply}
            disabled={busy || semCota}
            style={{
              background: semCota ? '#94a3b8' : '#0891b2', color: '#fff', border: 'none',
              borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700,
              cursor: busy || semCota ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Gerando…' : applied ? '↻ Reaplicar Kit' : '✨ Aplicar Kit'}
          </button>
        ) : (
          <span style={{ fontSize: 11, fontStyle: 'italic' }}>
            seu Kit Imagem ainda não tem {labelEl} — complete o Kit para ativar
          </span>
        )}
      </div>

      {error && (
        <p style={{ width: '100%', margin: '4px 0 0', color: '#b91c1c', fontSize: 11 }}>
          {error}
        </p>
      )}
    </div>
  );
}

interface ThumbPickerProps {
  name: string;
  options: { num: number; url?: string; label: string }[];
  selected: number | null;
  onChange: (num: number) => void;
}

function ThumbPicker({ name, options, selected, onChange }: ThumbPickerProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {options.map((o) => {
        const active = selected === o.num;
        return (
          <label
            key={o.num}
            title={o.label}
            style={{
              position: 'relative',
              width: 30,
              height: 30,
              borderRadius: 6,
              border: `2px solid ${active ? '#0891b2' : '#cbd5e1'}`,
              overflow: 'hidden',
              cursor: 'pointer',
              background: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <input
              type="radio"
              name={name}
              checked={active}
              onChange={() => onChange(o.num)}
              style={{ position: 'absolute', opacity: 0, inset: 0, cursor: 'pointer' }}
            />
            {o.url ? (
              <img src={o.url} alt={o.label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 10, fontWeight: 700, color: '#475569' }}>{o.label}</span>
            )}
            <span
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                background: active ? '#0891b2' : 'rgba(15,23,42,.75)',
                color: '#fff',
                fontSize: 8,
                fontWeight: 700,
                padding: '0 3px',
                borderTopLeftRadius: 4,
                lineHeight: '11px',
              }}
            >
              {o.num}
            </span>
          </label>
        );
      })}
    </div>
  );
}
