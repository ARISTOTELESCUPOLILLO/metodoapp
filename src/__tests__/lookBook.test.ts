// Modo LOOK BOOK — o personagem VESTE o produto, em pose e enquadramento de
// modelo, com o tipo da peça definindo o que não pode ser cortado fora do
// quadro. Pedido do Ari em 06/08/2026, como alternativa ao modo padrão (peça
// exposta ao lado), que continua sendo o default.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildReferences } from "../services/regenerateWithKit";
import { buildPostUnicoPrompt } from "../services/buildPuPrompt";
import { buildLookVariationBlock, TIPO_PECA_LABEL } from "../core/lookBook";
import { buildProductHierarchyBlock } from "../core/productHierarchy";
import { buildMoodGrammarBlock } from "../core/visualDirection";
import type { BrandKit, ImageKit, PostUnicoFormData, TipoPecaVestuario } from "../types";
import type { PostUnicoReferences } from "../shared/visual/references";

const imageKit: ImageKit = {
  avatar: "https://img/avatar.jpg",
  fachada: "https://img/fachada.jpg",
  cenarios: ["https://img/cenario1.jpg", null],
  produtos: ["https://img/camiseta.jpg", null, null, null, null, null, null, null],
};

// ── buildReferences: o modo só existe quando há produto E quem vista ─────────

describe("buildReferences — produtoVestido", () => {
  it("liga o modo com produto + avatar", () => {
    const refs = buildReferences("avatar", imageKit, undefined, undefined, {
      usarAvatar: true,
      produtosNums: [1],
      produtoVestido: "cima",
    });
    expect(refs.produtoVestido).toBe("cima");
  });

  it("liga o modo com produto + personagem sem avatar", () => {
    const refs = buildReferences("avatar", imageKit, undefined, undefined, {
      usarAvatar: false,
      produtosNums: [1],
      personagemSemAvatar: { ativo: true, genero: "mulher", idade: "25–35 anos" },
      produtoVestido: "look",
    });
    expect(refs.produtoVestido).toBe("look");
    expect(refs.personagemSemAvatarAtivo).toBe(true);
  });

  it("ignora o modo sem ninguém para vestir a peça", () => {
    const semNinguem = buildReferences("avatar", imageKit, undefined, undefined, {
      usarAvatar: false,
      produtosNums: [1],
      produtoVestido: "cima",
    });
    expect(semNinguem.produtoVestido).toBeUndefined();

    const semPersonagem = buildReferences("avatar", imageKit, undefined, undefined, {
      usarAvatar: true,
      produtosNums: [1],
      semPersonagem: true,
      produtoVestido: "cima",
    });
    expect(semPersonagem.produtoVestido).toBeUndefined();
  });

  it("ignora o modo sem produto selecionado", () => {
    const refs = buildReferences("avatar", imageKit, undefined, undefined, {
      usarAvatar: true,
      produtosNums: [],
      produtoVestido: "cima",
    });
    expect(refs.produtoVestido).toBeUndefined();
  });

  it("não veste uniforme e peça ao mesmo tempo — o produto ganha o corpo", () => {
    const refs = buildReferences(
      "avatar",
      imageKit,
      undefined,
      undefined,
      { usarAvatar: true, produtosNums: [1], useUniforme: true, produtoVestido: "cima" },
      "https://img/uniforme.jpg",
    );
    expect(refs.produtoVestido).toBe("cima");
    expect(refs.uniforme).toBeUndefined();
  });
});

// ── Enquadramento por tipo de peça ──────────────────────────────────────────

