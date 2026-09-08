// Controles da Informação-chave Editorial (piloto, atrás de
// profiles.beta_editorial) — PRODUTO/SERVIÇO/TEMA, USO NA COMUNICAÇÃO,
// LINHA EDITORIAL e PISTA.
//
// Componente CONTROLADO de propósito: quem guarda o estado é o dono das
// sugestões (PostUnicoForm no PU, contentForm/KeyInfoSection no MOP), porque é
// lá que a RODADA vive — trocar qualquer um destes campos reinicia a rodada, e
// esse reset precisa acontecer no mesmo lugar que zera suggestions/suggestCount.
// Duplicar o estado aqui criaria duas fontes de verdade para a mesma rodada.
//
// Renderizado só para quem está no beta: fora dele, nenhum destes campos
// existe na tela e a Sugestão segue o caminho Legacy.
import { useState } from "react";
import type { LinhaEditorialEscolha, UsoDoObjeto } from "../../../types";
import { LINHA_EDITORIAL_SPEC, LINHAS_EDITORIAIS } from "../../../domain/linhaEditorial.config";

const OBJETO_NENHUM = "";
const OBJETO_OUTRO = "__outro__";

const USO_LABEL: Record<UsoDoObjeto, string> = {
  auto: "Automático",
  nome: "Mostrar nome",
  sem_nome: "Referir sem nome",
  nao_usar: "Não usar",
};

const USO_AJUDA: Record<UsoDoObjeto, string> = {
  auto: "A IA decide se nomeia, se apenas se refere ou se não usa este item.",
  nome: "O nome do item aparece escrito na peça.",
  sem_nome: "O item é o contexto, mas o nome cadastrado não é escrito.",
  nao_usar: "O item não participa desta comunicação.",
};

const boxStyle: React.CSSProperties = {
  marginTop: 10,
  marginBottom: 10,
  padding: 12,
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  display: "grid",
  gap: 10,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#0f172a",
  marginBottom: 4,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 9px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontFamily: "inherit",
  fontSize: 13,
  color: "#0f172a",
};

const ajudaStyle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: 11,
  color: "#64748b",
  lineHeight: 1.4,
};

interface Props {
  /** Produtos/serviços do Kit de Marca. Pode vir vazio. */
  products: string[];
  objeto: string;
  onObjetoChange: (v: string) => void;
  usoObjeto: UsoDoObjeto;
  onUsoObjetoChange: (v: UsoDoObjeto) => void;
  linha: LinhaEditorialEscolha;
  onLinhaChange: (v: LinhaEditorialEscolha) => void;
  hint: string;
  onHintChange: (v: string) => void;
  disabled?: boolean;
}

export function EditorialControlsSection({
  products,
  objeto,
  onObjetoChange,
  usoObjeto,
  onUsoObjetoChange,
  linha,
  onLinhaChange,
  hint,
  onHintChange,
  disabled,
}: Props) {
  const cadastrado = products.includes(objeto);
  // "Outro" cobre o que o Kit não tem: no segmento MARCA o objeto pode ser um
  // livro, uma obra, um método ou um conceito ("Abaporu", "Semiótica da
  // Intenção"), que não são produto e por isso não estão no cadastro.
  // O toggle é estado LOCAL (só de tela): manter o campo aberto com texto vazio
  // não muda a rodada, porque a rodada olha para `objeto`, que continua "".
  const [modoOutro, setModoOutro] = useState(() => !!objeto && !cadastrado);
  const selectValue = modoOutro ? OBJETO_OUTRO : cadastrado ? objeto : OBJETO_NENHUM;
  const semObjeto = !objeto.trim();

  return (
    <div style={boxStyle}>
      <div>
        <label style={labelStyle}>Produto / serviço / tema</label>
        <select
          value={selectValue}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value;
            setModoOutro(v === OBJETO_OUTRO);
            onObjetoChange(v === OBJETO_OUTRO ? "" : v);
          }}
          style={{ ...selectStyle, opacity: disabled ? 0.5 : 1 }}
        >
          <option value={OBJETO_NENHUM}>Nenhum — falar da empresa ou da situação</option>
          {products.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value={OBJETO_OUTRO}>Outro — digitar um tema</option>
        </select>
        {modoOutro && (
          <input
            type="text"
            value={objeto}
            disabled={disabled}
            placeholder="Ex.: Abaporu, Semiótica da Intenção, Gestão de Tráfego Pago"
            onChange={(e) => onObjetoChange(e.target.value)}
            style={{ ...selectStyle, marginTop: 6 }}
          />
        )}
      </div>

      <div>
        <label style={labelStyle}>Uso na comunicação</label>
        <select
          value={usoObjeto}
          disabled={disabled || semObjeto}
          onChange={(e) => onUsoObjetoChange(e.target.value as UsoDoObjeto)}
          style={{ ...selectStyle, opacity: disabled || semObjeto ? 0.5 : 1 }}
        >
          {(Object.keys(USO_LABEL) as UsoDoObjeto[]).map((u) => (
            <option key={u} value={u}>
              {USO_LABEL[u]}
            </option>
          ))}
        </select>
        <p style={ajudaStyle}>
          {semObjeto
            ? "Escolha um produto, serviço ou tema para definir como ele aparece."
            : USO_AJUDA[usoObjeto]}
        </p>
      </div>

      <div>
        <label style={labelStyle}>Linha editorial</label>
        <select
          value={linha}
          disabled={disabled}
          onChange={(e) => onLinhaChange(e.target.value as LinhaEditorialEscolha)}
          style={{ ...selectStyle, opacity: disabled ? 0.5 : 1 }}
        >
          <option value="auto">Automático</option>
          {LINHAS_EDITORIAIS.map((l) => (
            <option key={l} value={l}>
              {LINHA_EDITORIAL_SPEC[l].label}
            </option>
          ))}
        </select>
        <p style={ajudaStyle}>
          {linha === "auto"
            ? "A cada nova sugestão o sistema muda a perspectiva, respeitando o objetivo da peça."
            : `"${LINHA_EDITORIAL_SPEC[linha].pergunta}" — as três sugestões seguem esta perspectiva, variando o ângulo.`}
        </p>
      </div>

      <div>
        <label style={labelStyle}>Pista (opcional)</label>
        <input
          type="text"
          value={hint}
          disabled={disabled}
          placeholder="Ex.: anúncio que recebe clique mas ninguém chama"
          onChange={(e) => onHintChange(e.target.value)}
          style={{ ...selectStyle, opacity: disabled ? 0.5 : 1 }}
        />
        <p style={ajudaStyle}>
          Escreva ou fale o que quer tratar. Trocar a pista não reinicia a rodada.
        </p>
      </div>
    </div>
  );
}
