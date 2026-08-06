// Contrato do MIX — o que o usuário seleciona no Kit Imagem tem de aparecer na
// peça, de forma previsível, em toda geração.
//
// Origem (achado real 06/08/2026, PU Atrevidinha Modas, CLAREZA, VAREJO, mix
// avatar + cenário + produto): a 1ª geração sorteou a estrutura "EM PÉ" e o
// avatar apareceu; o "gerar novamente" sorteou "DETALHE CONTEXTUAL" — que manda
// o personagem existir apenas por "mão, braço, silhueta" — e a pessoa sumiu da
// peça, sem que nada tivesse mudado na seleção. Na mesma peça o produto (uma
// camiseta) ficou sem destaque, disputando com a cor de figurino sorteada e com
// a trava de plano médio do CLAREZA.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { pickImageVariationBlock } from "../core/imageVariationPicker";
import { variationHasFaceNotDominant } from "../core/productHierarchy";
import { buildMixContratoBlock } from "../shared/visual/referenceBlocks";
import { buildMoodGrammarBlock } from "../core/visualDirection";
import { isApparelActivity } from "../utils/promptRules";
import { buildPostUnicoPrompt } from "../services/buildPuPrompt";
import {
  CLAREZA_CHARACTER_VARIATIONS,
  IMPACTO_CHARACTER_VARIATIONS,
} from "../core/visualDirection.lexicon";
import type { BrandKit, PostUnicoFormData } from "../types";
import type { PostUnicoReferences } from "../shared/visual/references";

// ── Sorteio de variação: avatar selecionado nunca cai em cena sem rosto ──────

describe("pickImageVariationBlock — avatar é contrato, não sugestão", () => {
  it("CLAREZA: com avatar, nenhuma das variações sorteadas retira o rosto da cena", () => {
    // 200 sorteios: com 3 variações no pool, a chance de a variação sem rosto
    // (1 em 3) não sair nenhuma vez por acaso é desprezível.
    for (let i = 0; i < 200; i++) {
      const bloco = pickImageVariationBlock("OP-01", true);
      expect(variationHasFaceNotDominant(bloco)).toBe(false);
      expect(bloco).not.toContain("DETALHE CONTEXTUAL");
    }
  });

  it("IMPACTO: com avatar, não sorteia a variação sem personagem dominante", () => {
    for (let i = 0; i < 200; i++) {
      const bloco = pickImageVariationBlock("OP-02", true);
      expect(variationHasFaceNotDominant(bloco)).toBe(false);
    }
  });

  it("sem avatar, a variação sem rosto continua no sorteio (diversidade preservada)", () => {
    const blocos = Array.from({ length: 200 }, () => pickImageVariationBlock("OP-01", false));
    expect(blocos.some((b) => variationHasFaceNotDominant(b))).toBe(true);
  });

  it("os pools ainda contêm as variações sem rosto — o filtro é do sorteio, não do léxico", () => {
    expect(CLAREZA_CHARACTER_VARIATIONS.some((v) => variationHasFaceNotDominant(v))).toBe(true);
    expect(IMPACTO_CHARACTER_VARIATIONS.some((v) => variationHasFaceNotDominant(v))).toBe(true);
    // E sobra pelo menos uma COM rosto para o sorteio filtrado não ficar vazio.
    expect(CLAREZA_CHARACTER_VARIATIONS.some((v) => !variationHasFaceNotDominant(v))).toBe(true);
  });
});

// ── Bloco do contrato ────────────────────────────────────────────────────────

describe("buildMixContratoBlock", () => {
  it("lista os três elementos do mix avatar + cenário + produto", () => {
    const bloco = buildMixContratoBlock({ avatar: true, cenario: true, produtosCount: 1 });
    expect(bloco).toContain("CONTRATO DO MIX");
    expect(bloco).toContain("ROSTO VISÍVEL");
    expect(bloco).toContain("AMBIENTE DO CENÁRIO");
    expect(bloco).toContain("O PRODUTO referenciado");
    expect(bloco).toContain("3 referências");
    expect(bloco).toContain("missing person");
  });

  it("não emite contrato com um único elemento (não é mix)", () => {
    expect(buildMixContratoBlock({ avatar: true })).toBe("");
    expect(buildMixContratoBlock({ produtosCount: 1 })).toBe("");
    expect(buildMixContratoBlock({})).toBe("");
  });

  it("pluraliza a contagem de produtos", () => {
    const bloco = buildMixContratoBlock({ cenario: true, produtosCount: 3 });
    expect(bloco).toContain("OS 3 PRODUTOS referenciados");
    // Sem avatar, não promete pessoa nenhuma.
    expect(bloco).not.toContain("ROSTO VISÍVEL");
    expect(bloco).not.toContain("missing person");
  });
});

// ── Enquadramento: produto-herói solta a trava de plano médio do CLAREZA ─────

describe("buildMoodGrammarBlock — produtoHero em CLAREZA", () => {
  it("sem produto, mantém a trava de plano médio", () => {
    const bloco = buildMoodGrammarBlock("OP-01");
    expect(bloco).toContain("PLANO MÉDIO EM CLAREZA — OBRIGATÓRIO");
  });

  it("com produto-herói, troca a trava pela regra que libera a aproximação", () => {
    const bloco = buildMoodGrammarBlock("OP-01", { produtoHero: true });
    expect(bloco).not.toContain("PLANO MÉDIO EM CLAREZA — OBRIGATÓRIO");
    expect(bloco).toContain("ENQUADRAMENTO EM CLAREZA COM PRODUTO-HERÓI");
    // A parte que NÃO pode cair junto: rosto inteiro no quadro.
    expect(bloco).toContain("INTEIRAMENTE dentro do quadro");
  });

  it("não altera os outros moods", () => {
    const bloco = buildMoodGrammarBlock("OP-02", { produtoHero: true });
    expect(bloco).not.toContain("ENQUADRAMENTO EM CLAREZA COM PRODUTO-HERÓI");
  });
});

