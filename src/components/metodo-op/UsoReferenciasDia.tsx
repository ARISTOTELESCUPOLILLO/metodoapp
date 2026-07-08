// Seletor de Imagens de Referência (IMG_RF) por peça/dia.
//
// Substitui o antigo PersonalizacaoBadge. Toggle default OFF; quando o
// usuário liga, vê as miniaturas do Kit Imagem PERMITIDAS para o
// (segmento, formato, modelo OP) atual e a frase "Você pode escolher: ...".
// Marca as imagens, clica "Gerar com referências" → chama regenerateWithKit.
//
// Custo: GRÁTIS dentro do plano. O extra só entra para liberar uma
// combinação que o plano não cobre (SERVIÇO/MARCA + produtos no carrossel).

import { Fragment } from "react";
import type { BrandKit, ImageKit, MoodCode } from "../../types";
import { cenarioLabel } from "../../utils/imageKitStorage";
import type { ModeloOP, SlotFormato } from "../../core/personalizacaoMop";
import { descrevePolicy, ordemGruposPorSegmento } from "../../core/referenciasPolicy";
import type { PersonagemGender } from "../../core/visualDirection";
import { Tile } from "./usoReferenciasDia/Tile";
import { useUsoReferenciasState } from "./usoReferenciasDia/useUsoReferenciasState";

// eslint-disable-next-line react-refresh/only-export-components -- re-export do hook acoplado ao componente deste arquivo
export { useRefSelection } from "./usoReferenciasDia/useRefSelection";
export type { RefSelectionState } from "./usoReferenciasDia/useRefSelection";

interface Props {
  segmento: BrandKit["segment"];
  modelo: ModeloOP | null;
  formato: SlotFormato;
  // Posição da peça (1-based). Usado só para o slot sintético.
  posicao: number;
  // Card do carrossel (1..5), quando aplicável.
  cardCarrossel?: number;
  kit: BrandKit;
  imageKit: ImageKit;
  mood: MoodCode;
  // Conteúdo atual da peça (forwarded ao motor para queimar o lettering).
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
  // Override explícito do alvo da geração (post|reels). Quando ausente,
  // infere por formato (reels → reels, demais → post).
  formatoOverride?: "post" | "reels";
  // Disparado após a geração com sucesso — recebe a dataURL final.
  // Quando o uso debitou extra carrossel-produto, `cobrouCarrosselProduto` = true.
  onGerou: (
    dataUrl: string,
    info: { cobrouCarrosselProduto: boolean; produtoNum?: number },
  ) => void;
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
  // Repassado pro regenerateWithKit pra recarregar o Kit Imagem do servidor
  // antes de gerar — evita referência fantasma de foto já deletada.
  userId?: string | null;
  // Gênero já decidido pro bloco desta peça (ver computeBlockGenders em
  // ResultsView.tsx) — sem isso, o botão interno "Gerar com referências"
  // deixava o motor sortear gênero do zero, podendo contradizer o
  // personagem que o GPT já escreveu em leituraCenica.personagem.
  forcedGender?: PersonagemGender;
  anchoraPersonagem?: string;
  ancoragePapel?: string;
  // Seed estável por sequência pra manter a mesma cor de roupa prevista do
  // avatar (sem uniforme real) em todas as peças — ver useAnchorControl.
  clothingSeed?: number;
}