describe("buildLookVariationBlock — enquadramento por tipo", () => {
  it("parte de cima: plano médio com rosto no quadro", () => {
    const b = buildLookVariationBlock("cima");
    expect(b).toContain("PLANO MÉDIO/AMERICANO");
    expect(b).toContain("ROSTO fica inteiramente visível");
  });

  it("look inteiro: corpo inteiro obrigatório, plano médio proibido", () => {
    const b = buildLookVariationBlock("look");
    expect(b).toContain("CORPO INTEIRO, DOS PÉS AO TOPO DA CABEÇA");
    expect(b).toContain("PROIBIDO plano médio");
  });

  it("calçado: os dois pés inteiros dentro do quadro", () => {
    const b = buildLookVariationBlock("calcado");
    expect(b).toContain("PÉS EM EVIDÊNCIA");
    expect(b).toContain("DOIS pés calçados ficam INTEIRAMENTE dentro do quadro");
    expect(b).toContain("PROIBIDO cortar a imagem acima dos tornozelos");
  });

  it("parte de baixo: peça inteira até a barra, sem cortar a cabeça", () => {
    const b = buildLookVariationBlock("baixo");
    expect(b).toContain("CORPO INTEIRO OU TRÊS-QUARTOS BAIXO");
    expect(b).toContain("cortando a cabeça");
  });

  it("todos os tipos declaram pose de modelo e devolvem a luz ao mood", () => {
    (Object.keys(TIPO_PECA_LABEL) as TipoPecaVestuario[]).forEach((t) => {
      const b = buildLookVariationBlock(t);
      expect(b).toContain("PEÇA DE MODA COM MODELO");
      expect(b).toContain("POSE DESTA GERAÇÃO");
      expect(b).toContain("luz, paleta, clima e detalhe criativo continuam sendo os do mood");
    });
  });

  it("a pose varia entre gerações (não repete a mesma no 'gerar outra')", () => {
    const poses = new Set(Array.from({ length: 80 }, () => buildLookVariationBlock("cima")));
    expect(poses.size).toBeGreaterThan(1);
  });
});

// ── Hierarquia: pessoa e produto deixam de competir ─────────────────────────

describe("buildProductHierarchyBlock — modo vestido", () => {
  it("substitui a regra de apresentação pela de suporte, nos três segmentos", () => {
    (["VAREJO", "SERVIÇOS", "MARCA"] as const).forEach((segment) => {
      const b = buildProductHierarchyBlock({
        produtosCount: 1,
        hasCenario: true,
        hasAvatar: true,
        segment,
        produtoVestido: true,
      });
      expect(b).toContain("MODO LOOK BOOK");
      expect(b).toContain("MODELO vs PRODUTO");
      // A frase do modo padrão que se tornaria contraditória com a peça vestida.
      expect(b).not.toContain("PROIBIDO o corpo da pessoa cobrir a maior parte do produto");
      // Duplicar a peça (vestida + exposta) é o erro típico deste modo.
      expect(b).toContain("nunca vestida E exposta");
    });
  });

  it("sem o modo, a regra padrão do segmento continua intacta", () => {
    const b = buildProductHierarchyBlock({
      produtosCount: 1,
      hasCenario: true,
      hasAvatar: true,
      segment: "VAREJO",
    });
    expect(b).toContain("PROIBIDO o corpo da pessoa cobrir a maior parte do produto");
    expect(b).not.toContain("MODO LOOK BOOK");
  });
});

// ── Prompt completo ─────────────────────────────────────────────────────────