// ── Detecção de atividade de moda ────────────────────────────────────────────

describe("isApparelActivity", () => {
  it("reconhece atividades de moda, calçados e confecção", () => {
    expect(isApparelActivity("Moda feminina multimarca e masculina, calçados")).toBe(true);
    expect(isApparelActivity("Loja de roupas infantis")).toBe(true);
    expect(isApparelActivity("Confecção e malharia")).toBe(true);
    expect(isApparelActivity("Boutique de lingerie")).toBe(true);
    expect(isApparelActivity("Sapataria")).toBe(true);
    expect(isApparelActivity("Brechó")).toBe(true);
  });

  it("não confunde 'moda' dentro de outras palavras", () => {
    expect(isApparelActivity("Academia com várias modalidades esportivas")).toBe(false);
    expect(isApparelActivity("Pousada com acomodações familiares")).toBe(false);
    expect(isApparelActivity("Assessoria para tenistas profissionais")).toBe(false);
    expect(isApparelActivity("Consultoria de negócios")).toBe(false);
    expect(isApparelActivity(undefined)).toBe(false);
  });
});

// ── Prompt completo: o caso real da Atrevidinha ──────────────────────────────

const kitVarejoModa: BrandKit = {
  companyName: "Atrevidinha Modas",
  segment: "VAREJO",
  logoHasName: true,
  primaryColor: "#59461d",
  secondaryColor: "#d9cca9",
  fontPair: "Inter",
  brandVoice: "convidativa",
  mainActivity: "Moda feminina multimarca e masculina, calçados",
};

const dataModa: PostUnicoFormData = {
  companyName: "Atrevidinha Modas",
  mainActivity: "Moda feminina multimarca e masculina, calçados",
  audience: "B2C",
  keyInfo: "Camiseta Colcci a partir de R$ 134,00.",
  objetivo: "promocao",
  direcao: "mood",
  mood: "OP-01",
  faixaEtaria: "35-49",
};

const refsMix: PostUnicoReferences = {
  avatar: "https://img/avatar.jpg",
  cenario: "https://img/cenario.jpg",
  produtos: [{ num: 1, dataUrl: "https://img/prod1.jpg" }],
};

function promptModa() {
  return buildPostUnicoPrompt({
    data: dataModa,
    kit: kitVarejoModa,
    copy: {
      titulo: "CAMISETAS COLCCI COM PREÇOS ESPECIAIS",
      texto: "Estilo marcante de manhã à noite.",
    },
    references: refsMix,
    forcedGender: "mulher",
  });
}

describe("PU — mix avatar + cenário + produto em VAREJO de moda", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("declara o contrato dos três elementos", () => {
    const p = promptModa();
    expect(p).toContain("CONTRATO DO MIX");
    expect(p).toContain("ROSTO VISÍVEL");
    expect(p).toContain("AMBIENTE DO CENÁRIO");
  });

  it("nunca autoriza a cena sem pessoa quando há avatar selecionado", () => {
    // 50 prompts com Math.random real — nenhuma geração pode sortear a variação
    // que retira o rosto, nem emitir a reconciliação de "nenhuma pessoa visível".
    vi.restoreAllMocks();
    for (let i = 0; i < 50; i++) {
      const p = promptModa();
      expect(p).not.toContain("DETALHE CONTEXTUAL");
      expect(p).not.toContain("ou nenhuma pessoa visível");
    }
  });

  it("o repertório de pose do avatar não oferece mais enquadramento sem rosto", () => {
    const p = promptModa();
    // A própria instrução do AVATAR (bloco de prioridade máxima) listava
    // "OU peça sem rosto visível" como opção válida — contradizendo o contrato.
    expect(p).toContain("mas o ROSTO SEMPRE APARECE");
    expect(p).toContain("PROIBIDO resolver o enquadramento sem rosto visível");
  });

  it("expõe a peça de roupa em vez de vesti-la no personagem", () => {
    const p = promptModa();
    expect(p).toContain("PRODUTO DE VESTUÁRIO — EXPOSTO, NÃO VESTIDO");
    expect(p).toContain("VESTUÁRIO DO AVATAR");
    expect(p).toContain("product worn by the model");
  });

  it("libera a câmera para aproximar do produto sem cortar o rosto", () => {
    const p = promptModa();
    expect(p).toContain("ENQUADRAMENTO EM CLAREZA COM PRODUTO-HERÓI");
    expect(p).not.toContain("PLANO MÉDIO EM CLAREZA — OBRIGATÓRIO");
  });

  it("mantém a regra de protagonismo do produto (VAREJO)", () => {
    const p = promptModa();
    expect(p).toContain("REGRA DE PROTAGONISMO DO PRODUTO");
  });
});

describe("PU — VAREJO sem moda não recebe a regra de vestuário", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loja de ferramentas mantém o figurino sorteado normal", () => {
    const p = buildPostUnicoPrompt({
      data: { ...dataModa, mainActivity: "Loja de ferramentas e materiais de construção" },
      kit: { ...kitVarejoModa, mainActivity: "Loja de ferramentas e materiais de construção" },
      copy: { titulo: "FURADEIRA EM OFERTA", texto: "Só nesta semana." },
      references: refsMix,
      forcedGender: "homem",
    });
    expect(p).not.toContain("PRODUTO DE VESTUÁRIO");
    expect(p).toContain("VESTUÁRIO:");
    // O contrato do mix continua valendo — ele não depende do ramo de moda.
    expect(p).toContain("CONTRATO DO MIX");
  });
});
