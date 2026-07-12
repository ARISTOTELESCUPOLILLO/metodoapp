import type { SugestaoEngineInput } from "@/core/sugestaoEngine";
import type { SugestaoFixture } from "./fixtures";

// Fixtures do teste A/B "Sintoma Real" (12/07/2026) — hipótese derivada da
// conversa sobre a Retórica de Aristóteles (endoxa/entimema) e o print em
// AJUSTE_CONFLITO ("Criação de sites para orçamentos recebidos online" —
// "só viagem da IA"): pra negócio de SERVIÇOS abstrato (sem textura física
// de uso, ao contrário de um produto físico), o motor às vezes INVENTA uma
// cena de negócio plausível-soante em vez de usar um sintoma real e
// reconhecível pelo cliente daquele ramo. Ver memória do projeto
// (metodo-op-aristoteles-retorica-sugestao / metodo-op-premissa-observador-
// shelved) pro racional completo.
//
// TODOS os 8 abaixo são contas REAIS do produto (dados lidos de brand_kits
// em 12/07/2026 via query direta ao Supabase — não inventados):
// - Oficina de Propaganda (as 2 primeiras) é o PRÓPRIO negócio do Aristóteles
//   — é a conta de onde saiu o print "só viagem da IA" que motivou este
//   teste; "Planejamento de Comunicação" é literalmente o produto do
//   exemplo ruim.
// - InfoPoint, Clínica Saúde Total e Sabor de Casa não têm `products`
//   cadastrado no Kit de Marca — passam pelo caminho decomposeAtividadeEmItens
//   (decompõe a ATIVIDADE em itens via IA), não pelo caminho de item
//   escolhido de uma lista fixa. Cobre os dois caminhos de produção.
// - Pronto Vet usa um item de SERVIÇO (não produto físico) dentro de um
//   segmento que também vende itens físicos — meio-termo controlado.
// - Loja Rocha e Moto Vale são VAREJO físico — controle: a hipótese prevê
//   que aqui a Variante A já funciona bem (textura física già ancora a
//   cena), então a Variante Sintoma Real não deveria mudar muita coisa.
const base: Omit<
  SugestaoEngineInput,
  "mainActivity" | "companyName" | "segment" | "objetivo" | "mode" | "selectedProducts" | "audience"
> = {
  hint: "",
  attempt: 0,
  sessionSeed: 0,
  previousSuggestions: [],
  isPersonalBrand: false,
  brandVoice: "",
};

export const fixturesSintomaReal: SugestaoFixture[] = [
  {
    id: "oficina-propaganda-planejamento-mop-b2b",
    label:
      "Oficina de Propaganda (SERVIÇOS/B2B) — MOP — institucional — Planejamento de Comunicação (item do print ruim)",
    input: {
      ...base,
      companyName: "Oficina de Propaganda",
      mainActivity: "Consultoria de Marketing Digital",
      segment: "SERVIÇOS",
      objetivo: "institucional",
      mode: "metodo",
      selectedProducts: ["Planejamento de Comunicação"],
      audience: "B2B",
    },
  },
  {
    id: "oficina-propaganda-site-pu-b2b",
    label: "Oficina de Propaganda (SERVIÇOS/B2B) — PU — promoção — Criação de sites",
    input: {
      ...base,
      companyName: "Oficina de Propaganda",
      mainActivity: "Consultoria de Marketing e Marketing Digital",
      segment: "SERVIÇOS",
      objetivo: "promocao",
      mode: "postunico",
      selectedProducts: ["Criação de sites"],
      audience: "B2B",
    },
  },
  {
    id: "infopoint-erp-mop-b2b-sem-produtos",
    label:
      "InfoPoint (SERVIÇOS/B2B) — MOP — oportunidade — sem produtos cadastrados (decompõe atividade)",
    input: {
      ...base,
      companyName: "InfoPoint",
      mainActivity: "Sistema de Gestão Empresarial - ERP",
      segment: "SERVIÇOS",
      objetivo: "oportunidade",
      mode: "metodo",
      selectedProducts: [],
      audience: "B2B",
    },
  },
  {
    id: "clinica-saude-total-mop-b2c-sem-produtos",
    label:
      "Clínica Saúde Total (SERVIÇOS/B2C) — MOP — institucional — sem produtos cadastrados (decompõe atividade)",
    input: {
      ...base,
      companyName: "Clínica Saúde Total",
      mainActivity: "Clínica médica com foco em saúde preventiva",
      segment: "SERVIÇOS",
      objetivo: "institucional",
      mode: "metodo",
      selectedProducts: [],
      audience: "B2C",
    },
  },
  {
    id: "sabor-de-casa-pu-b2c-sem-produtos",
    label:
      "Sabor de Casa (SERVIÇOS/B2C) — PU — promoção — sem produtos cadastrados (decompõe atividade)",
    input: {
      ...base,
      companyName: "Sabor de Casa",
      mainActivity: "Restaurante de comida a quilo e marmitex",
      segment: "SERVIÇOS",
      objetivo: "promocao",
      mode: "postunico",
      selectedProducts: [],
      audience: "B2C",
    },
  },
  {
    id: "prontovet-consulta-mop-b2c-servico",
    label: "Pronto Vet (SERVIÇOS/B2C) — MOP — promoção — item de SERVIÇO (não produto físico)",
    input: {
      ...base,
      companyName: "Pronto Vet",
      mainActivity: "Clínica veterinária, ração, remédios e acessórios",
      segment: "SERVIÇOS",
      objetivo: "promocao",
      mode: "metodo",
      selectedProducts: ["Consultas veterinárias"],
      audience: "B2C",
    },
  },
  {
    id: "loja-rocha-terno-mop-b2c-controle",
    label: "Loja Rocha (VAREJO/B2C) — MOP — promoção — Ternos Slim (CONTROLE: item físico)",
    input: {
      ...base,
      companyName: "Loja Rocha",
      mainActivity: "Loja de Ternos e Moda Social Masculina",
      segment: "VAREJO",
      objetivo: "promocao",
      mode: "metodo",
      selectedProducts: ["Ternos Slim"],
      audience: "B2C",
    },
  },
  {
    id: "moto-vale-kit-relacao-pu-b2c-controle",
    label: "Moto Vale (VAREJO/B2C) — PU — aviso — kit relação (CONTROLE: item físico)",
    input: {
      ...base,
      companyName: "Moto Vale",
      mainActivity: "Loja de peças e acessórios para motocicletas",
      segment: "VAREJO",
      objetivo: "aviso",
      mode: "postunico",
      selectedProducts: ["kit relação"],
      audience: "B2C",
    },
  },
];
