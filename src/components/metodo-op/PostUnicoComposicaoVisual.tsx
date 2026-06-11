import { ImageKit, MoodCode, PostUnicoVisualSelection } from '../../types';
import { produtosDisponiveis, cenariosDisponiveis, cenarioLabel } from '../../utils/imageKitStorage';
import { policyPorFormato } from '../../core/referenciasPolicy';

// PU2/PU4/PU8 têm a mesma política em qualquer segmento/formato — usamos
// 'estatico'/'PU2' apenas como parâmetro neutro para ler o limite de produtos
// a partir da fonte única de verdade (referenciasPolicy.ts).
const MAX_PRODUTOS_PU = policyPorFormato('VAREJO', 'estatico', 'PU2').produtos;

interface Props {
  imageKit: ImageKit;
  selection: PostUnicoVisualSelection;
  onChange: (next: PostUnicoVisualSelection) => void;
  mood?: MoodCode;
}

export default function PostUnicoComposicaoVisual({ imageKit, selection, onChange, mood }: Props) {
  const hasAvatar1 = !!imageKit.avatar;
  const hasAvatar2 = !!imageKit.avatar2;
  const hasAvatar = hasAvatar1 || hasAvatar2;
  const cenarios = cenariosDisponiveis(imageKit);
  const hasCenario = cenarios.length > 0;
  const produtos = produtosDisponiveis(imageKit);
  const hasProdutos = produtos.length > 0;

  const effectiveCenario = selection.cenarioSelecionado ?? null;

  const refsAtivas =
    (selection.useAvatar ? 1 : 0) +
    (selection.useCenario && hasCenario && effectiveCenario ? 1 : 0) +
    (selection.useProdutos && hasProdutos ? selection.produtosSelecionados.length : 0);

  function pickAvatar(slot: 1 | 2) {
    if (selection.useAvatar && selection.avatarSelecionado === slot) {
      onChange({ ...selection, useAvatar: false });
    } else {
      onChange({ ...selection, useAvatar: true, avatarSelecionado: slot });
    }
  }
  function pickCenario(num: number) {
    const isCurrent = effectiveCenario === num && selection.useCenario;
    if (isCurrent) {
      onChange({ ...selection, useCenario: false, cenarioSelecionado: null });
    } else {
      onChange({ ...selection, useCenario: true, cenarioSelecionado: num });
    }
  }
  function toggleProduto(num: number) {
    const has = selection.produtosSelecionados.includes(num);
    let next: number[];
    if (has) {
      next = selection.produtosSelecionados.filter((n) => n !== num);
    } else if (selection.produtosSelecionados.length >= MAX_PRODUTOS_PU) {
      // Substitui o mais antigo se já está no limite
      next = [...selection.produtosSelecionados.slice(1), num];
    } else {
      next = [...selection.produtosSelecionados, num];
    }
    onChange({ ...selection, useProdutos: next.length > 0, produtosSelecionados: next });
  }

  return (
    <div className="formatBox">
      <strong>Composição visual da peça</strong>
      <p style={{ margin: '4px 0 6px', fontSize: 12, color: '#64748b' }}>
        Marque abaixo quais imagens do seu <strong>Kit Imagem</strong> devem aparecer/orientar esta peça.
        <strong> Se você não marcar nenhuma, a peça é gerada apenas a partir do texto, sem usar referências visuais do seu kit.</strong>
      </p>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: '#0e7490' }}>
        Você pode combinar: <b>1 avatar + 1 cenário + até {MAX_PRODUTOS_PU} produtos</b>.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))',
        gap: 6,
      }}>
        {hasAvatar1 && (
          <Tile
            checked={selection.useAvatar && selection.avatarSelecionado === 1}
            onToggle={() => pickAvatar(1)}
            url={imageKit.avatar || undefined}
            label="Avatar 1"
          />
        )}
        {hasAvatar2 && (
          <Tile
            checked={selection.useAvatar && selection.avatarSelecionado === 2}
            onToggle={() => pickAvatar(2)}
            url={imageKit.avatar2 || undefined}
            label="Avatar 2"
          />
        )}
        {cenarios.map((num) => (
          <Tile
            key={`c${num}`}
            checked={selection.useCenario && effectiveCenario === num}
            onToggle={() => pickCenario(num)}
            url={imageKit.cenarios[num - 1] || undefined}
            label={cenarioLabel(imageKit, num)}
          />
        ))}
        {produtos.map((num) => (
          <Tile
            key={`p${num}`}
            checked={selection.produtosSelecionados.includes(num)}
            onToggle={() => toggleProduto(num)}
            url={imageKit.produtos[num - 1] || undefined}
            label={`Produto ${num}`}
          />
        ))}
      </div>

      {(!hasAvatar || !hasCenario || !hasProdutos) && (
        <div style={{
          marginTop: 10, background: '#fffbeb', border: '1px solid #fcd34d',
          color: '#92400e', borderRadius: 6, padding: '6px 8px', fontSize: 11,
        }}>
          ⚠️ {!hasAvatar && 'Adicione um avatar no Kit Imagem para usar. '}
          {!hasCenario && 'Adicione cenários (até 3) no Kit Imagem para usar. '}
          {!hasProdutos && 'Adicione produtos no Kit Imagem para usar.'}
        </div>
      )}

      {mood === 'OP-06' && selection.useCenario && hasCenario && effectiveCenario && (
        <div style={{
          marginTop: 10, background: '#fffbeb', border: '1px solid #fcd34d',
          color: '#92400e', borderRadius: 6, padding: '6px 8px', fontSize: 11,
        }}>
          ⚠️ No mood <strong>Silêncio</strong>, a composição prioriza espaço vazio e um único elemento isolado — o cenário enviado pode não aparecer reconhecível no resultado. Se quiser preservar este ambiente, considere usar Avatar/Produto como referência ou escolher outro mood.
        </div>
      )}

      {refsAtivas > 0 && (
        <div style={{ marginTop: 12, padding: '8px 10px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, fontSize: 12, color: '#78350f' }}>
          ⏱️ Geração com Kit Imagem usa o modelo de edição. Costuma levar de
          {' '}<strong>30 a 60 segundos</strong>{refsAtivas >= 3 ? ' (com várias referências pode passar de 1 minuto)' : ''}.
        </div>
      )}
    </div>
  );
}

function Tile({ checked, onToggle, url, label }: {
  checked: boolean; onToggle: () => void; url?: string; label: string;
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
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', textAlign: 'center', lineHeight: 1.15 }}>{label}</span>
    </label>
  );
}
