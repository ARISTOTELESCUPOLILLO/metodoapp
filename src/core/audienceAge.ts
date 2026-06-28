import type { FaixaEtaria } from "../types";

// As mesmas 3 faixas dos seletores do form (ContentForm e PostUnicoForm).
// Usadas na âncora visual MOP (ResultsView) e no personagemSemAvatar PU.
export const AGE_OPTIONS = [
  "18–34 anos",
  "35–49 anos",
  "50–65 anos",
];

// Instrução de registro/vocabulário por faixa etária — injetada nos prompts de
// texto (MOP e PU). A faixa direciona o TOM e o VOCABULÁRIO, nunca aparece
// literal no título/texto gerado.
export const FAIXA_ETARIA_REGISTRO: Record<FaixaEtaria, string> = {
  "18-34":
    "REGISTRO PARA 18 A 34 ANOS: vocabulário jovem-adulto, direto e atual, sem gíria forçada nem formalidade excessiva. Frases curtas, ritmo ágil, referências de quem está construindo independência, carreira ou primeiros grandes consumos. O título pode ser mais coloquial e cortante.",
  "35-49":
    "REGISTRO PARA 35 A 49 ANOS: vocabulário maduro e prático, foco em eficiência, qualidade e decisão consciente. Tom de quem já tem experiência de compra ou gestão e valoriza tempo e resultado concreto. Equilíbrio entre proximidade e autoridade, sem informalidade excessiva.",
  "50-65":
    "REGISTRO PARA 50 A 65 ANOS: vocabulário claro e respeitoso, sem anglicismos nem abreviações de internet. Frases bem construídas, tom de confiança e estabilidade, que valoriza tradição, segurança e atendimento humano. Evitar gíria, pressão de urgência e linguagem publicitária vazia.",
};

// Mapeia a faixa etária do form para a label correspondente em AGE_OPTIONS.
// Agora é 1-para-1 — form e painel visual usam as mesmas 3 faixas.
export function mapFaixaToAnchorAge(faixa?: FaixaEtaria | null): string | undefined {
  if (faixa === "18-34") return "18–34 anos";
  if (faixa === "35-49") return "35–49 anos";
  if (faixa === "50-65") return "50–65 anos";
  return undefined;
}
