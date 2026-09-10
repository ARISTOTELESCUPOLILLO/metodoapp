import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildPostUnicoPrompt } from "../services/buildPuPrompt";
import { buildReferences } from "../services/regenerateWithKit";
import type { BrandKit, ImageKit, PostUnicoFormData } from "../types";

// CASO REAL — 09 e 10/09/2026, conta admin, Post Unico. O Ari marcou
// "Gerar personagem (sem avatar)" com genero feminino e faixa 50-65, sem nada
// do Kit Imagem marcado (a conta ainda nao tem fachada). As duas pecas sairam
// SEM pessoa nenhuma.
//
// A causa: referencesBlock monta uma lista dos elementos ENVIADOS (avatar,
// uniforme, fachada, cenario, fato, venda, produtos) e desistia com
// `if (!elementos.length) return ""`. O personagem sem avatar nao e uma imagem
// — e uma pessoa inventada do zero — entao nunca entrou nessa lista, e o corte
// levava junto o bloco PERSONAGEM OBRIGATORIO montado logo abaixo. Ele so
// sobrevivia de carona em alguma foto do Kit.
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const kit: BrandKit = {
  companyName: "Oficina de Propaganda",
  segment: "SERVIÇOS",
  logoHasName: true,
  primaryColor: "#0f172a",
  secondaryColor: "#dc2626",
  fontPair: "Inter",
  brandVoice: "profissional e acessível",
  mainActivity: "Consultoria de Marketing Digital",
};

const data: PostUnicoFormData = {
  companyName: "Oficina de Propaganda",
  mainActivity: "Consultoria de Marketing Digital",
  audience: "B2C",
  keyInfo: "Reconhecimento visual imediato ajuda a marca a ser encontrada.",
  objetivo: "oportunidade",
  direcao: "livre",
  faixaEtaria: "50-65",
};

const KIT_VAZIO: ImageKit = {
  cenarios: [null, null],
  produtos: [null, null, null, null, null, null, null, null],
};

const KIT_COM_CENARIO: ImageKit = {
  cenarios: ["https://img/cenario1.jpg", null],
  produtos: [null, null, null, null, null, null, null, null],
};

function refsDoPersonagem(imageKit: ImageKit, comCenario: boolean) {
  return buildReferences("avatar", imageKit, undefined, undefined, {
    usarAvatar: false,
    avatarNum: 1,
    usarFachada: false,
    cenarioNum: comCenario ? 1 : null,
    produtosNums: [],
    useUniforme: false,
    personagemSemAvatar: { ativo: true, genero: "mulher", idade: "50-65 anos" },
    semPersonagem: false,
  } as never);
}

function prompt(imageKit: ImageKit, comCenario: boolean) {
  return buildPostUnicoPrompt({
    data,
    kit,
    copy: {
      titulo: "CRIAÇÃO DE LOGOMARCA: O QUE MUDA",
      texto: "Reconhecimento visual rápido ajuda.",
    },
    references: refsDoPersonagem(imageKit, comCenario),
    forcedGender: "mulher",
    tonalidadeSeed: 3,
  } as never);
}

describe("personagem sem avatar sozinho, sem nenhuma foto do Kit", () => {
  it("a marcacao chega intacta em buildReferences", () => {
    const refs = refsDoPersonagem(KIT_VAZIO, false);
    expect(refs.personagemSemAvatarAtivo).toBe(true);
    expect(refs.personagemIdade).toBe("50-65 anos");
    expect(refs.avatar).toBeUndefined();
  });

  it("o prompt EXIGE o personagem mesmo sem nenhuma imagem enviada", () => {
    const p = prompt(KIT_VAZIO, false);
    expect(p).toContain("PERSONAGEM OBRIGATÓRIO");
    expect(p).toContain("DEVE ter um personagem humano claramente visível");
    expect(p).toContain("aparentando 50-65 anos");
    expect(p).toContain("gênero: mulher");
  });

  it("sem foto, o cabecalho NAO afirma imagem de referencia", () => {
    const p = prompt(KIT_VAZIO, false);
    expect(p).toContain("COMPOSIÇÃO DEFINIDA PELO USUÁRIO — PRIORIDADE MÁXIMA");
    expect(p).toContain("NÃO há imagem de referência nesta peça");
    expect(p).not.toContain("REFERÊNCIA VISUAL ENVIADA");
    // "Elementos enviados" e "INTEGRAÇÃO: combinar os elementos" pressupoem
    // fotos — sem nenhuma, mandariam o modelo procurar o que nao existe.
    expect(p).not.toContain("Elementos enviados:");
    expect(p).not.toContain("INTEGRAÇÃO: combinar os elementos");
  });

  it("com uma foto do Kit, o cabecalho antigo continua igual", () => {
    const p = prompt(KIT_COM_CENARIO, true);
    expect(p).toContain("REFERÊNCIA VISUAL ENVIADA — PRIORIDADE MÁXIMA");
    expect(p).toContain("Elementos enviados:");
    expect(p).toContain("PERSONAGEM OBRIGATÓRIO");
  });
});