const kitModa: BrandKit = {
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

function prompt(refs: PostUnicoReferences) {
  return buildPostUnicoPrompt({
    data: dataModa,
    kit: kitModa,
    copy: { titulo: "CAMISETAS COLCCI", texto: "Estilo marcante de manhã à noite." },
    references: refs,
    forcedGender: "mulher",
  });
}

const refsLook: PostUnicoReferences = {
  avatar: "https://img/avatar.jpg",
  cenario: "https://img/cenario.jpg",
  produtos: [{ num: 1, dataUrl: "https://img/camiseta.jpg" }],
  produtoVestido: "cima",
};

// ── Reconciliação com a gramática de cada mood ──────────────────────────────
// Cada mood traz na REGRA INEGOCIÁVEL uma instrução de câmera, pose ou escala
// que contradiz a pose de modelo. Contradição no mesmo prompt é a classe de bug
// que fez o avatar sumir em 06/08 — o modelo escolhe um lado por conta própria.

describe("buildMoodGrammarBlock — look book × mood", () => {
  it("IMPACTO: solta a exigência de contra-plongée, mantém luz e paleta do mood", () => {
    const semLook = buildMoodGrammarBlock("OP-02");
    expect(semLook).toContain("OBRIGATÓRIO contra-plongée leve");

    const comLook = buildMoodGrammarBlock("OP-02", { lookBook: true });
    expect(comLook).not.toContain("CÂMERA EM IMPACTO: OBRIGATÓRIO contra-plongée leve");
    expect(comLook).toContain("LOOK BOOK NESTA PEÇA");
    expect(comLook).toContain("luz focal direcional");
  });

  it("INSTANTE: permite a pose, exigindo pose em movimento em vez de rigidez", () => {
    const semLook = buildMoodGrammarBlock("OP-03");
    expect(semLook).toContain("NUNCA olha para câmera com pose intencional");

    const comLook = buildMoodGrammarBlock("OP-03", { lookBook: true });
    expect(comLook).not.toContain("NUNCA olha para câmera com pose intencional");
    expect(comLook).toContain("a modelo POSA");
    expect(comLook).toContain("pose em movimento");
  });

  it("FRAGMENTO: mantém os blocos, com a modelo no bloco principal", () => {
    const comLook = buildMoodGrammarBlock("OP-04", { lookBook: true });
    expect(comLook).toContain("BLOCO PRINCIPAL");
    expect(comLook).toContain("DETALHES DA MESMA PEÇA");
    expect(comLook).toContain("PROIBIDO fragmentar a modelo em blocos que a cortem");
  });

  it("DESVIO: tira a distorção de perspectiva, mantém a ruptura simbólica", () => {
    const semLook = buildMoodGrammarBlock("OP-05");
    expect(semLook).toContain("PROIBIDO câmera frontal neutra em qualquer hipótese");

    const comLook = buildMoodGrammarBlock("OP-05", { lookBook: true });
    expect(comLook).not.toContain("PROIBIDO câmera frontal neutra em qualquer hipótese");
    expect(comLook).toContain("RUPTURA SIMBÓLICA");
    expect(comLook).toContain("nunca por deformar a modelo");
  });

  it("SILÊNCIO: suspende o limite de 30% e o fragmento parcial, mantém a chave clara", () => {
    const semLook = buildMoodGrammarBlock("OP-06");
    expect(semLook).toContain("NO MÁXIMO 30% da área total");
    expect(semLook).toContain("fragmento parcial APENAS");

    const comLook = buildMoodGrammarBlock("OP-06", { lookBook: true });
    expect(comLook).not.toContain("NO MÁXIMO 30% da área total");
    expect(comLook).not.toContain("fragmento parcial APENAS");
    expect(comLook).toContain("a modelo aparece INTEIRA");
    expect(comLook).toContain("luz alta-chave");
  });

  it("a linha de câmera da gramática cede ao look book em todos os moods", () => {
    (["OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06"] as const).forEach((m) => {
      const b = buildMoodGrammarBlock(m, { lookBook: true });
      expect(b, `mood ${m}`).toContain("Atitude da câmera: definida pelo LOOK BOOK");
      // Luz e paleta do mood continuam inteiras — o look book não sequestra a
      // fotografia, só pose/câmera/enquadramento.
      expect(b, `mood ${m}`).toContain("- Luz:");
      expect(b, `mood ${m}`).toContain("- Paleta:");
    });
  });

  it("sem look book, a gramática de todos os moods fica intacta", () => {
    (["OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06"] as const).forEach((m) => {
      const b = buildMoodGrammarBlock(m);
      expect(b, `mood ${m}`).not.toContain("LOOK BOOK");
    });
  });
});

describe("PU — prompt no modo look book", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("veste a peça e não manda expô-la ao lado", () => {
    const p = prompt(refsLook);
    expect(p).toContain("PRODUTO VESTIDO PELA MODELO");
    expect(p).not.toContain("PRODUTO DE VESTUÁRIO — EXPOSTO, NÃO VESTIDO");
  });

  it("não sorteia figurino — quem define a roupa é o produto", () => {
    const p = prompt(refsLook);
    expect(p).toContain("VESTUÁRIO: definido pelo PRODUTO");
    expect(p).not.toContain("VESTUÁRIO DO AVATAR: Roupa");
  });

  it("troca a estrutura de cena sorteada pela pose de modelo", () => {
    const p = prompt(refsLook);
    expect(p).toContain("PEÇA DE MODA COM MODELO");
    // As estruturas do CLAREZA, que falam de gesto de ofício e bancada.
    expect(p).not.toContain("Estrutura: EM PÉ");
    expect(p).not.toContain("DETALHE CONTEXTUAL");
  });

  it("exige fidelidade item por item da peça vestida", () => {
    const p = prompt(refsLook);
    expect(p).toContain("FIDELIDADE À FOTO DE REFERÊNCIA");
    expect(p).toContain("mesma ESTAMPA");
    expect(p).toContain("NEGATIVE: different garment");
  });

  it("o contrato do mix descreve a peça vestida, não um objeto à parte", () => {
    const p = prompt(refsLook);
    expect(p).toContain("CONTRATO DO MIX");
    expect(p).toContain("A PEÇA REFERENCIADA, VESTIDA");
    expect(p).toContain("Não existe uma segunda unidade da peça exposta em cena");
  });

  it("libera o enquadramento do CLAREZA para o produto vestido", () => {
    const p = prompt(refsLook);
    // A regra de rosto inteiro do CLAREZA (era "trava de plano médio" até
    // 12/08/2026) cede à do produto-herói, que também garante o rosto.
    expect(p).not.toContain("ROSTO INTEIRO EM CLAREZA — INEGOCIÁVEL");
    expect(p).toContain("ENQUADRAMENTO EM CLAREZA COM PRODUTO-HERÓI");
  });

  it("calçado leva o enquadramento aos pés, mantendo o rosto", () => {
    const p = prompt({ ...refsLook, produtoVestido: "calcado" });
    expect(p).toContain("DOIS pés calçados ficam INTEIRAMENTE dentro do quadro");
    expect(p).toContain("O ROSTO permanece visível");
  });

  it("look inteiro pede corpo inteiro", () => {
    const p = prompt({ ...refsLook, produtoVestido: "look" });
    expect(p).toContain("CORPO INTEIRO, DOS PÉS AO TOPO DA CABEÇA");
  });

  it("vale em todos os 6 moods, não só em CLAREZA", () => {
    (["OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06"] as const).forEach((m) => {
      const p = buildPostUnicoPrompt({
        data: { ...dataModa, mood: m },
        kit: kitModa,
        copy: { titulo: "CAMISETAS COLCCI", texto: "Estilo marcante." },
        references: refsLook,
        forcedGender: "mulher",
      });
      expect(p, `mood ${m}`).toContain("PEÇA DE MODA COM MODELO");
      expect(p, `mood ${m}`).toContain("PRODUTO VESTIDO PELA MODELO");
      expect(p, `mood ${m}`).toContain("PLANO MÉDIO/AMERICANO");
    });
  });

  it("vale também na Direção Livre", () => {
    const p = buildPostUnicoPrompt({
      data: { ...dataModa, direcao: "livre", mood: undefined },
      kit: kitModa,
      copy: { titulo: "CAMISETAS COLCCI", texto: "Estilo marcante." },
      references: refsLook,
      forcedGender: "mulher",
    });
    expect(p).toContain("PEÇA DE MODA COM MODELO");
    expect(p).toContain("PRODUTO VESTIDO PELA MODELO");
  });

  it("sem o modo, o padrão de peça exposta continua valendo", () => {
    const { produtoVestido: _ignorado, ...refsPadrao } = refsLook;
    const p = prompt(refsPadrao);
    expect(p).toContain("PRODUTO DE VESTUÁRIO — EXPOSTO, NÃO VESTIDO");
    expect(p).not.toContain("PRODUTO VESTIDO PELA MODELO");
    expect(p).not.toContain("PEÇA DE MODA COM MODELO");
  });
});

