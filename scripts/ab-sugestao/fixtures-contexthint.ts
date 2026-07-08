import type { SugestaoEngineInput } from "@/core/sugestaoEngine";

// Fixtures do teste "hint de contexto" (ideia do Fable, 08/07/2026) — 5
// contas REAIS de teste do produto (dados lidos de brand_kits em
// 08/07/2026), cada uma com o item MAIS ESPECÍFICO trocado por uma versão
// deliberadamente GENÉRICA, simulando o "cadastro preguiçoso" que motivou a
// ideia. `otherProducts` = restante da lista real cadastrada (usada só como
// corpus de grounding pelo contextHint.ts, não entra no prompt final).
export interface ContextHintFixture {
  id: string;
  label: string;
  genericItem: string;
  otherProducts: string[];
  input: SugestaoEngineInput;
}

const base: Omit<
  SugestaoEngineInput,
  "mainActivity" | "companyName" | "segment" | "objetivo" | "mode" | "selectedProducts" | "audience" | "isPersonalBrand" | "brandVoice"
> = {
  hint: "",
  attempt: 0,
  sessionSeed: 0,
  previousSuggestions: [],
};

export const fixtures: ContextHintFixture[] = [
  {
    id: "ferrimaq",
    label: "FERRIMAQ (VAREJO/B2B) — item genérico: Móveis para escritório",
    genericItem: "Móveis para escritório",
    otherProducts: [
      "Armário de escritório",
      "Poltrona de trabalho",
      "Estante de escritório",
      "Cadeira estofada de escritório",
      "Cadeira de recepção de consultório",
      "Mesa de secretária",
      "Mesa para gestores",
    ],
    input: {
      ...base,
      companyName: "FERRIMAQ",
      mainActivity: "Venda de Móveis para Escritório, Consultórios, Auditórios, Refeitório e Escolares",
      segment: "VAREJO",
      objetivo: "oportunidade",
      mode: "postunico",
      selectedProducts: ["Móveis para escritório"],
      audience: "B2B",
      isPersonalBrand: false,
      brandVoice: "",
    },
  },
  {
    id: "barbosa",
    label: "Barbosa Lubrificantes (VAREJO/B2B) — item genérico: Óleo lubrificante",
    genericItem: "Óleo lubrificante",
    otherProducts: [
      "Correias industriais",
      "Mangueiras hidráulicas",
      "Equipamentos de proteção individual (EPI)",
      "Correias automotivas",
      "Filtro para motores agrícola",
      "Lubrificantes para maquinas agrícola",
    ],
    input: {
      ...base,
      companyName: "Barbosa Lubrificantes",
      mainActivity: "Loja de lubrificantes, correias, mangueiras, ferramentas e EPI",
      segment: "VAREJO",
      objetivo: "oportunidade",
      mode: "postunico",
      selectedProducts: ["Óleo lubrificante"],
      audience: "B2B",
      isPersonalBrand: false,
      brandVoice: "",
    },
  },
  {
    id: "prontovet",
    label: "Pronto Vet (SERVIÇOS/B2C) — item genérico: Ração",
    genericItem: "Ração",
    otherProducts: [
      "Consultas veterinárias",
      "Vacinas",
      "Banho e tosa",
      "Coleira para cães",
      "Vitamina para pets",
    ],
    input: {
      ...base,
      companyName: "Pronto Vet",
      mainActivity: "Clínica veterinária, ração, remédios e acessórios",
      segment: "SERVIÇOS",
      objetivo: "oportunidade",
      mode: "postunico",
      selectedProducts: ["Ração"],
      audience: "B2C",
      isPersonalBrand: false,
      brandVoice: "",
    },
  },
  {
    id: "roziner",
    label: "Roziner Artista e Poetisa (MARCA) — item genérico: Pintura",
    genericItem: "Pintura",
    otherProducts: ["decoração afetiva", "reaproveitamento de objetos", "poesia"],
    input: {
      ...base,
      companyName: "Roziner Artista e Poetisa",
      mainActivity: "Reaproveitamento de objetos, decoração afetiva, pintura e poesias",
      segment: "MARCA",
      objetivo: "oportunidade",
      mode: "postunico",
      selectedProducts: ["Pintura"],
      audience: "B2C",
      isPersonalBrand: true,
      brandVoice: "",
    },
  },
  {
    id: "oficina-op",
    label: "Oficina de Propaganda (SERVIÇOS/B2B) — item genérico: Marketing digital",
    genericItem: "Marketing digital",
    otherProducts: [
      "Gestão de redes sociais",
      "Postagens no Instagram",
      "Tráfego pago nos meios digitais",
      "Minicurso de vendas",
      "Consultoria presencial e online",
      "Aplicativo Método OP para geração de texto e imagem",
    ],
    input: {
      ...base,
      companyName: "Oficina de Propaganda",
      mainActivity: "Consultoria de Marketing Digital",
      segment: "SERVIÇOS",
      objetivo: "oportunidade",
      mode: "postunico",
      selectedProducts: ["Marketing digital"],
      audience: "B2B",
      isPersonalBrand: false,
      brandVoice: "",
    },
  },
];
