import { Fragment, useEffect } from "react";
import {
  BrandKit,
  FaixaEtaria,
  ImageKit,
  MoodCode,
  PostUnicoObjetivo,
  PostUnicoVisualSelection,
} from "../../types";
import {
  produtosDisponiveis,
  cenariosDisponiveis,
  cenarioLabel,
  CENARIO_SLOTS,
} from "../../utils/imageKitStorage";
import { ordemGruposPorSegmento, PU_MAX_PRODUTOS } from "../../core/referenciasPolicy";
import { mapFaixaToAnchorAge } from "../../core/audienceAge";
import { Tile } from "./composicaoVisual/Tile";
import { PersonagemSemAvatarBlock } from "./composicaoVisual/PersonagemSemAvatarBlock";

const MAX_PRODUTOS_PU = PU_MAX_PRODUTOS;

interface Props {
  imageKit: ImageKit;
  kit: BrandKit;
  selection: PostUnicoVisualSelection;
  onChange: (next: PostUnicoVisualSelection) => void;
  mood?: MoodCode;
  objetivo?: PostUnicoObjetivo;
  faixaEtaria?: FaixaEtaria | null;
  generoPref?: "M" | "F" | null;
}

export default function PostUnicoComposicaoVisual({
  imageKit,
  kit,
  selection,
  onChange,
  mood,
  objetivo,
  faixaEtaria,
  generoPref,
}: Props) {
  // Mantém genero/idade dos controles em sincronia com as props do form,
  // para que mudanças em generoPref/faixaEtaria depois do checkbox já marcado
  // sejam sempre refletidas na geração.
  useEffect(() => {
    if (!selection.personagemSemAvatar?.ativo) return;
    const newGenero =
      generoPref === "F"
        ? "mulher"
        : generoPref === "M"
          ? "homem"
          : selection.personagemSemAvatar.genero;
    const newIdade = faixaEtaria
      ? (mapFaixaToAnchorAge(faixaEtaria) ?? selection.personagemSemAvatar.idade)
      : selection.personagemSemAvatar.idade;
    if (
      newGenero !== selection.personagemSemAvatar.genero ||
      newIdade !== selection.personagemSemAvatar.idade
    ) {
      onChange({
        ...selection,
        personagemSemAvatar: {
          ...selection.personagemSemAvatar,
          genero: newGenero,
          idade: newIdade,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generoPref, faixaEtaria]);

  const hasAvatar1 = !!imageKit.avatar;
  const hasAvatar2 = !!imageKit.avatar2;
  const hasAvatar = hasAvatar1 || hasAvatar2;
  const hasFachada = !!imageKit.fachada;
  const cenarios = cenariosDisponiveis(imageKit);
  const hasCenario = cenarios.length > 0;
  const produtos = produtosDisponiveis(imageKit);
  const hasProdutos = produtos.length > 0;
  const hasFato = !!imageKit.fato && objetivo === "fatos";
  const hasVenda = !!imageKit.venda && objetivo === "venda";

  // Objetivo "Venda" usa a foto cadastrada quase sem alteração (ver aviso
  // abaixo) — mostrar as demais referências (avatar/fachada/cenário/produtos)
  // ao lado dela só dava chance de o usuário marcar a errada por engano ou
  // misturar referências que a IA recriaria por cima da foto documental.
  // Restringe a composição a SÓ a foto de Venda enquanto esse objetivo tiver
  // foto cadastrada, e limpa qualquer seleção anterior de outras referências
  // pra não vazar pra dentro da geração mesmo sem aparecer na tela.
  useEffect(() => {
    if (!hasVenda) return;
    const hasOutrasRefs =
      selection.useAvatar ||
      selection.useFachada ||
      selection.useCenario ||
      selection.useProdutos ||
      !!selection.personagemSemAvatar?.ativo;
    if (!hasOutrasRefs) return;
    onChange({
      ...selection,
      useAvatar: false,
      useFachada: false,
      useCenario: false,
      cenarioSelecionado: null,
      useProdutos: false,
      produtosSelecionados: [],
      personagemSemAvatar: selection.personagemSemAvatar
        ? { ...selection.personagemSemAvatar, ativo: false }
        : selection.personagemSemAvatar,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a hasVenda; `selection`/`onChange` são lidos, não devem re-disparar o efeito
  }, [hasVenda]);

  const effectiveCenario = selection.cenarioSelecionado ?? null;

  const refsAtivas =
    (selection.useAvatar ? 1 : 0) +
    (selection.useFachada && hasFachada ? 1 : 0) +
    (selection.useCenario && hasCenario && effectiveCenario ? 1 : 0) +
    (selection.useProdutos && hasProdutos ? selection.produtosSelecionados.length : 0) +
    (!selection.useAvatar && selection.personagemSemAvatar?.ativo ? 1 : 0) +
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
      <p style={{ margin: "4px 0 6px", fontSize: 12, color: "#64748b" }}>
        Marque quais imagens do seu <strong>Kit Imagem</strong> devem aparecer nesta peça.
        <strong> Se não marcar nenhuma, a peça é criada só a partir do texto.</strong>
      </p>
      {!hasVenda && (
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#0e7490" }}>
          Você pode combinar:{" "}
          <b>
            1 avatar + fachada + 1 cenário (dentre até {CENARIO_SLOTS} cadastrados) + até{" "}
            {MAX_PRODUTOS_PU} produtos
          </b>
          .
          {produtosNoLimite && (
            <> Limite de produtos atingido — desmarque um para escolher outro.</>
          )}
        </p>
      )}
      {(hasFato || hasVenda) && (
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#0e7490" }}>
          A foto de <b>{hasFato ? "Fato" : "Venda"}</b> é usada quase sem alteração, só com
          marca/título/texto sobrepostos
          {hasVenda
            ? " — por isso é a única referência disponível neste objetivo."
            : " — diferente das outras imagens, que a IA recria."}
        </p>
      )}
      {!hasVenda && kit.isPersonalBrand && !hasAvatar && (
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 12,
            color: "#713f12",
            background: "#fefce8",
            border: "1px solid #fde047",
            borderRadius: 10,
            padding: "8px 12px",
          }}
        >
          ⚠ Esta marca é pessoal — funciona melhor com seu <b>avatar</b> marcado como referência, já
          que você é a própria marca.
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(78px, 1fr))",
          gap: 6,
        }}
      >
        {!hasVenda &&
          ordemGruposPorSegmento(kit.segment).map((grupo) => {
            if (grupo === "avatar") {
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
            if (grupo === "fachada") {
              return (
                hasFachada && (
                  <Tile
                    key="fachada"
                    checked={!!selection.useFachada}
                    onToggle={pickFachada}
                    url={imageKit.fachada || undefined}
                    label="Fachada"
                  />
                )
              );
            }
            if (grupo === "cenario") {
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

      {selection.useProdutos && selection.produtosSelecionados.length > 0 && (
        <label className="checkRow" style={{ marginTop: 8, fontSize: 12, fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={!!selection.produtoTelaInformativa}
            onChange={(e) => onChange({ ...selection, produtoTelaInformativa: e.target.checked })}
          />
          Meu produto é digital (app, sistema ou painel) — mostrar a tela com nitidez
        </label>
      )}

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

      {!hasVenda && !selection.useAvatar && (
        <PersonagemSemAvatarBlock
          selection={selection}
          onChange={onChange}
          uniformeDataUrl={kit.uniformeDataUrl}
          generoPref={generoPref}
          faixaEtaria={faixaEtaria}
        />
      )}

      {!hasVenda && (!hasAvatar || !hasFachada || !hasCenario || !hasProdutos) && (
        <div
          style={{
            marginTop: 10,
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            color: "#92400e",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 11,
          }}
        >
          ⚠️ {!hasAvatar && "Adicione um avatar no Kit Imagem para usar. "}
          {!hasFachada && "Adicione a fachada no Kit Imagem para usar. "}
          {!hasCenario && "Adicione cenários (até 2) no Kit Imagem para usar. "}
          {!hasProdutos && "Adicione produtos no Kit Imagem para usar."}
        </div>
      )}

      {objetivo === "fatos" && !imageKit.fato && (
        <div
          style={{
            marginTop: 10,
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            color: "#92400e",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 11,
          }}
        >
          ⚠️ Objetivo "Fatos" funciona melhor com uma foto do evento. Adicione em{" "}
          <strong>Kit Imagem → Fato</strong>.
        </div>
      )}

      {objetivo === "venda" && !imageKit.venda && (
        <div
          style={{
            marginTop: 10,
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            color: "#92400e",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 11,
          }}
        >
          ⚠️ Objetivo "Venda" funciona melhor com uma foto do colaborador com o produto. Adicione em{" "}
          <strong>Kit Imagem → Venda</strong>.
        </div>
      )}

      {mood === "OP-06" && selection.useCenario && hasCenario && effectiveCenario && (
        <div
          style={{
            marginTop: 10,
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            color: "#92400e",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 11,
          }}
        >
          ⚠️ No estilo <strong>Silêncio</strong> a imagem usa muito espaço vazio — o cenário enviado
          pode não aparecer reconhecível no resultado. Para preservá-lo, use Avatar/Produto como
          referência ou escolha outro estilo.
        </div>
      )}

      {refsAtivas > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 10px",
            background: "#fef3c7",
            border: "1px solid #fcd34d",
            borderRadius: 8,
            fontSize: 12,
            color: "#78350f",
          }}
        >
          ⏱️ Gerar com imagens do Kit costuma levar de <strong>30 a 60 segundos</strong>
          {refsAtivas >= 3 ? " (com várias, pode passar de 1 minuto)" : ""}.
        </div>
      )}
    </div>
  );
}