// ── Modo CATÁLOGO: look book sem nenhum texto na imagem ─────────────────────
// Pedido do Ari em 06/08/2026, ao ver a primeira peça do look book: o uso real
// é a loja mandar ao cliente as roupas disponíveis, vestidas, para dar vontade
// de comprar. Nesse uso título e texto atrapalham — fica só a logomarca.

describe("buildReferences — catálogo depende do look book", () => {
  it("liga junto com a peça vestida", () => {
    const refs = buildReferences("avatar", imageKit, undefined, undefined, {
      usarAvatar: true,
      produtosNums: [1],
      produtoVestido: "look",
      lookCatalogo: true,
    });
    expect(refs.produtoVestido).toBe("look");
    expect(refs.lookCatalogo).toBe(true);
  });

  it("cai junto quando o look book não se aplica — nunca gera peça muda sozinho", () => {
    const semNinguem = buildReferences("avatar", imageKit, undefined, undefined, {
      usarAvatar: false,
      produtosNums: [1],
      produtoVestido: "cima",
      lookCatalogo: true,
    });
    expect(semNinguem.lookCatalogo).toBeUndefined();

    const semProduto = buildReferences("avatar", imageKit, undefined, undefined, {
      usarAvatar: true,
      produtosNums: [],
      produtoVestido: "cima",
      lookCatalogo: true,
    });
    expect(semProduto.lookCatalogo).toBeUndefined();
  });

  it("look book sem catálogo continua com texto — o catálogo é opcional", () => {
    const refs = buildReferences("avatar", imageKit, undefined, undefined, {
      usarAvatar: true,
      produtosNums: [1],
      produtoVestido: "cima",
    });
    expect(refs.produtoVestido).toBe("cima");
    expect(refs.lookCatalogo).toBeUndefined();
  });
});

