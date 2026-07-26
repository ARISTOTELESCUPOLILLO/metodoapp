import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildPostUnicoPrompt } from "../services/buildPuPrompt";
import { buildReferences } from "../services/regenerateWithKit";
import type { BrandKit, ImageKit, PostUnicoFormData, Segment } from "../types";
import type { PostUnicoReferences } from "../shared/visual/references";

// Sorteios (arquétipo, paleta, câmera, vestuário) usam Math.random — fixado
// para tornar as asserções determinísticas.
beforeEach(() => {
  vi.spyOn(Math, "random").mockReturnValue(0);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const kitBase: BrandKit = {
  companyName: "Empresa Teste",
  segment: "SERVIÇOS",
  logoHasName: true,
  primaryColor: "#123a63",
  secondaryColor: "#e2e8f0",
  fontPair: "Inter",
  brandVoice: "profissional e acessível",
  mainActivity: "Consultoria de negócios",
};

const dataBase: PostUnicoFormData = {
  companyName: "Empresa Teste",
  mainActivity: "Consultoria de negócios",
  audience: "B2C",
  keyInfo: "Atendimento com hora marcada",
  objetivo: "institucional",
  direcao: "livre",
  faixaEtaria: "35-49",
};

const imageKit: ImageKit = {
  avatar: "https://img/avatar1.jpg",
  fachada: "https://img/fachada.jpg",
  cenarios: ["https://img/cenario1.jpg", null],
  produtos: ["https://img/prod1.jpg", "https://img/prod2.jpg", null, null, null, null, null, null],
};

function prompt(opts: {
  refs?: PostUnicoReferences;
  segment?: Segment;
  direcao?: PostUnicoFormData["direcao"];
  mood?: PostUnicoFormData["mood"];
  isPersonalBrand?: boolean;
}) {
  return buildPostUnicoPrompt({
    data: { ...dataBase, direcao: opts.direcao ?? "livre", mood: opts.mood },
    kit: { ...kitBase, segment: opts.segment ?? "SERVIÇOS", isPersonalBrand: opts.isPersonalBrand },
    copy: { titulo: "DECIDA HOJE", texto: "Sua consultoria começa agora." },
    references: opts.refs,
    // Gênero sempre chega preenchido do hook (há fallback aleatório) — o teste
    // reproduz esse cenário de propósito: é o que fazia a peça sair com pessoa.
    forcedGender: opts.refs?.semPersonagemAtivo ? undefined : "mulher",
  });
}

// ── buildReferences ──────────────────────────────────────────────────────────

describe("buildReferences — semPersonagem", () => {
  it("liga semPersonagemAtivo e mantém cenário, fachada e produtos", () => {
    const refs = buildReferences("avatar", imageKit, undefined, undefined, {
      usarAvatar: false,
      usarFachada: true,
      cenarioNum: 1,
      produtosNums: [1, 2],
      semPersonagem: true,
    });
    expect(refs.semPersonagemAtivo).toBe(true);
    expect(refs.fachada).toBe("https://img/fachada.jpg");
    expect(refs.cenario).toBe("https://img/cenario1.jpg");
    expect(refs.produtos).toHaveLength(2);
  });

  it("descarta avatar, uniforme e personagem sem avatar mesmo se vierem marcados", () => {
    const refs = buildReferences(
      "avatar",
      imageKit,
      undefined,
      undefined,
      {
        usarAvatar: true,
        useUniforme: true,
        personagemSemAvatar: { ativo: true, genero: "homem", idade: "30–40 anos" },
        semPersonagem: true,
      },
      "https://img/uniforme.jpg",
    );
    expect(refs.semPersonagemAtivo).toBe(true);
    expect(refs.avatar).toBeUndefined();
    expect(refs.uniforme).toBeUndefined();
    expect(refs.personagemSemAvatarAtivo).toBeUndefined();
  });

  it("sem o flag, o comportamento atual é preservado", () => {
    const refs = buildReferences("avatar", imageKit, undefined, undefined, {
      usarAvatar: true,
      produtosNums: [1],
    });
    expect(refs.semPersonagemAtivo).toBeUndefined();
    expect(refs.avatar).toBe("https://img/avatar1.jpg");
  });
});

// ── Prompt: o que deixa de ser afirmado ──────────────────────────────────────

describe("buildPostUnicoPrompt — semPersonagem desliga as afirmações de pessoa", () => {
  const refsSemPersonagem: PostUnicoReferences = {
    semPersonagemAtivo: true,
    cenario: "https://img/cenario1.jpg",
    produtos: [{ num: 1, dataUrl: "https://img/prod1.jpg" }],
  };

  it("não declara gênero obrigatório em Direção Livre", () => {
    const p = prompt({ refs: refsSemPersonagem });
    expect(p).not.toContain("GÊNERO OBRIGATÓRIO");
    expect(p).not.toContain("a pessoa retratada DEVE ser");
  });

  it("não declara gênero obrigatório em nenhum dos 6 moods", () => {
    for (const mood of ["OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06"] as const) {
      const p = prompt({ refs: refsSemPersonagem, direcao: "mood", mood });
      expect(p, `mood ${mood}`).not.toContain("GÊNERO OBRIGATÓRIO");
      expect(p, `mood ${mood}`).not.toContain("a pessoa retratada DEVE ser");
      expect(p, `mood ${mood}`).toContain("PEÇA SEM PERSONAGEM");
      expect(p, `mood ${mood}`).toContain("ESTRUTURA SEM PERSONAGEM");
    }
  });

  it("cenário não pede mais personagem dentro do espaço", () => {
    const p = prompt({ refs: refsSemPersonagem });
    expect(p).not.toContain("Adicione personagem e ação dentro deste espaço real");
    expect(p).toContain("O espaço aparece SEM PESSOAS");
  });

  it("fachada não oferece mais a alternativa 'pessoa ou produto'", () => {
    const p = prompt({ refs: { semPersonagemAtivo: true, fachada: "https://img/fachada.jpg" } });
    expect(p).not.toContain("A pessoa ou produto deve aparecer à frente");
    expect(p).toContain("sem qualquer pessoa em quadro");
  });

  it("sem nenhuma referência do Kit, não entra o personagem-padrão do público-alvo", () => {
    const p = prompt({ refs: { semPersonagemAtivo: true } });
    expect(p).not.toContain("PERSONAGEM-PADRÃO DA CENA");
    expect(p).toContain("PEÇA SEM PERSONAGEM");
    // A trava anti-metáfora continua ativa (não depende de personagem).
    expect(p).toContain("TRAVA ANTI-LITERALIDADE");
  });

  it("injeta a regra no corpo e o reforço na última linha", () => {
    const p = prompt({ refs: refsSemPersonagem });
    expect(p).toContain("REGRA INVIOLÁVEL DE PRECEDÊNCIA MÁXIMA");
    expect(p.trimEnd().endsWith("person cropped at frame edge.")).toBe(true);
  });

  it("declara o sujeito conforme o que foi marcado", () => {
    expect(prompt({ refs: refsSemPersonagem })).toContain(
      "o(s) PRODUTO(S) enviados como referência",
    );
    expect(prompt({ refs: { semPersonagemAtivo: true, cenario: "c" } })).toContain(
      "o AMBIENTE do cenário enviado como referência",
    );
    expect(prompt({ refs: { semPersonagemAtivo: true, fachada: "f" } })).toContain(
      "a FACHADA enviada como referência",
    );
    expect(prompt({ refs: { semPersonagemAtivo: true } })).toContain("do ofício REAL da empresa");
  });
});

// ── Prompt: hierarquia por segmento ──────────────────────────────────────────

describe("buildPostUnicoPrompt — sujeito por segmento sem personagem", () => {
  const refsProduto: PostUnicoReferences = {
    semPersonagemAtivo: true,
    produtos: [{ num: 1, dataUrl: "https://img/prod1.jpg" }],
  };

  it("SERVIÇOS: produto vira sujeito, sem apontar protagonismo para o personagem", () => {
    const p = prompt({ refs: refsProduto, segment: "SERVIÇOS" });
    expect(p).toContain("SUJEITO DA COMPOSIÇÃO — PRODUTO, SEM PERSONAGEM");
    expect(p).not.toContain("O PERSONAGEM é quem ocupa esse papel");
  });

  it("MARCA: não pede mais equilíbrio 50/50 com o personagem", () => {
    const p = prompt({ refs: refsProduto, segment: "MARCA" });
    expect(p).toContain("SUJEITO DA COMPOSIÇÃO — PRODUTO, SEM PERSONAGEM");
    expect(p).not.toContain("PESO VISUAL IGUAL, MEIO A MEIO");
  });

  it("MARCA pessoal: também troca a regra de personagem-protagonista", () => {
    const p = prompt({ refs: refsProduto, segment: "MARCA", isPersonalBrand: true });
    expect(p).toContain("SUJEITO DA COMPOSIÇÃO — PRODUTO, SEM PERSONAGEM");
    expect(p).not.toContain("a pessoa É a marca");
  });

  it("VAREJO: mantém a regra de produto-herói já existente", () => {
    const p = prompt({ refs: refsProduto, segment: "VAREJO" });
    expect(p).toContain("REGRA DE PROTAGONISMO DO PRODUTO");
  });
});

// ── Regressão: sem o flag, nada muda ─────────────────────────────────────────

describe("buildPostUnicoPrompt — sem o flag, comportamento preservado", () => {
  it("continua declarando gênero e pedindo personagem no cenário", () => {
    const p = prompt({ refs: { cenario: "https://img/cenario1.jpg" } });
    expect(p).toContain("GÊNERO OBRIGATÓRIO");
    expect(p).toContain("Adicione personagem e ação dentro deste espaço real");
    expect(p).not.toContain("PEÇA SEM PERSONAGEM");
  });

  it("sem referências, mantém o personagem-padrão do público-alvo", () => {
    const p = prompt({});
    expect(p).toContain("PERSONAGEM-PADRÃO DA CENA");
    expect(p).not.toContain("PEÇA SEM PERSONAGEM");
  });
});
