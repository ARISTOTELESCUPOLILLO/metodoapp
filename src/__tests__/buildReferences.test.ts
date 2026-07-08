import { describe, it, expect } from "vitest";
import { buildReferences } from "../services/regenerateWithKit";
import type { ImageKit } from "../types";

// Kit de imagem com todos os slots preenchidos para os testes.
const fullKit: ImageKit = {
  avatar: "https://img/avatar1.jpg",
  avatar2: "https://img/avatar2.jpg",
  fachada: "https://img/fachada.jpg",
  cenarios: ["https://img/cenario1.jpg", "https://img/cenario2.jpg"],
  produtos: [
    "https://img/prod1.jpg",
    "https://img/prod2.jpg",
    "https://img/prod3.jpg",
    null,
    null,
    null,
    null,
    null,
  ],
  fato: "https://img/fato.jpg",
  venda: "https://img/venda.jpg",
};

// Kit com slots parcialmente preenchidos.
const sparseKit: ImageKit = {
  cenarios: [null, null],
  produtos: [null, null, null, null, null, null, null, null],
};

// ── Seleção por elemento (sem selecaoDireta) ──────────────────────────────────

describe("buildReferences via elemento", () => {
  it("elemento 'avatar': inclui avatar, exclui cenario/produto", () => {
    const refs = buildReferences("avatar", fullKit);
    expect(refs.avatar).toBe("https://img/avatar1.jpg");
    expect((refs as Record<string, unknown>)["cenarios"]).toBeUndefined();
    expect(refs.produtos).toBeUndefined();
  });

  it("elemento 'cenario': inclui cenario (singular), sem avatar nem produto", () => {
    const refs = buildReferences("cenario", fullKit);
    expect(refs.cenario).toBeDefined(); // campo singular: refs.cenario
    expect(refs.avatar).toBeUndefined();
    expect(refs.produtos).toBeUndefined();
  });

  it("elemento 'cenario+avatar': inclui ambos", () => {
    const refs = buildReferences("cenario+avatar", fullKit, undefined, 1);
    expect(refs.avatar).toBeDefined();
    expect(refs.cenario).toBeDefined(); // campo singular
  });

  it("elemento 'produto': inclui produtos selecionados como {num, dataUrl}", () => {
    const refs = buildReferences("produto", fullKit, [1, 2]);
    expect(refs.produtos).toHaveLength(2);
    // produtos é {num: number, dataUrl: string}[], não string[]
    expect(refs.produtos![0].dataUrl).toBe("https://img/prod1.jpg");
    expect(refs.produtos![0].num).toBe(1);
    expect(refs.produtos![1].dataUrl).toBe("https://img/prod2.jpg");
    expect(refs.produtos![1].num).toBe(2);
  });

  it("elemento 'avatar+produto': inclui avatar e produtos", () => {
    const refs = buildReferences("avatar+produto", fullKit, [1]);
    expect(refs.avatar).toBeDefined();
    expect(refs.produtos).toHaveLength(1);
  });
});

// ── Seleção via selecaoDireta (modo PU e regen MOP com Kit) ──────────────────