describe("buildLookVariationBlock — pose de catálogo", () => {
  it("nunca encosta a modelo numa parede (a reclamação que originou o modo)", () => {
    const blocos = Array.from({ length: 200 }, () => buildLookVariationBlock("cima", true));
    expect(blocos.some((b) => b.includes("encostada de lado numa parede"))).toBe(false);
    expect(blocos.some((b) => b.includes("de perfil ou quase"))).toBe(false);
  });

  it("sem catálogo, o repertório completo de campanha continua disponível", () => {
    const blocos = Array.from({ length: 200 }, () => buildLookVariationBlock("cima"));
    expect(blocos.some((b) => b.includes("encostada de lado numa parede"))).toBe(true);
  });

  it("ainda varia a pose entre gerações, mesmo com o pool reduzido", () => {
    const poses = new Set(Array.from({ length: 80 }, () => buildLookVariationBlock("look", true)));
    expect(poses.size).toBeGreaterThan(1);
  });

  it("centraliza a modelo e explica que não há texto ocupando o quadro", () => {
    const b = buildLookVariationBlock("look", true);
    expect(b).toContain("COMPOSIÇÃO CENTRADA");
    expect(b).toContain("NÃO existe título nem bloco de texto");
    expect(b).toContain("PROIBIDO empurrar a figura para uma das laterais");
  });

  it("sem catálogo não centraliza — campanha editorial pode ser assimétrica", () => {
    const b = buildLookVariationBlock("look");
    expect(b).not.toContain("COMPOSIÇÃO CENTRADA");
  });

  it("o enquadramento por tipo continua valendo dentro do catálogo", () => {
    expect(buildLookVariationBlock("calcado", true)).toContain("PÉS EM EVIDÊNCIA");
    expect(buildLookVariationBlock("look", true)).toContain("CORPO INTEIRO, DOS PÉS AO TOPO");
  });
});

