import { describe, it, expect } from "vitest";
import {
  rotuloDoEixo,
  extrairEixosDeCamera,
  extrairEstrutura,
  montarVariacaoTelemetria,
  sanitizarVariacaoTelemetria,
} from "../core/variacaoTelemetria";
import { buildCameraLine } from "../core/cameraAxes";
import { pickImageVariationBlock } from "../core/imageVariationPicker";
import {
  EIXO_DISTANCIA_CLAREZA,
  EIXO_ALTURA_CLAREZA,
  EIXO_OTICA_CLAREZA,
  EIXO_PROFUNDIDADE_CLAREZA,
  EIXO_LUZ_CLAREZA,
  EIXO_DISTANCIA_IMPACTO,
  EIXO_ALTURA_IMPACTO,
  EIXO_OTICA_IMPACTO,
  EIXO_PROFUNDIDADE_IMPACTO,
  EIXO_LUZ_IMPACTO,
  EIXO_DISTANCIA_SILENCIO,
  EIXO_ALTURA_SILENCIO,
  EIXO_OTICA_SILENCIO,
  EIXO_PROFUNDIDADE_SILENCIO,
  EIXO_LUZ_SILENCIO,
  EIXO_DISTANCIA_DESVIO,
  EIXO_ALTURA_DESVIO,
  EIXO_OTICA_DESVIO,
  EIXO_PROFUNDIDADE_DESVIO,
  EIXO_LUZ_DESVIO,
} from "../core/cameraAxes";
import { MoodCode } from "../types";

const TODOS_OS_EIXOS = [
  EIXO_DISTANCIA_CLAREZA,
  EIXO_ALTURA_CLAREZA,
  EIXO_OTICA_CLAREZA,
  EIXO_PROFUNDIDADE_CLAREZA,
  EIXO_LUZ_CLAREZA,
  EIXO_DISTANCIA_IMPACTO,
  EIXO_ALTURA_IMPACTO,
  EIXO_OTICA_IMPACTO,
  EIXO_PROFUNDIDADE_IMPACTO,
  EIXO_LUZ_IMPACTO,
  EIXO_DISTANCIA_SILENCIO,
  EIXO_ALTURA_SILENCIO,
  EIXO_OTICA_SILENCIO,
  EIXO_PROFUNDIDADE_SILENCIO,
  EIXO_LUZ_SILENCIO,
  EIXO_DISTANCIA_DESVIO,
  EIXO_ALTURA_DESVIO,
  EIXO_OTICA_DESVIO,
  EIXO_PROFUNDIDADE_DESVIO,
  EIXO_LUZ_DESVIO,
].flat();

describe("rotuloDoEixo", () => {
  it("corta no delimitador que o próprio pool usa", () => {
    expect(rotuloDoEixo("PLANO PRÓXIMO: enquadramento fechado no busto — ombros")).toBe(
      "PLANO PRÓXIMO",
    );
    expect(rotuloDoEixo("lente 28mm, angular que exagera a perspectiva")).toBe("lente 28mm");
    expect(rotuloDoEixo("câmera nivelada com o sujeito, sem inclinação nenhuma")).toBe(
      "câmera nivelada com o sujeito",
    );
  });

  it("não quebra termo hifenizado — o hífen comum não é delimitador", () => {
    expect(rotuloDoEixo("CONTRA-PLONGÉE SUAVE: câmera ligeiramente abaixo")).toBe(
      "CONTRA-PLONGÉE SUAVE",
    );
    expect(rotuloDoEixo("luz alta-chave difusa e envolvente, sombras quase ausentes")).toBe(
      "luz alta-chave difusa e envolvente",
    );
  });

  it("aceita texto vazio sem estourar", () => {
    expect(rotuloDoEixo("")).toBe("");
    expect(rotuloDoEixo("   ")).toBe("");
  });

  it("todo eixo real produz rótulo curto, não-vazio e sem sobra de descrição", () => {
    for (const texto of TODOS_OS_EIXOS) {
      const rotulo = rotuloDoEixo(texto);
      expect(rotulo.length, `rótulo vazio para: ${texto.slice(0, 40)}`).toBeGreaterThan(0);
      expect(rotulo.length, `rótulo longo demais: ${rotulo}`).toBeLessThanOrEqual(48);
      // O rótulo é sempre um prefixo do texto original — nunca inventa conteúdo.
      expect(texto.startsWith(rotulo)).toBe(true);
    }
  });

  it("rotula cada opção de um mesmo eixo de forma distinta — senão não dá para contar repetição", () => {
    const pools = [
      EIXO_DISTANCIA_CLAREZA,
      EIXO_ALTURA_CLAREZA,
      EIXO_OTICA_CLAREZA,
      EIXO_LUZ_CLAREZA,
      EIXO_ALTURA_DESVIO,
      EIXO_DISTANCIA_SILENCIO,
      EIXO_LUZ_IMPACTO,
    ];
    for (const pool of pools) {
      const rotulos = pool.map(rotuloDoEixo);
      expect(new Set(rotulos).size, `rótulos colididos em: ${rotulos.join(" | ")}`).toBe(
        pool.length,
      );
    }
  });
});

