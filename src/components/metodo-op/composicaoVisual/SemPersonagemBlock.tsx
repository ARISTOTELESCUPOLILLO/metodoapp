// Bloco "Peça sem personagem" da Composição Visual do Post Único.
// Liga o modo em que a imagem não tem nenhuma pessoa — o sujeito passa a ser
// o produto, o cenário/fachada ou um objeto do ofício. Ver core/semPersonagem.ts
// para o que o flag desliga no prompt de imagem.
//
// Exclusividade: ligar aqui desmarca avatar, uniforme e o personagem sem
// avatar (não faz sentido pedir os dois; o motor reforça a mesma exclusão em
// buildReferences, para o caso de estado restaurado do localStorage).
import type { PostUnicoVisualSelection } from "../../../types";

interface Props {
  selection: PostUnicoVisualSelection;
  onChange: (next: PostUnicoVisualSelection) => void;
  /** Marca pessoal: o dono É a marca, então uma peça sem pessoa é uma escolha
   *  deliberada — vale avisar, sem impedir. */
  isPersonalBrand?: boolean;
}

export function SemPersonagemBlock({ selection, onChange, isPersonalBrand }: Props) {
  const ativo = !!selection.semPersonagem;
  return (
    <div
      style={{
        marginTop: 8,
        padding: "8px 10px",
        background: ativo ? "#f5f3ff" : "#f8fafc",
        border: `1px solid ${ativo ? "#c4b5fd" : "#e2e8f0"}`,
        borderRadius: 8,
      }}
    >
      <label className="checkRow" style={{ fontWeight: 700, fontSize: 12, color: "#0f172a" }}>
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => {
            const ligando = e.target.checked;
            onChange({
              ...selection,
              semPersonagem: ligando,
              ...(ligando
                ? {
                    useAvatar: false,
                    useUniforme: false,
                    personagemSemAvatar: selection.personagemSemAvatar
                      ? { ...selection.personagemSemAvatar, ativo: false }
                      : selection.personagemSemAvatar,
                  }
                : {}),
            });
          }}
        />
        <span>Peça sem personagem — nenhuma pessoa na imagem</span>
        {ativo && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#5b21b6",
              background: "#fff",
              border: "1px solid #ddd6fe",
              borderRadius: 6,
              padding: "2px 8px",
              letterSpacing: 0.3,
            }}
          >
            Sem pessoas
          </span>
        )}
      </label>
      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#64748b" }}>
        A cena é montada só com <b>produto</b>, <b>cenário</b>, <b>fachada</b> ou objetos do negócio
        — pode combinar as três imagens. Vale para qualquer segmento e qualquer estilo. Desmarca
        avatar e personagem.
      </p>
      {ativo && isPersonalBrand && (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#713f12" }}>
          ⚠ Esta marca é pessoal — você é a própria marca. Sem personagem, a peça comunica pelo
          objeto e pelo ambiente.
        </p>
      )}
    </div>
  );
}
