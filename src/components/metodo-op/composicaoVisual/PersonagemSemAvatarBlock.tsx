// Bloco "Gerar personagem (sem avatar) — público-alvo" da Composição Visual
// do Post Único — extraído de PostUnicoComposicaoVisual.tsx (PLANO_V2 Fase
// 9.1). JSX e lógica movidos 1:1, sem mudança de comportamento.
import type { FaixaEtaria, PostUnicoVisualSelection } from "../../../types";
import { AGE_OPTIONS, mapFaixaToAnchorAge } from "../../../core/audienceAge";

interface Props {
  selection: PostUnicoVisualSelection;
  onChange: (next: PostUnicoVisualSelection) => void;
  uniformeDataUrl?: string;
  generoPref?: "M" | "F" | null;
  faixaEtaria?: FaixaEtaria | null;
  /** Avisa o pai que o usuário trocou o gênero manualmente (botão "Trocar
   * p/"), pra ele parar de re-sincronizar esse campo a partir do formulário. */
  onGeneroTocadoManualmente?: () => void;
  /** Mesma ideia, para o select de idade. */
  onIdadeTocadaManualmente?: () => void;
}

export function PersonagemSemAvatarBlock({
  selection,
  onChange,
  uniformeDataUrl,
  generoPref,
  faixaEtaria,
  onGeneroTocadoManualmente,
  onIdadeTocadaManualmente,
}: Props) {
  return (
    <div
      style={{
        marginTop: 8,
        padding: "8px 10px",
        background: selection.personagemSemAvatar?.ativo ? "#ecfeff" : "#f8fafc",
        border: `1px solid ${selection.personagemSemAvatar?.ativo ? "#67e8f9" : "#e2e8f0"}`,
        borderRadius: 8,
      }}
    >
      <label className="checkRow" style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>
        <input
          type="checkbox"
          checked={!!selection.personagemSemAvatar?.ativo}
          onChange={(e) => {
            const ativando = e.target.checked;
            const generoPreenchido =
              ativando && generoPref
                ? generoPref === "F"
                  ? "mulher"
                  : "homem"
                : (selection.personagemSemAvatar?.genero ?? "homem");
            const idadePreenchida =
              ativando && faixaEtaria
                ? (mapFaixaToAnchorAge(faixaEtaria) ??
                  selection.personagemSemAvatar?.idade ??
                  AGE_OPTIONS[2])
                : (selection.personagemSemAvatar?.idade ?? AGE_OPTIONS[2]);
            onChange({
              ...selection,
              personagemSemAvatar: {
                ativo: ativando,
                genero: generoPreenchido,
                idade: idadePreenchida,
                comUniforme: selection.personagemSemAvatar?.comUniforme ?? false,
              },
            });
          }}
        />
        <span>Gerar personagem (sem avatar) — público-alvo</span>
        {selection.personagemSemAvatar?.ativo && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#475569",
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              padding: "2px 8px",
              letterSpacing: 0.3,
            }}
          >
            {selection.personagemSemAvatar.genero === "mulher" ? "F" : "M"} ·{" "}
            {(selection.personagemSemAvatar.idade ?? "").replace(" anos", "").replace(" ano", "")} ·{" "}
            {selection.personagemSemAvatar.comUniforme && uniformeDataUrl
              ? "Emissor"
              : "Público-alvo"}
          </span>
        )}
      </label>
      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
        Por padrão esse personagem representa o <b>público-alvo</b> (figurino livre) — não precisa
        de uniforme cadastrado para aparecer.
      </p>
      {selection.personagemSemAvatar?.ativo && (
        <div
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => {
              onChange({
                ...selection,
                personagemSemAvatar: {
                  ...selection.personagemSemAvatar!,
                  genero: selection.personagemSemAvatar!.genero === "mulher" ? "homem" : "mulher",
                },
              });
              onGeneroTocadoManualmente?.();
            }}
            style={{
              fontSize: 11,
              padding: "3px 10px",
              border: "1px solid #bfdbfe",
              background: "#eff6ff",
              color: "#1d4ed8",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Trocar p/ {selection.personagemSemAvatar.genero === "mulher" ? "Masculino" : "Feminino"}
          </button>
          <select
            value={selection.personagemSemAvatar.idade}
            onChange={(e) => {
              onChange({
                ...selection,
                personagemSemAvatar: {
                  ...selection.personagemSemAvatar!,
                  idade: e.target.value,
                },
              });
              onIdadeTocadaManualmente?.();
            }}
            style={{
              fontSize: 11,
              padding: "3px 6px",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              background: "#fff",
              color: "#475569",
              cursor: "pointer",
            }}
          >
            {AGE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      )}
      {selection.personagemSemAvatar?.ativo && !!uniformeDataUrl && (
        <label className="checkRow" style={{ marginTop: 8, fontSize: 12, color: "#0f172a" }}>
          <input
            type="checkbox"
            checked={!!selection.personagemSemAvatar.comUniforme}
            onChange={(e) =>
              onChange({
                ...selection,
                personagemSemAvatar: {
                  ...selection.personagemSemAvatar!,
                  comUniforme: e.target.checked,
                },
              })
            }
          />
          Vestir com uniforme da empresa (esse personagem passa a ser o emissor, não o público-alvo)
        </label>
      )}
    </div>
  );
}