describe("PU — prompt no modo catálogo", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const refsCatalogo: PostUnicoReferences = { ...refsLook, lookCatalogo: true };

  it("proíbe qualquer texto e não manda escrever título nem texto de apoio", () => {
    const p = prompt(refsCatalogo);
    expect(p).toContain("PEÇA DE CATÁLOGO — ZERO TEXTO NA IMAGEM");
    expect(p).not.toContain("TÍTULO E TEXTO OBRIGATÓRIOS");
    expect(p).not.toContain("A peça DEVE ter lettering");
    expect(p).not.toContain("texto é SEMPRE obrigatório");
  });

  it("não vaza o título/texto gerados — a copy existe no app, não na imagem", () => {
    const p = prompt(refsCatalogo);
    expect(p).not.toContain("CAMISETAS COLCCI");
    expect(p).not.toContain("Estilo marcante de manhã à noite.");
  });

  it("desliga a tipografia — instruir fonte afirmaria que existe texto", () => {
    const p = prompt(refsCatalogo);
    expect(p).not.toContain("Hierarquia tipográfica");
    expect(p).not.toContain("MARGEM DE 110 PX para título e texto de apoio");
    expect(p).not.toContain("A imagem contém apenas o TÍTULO e o TEXTO DE APOIO");
  });

  it("repete a proibição na ÚLTIMA linha do prompt (onde ela pesa mais)", () => {
    const p = prompt(refsCatalogo);
    expect(p.trimEnd().endsWith("refaça a composição sem ele.")).toBe(true);
    expect(p).toContain("ÚLTIMA VERIFICAÇÃO — PEÇA DE CATÁLOGO");
  });

  it("protege a área da logomarca conforme a posição escolhida no Kit", () => {
    const baixo = buildPostUnicoPrompt({
      data: dataModa,
      kit: { ...kitModa, logoPosition: "bottom-center" },
      references: { ...refsCatalogo, produtoVestido: "look" },
      forcedGender: "mulher",
    });
    expect(baixo).toContain("termina ACIMA da faixa reservada embaixo");

    const topo = buildPostUnicoPrompt({
      data: dataModa,
      kit: { ...kitModa, logoPosition: "top-center" },
      references: { ...refsCatalogo, produtoVestido: "look" },
      forcedGender: "mulher",
    });
    expect(topo).toContain("TOPO DA CABEÇA da modelo fica ABAIXO da faixa reservada");

    const canto = buildPostUnicoPrompt({
      data: dataModa,
      kit: { ...kitModa, logoPosition: "bottom-right" },
      references: { ...refsCatalogo, produtoVestido: "look" },
      forcedGender: "mulher",
    });
    expect(canto).toContain("canto inferior direito");
  });

  it("continua sendo look book: peça vestida, fiel, sem segunda unidade exposta", () => {
    const p = prompt(refsCatalogo);
    expect(p).toContain("PRODUTO VESTIDO PELA MODELO");
    expect(p).toContain("FIDELIDADE À FOTO DE REFERÊNCIA");
    expect(p).toContain("Não existe uma segunda unidade da peça exposta em cena");
  });

  it("na regeneração não promete manter um título que não existe", () => {
    const p = buildPostUnicoPrompt({
      data: dataModa,
      kit: kitModa,
      references: refsCatalogo,
      forcedGender: "mulher",
      variationHint: true,
    });
    expect(p).toContain("NOVA VERSÃO");
    expect(p).not.toContain("mantendo o MESMO título");
    expect(p).toContain("igualmente sem texto");
  });

  it("vale nos 6 moods e na Direção Livre", () => {
    (["OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06"] as const).forEach((m) => {
      const p = buildPostUnicoPrompt({
        data: { ...dataModa, mood: m },
        kit: kitModa,
        references: refsCatalogo,
        forcedGender: "mulher",
      });
      expect(p, `mood ${m}`).toContain("ZERO TEXTO NA IMAGEM");
      expect(p, `mood ${m}`).toContain("COMPOSIÇÃO CENTRADA");
    });
    const livre = buildPostUnicoPrompt({
      data: { ...dataModa, direcao: "livre", mood: undefined },
      kit: kitModa,
      references: refsCatalogo,
      forcedGender: "mulher",
    });
    expect(livre).toContain("ZERO TEXTO NA IMAGEM");
  });

  it("look book SEM catálogo mantém o texto obrigatório de sempre", () => {
    const p = prompt(refsLook);
    expect(p).not.toContain("ZERO TEXTO NA IMAGEM");
    expect(p).toContain("TÍTULO E TEXTO OBRIGATÓRIOS");
    expect(p).toContain("CAMISETAS COLCCI");
  });
});