describe("buildReferences via selecaoDireta", () => {
  it("usarAvatar: true → refs.avatar preenchido", () => {
    const refs = buildReferences("avatar", fullKit, undefined, undefined, {
      usarAvatar: true,
      avatarNum: 1,
    });
    expect(refs.avatar).toBe("https://img/avatar1.jpg");
  });

  it("avatarNum: 2 → usa avatar2", () => {
    const refs = buildReferences("avatar", fullKit, undefined, undefined, {
      usarAvatar: true,
      avatarNum: 2,
    });
    expect(refs.avatar).toBe("https://img/avatar2.jpg");
  });

  it("avatarNum: 2 sem avatar2 → fallback para avatar1", () => {
    const refs = buildReferences("avatar", sparseKit, undefined, undefined, {
      usarAvatar: true,
      avatarNum: 2,
    });
    // sparseKit não tem avatar nem avatar2 → refs.avatar deve ser undefined
    expect(refs.avatar).toBeUndefined();
  });

  it("usarFachada: true → refs.fachada preenchido", () => {
    const refs = buildReferences("cenario", fullKit, undefined, undefined, {
      usarAvatar: false,
      usarFachada: true,
    });
    expect(refs.fachada).toBe("https://img/fachada.jpg");
  });

  it("usarFachada: false → refs.fachada ausente mesmo com fachada no kit", () => {
    const refs = buildReferences("cenario", fullKit, undefined, undefined, {
      usarAvatar: false,
      usarFachada: false,
    });
    expect(refs.fachada).toBeUndefined();
  });

  it("cenarioNum: 1 → primeiro cenário do kit", () => {
    const refs = buildReferences("cenario", fullKit, undefined, undefined, {
      usarAvatar: false,
      cenarioNum: 1,
    });
    expect(refs.cenario).toBe("https://img/cenario1.jpg");
  });

  it("cenarioNum: 2 → segundo cenário do kit", () => {
    const refs = buildReferences("cenario", fullKit, undefined, undefined, {
      usarAvatar: false,
      cenarioNum: 2,
    });
    expect(refs.cenario).toBe("https://img/cenario2.jpg");
  });

  it("produtosNums: [1, 2] → refs.produtos com 2 {num, dataUrl}", () => {
    const refs = buildReferences("produto", fullKit, undefined, undefined, {
      usarAvatar: false,
      produtosNums: [1, 2],
    });
    expect(refs.produtos).toHaveLength(2);
    expect(refs.produtos![0].dataUrl).toBe("https://img/prod1.jpg");
    expect(refs.produtos![1].dataUrl).toBe("https://img/prod2.jpg");
  });

  it("produtosNums: [] → refs.produtos ausente ou vazio", () => {
    const refs = buildReferences("produto", fullKit, undefined, undefined, {
      usarAvatar: false,
      produtosNums: [],
    });
    // Lista vazia = sem produto nas referências
    expect(!refs.produtos || refs.produtos.length === 0).toBe(true);
  });

  it("slot nulo no kit não vaza para refs.produtos", () => {
    // Kit com produto 1 preenchido e produto 2 nulo
    const kit: ImageKit = {
      cenarios: [null, null],
      produtos: ["https://img/prod1.jpg", null, null, null, null, null, null, null],
    };
    const refs = buildReferences("produto", kit, undefined, undefined, {
      usarAvatar: false,
      produtosNums: [1, 2],
    });
    // produto 2 é null no kit → só produto 1 deve aparecer, com dataUrl válida
    expect(refs.produtos?.every((p) => !!p.dataUrl)).toBe(true);
    expect(refs.produtos).toHaveLength(1); // só o produto 1 (produto 2 é null)
  });

  it("uniforme presente e useUniforme: true → refs.uniforme preenchido", () => {
    const refs = buildReferences(
      "avatar",
      fullKit,
      undefined,
      undefined,
      { usarAvatar: true, useUniforme: true },
      "https://img/uniforme.jpg",
    );
    expect(refs.uniforme).toBe("https://img/uniforme.jpg");
  });

  it("useUniforme: true sem uniformeDataUrl → refs.uniforme ausente", () => {
    const refs = buildReferences(
      "avatar",
      fullKit,
      undefined,
      undefined,
      { usarAvatar: true, useUniforme: true },
      undefined,
    );
    expect(refs.uniforme).toBeUndefined();
  });
});

// ── Sanitização de policy (crítico: causa do bug commit cb6fa4c) ──────────────
// Se o chamador sanitizar selecaoDireta antes de chamar buildReferences
// (como policyPorFormato exige para SERVIÇOS/MARCA estático), o resultado
// deve ser sem produto. Estes testes documentam o comportamento esperado.

describe("buildReferences respeita seleção vazia de produtos", () => {
  it("produtosNums vazio + kit com produtos → refs sem produto", () => {
    const refs = buildReferences("avatar", fullKit, undefined, undefined, {
      usarAvatar: true,
      produtosNums: [],
    });
    expect(!refs.produtos || refs.produtos.length === 0).toBe(true);
  });
});

// ── produtoTelaInformativa degrada com avatar ativo (2026-07-07) ─────────────
// Achado real: avatar + produto-tela repetidamente vazou conteúdo de tela pra
// carcaça/tampa mesmo com o texto de contenção reforçado (revisão Opus 4.8 +
// Fable 5) — sem avatar (produto+cenário, por exemplo), o caso de uso real do
// checkbox (produto digital como herói solo) permanece intacto.
describe("buildReferences degrada produtoTelaInformativa quando há avatar", () => {
  it("produtoTelaInformativa: true SEM avatar → refs.produtoTelaInformativa true", () => {
    const refs = buildReferences("produto", fullKit, undefined, undefined, {
      usarAvatar: false,
      produtosNums: [1],
      produtoTelaInformativa: true,
    });
    expect(refs.produtoTelaInformativa).toBe(true);
  });

  it("produtoTelaInformativa: true COM avatar → refs.produtoTelaInformativa ausente", () => {
    const refs = buildReferences("avatar+produto", fullKit, undefined, undefined, {
      usarAvatar: true,
      avatarNum: 1,
      produtosNums: [1],
      produtoTelaInformativa: true,
    });
    expect(refs.avatar).toBeDefined();
    expect(refs.produtoTelaInformativa).toBeUndefined();
  });
});
