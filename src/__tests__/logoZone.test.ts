import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildPostUnicoPrompt } from "../services/buildPuPrompt";
import type { BrandKit, LogoPosition, PostUnicoFormData } from "../types";

// Trava da GEOMETRIA da zona da logomarca (achado real de 03/08/2026).
//
// A logo é carimbada por canvas DEPOIS da IA (utils/canvasComposer.ts):
//   feed 1080x1350 → PAD 110, LOGO_MAX_W 288, LOGO_MAX_H 108
//   bottom-right   → x 682..970 (63%..90%)   y 1132..1240 (83,9%..91,9%)
//   top-center     →                          y  110..218  ( 8,1%..16,1%)
//   bottom-center  →                          y 1132..1240 (83,9%..91,9%)
//
// A reserva declarada no prompt precisa CONTER essa caixa. A versão antiga
// ("~18% × ~10%" colada na borda; faixa de "~14%") não continha: a IA obedecia
// a reserva e o carimbo da logo caía em cima da última linha de texto.
// Estes testes falham se alguém reduzir a reserva abaixo da caixa real.
//
// Achado real (04/08/2026): reserva correta NÃO bastou. Mesmo com a caixa real
// declarada e uma trava numérica no FIM do bloco ("nenhuma linha abaixo de 80%
// da altura"), o modelo desceu o texto de apoio até 92% e a logo caiu em cima
// (PU Barbosa Lubrificantes, logo bottom-right, já com o fix de 03/08 no ar).
// A trava passou para o COMEÇO do bloco — âncora de topo declarada, bloco
// crescendo para baixo. Os testes abaixo travam as duas coisas: a reserva
// (que continua descrevendo a caixa real) e a âncora de topo por posição.

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

function prompt(logoPosition: LogoPosition, mood?: PostUnicoFormData["mood"]) {
  return buildPostUnicoPrompt({
    data: { ...dataBase, direcao: mood ? "mood" : "livre", mood },
    kit: { ...kitBase, logoPosition },
    copy: { titulo: "DECIDA HOJE", texto: "Sua consultoria começa agora." },
    forcedGender: "mulher",
  });
}

describe("zona da logomarca — canto inferior direito", () => {
  const p = prompt("bottom-right");

  it("reserva um retângulo que cobre a caixa real da logo (63%..90% × 84%..92%)", () => {
    expect(p).toContain("começa a 60% da LARGURA e a 80% da ALTURA");
  });

  it("avisa que a zona NÃO está colada na borda — a logo fica no miolo", () => {
    expect(p).toContain("fica no MIOLO dessa área (recuada 110 px das bordas");
  });

  it("não volta à reserva antiga, que não cobria a logo", () => {
    expect(p).not.toContain("~18% × ~10%");
  });
});

describe("âncora de topo do bloco de texto — o que abre espaço para a logo", () => {
  it("logo no canto inferior direito: bloco começa entre 10% e 16% da altura", () => {
    const p = prompt("bottom-right");
    expect(p).toContain("O BLOCO COMEÇA PELO ALTO");
    expect(p).toContain("entre 10% e 16% da altura do canvas");
    expect(p).toContain("cresce PARA BAIXO");
  });

  it("logo na base central: mesma âncora de topo", () => {
    expect(prompt("bottom-center")).toContain("entre 10% e 16% da altura do canvas");
  });

  it("logo no topo central: âncora desce para depois da faixa (24% a 30%)", () => {
    const p = prompt("top-center");
    expect(p).toContain("entre 24% e 30% da altura do canvas");
    expect(p).not.toContain("entre 10% e 16% da altura do canvas");
  });

  it("vale também no mood SILÊNCIO, que antes variava topo/meio/base", () => {
    const p = prompt("bottom-right", "OP-06");
    expect(p).toContain("METADE DIREITA");
    expect(p).toContain("entre 10% e 16% da altura do canvas");
    expect(p).not.toContain("Explore variações verticais");
  });

  it("não sobrou a trava de fim de bloco, que falhou duas vezes", () => {
    const p = prompt("bottom-right", "OP-06");
    expect(p).not.toContain("TRAVA DE LINHA");
    expect(p).not.toContain("terminar ACIMA de 80% da altura");
  });
});

describe("zona da logomarca — faixas centrais (topo e base)", () => {
  it("faixa do topo tem ~20% da altura (logo vai até 16,1%)", () => {
    const p = prompt("top-center");
    expect(p).toContain("FAIXA HORIZONTAL COMPLETA");
    expect(p).toContain("com ~20% da altura");
    expect(p).not.toContain("com ~14% da altura");
  });

  it("faixa da base tem ~20% da altura (logo começa em 83,9%)", () => {
    const p = prompt("bottom-center");
    expect(p).toContain("com ~20% da altura");
  });

  it("faixa comprimida do IMPACTO não desce abaixo de 18% (limite geométrico)", () => {
    // OP-02 + tópicos + logo no topo comprime a faixa — mas nunca abaixo da
    // altura que a logo de fato ocupa.
    const p = buildPostUnicoPrompt({
      data: { ...dataBase, direcao: "mood", mood: "OP-02" },
      kit: { ...kitBase, logoPosition: "top-center" },
      copy: {
        titulo: "DECIDA HOJE",
        texto: "",
        topicos: [
          { icone: "estrela", texto: "Identidade clara" },
          { icone: "aperto de mãos", texto: "Equipe dedicada" },
          { icone: "selo de aprovação (check)", texto: "Profissionalismo" },
        ],
      },
      forcedGender: "mulher",
    });
    expect(p).toContain("com ~18% da altura");
    expect(p).not.toContain("com ~10% da altura");
  });

  it("avisa que a logo fica no miolo da faixa, não encostada na borda", () => {
    const p = prompt("bottom-center");
    expect(p).toContain("fica no MIOLO da faixa (recuada da borda");
  });
});
