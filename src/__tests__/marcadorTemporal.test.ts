import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import {
  detectarMarcadorTemporal,
  manifestacaoPedeRecorrencia,
  buildRegraRecorrenciaApoio,
} from "../core/marcadorTemporal";
import { buildIntencaoRegraApoio } from "../core/intencao";
import { INTENCAO_MANIFESTACAO } from "../domain/intencao.config";

describe("detectarMarcadorTemporal — informações-chave reais do corpus", () => {
  it("R3 tem os DOIS marcadores — foi o caso que derrubou a camada", () => {
    const m = detectarMarcadorTemporal(
      "Toda peça passa por revisão de duas pessoas antes de ir ao ar",
    );
    expect(m).toEqual({ recorrencia: true, pontual: true });
  });

  it("3C/3D só têm o instante", () => {
    const m = detectarMarcadorTemporal("Reunião presencial tira dúvida na hora");
    expect(m).toEqual({ recorrencia: false, pontual: true });
  });

  it("as demais do corpus não trazem tempo nenhum", () => {
    for (const k of [
      "Quem escreve o texto não é quem faz a arte",
      "Atendemos sem hora marcada",
      "Tráfego pago nos meios digitais geram visitas rápidas",
    ]) {
      expect(detectarMarcadorTemporal(k)).toEqual({ recorrencia: false, pontual: false });
    }
  });

  it("reconhece recorrência escrita de vários jeitos", () => {
    for (const k of [
      "Todo mês entra coleção nova",
      "A cada troca de óleo conferimos os filtros",
      "Atendemos sempre com o mesmo time",
      "Estamos na mesma esquina há 12 anos",
      "Fazemos a limpeza diariamente",
    ]) {
      expect(detectarMarcadorTemporal(k).recorrencia).toBe(true);
    }
  });

  it("não confunde acento nem caixa", () => {
    expect(detectarMarcadorTemporal("TODA SEGUNDA TEM NOVIDADE").recorrencia).toBe(true);
    expect(detectarMarcadorTemporal("entrega no mesmo dia").pontual).toBe(true);
  });

  it("informação-chave vazia não acusa nada", () => {
    expect(detectarMarcadorTemporal("")).toEqual({ recorrencia: false, pontual: false });
    expect(detectarMarcadorTemporal(null)).toEqual({ recorrencia: false, pontual: false });
  });
});

// Fixa QUAIS das 36 casas pedem tempo. Se alguém reescrever uma frase da tabela
// e mudar esse conjunto sem perceber, este teste cai — que é exatamente o que se
// quer, porque a cláusula de tempo passa a entrar (ou sumir) em silêncio.
describe("quais casas da tabela pedem repetição", () => {
  it("são quatro, e todas da intenção CONFIANÇA — que é a que se prova repetindo", () => {
    const pedem: string[] = [];
    for (const [intencao, porSegmento] of Object.entries(INTENCAO_MANIFESTACAO)) {
      for (const [segmento, porCamada] of Object.entries(porSegmento)) {
        for (const [camada, frase] of Object.entries(porCamada)) {
          if (manifestacaoPedeRecorrencia(frase)) pedem.push(`${intencao}.${segmento}.${camada}`);
        }
      }
    }
    expect(pedem.sort()).toEqual([
      "confianca.MARCA.silenciosa",
      "confianca.SERVIÇOS.silenciosa",
      "confianca.VAREJO.interna",
      "confianca.VAREJO.silenciosa",
    ]);
  });

  it("duração e constância de maneira ficam de fora — ver a nota no motor", () => {
    // seguranca.MARCA.silenciosa é "há quanto tempo faz o mesmo" (duração, que
    // não se deriva do presente habitual) e seguranca.MARCA.interna é "mantém o
    // mesmo jeito de aparecer" (maneira). Nenhuma das duas tem falha medida.
    expect(manifestacaoPedeRecorrencia("Mostra há quanto tempo faz o mesmo")).toBe(false);
    expect(manifestacaoPedeRecorrencia("Mantém o mesmo jeito de aparecer")).toBe(false);
  });

  it("as 32 restantes não recebem cláusula de tempo nenhuma", () => {
    expect(
      buildRegraRecorrenciaApoio("Mostra quem faz o trabalho", "Atendemos sem hora marcada"),
    ).toBe("");
    expect(
      buildRegraRecorrenciaApoio("Mostra o trabalho acontecendo", "Reunião tira dúvida na hora"),
    ).toBe("");
  });
});

