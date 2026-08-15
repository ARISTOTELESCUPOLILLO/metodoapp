// Intenção declarada — bloco ANINHADO dentro de "Objetivo da peça" (piloto,
// atrás da flag profiles.beta_intencao).
//
// POR QUE ANINHADO E NÃO AO LADO: "Objetivo da peça" classifica o FORMATO — o
// que a peça é. A intenção classifica o ALVO — o que ela deve provocar. Lado a
// lado, o usuário responde o fácil e pula o difícil.
import {
  INTENCOES,
  MAX_TRANSFORMACOES_SECUNDARIAS,
  type IntencaoDeclarada,
  type TransformacaoPretendida,
} from "../../../domain/intencao.config";
import { checkCoerencia, ordenarTransformacoes } from "../../../core/intencao";

interface Props {
  /** Rótulo do objetivo já escolhido — usado na frase de transição. */
  objetivoLabel: string;
  intencao: IntencaoDeclarada | null;
  transformacaoPrincipal: TransformacaoPretendida | null;
  transformacoesSecundarias: TransformacaoPretendida[];
  /** Natureza do negócio = segmento do Kit de Marca. Só ORDENA a lista. */
  segment?: string;
  onIntencaoChange: (v: IntencaoDeclarada) => void;
  onPrincipalChange: (v: TransformacaoPretendida) => void;
  onSecundariasChange: (v: TransformacaoPretendida[]) => void;
}

export function IntencaoSection({
  objetivoLabel,
  intencao,
  transformacaoPrincipal,
  transformacoesSecundarias,
  segment,
  onIntencaoChange,
  onPrincipalChange,
  onSecundariasChange,
}: Props) {
  const aviso = checkCoerencia(intencao, transformacaoPrincipal, segment);
  const transformacoes = ordenarTransformacoes(segment);

  // Escolher como PRINCIPAL algo que já estava marcado como secundária apenas
  // promove a opção — não deixa a mesma transformação nas duas listas.
  const escolherPrincipal = (v: TransformacaoPretendida) => {
    onPrincipalChange(v);
    if (transformacoesSecundarias.includes(v)) {
      onSecundariasChange(transformacoesSecundarias.filter((t) => t !== v));
    }
  };

  const alternarSecundaria = (v: TransformacaoPretendida) => {
    if (transformacoesSecundarias.includes(v)) {
      onSecundariasChange(transformacoesSecundarias.filter((t) => t !== v));
      return;
    }
    if (transformacoesSecundarias.length >= MAX_TRANSFORMACOES_SECUNDARIAS) return;
    onSecundariasChange([...transformacoesSecundarias, v]);
  };

  const secundariasCheias = transformacoesSecundarias.length >= MAX_TRANSFORMACOES_SECUNDARIAS;

  return (
    <div className="intencaoBlock">
      <p className="trackNote" style={{ margin: "14px 0 10px" }}>
        <strong>{objetivoLabel} é o que a peça é.</strong> Diga o que ela deve provocar.
      </p>

      <strong>Intenção — o que ele deve passar a perceber</strong>
      <div className="sequenceGrid">
        {INTENCOES.map((i) => (
          <button
            key={i.valor}
            type="button"
            className={`sequenceCard trackCard${intencao === i.valor ? " active" : ""}`}
            onClick={() => onIntencaoChange(i.valor)}
          >
            <span className="sequenceNum">{i.rotulo}</span>
            <span className="trackDescription">{i.apoio}</span>
          </button>
        ))}
      </div>

      {/* Rotulado "Transformação pretendida", NUNCA "Ação": preferência e
          urgência são estados, não ações — sob o rótulo "Ação" o cliente ignora
          justamente as duas primeiras opções. */}
      <strong style={{ display: "block", marginTop: 16 }}>
        Transformação pretendida — o que muda nele depois
      </strong>
      <div className="sequenceGrid">
        {transformacoes.map((t) => (
          <button
            key={t.valor}
            type="button"
            className={`sequenceCard trackCard${transformacaoPrincipal === t.valor ? " active" : ""}`}
            onClick={() => escolherPrincipal(t.valor)}
          >
            <span className="trackDescription">{t.rotulo}</span>
          </button>
        ))}
      </div>

      {transformacaoPrincipal && (
        <>
          <p className="trackNote" style={{ margin: "12px 0 8px" }}>
            Se quiser, some até {MAX_TRANSFORMACOES_SECUNDARIAS} secundárias — só a principal acima
            conta na medição.
          </p>
          <div className="sequenceGrid">
            {transformacoes
              .filter((t) => t.valor !== transformacaoPrincipal)
              .map((t) => {
                const marcada = transformacoesSecundarias.includes(t.valor);
                return (
                  <button
                    key={t.valor}
                    type="button"
                    className={`sequenceCard trackCard${marcada ? " active" : ""}`}
                    disabled={!marcada && secundariasCheias}
                    onClick={() => alternarSecundaria(t.valor)}
                  >
                    <span className="trackDescription">{t.rotulo}</span>
                  </button>
                );
              })}
          </div>
        </>
      )}

      {/* O aviso é a parte mais valiosa do recurso: é onde o cliente descobre
          que estava pedindo à peça algo que a peça não pode dar. Pergunta, nunca
          bloqueio — ele pode ignorar e gerar assim mesmo (e isso é registrado). */}
      {aviso && (
        <p className="trackNote" style={{ marginTop: 12 }}>
          <strong>Atenção:</strong> {aviso}
        </p>
      )}
    </div>
  );
}