describe("extrairEixosDeCamera", () => {
  const MOODS_COM_EIXOS: MoodCode[] = ["OP-01", "OP-02", "OP-05", "OP-06"];

  it("lê todos os eixos do prompt real de cada mood, em qualquer posição da fila", () => {
    for (const mood of MOODS_COM_EIXOS) {
      // O CLAREZA ganhou um sexto eixo (corpo de câmera e textura) em
      // 13/08/2026; os demais seguem com cinco.
      const esperado = mood === "OP-01" ? 6 : 5;
      for (let seed = 0; seed < 12; seed++) {
        const bloco = pickImageVariationBlock({ mood, seed });
        const eixos = extrairEixosDeCamera(bloco);
        expect(eixos.length, `${mood} seed ${seed}: ${bloco.slice(0, 120)}`).toBe(esperado);
        for (const e of eixos) {
          expect(e.length).toBeGreaterThan(0);
          expect(e.length).toBeLessThanOrEqual(48);
        }
      }
    }
  });

  it("o rótulo do último eixo não vaza o texto que vem depois da câmera no prompt", () => {
    for (const mood of MOODS_COM_EIXOS) {
      for (let seed = 0; seed < 12; seed++) {
        const eixos = extrairEixosDeCamera(pickImageVariationBlock({ mood, seed }));
        const ultimo = eixos[eixos.length - 1];
        // O texto seguinte sempre começa com um destes marcadores; nenhum pode
        // aparecer dentro do rótulo do eixo de luz.
        expect(ultimo).not.toMatch(/Estrutura|objeto isolado|Gesto\/ação|Arranjo/);
      }
    }
  });

  it("os rótulos lidos batem com os do pool de origem", () => {
    const linha = buildCameraLine("OP-01", { seed: 3 });
    const lidos = extrairEixosDeCamera(`⚠ VARIAÇÃO: Câmera: ${linha}. Estrutura: qualquer coisa `);
    expect(lidos).toEqual(linha.split(" · ").map(rotuloDoEixo));
  });

  it("devolve lista vazia quando não há bloco de variação no prompt", () => {
    expect(extrairEixosDeCamera("prompt qualquer sem variação")).toEqual([]);
    expect(extrairEixosDeCamera("")).toEqual([]);
  });

  it("devolve lista vazia para mood sem eixos de câmera (INSTANTE cai no pool antigo)", () => {
    // OP-03 tem câmera de frase pronta, não decupada em eixos — a linha não usa
    // o separador " · ", então sai um rótulo só, não cinco.
    const eixos = extrairEixosDeCamera(pickImageVariationBlock({ mood: "OP-03", seed: 1 }));
    expect(eixos.length).toBeLessThan(5);
  });
});

describe("extrairEstrutura", () => {
  it("lê a pose sorteada dos moods de personagem", () => {
    const bloco = pickImageVariationBlock({ mood: "OP-01", seed: 2 });
    const estrutura = extrairEstrutura(bloco);
    expect(estrutura.length).toBeGreaterThan(0);
    expect(estrutura.length).toBeLessThanOrEqual(48);
  });

  it("lê a ruptura do DESVIO sem confundir com o prefixo 'Estrutura:'", () => {
    const bloco = pickImageVariationBlock({ mood: "OP-05", seed: 4 });
    const estrutura = extrairEstrutura(bloco);
    expect(estrutura.length).toBeGreaterThan(0);
    // Se o prefixo curto casasse primeiro, sobraria "da ruptura" como rótulo.
    expect(estrutura).not.toMatch(/^da ruptura/);
  });

  it("lê o arranjo de grade do FRAGMENTO", () => {
    const bloco = pickImageVariationBlock({ mood: "OP-04", seed: 1 });
    expect(extrairEstrutura(bloco).length).toBeGreaterThan(0);
  });

  it("devolve vazio quando a composição já veio da etapa de conteúdo", () => {
    // Com composicao preenchida o sorteio é suprimido de propósito — a ausência
    // de rótulo é informação correta, não falha de leitura.
    const bloco = pickImageVariationBlock({ mood: "OP-01", seed: 1, composicao: "cena escrita" });
    expect(extrairEstrutura(bloco)).toBe("");
  });
});