describe("buildRegraRecorrenciaApoio — as três saídas", () => {
  const casa = "Mostra a rotina de trabalho que se repete";

  it("CASO 1 — dois marcadores: manda o apoio ficar com o que se repete", () => {
    const r = buildRegraRecorrenciaApoio(
      casa,
      "Toda peça passa por revisão de duas pessoas antes de ir ao ar",
    );
    expect(r).toContain("DOIS MARCADORES DE TEMPO");
    expect(r).toContain("fica com o que SE REPETE");
    expect(r).toContain("O instante é assunto do título");
  });

  it("CASO 2 — sem recorrência: deriva do fato e proíbe inventar cadência", () => {
    const r = buildRegraRecorrenciaApoio(casa, "Reunião presencial tira dúvida na hora");
    expect(r).toContain("NÃO DIZ COM QUE FREQUÊNCIA");
    expect(r).toContain("PROIBIDO inventar cadência");
    expect(r).toContain("presente habitual");
    // A decisão do Ari: derivar, nunca acrescentar número/dia/horário.
    expect(r).toContain("sem acrescentar número, dia nem horário");
  });

  it("CASO 3 — a informação-chave já resolve sozinha: nada é acrescentado", () => {
    expect(buildRegraRecorrenciaApoio(casa, "Todo mês entra coleção nova")).toBe("");
  });

  it("sem manifestação não há cláusula", () => {
    expect(buildRegraRecorrenciaApoio(null, "Reunião tira dúvida na hora")).toBe("");
    expect(buildRegraRecorrenciaApoio("", "Reunião tira dúvida na hora")).toBe("");
  });
});

describe("fiação na regra do apoio", () => {
  const base = {
    intencao: "confianca" as const,
    transformacaoPrincipal: "preferencia" as const,
    segment: "SERVIÇOS",
    apoio: "texto" as const,
  };

  it("a cláusula entra colada na manifestação e antes do CONFIRA", () => {
    const regra = buildIntencaoRegraApoio({
      ...base,
      keyInfo: "Toda peça passa por revisão de duas pessoas antes de ir ao ar",
    });
    const posManifest = regra.indexOf("Mostra a rotina de trabalho que se repete");
    const posClausula = regra.indexOf("DOIS MARCADORES DE TEMPO");
    const posConfira = regra.indexOf("CONFIRA ANTES DE RESPONDER");
    expect(posManifest).toBeGreaterThan(-1);
    expect(posClausula).toBeGreaterThan(posManifest);
    expect(posConfira).toBeGreaterThan(posClausula);
  });

  it("o contrato de posição da regra do apoio continua intacto", () => {
    const regra = buildIntencaoRegraApoio({ ...base, keyInfo: "Reunião tira dúvida na hora" });
    expect(regra.startsWith("\n- ")).toBe(true);
    expect(regra.endsWith("\n")).toBe(false);
  });

  it("sem keyInfo o prompt de hoje não muda — só a casa que pede tempo é afetada", () => {
    const semKey = buildIntencaoRegraApoio({ ...base, transformacaoPrincipal: "orcamento" });
    const comKey = buildIntencaoRegraApoio({
      ...base,
      transformacaoPrincipal: "orcamento",
      keyInfo: "Reunião presencial tira dúvida na hora",
    });
    expect(semKey).toBe(comKey);
  });

  it("generate-pu-copy passa a informação-chave para a regra do apoio", () => {
    const fonte = readFileSync(
      resolve(process.cwd(), "src/routes/api/generate-pu-copy.ts"),
      "utf8",
    );
    expect(fonte).toContain("keyInfo,\n            apoio: wantsTopicos");
  });
});
