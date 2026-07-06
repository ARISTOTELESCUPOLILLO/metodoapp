import type { SugestaoEngineInput } from "@/core/sugestaoEngine";

// Cenários do teste A/B da Sugestão (MOP + PU) — Variante A (atual) vs
// Variante B (hipótese "Produto+Conector+Recorte"/"Produto+Benefício
// Percebido" enviada pelo Aristóteles em 06/07/2026).
//
// 3 das empresas abaixo (FERRIMAQ, Barbosa Lubrificantes, Pronto Vet) são
// contas de teste REAIS do produto (dados lidos de brand_kits em
// 06/07/2026, ver scripts/seed-products.mjs) — não inventadas. As demais
// (MARCA institucional, MARCA pessoal, "sem produtos cadastrados") são
// sintéticas, criadas só para cobrir combinações de segmento que as contas
// reais não têm.
export interface SugestaoFixture {
  id: string;
  label: string;
  input: SugestaoEngineInput;
}

const base: Omit<
  SugestaoEngineInput,
  | "mainActivity"
  | "companyName"
  | "segment"
  | "objetivo"
  | "mode"
  | "selectedProducts"
  | "audience"
> = {
  hint: "",
  attempt: 0,
  sessionSeed: 0,
  previousSuggestions: [],
  isPersonalBrand: false,
  brandVoice: "",
};

export const fixtures: SugestaoFixture[] = [
  {
    id: "ferrimaq-mop-b2b",
    label: "FERRIMAQ (VAREJO/B2B) — MOP — promoção",
    input: {
      ...base,
      companyName: "FERRIMAQ",
      mainActivity: "Venda de Móveis para Escritório, Consultórios, Auditórios, Refeitório e Escolares",
      segment: "VAREJO",
      objetivo: "promocao",
      mode: "metodo",
      selectedProducts: ["Cadeira de recepção de consultório"],
      audience: "B2B",
    },
  },
  {
    id: "ferrimaq-pu-b2b",
    label: "FERRIMAQ (VAREJO/B2B) — PU — promoção",
    input: {
      ...base,
      companyName: "FERRIMAQ",
      mainActivity: "Venda de Móveis para Escritório, Consultórios, Auditórios, Refeitório e Escolares",
      segment: "VAREJO",
      objetivo: "promocao",
      mode: "postunico",
      selectedProducts: ["Mesa para gestores"],
      audience: "B2B",
    },
  },
  {
    id: "barbosa-mop-b2b",
    label: "Barbosa Lubrificantes (VAREJO/B2B) — MOP — oportunidade",
    input: {
      ...base,
      companyName: "Barbosa Lubrificantes",
      mainActivity:
        "Loja de lubrificantes, correias, mangueiras, ferramentas, EPI e serviço de prensa de mangueiras",
      segment: "VAREJO",
      objetivo: "oportunidade",
      mode: "metodo",
      selectedProducts: ["Correias industriais"],
      audience: "B2B",
    },
  },
  {
    id: "barbosa-pu-b2b",
    label: "Barbosa Lubrificantes (VAREJO/B2B) — PU — aviso",
    input: {
      ...base,
      companyName: "Barbosa Lubrificantes",
      mainActivity:
        "Loja de lubrificantes, correias, mangueiras, ferramentas, EPI e serviço de prensa de mangueiras",
      segment: "VAREJO",
      objetivo: "aviso",
      mode: "postunico",
      selectedProducts: ["Serviço de prensa de mangueiras"],
      audience: "B2B",
    },
  },
  {
    id: "prontovet-mop-b2c-servico",
    label: "Pronto Vet (SERVIÇOS/B2C) — MOP — promoção — item serviço",
    input: {
      ...base,
      companyName: "Pronto Vet",
      mainActivity: "Clínica veterinária, ração, remédios e acessórios",
      segment: "SERVIÇOS",
      objetivo: "promocao",
      mode: "metodo",
      selectedProducts: ["Vacinas para cães e gatos"],
      audience: "B2C",
    },
  },
  {
    id: "prontovet-pu-b2c-produto",
    label: "Pronto Vet (SERVIÇOS/B2C) — PU — homenagem — item produto (troca de lente p/ VAREJO na Variante A)",
    input: {
      ...base,
      companyName: "Pronto Vet",
      mainActivity: "Clínica veterinária, ração, remédios e acessórios",
      segment: "SERVIÇOS",
      objetivo: "homenagem",
      mode: "postunico",
      selectedProducts: ["Ração para cães e gatos"],
      audience: "B2C",
    },
  },
  {
    id: "marca-institucional-mop-b2c",
    label: "MARCA institucional sintética (café de bairro) — MOP — institucional",
    input: {
      ...base,
      companyName: "Grão & Tempo Cafeteria",
      mainActivity: "Cafeteria de bairro com grãos torrados na casa e ambiente para trabalhar e ler",
      segment: "MARCA",
      objetivo: "institucional",
      mode: "metodo",
      selectedProducts: ["Café coado na hora"],
      audience: "B2C",
    },
  },
  {
    id: "marca-pessoal-pu-b2b",
    label: "MARCA pessoal sintética (consultora de marketing) — PU — promoção",
    input: {
      ...base,
      companyName: "Camila Reis Consultoria",
      mainActivity: "Consultoria de marketing digital para pequenas empresas, com mentoria individual",
      segment: "MARCA",
      objetivo: "promocao",
      mode: "postunico",
      selectedProducts: ["Mentoria individual de marketing"],
      audience: "B2B",
      isPersonalBrand: true,
    },
  },
  {
    id: "sem-produtos-mop-b2b",
    label: "Sem produtos cadastrados sintético (marcenaria sob encomenda) — MOP — oportunidade",
    input: {
      ...base,
      companyName: "Marcenaria Vale Verde",
      mainActivity: "Marcenaria sob encomenda: móveis planejados, restauração de móveis antigos e projetos personalizados",
      segment: "VAREJO",
      objetivo: "oportunidade",
      mode: "metodo",
      selectedProducts: [],
      audience: "B2C",
    },
  },
];