describe("montarVariacaoTelemetria", () => {
  it("junta o contexto do chamador com os eixos lidos do prompt", () => {
    const prompt = `qualquer coisa antes ${pickImageVariationBlock({ mood: "OP-02", seed: 7 })}`;
    const meta = montarVariacaoTelemetria({ prompt, mood: "OP-02", seed: 7, avatar: true });
    expect(meta).toBeDefined();
    expect(meta?.mood).toBe("OP-02");
    expect(meta?.seed).toBe(7);
    expect(meta?.avatar).toBe(true);
    expect(meta?.camera?.length).toBe(5);
  });

  it("omite campo ausente em vez de gravar nulo", () => {
    const meta = montarVariacaoTelemetria({ prompt: "sem variação", mood: "OP-01" });
    expect(meta).toEqual({ mood: "OP-01" });
    expect(meta).not.toHaveProperty("seed");
    expect(meta).not.toHaveProperty("camera");
  });

  it("seed 0 é posição válida da fila e precisa sobreviver", () => {
    const meta = montarVariacaoTelemetria({ prompt: "sem variação", seed: 0 });
    expect(meta?.seed).toBe(0);
  });

  it("devolve undefined quando não há absolutamente nada a registrar", () => {
    expect(montarVariacaoTelemetria({ prompt: "" })).toBeUndefined();
  });
});

describe("sanitizarVariacaoTelemetria", () => {
  it("preserva um registro legítimo", () => {
    const bom = { mood: "OP-05", seed: 3, avatar: false, camera: ["PLANO MÉDIO"], estrutura: "X" };
    expect(sanitizarVariacaoTelemetria(bom)).toEqual(bom);
  });

  it("descarta chave desconhecida vinda do cliente", () => {
    const meta = sanitizarVariacaoTelemetria({ mood: "OP-01", lixo: "não deveria entrar" });
    expect(meta).toEqual({ mood: "OP-01" });
  });

  it("trunca texto longo em vez de gravar no banco o que o cliente mandar", () => {
    const meta = sanitizarVariacaoTelemetria({
      mood: "x".repeat(500),
      estrutura: "y".repeat(500),
      camera: ["z".repeat(500)],
    });
    expect(meta?.mood?.length).toBe(16);
    expect(meta?.estrutura?.length).toBe(48);
    expect(meta?.camera?.[0].length).toBe(48);
  });

  it("limita a quantidade de eixos e descarta item não-texto", () => {
    const meta = sanitizarVariacaoTelemetria({
      camera: [...Array(50).fill("eixo"), 1, null, {}],
    });
    expect(meta?.camera?.length).toBeLessThanOrEqual(8);
  });

  it("recusa tipo errado nos campos escalares", () => {
    const meta = sanitizarVariacaoTelemetria({ seed: "3", avatar: "sim", mood: 42 });
    expect(meta).toBeUndefined();
  });

  it("recusa entrada que não é objeto", () => {
    expect(sanitizarVariacaoTelemetria(null)).toBeUndefined();
    expect(sanitizarVariacaoTelemetria("texto")).toBeUndefined();
    expect(sanitizarVariacaoTelemetria([1, 2])).toBeUndefined();
    expect(sanitizarVariacaoTelemetria(undefined)).toBeUndefined();
  });

  it("sobrevive à ida e volta do que o cliente monta de verdade", () => {
    const prompt = pickImageVariationBlock({ mood: "OP-06", seed: 5 });
    const montado = montarVariacaoTelemetria({ prompt, mood: "OP-06", seed: 5, avatar: false });
    const viaRede = JSON.parse(JSON.stringify(montado));
    expect(sanitizarVariacaoTelemetria(viaRede)).toEqual(montado);
  });
});
