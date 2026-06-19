import { Fragment } from 'react';
import { BrandKit, ImageKit, MoodCode, PostUnicoObjetivo, PostUnicoVisualSelection } from '../../types';
import { produtosDisponiveis, cenariosDisponiveis, cenarioLabel } from '../../utils/imageKitStorage';
import { ordemGruposPorSegmento, PU_MAX_PRODUTOS } from '../../core/referenciasPolicy';

const MAX_PRODUTOS_PU = PU_MAX_PRODUTOS;

// Mesma faixa etária usada no box "Personagem da sequência" do MOP (ResultsView.tsx).
const AGE_OPTIONS = ['18–28 anos', '25–35 anos', '30–40 anos', '35–45 anos', '40–55 anos', '50–65 anos'];

interface Props {
  imageKit: ImageKit;
  kit: BrandKit;
  selection: PostUnicoVisualSelection;
  onChange: (next: PostUnicoVisualSelection) => void;
  mood?: MoodCode;
  // Gate de visibilidade dos tiles de Fato/Venda — só fazem sentido com o
  // objetivo de peça correspondente selecionado.
  objetivo?: PostUnicoObjetivo;
}

export default function PostUnicoComposicaoVisual({ imageKit, kit, selection, onChange, mood, objetivo }: Props) {
  const hasAvatar1 = !!imageKit.avatar;
  const hasAvatar2 = !!imageKit.avatar2;
  const hasAvatar = hasAvatar1 || hasAvatar2;
  const hasFachada = !!imageKit.fachada;
  const cenarios = cenariosDisponiveis(imageKit);
  const hasCenario = cenarios.length > 0;
  const produtos = produtosDisponiveis(imageKit);
  const hasProdutos = produtos.length > 0;
  const hasFato = !!imageKit.fato && objetivo === 'fatos';
  const hasVenda = !!imageKit.venda && objetivo === 'venda';

  const effectiveCenario = selection.cenarioSelecionado ?? null;

  const refsAtivas =
    (selection.useAvatar ? 1 : 0) +
    (selection.useFachada && hasFachada ? 1 : 0) +
    (selection.useCenario && hasCenario && effectiveCenario ? 1 : 0) +
    (selection.useProdutos && hasProdutos ? selection.produtosSelecionados.length : 0) +
    (!selection.useAvatar && selection.personagemSemAvatar?.ativo && kit.uniformeDataUrl ? 1 : 0) +
    (selection.useFato && hasFato ? 1 : 0) +
    (selection.useVenda && hasVenda ? 1 : 0);

  function pickAvatar(slot: 1 | 2) {
    if (selection.useAvatar && selection.avatarSelecionado === slot) {
      onChange({ ...selection, useAvatar: false });
    } else {
      onChange({ ...selection, useAvatar: true, avatarSelecionado: slot });
    }
  }
  function pickFachada() {
    onChange({ ...selection, useFachada: !selection.useFachada });
  }
  function pickFato() {
    onChange({ ...selection, useFato: !selection.useFato });
  }
  function pickVenda() {
    onChange({ ...selection, useVenda: !selection.useVenda });
  }
  function pickCenario(num: number) {
    const isCurrent = effectiveCenario === num && selection.useCenario;
    if (isCurrent) {
      onChange({ ...selection, useCenario: false, cenarioSelecionado: null });
    } else {
      onChange({ ...selection, useCenario: true, cenarioSelecionado: num });
    }
  }
  const produtosNoLimite = selection.produtosSelecionados.length >= MAX_PRODUTOS_PU;

  function toggleProduto(num: number) {
    const has = selection.produtosSelecionados.includes(num);
    if (!has && produtosNoLimite) return; // no limite: usuário precisa desmarcar antes de trocar
    const next = has
      ? selection.produtosSelecionados.filter((n) => n !== num)
      : [...selection.produtosSelecionados, num];
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
        Você pode combinar: <b>1 avatar + fachada + 1 cenário + até {MAX_PRODUTOS_PU} produtos</b>.
        {produtosNoLimite && (
          <> Limite de produtos atingido — desmarque um para escolher outro.</>
        )}
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))',
        gap: 6,
      }}>
        {ordemGruposPorSegmento(kit.segment).map((grupo) => {
          if (grupo === 'avatar') {
            return (
              <Fragment key="avatar-group">
                {hasAvatar1 && (
                  <Tile
                    key="a1"
                    checked={selection.useAvatar && selection.avatarSelecionado === 1}
                    onToggle={() => pickAvatar(1)}
                    url={imageKit.avatar || undefined}
                    label="Avatar 1"
                  />
                )}
                {hasAvatar2 && (
                  <Tile
                    key="a2"
                    checked={selection.useAvatar && selection.avatarSelecionado === 2}
                    onToggle={() => pickAvatar(2)}
                    url={imageKit.avatar2 || undefined}
                    label="Avatar 2"
                  />
                )}
              </Fragment>
            );
          }
          if (grupo === 'fachada') {
            return hasFachada && (
              <Tile
                key="fachada"
                checked={!!selection.useFachada}
                onToggle={pickFachada}
                url={imageKit.fachada || undefined}
                label="Fachada"
              />
            );
          }
          if (grupo === 'cenario') {
            return cenarios.map((num) => (
              <Tile
                key={`c${num}`}
                checked={selection.useCenario && effectiveCenario === num}
                onToggle={() => pickCenario(num)}
                url={imageKit.cenarios[num - 1] || undefined}
                label={cenarioLabel(imageKit, num)}
              />
            ));
          }
          // produto
          return produtos.map((num) => {
            const checked = selection.produtosSelecionados.includes(num);
            return (
              <Tile
                key={`p${num}`}
                checked={checked}
                disabled={!checked && produtosNoLimite}
                onToggle={() => toggleProduto(num)}
                url={imageKit.produtos[num - 1] || undefined}
                label={`Produto ${num}`}
              />
            );
          });
        })}
        {hasFato && (
          <Tile
            checked={!!selection.useFato}
            onToggle={pickFato}
            url={imageKit.fato || undefined}
            label="Fato"
          />
        )}
        {hasVenda && (
          <Tile
            checked={!!selection.useVenda}
            onToggle={pickVenda}
            url={imageKit.venda || undefined}
            label="Venda"
          />
        )}
      </div>

      {!!kit.uniformeDataUrl && selection.useAvatar && (
        <label className="checkRow" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={selection.useUniforme}
            onChange={(e) => onChange({ ...selection, useUniforme: e.target.checked })}
          />
          Gerar com uniforme da empresa
        </label>
      )}

      {!!kit.uniformeDataUrl && !selection.useAvatar && (
        <div style={{
          marginTop: 8, padding: '8px 10px',
          background: selection.personagemSemAvatar?.ativo ? '#ecfeff' : '#f8fafc',
          border: `1px solid ${selection.personagemSemAvatar?.ativo ? '#67e8f9' : '#e2e8f0'}`,
          borderRadius: 8,
        }}>
          <label className="checkRow" style={{ fontWeight: 700, fontSize: 12, color: '#0f172a' }}>
            <input
              type="checkbox"
              checked={!!selection.personagemSemAvatar?.ativo}
              onChange={(e) => onChange({
                ...selection,
                personagemSemAvatar: {
                  ativo: e.target.checked,
                  genero: selection.personagemSemAvatar?.genero ?? 'homem',
                  idade: selection.personagemSemAvatar?.idade ?? AGE_OPTIONS[2],
                },
              })}
            />
            <span>Gerar personagem com uniforme (sem avatar)</span>
            {selection.personagemSemAvatar?.ativo && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 8px', letterSpacing: 0.3 }}>
                {selection.personagemSemAvatar.genero === 'mulher' ? 'F' : 'M'} · {selection.personagemSemAvatar.idade.replace(' anos', '').replace(' ano', '')}
              </span>
            )}
          </label>
          {selection.personagemSemAvatar?.ativo && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => onChange({
                  ...selection,
                  personagemSemAvatar: {
                    ...selection.personagemSemAvatar!,
                    genero: selection.personagemSemAvatar!.genero === 'mulher' ? 'homem' : 'mulher',
                  },
                })}
                style={{ fontSize: 11, padding: '3px 10px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}
              >
                Trocar p/ {selection.personagemSemAvatar.genero === 'mulher' ? 'Masculino' : 'Feminino'}
              </button>
              <select
                value={selection.personagemSemAvatar.idade}
                onChange={(e) => onChange({
                  ...selection,
                  personagemSemAvatar: { ...selection.personagemSemAvatar!, idade: e.target.value },
                })}
                style={{ fontSize: 11, padding: '3px 6px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', color: '#475569', cursor: 'pointer' }}
              >
                {AGE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {(!hasAvatar || !hasFachada || !hasCenario || !hasProdutos) && (
        <div style={{
          marginTop: 10, background: '#fffbeb', border: '1px solid #fcd34d',
          color: '#92400e', borderRadius: 6, padding: '6px 8px', fontSize: 11,
        }}>
          ⚠️ {!hasAvatar && 'Adicione um avatar no Kit Imagem para usar. '}
          {!hasFachada && 'Adicione a fachada no Kit Imagem para usar. '}
          {!hasCenario && 'Adicione cenários (até 2) no Kit Imagem para usar. '}
          {!hasProdutos && 'Adicione produtos no Kit Imagem para usar.'}
        </div>
      )}

      {objetivo === 'fatos' && !imageKit.fato && (
        <div style={{
          marginTop: 10, background: '#fffbeb', border: '1px solid #fcd34d',
          color: '#92400e', borderRadius: 6, padding: '6px 8px', fontSize: 11,
        }}>
          ⚠️ Objetivo "Fatos" funciona melhor com uma foto do evento. Adicione em <strong>Kit Imagem → Fato</strong>.
        </div>
      )}

      {objetivo === 'venda' && !imageKit.venda && (
        <div style={{
          marginTop: 10, background: '#fffbeb', border: '1px solid #fcd34d',
          color: '#92400e', borderRadius: 6, padding: '6px 8px', fontSize: 11,
        }}>
          ⚠️ Objetivo "Venda" funciona melhor com uma foto do colaborador com o produto. Adicione em <strong>Kit Imagem → Venda</strong>.
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

function Tile({ checked, onToggle, url, label, disabled }: {
  checked: boolean; onToggle: () => void; url?: string; label: string; disabled?: boolean;
}) {
  return (
    <label
      title={disabled ? 'Limite atingido — desmarque um item para trocar' : undefined}
      style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: 4, borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? '#cffafe' : '#fff',
        border: `1px solid ${checked ? '#0891b2' : '#e2e8f0'}`,
        fontSize: 10,
        opacity: disabled ? 0.45 : 1,
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
          disabled={disabled}
          onChange={onToggle}
          style={{ position: 'absolute', top: 4, left: 4, width: 16, height: 16, minWidth: 16, margin: 0, padding: 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a', textAlign: 'center', lineHeight: 1.15 }}>{label}</span>
    </label>
  );
}