export default function UsoReferenciasDia(props: Props) {
  const {
    segmento,
    modelo,
    formato,
    posicao,
    cardCarrossel,
    kit,
    imageKit,
    mood,
    titulo,
    texto,
    imagePrompt,
    leituraCenica,
    formatoOverride,
    onGerou,
    storageKey,
    compact,
    footerAction,
    userId,
    forcedGender,
    anchoraPersonagem,
    ancoragePapel,
    clothingSeed,
  } = props;

  const {
    policy,
    cenariosDisp,
    produtosDisp,
    temAlguma,
    enabled,
    setEnabled,
    avatarNum,
    setAvatarNum,
    usarFachada,
    setUsarFachada,
    cenarioNum,
    setCenarioNum,
    produtosNums,
    toggleProduto,
    produtosNoLimite,
    useUniforme,
    setUseUniforme,
    produtoTelaInformativa,
    setProdutoTelaInformativa,
    busy,
    error,
    podeGerar,
    handleGerar,
  } = useUsoReferenciasState({
    segmento,
    modelo,
    formato,
    posicao,
    cardCarrossel,
    kit,
    imageKit,
    mood,
    titulo,
    texto,
    imagePrompt,
    leituraCenica,
    formatoOverride,
    onGerou,
    storageKey,
    userId,
    forcedGender,
    anchoraPersonagem,
    ancoragePapel,
    clothingSeed,
  });

  // Política não permite NENHUMA imagem para este formato/segmento → não mostra nada.
  const policyAllowsAny =
    policy.avatar || policy.fachada || policy.cenarios > 0 || policy.produtos > 0;
  if (!policyAllowsAny) return null;

  // Política permite imagens mas o Kit está vazio → mostra orientação.
  if (!temAlguma) {
    const itemsFaltando: string[] = [];
    if (policy.avatar && !imageKit.avatar && !imageKit.avatar2) itemsFaltando.push("avatar");
    if (policy.fachada && !imageKit.fachada) itemsFaltando.push("fachada");
    if (policy.cenarios > 0 && cenariosDisp.length === 0) itemsFaltando.push("cenário");
    if (policy.produtos > 0 && produtosDisp.length === 0) itemsFaltando.push("produtos");
    return (
      <div
        style={{
          background: "#fefce8",
          border: "1px solid #fde047",
          borderRadius: 10,
          padding: "8px 12px",
          marginBottom: 10,
          fontSize: 12,
          color: "#713f12",
        }}
      >
        📦 Esta peça aceita imagens do Kit ({descrevePolicy(policy)}). Adicione{" "}
        {itemsFaltando.join(", ")} ao <strong>Kit Imagem</strong> para usá-las.
      </div>
    );
  }

  // Aviso amarelo se a política permite o tipo mas o Kit não tem a imagem.
  const faltaAvatar = policy.avatar && !imageKit.avatar && !imageKit.avatar2;
  const faltaFachada = policy.fachada && !imageKit.fachada;
  const faltaCenario = policy.cenarios > 0 && cenariosDisp.length === 0;
  const faltaProduto = policy.produtos > 0 && produtosDisp.length === 0;
  const algumFaltando = faltaAvatar || faltaFachada || faltaCenario || faltaProduto;

  const borderColor = enabled ? "#67e8f9" : "#e2e8f0";
  const bg = enabled ? "#ecfeff" : "#f8fafc";

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
        padding: "8px 10px",
        marginBottom: 10,
        fontSize: 12,
        color: enabled ? "#0e7490" : "#334155",
      }}
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          fontWeight: 700,
          userSelect: "none",
          width: "100%",
        }}
      >
        <input
          type="checkbox"
          style={{
            width: 16,
            height: 16,
            minWidth: 16,
            margin: 0,
            padding: 0,
            flexShrink: 0,
            cursor: "pointer",
          }}
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Usar Imagens de Referência
        </span>
      </label>

      {enabled && (
        <div style={{ marginTop: 8 }}>
          <p style={{ margin: "0 0 8px", fontSize: 11, opacity: 0.85 }}>
            Você pode escolher: <b>{descrevePolicy(policy)}</b>.
            {produtosNoLimite && " Limite de produtos atingido — desmarque um para escolher outro."}
          </p>
          {formato === "carrossel" && policy.produtos > 0 && (
            <p style={{ margin: "0 0 8px", fontSize: 11, opacity: 0.85 }}>
              {segmento === "VAREJO"
                ? "Até 5 fotos: cada card recebe uma foto inteira, pela numeração. Com menos de 5, a 1ª e a última ficam inteiras nas pontas; as do meio aparecem em detalhe, repetindo se faltar foto."
                : "1 foto por card, na ordem marcada — repete se faltar foto."}
            </p>
          )}
          {kit.isPersonalBrand && !imageKit.avatar && !imageKit.avatar2 && (
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 11,
                color: "#713f12",
                background: "#fefce8",
                border: "1px solid #fde047",
                borderRadius: 8,
                padding: "6px 10px",
              }}
            >
              ⚠ Esta marca é pessoal — funciona melhor com seu <b>avatar</b> marcado como
              referência, já que você é a própria marca.
            </p>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(78px, 1fr))",
              gap: 6,
            }}
          >
            {ordemGruposPorSegmento(segmento).map((grupo) => {
              if (grupo === "avatar") {
                return (
                  <Fragment key="avatar-group">
                    {policy.avatar && imageKit.avatar && (
                      <Tile
                        key="a1"
                        checked={avatarNum === 1}
                        onToggle={() => setAvatarNum((cur) => (cur === 1 ? null : 1))}
                        url={imageKit.avatar}
                        label={imageKit.avatar2 ? "Avatar 1" : "Avatar"}
                      />
                    )}
                    {policy.avatar && imageKit.avatar2 && (
                      <Tile
                        key="a2"
                        checked={avatarNum === 2}
                        onToggle={() => setAvatarNum((cur) => (cur === 2 ? null : 2))}
                        url={imageKit.avatar2}
                        label="Avatar 2"
                      />
                    )}
                  </Fragment>
                );
              }
              if (grupo === "fachada") {
                return (
                  policy.fachada &&
                  imageKit.fachada && (
                    <Tile
                      key="fachada"
                      checked={usarFachada}
                      onToggle={() => setUsarFachada((cur) => !cur)}
                      url={imageKit.fachada}
                      label="Fachada"
                    />
                  )
                );
              }
              if (grupo === "cenario") {
                return (
                  policy.cenarios > 0 &&
                  cenariosDisp.map((n) => (
                    <Tile
                      key={`c${n}`}
                      checked={cenarioNum === n}
                      onToggle={() => setCenarioNum((cur) => (cur === n ? null : n))}
                      url={imageKit.cenarios[n - 1] || undefined}
                      label={cenarioLabel(imageKit, n)}
                    />
                  ))
                );
              }
              // produto
              return (
                policy.produtos > 0 &&
                produtosDisp.map((n) => {
                  const ordem = produtosNums.indexOf(n);
                  const isCarrossel = formato === "carrossel";
                  const checked = produtosNums.includes(n);
                  return (
                    <Tile
                      key={`p${n}`}
                      checked={checked}
                      disabled={!checked && produtosNoLimite}
                      onToggle={() => toggleProduto(n)}
                      url={imageKit.produtos[n - 1] || undefined}
                      label={`Produto ${n}`}
                      badge={isCarrossel && ordem >= 0 ? ordem + 1 : undefined}
                    />
                  );
                })
              );
            })}
          </div>

          {!!kit.uniformeDataUrl && policy.avatar && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 8,
                cursor: avatarNum != null ? "pointer" : "default",
                opacity: avatarNum != null ? 1 : 0.5,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                style={{
                  width: 16,
                  height: 16,
                  minWidth: 16,
                  margin: 0,
                  padding: 0,
                  flexShrink: 0,
                  cursor: avatarNum != null ? "pointer" : "default",
                }}
                checked={useUniforme}
                disabled={avatarNum == null}
                onChange={(e) => setUseUniforme(e.target.checked)}
              />
              Gerar com uniforme da empresa
              {avatarNum == null && " (marque um avatar acima para usar)"}
            </label>
          )}

          {policy.produtos > 0 && produtosNums.length > 0 && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 8,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <input
                type="checkbox"
                style={{
                  width: 16,
                  height: 16,
                  minWidth: 16,
                  margin: 0,
                  padding: 0,
                  flexShrink: 0,
                  cursor: "pointer",
                }}
                checked={produtoTelaInformativa}
                onChange={(e) => setProdutoTelaInformativa(e.target.checked)}
              />
              Meu produto é digital (app, sistema ou painel) — mostrar a tela com nitidez
            </label>
          )}
          {policy.produtos > 0 &&
            produtosNums.length > 0 &&
            produtoTelaInformativa &&
            avatarNum != null && (
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "#94a3b8" }}>
                Com avatar marcado junto, a tela sai no tratamento padrão (sem forçar nitidez total)
                — evita conteúdo de tela vazando pra fora do retângulo.
              </p>
            )}

          {algumFaltando && (
            <div
              style={{
                marginTop: 8,
                background: "#fffbeb",
                border: "1px solid #fcd34d",
                color: "#92400e",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 11,
              }}
            >
              ⚠️ {faltaAvatar && "Adicione um avatar no Kit Imagem para usar. "}
              {faltaFachada && "Adicione a fachada no Kit Imagem para usar. "}
              {faltaCenario && "Adicione cenários no Kit Imagem para usar. "}
              {faltaProduto && "Adicione produtos no Kit Imagem para usar."}
            </div>
          )}

          {footerAction ? (
            <div style={{ marginTop: 8 }}>{footerAction}</div>
          ) : (
            !compact && (
              <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={handleGerar}
                  disabled={!podeGerar}
                  style={{
                    background: podeGerar ? "#0891b2" : "#94a3b8",
                    color: "#fff",
                    border: "none",
                    borderRadius: 12,
                    padding: "11px 18px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: podeGerar ? "pointer" : "not-allowed",
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {busy ? "Gerando…" : "✨ Gerar com referências"}
                </button>
              </div>
            )
          )}
        </div>
      )}

      {error && <p style={{ margin: "6px 0 0", color: "#b91c1c", fontSize: 11 }}>{error}</p>}
    </div>
  );
}
