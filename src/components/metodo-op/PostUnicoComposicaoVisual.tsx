import { Fragment, useEffect, useRef } from "react";
import {
  BrandKit,
  FaixaEtaria,
  ImageKit,
  MoodCode,
  PostUnicoObjetivo,
  PostUnicoVisualSelection,
  TipoPecaVestuario,
} from "../../types";
import { TIPO_PECA_LABEL } from "../../core/lookBook";
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
import { SemPersonagemBlock } from "./composicaoVisual/SemPersonagemBlock";

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
  // sejam sempre refletidas na geração — EXCETO se o usuário já tocou
  // manualmente no toggle "Trocar p/"/select de idade (achado 16/07/2026:
  // esse efeito reescrevia por cima da escolha manual do usuário). Uma vez
  // tocado, o campo manual manda até o personagem ser desativado.
  const generoTocadoRef = useRef(false);
  const idadeTocadoRef = useRef(false);
  useEffect(() => {
    if (!selection.personagemSemAvatar?.ativo) {
      generoTocadoRef.current = false;
      idadeTocadoRef.current = false;
    }
  }, [selection.personagemSemAvatar?.ativo]);
  useEffect(() => {
    if (!selection.personagemSemAvatar?.ativo) return;
    const newGenero = generoTocadoRef.current
      ? selection.personagemSemAvatar.genero
      : generoPref === "F"
        ? "mulher"
        : generoPref === "M"
          ? "homem"
          : selection.personagemSemAvatar.genero;
    const newIdade = idadeTocadoRef.current
      ? selection.personagemSemAvatar.idade
      : faixaEtaria
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
  // Objetivos "Fatos" e "Venda" usam a foto cadastrada quase sem alteração
  // (ver aviso abaixo) — mostrar as demais referências (avatar/fachada/
  // cenário/produtos) ao lado dela só dava chance de o usuário marcar a
  // errada por engano ou misturar referências que a IA recriaria por cima da
  // foto documental. hasVenda já tinha essa restrição; estendida a hasFato
  // pelo mesmo motivo (mesmo padrão de risco, mesmo aviso "usada quase sem
  // alteração").
  const hasDocFoto = hasFato || hasVenda;

  // Restringe a composição a SÓ a foto documental (Fato ou Venda) enquanto o
  // objetivo tiver foto cadastrada, e limpa qualquer seleção anterior de
  // outras referências pra não vazar pra dentro da geração mesmo sem
  // aparecer na tela.
  useEffect(() => {
    if (!hasDocFoto) return;
    const hasOutrasRefs =
      selection.useAvatar ||
      selection.useFachada ||
      selection.useCenario ||
      selection.useProdutos ||
      !!selection.personagemSemAvatar?.ativo ||
      !!selection.semPersonagem;
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
      // A foto de Fato/Venda é preservada como está, com as pessoas reais que
      // aparecem nela — "sem personagem" não se aplica e é desmarcado junto.
      semPersonagem: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage a hasDocFoto; `selection`/`onChange` são lidos, não devem re-disparar o efeito
  }, [hasDocFoto]);

  // Look book só existe com produto E pessoa. Quando o usuário desmarca um dos
  // dois depois de ter ligado o modo, o flag é limpo aqui — senão ele fica
  // órfão no localStorage e volta a valer sozinho numa peça futura em que a
  // combinação se repita, sem o usuário ter pedido.
  const temProdutoSelecionado = selection.useProdutos && selection.produtosSelecionados.length > 0;
  const podeVestir =
    temProdutoSelecionado &&
    !selection.semPersonagem &&
    (selection.useAvatar || !!selection.personagemSemAvatar?.ativo);
  useEffect(() => {
    if (selection.produtoVestido && !podeVestir) {
      onChange({ ...selection, produtoVestido: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage à condição; `selection`/`onChange` são lidos, não devem re-disparar o efeito
  }, [podeVestir, selection.produtoVestido]);

  const effectiveCenario = selection.cenarioSelecionado ?? null;

  // Quem veste a peça no modo look book: o avatar do Kit ou o personagem criado
  // sem foto. Sem nenhum dos dois (ou com "peça sem personagem" marcado), o modo
  // não tem em quem vestir e nem aparece na tela.
  const temPessoaEmCena =
    !selection.semPersonagem && (selection.useAvatar || !!selection.personagemSemAvatar?.ativo);

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
      // Marcar um avatar desliga "peça sem personagem" — os dois são
      // mutuamente exclusivos.
      onChange({ ...selection, useAvatar: true, avatarSelecionado: slot, semPersonagem: false });
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
      {!hasDocFoto && (
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
      {hasDocFoto && (
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#0e7490" }}>
          A foto de <b>{hasFato ? "Fato" : "Venda"}</b> é usada quase sem alteração, só com
          marca/título/texto sobrepostos — por isso é a única referência disponível neste objetivo.
        </p>
      )}
      {!hasDocFoto && kit.isPersonalBrand && !hasAvatar && (
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
        {!hasDocFoto &&
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
        <>
          <label className="checkRow" style={{ marginTop: 8, fontSize: 12, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={!!selection.produtoTelaInformativa}
              onChange={(e) => onChange({ ...selection, produtoTelaInformativa: e.target.checked })}
            />
            Meu produto é digital (app, sistema ou painel) — mostrar a tela com nitidez
          </label>
          {selection.produtoTelaInformativa && selection.useAvatar && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "#94a3b8" }}>
              Com avatar marcado junto, a tela sai no tratamento padrão (sem forçar nitidez total) —
              evita conteúdo de tela vazando pra fora do retângulo.
            </p>
          )}

          {/* Look book — só faz sentido com alguém em cena para vestir a peça. */}
          {temPessoaEmCena && (
            <>
              <label className="checkRow" style={{ marginTop: 8, fontSize: 12, fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={!!selection.produtoVestido}
                  onChange={(e) =>
                    onChange({
                      ...selection,
                      // "cima" é o default por ser o caso mais comum (camiseta,
                      // blusa) — o usuário troca no seletor logo abaixo.
                      produtoVestido: e.target.checked ? "cima" : undefined,
                      // Uniforme e peça vestida disputam o corpo do personagem.
                      useUniforme: e.target.checked ? false : selection.useUniforme,
                    })
                  }
                />
                O produto veste o personagem (look de modelo)
              </label>
              {selection.produtoVestido && (
                <>
                  <label
                    style={{
                      display: "block",
                      margin: "6px 0 0",
                      fontSize: 11,
                      color: "#94a3b8",
                    }}
                  >
                    Tipo da peça — define o enquadramento da foto
                    <select
                      value={selection.produtoVestido}
                      onChange={(e) =>
                        onChange({
                          ...selection,
                          produtoVestido: e.target.value as TipoPecaVestuario,
                        })
                      }
                      style={{ display: "block", marginTop: 4, width: "100%", padding: "6px 8px" }}
                    >
                      {(Object.keys(TIPO_PECA_LABEL) as TipoPecaVestuario[]).map((t) => (
                        <option key={t} value={t}>
                          {TIPO_PECA_LABEL[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: "#94a3b8" }}>
                    {selection.produtoVestido === "cima"
                      ? "Plano médio: torso e rosto no quadro."
                      : selection.produtoVestido === "baixo"
                        ? "Corpo inteiro ou três-quartos baixo — a peça aparece até a barra."
                        : selection.produtoVestido === "look"
                          ? "Corpo inteiro, dos pés à cabeça."
                          : "Corpo inteiro com os dois pés no quadro."}{" "}
                    A peça vestida sai parecida com a foto, não idêntica — para estampa ou logo que
                    o cliente precisa reconhecer, desmarque e deixe a peça exposta ao lado.
                  </p>
                </>
              )}
            </>
          )}
        </>
      )}

      {!hasDocFoto && (
        <SemPersonagemBlock
          selection={selection}
          onChange={onChange}
          isPersonalBrand={kit.isPersonalBrand}
        />
      )}

      {!!kit.uniformeDataUrl && selection.useAvatar && (
        <label className="checkRow" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={selection.useUniforme}
            onChange={(e) =>
              onChange({
                ...selection,
                useUniforme: e.target.checked,
                // Uniforme e look book vestem a mesma pessoa — marcar um
                // desmarca o outro (a exclusão também é reforçada no motor,
                // em buildReferences).
                produtoVestido: e.target.checked ? undefined : selection.produtoVestido,
              })
            }
          />
          Gerar com uniforme da empresa
        </label>
      )}

      {!hasDocFoto && !selection.useAvatar && !selection.semPersonagem && (
        <PersonagemSemAvatarBlock
          selection={selection}
          onChange={onChange}
          uniformeDataUrl={kit.uniformeDataUrl}
          generoPref={generoPref}
          faixaEtaria={faixaEtaria}
          onGeneroTocadoManualmente={() => (generoTocadoRef.current = true)}
          onIdadeTocadaManualmente={() => (idadeTocadoRef.current = true)}
        />
      )}

      {!hasDocFoto && (!hasAvatar || !hasFachada || !hasCenario || !hasProdutos) && (
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
