import { describe, it, expect } from "vitest";
import { nomeExigidoNoTitulo, checkNomeNoTitulo } from "../core/linhaEditorialRules";
import { tetoDaLimpeza } from "../services/regenerateBlock";
import { applyDeterministicFallback } from "../core/textValidation";

// Caso real de 14/09/2026 (PU, conta admin): MOSTRAR NOME com "Tráfego Pago
// Digital", modo de tópicos. O título novo saiu "Mais clientes, menos visita
// perdida" — sem o nome — porque nenhum caminho de título novo sabia do nome.
const INFO =
  "No tráfego pago digital, a preocupação inicial com quantidade de acessos está cedendo espaço para o foco em contatos realmente interessados.";
const EDITORIAL = {
  linhaEditorial: "transformacao",
  usoObjeto: "nome" as const,
  objetoEditorial: "Tráfego Pago Digital",
  proposicao: INFO,
};

describe("nomeExigidoNoTitulo — a condição única de MOSTRAR NOME", () => {
  it("exige o nome quando a escolha editorial vale", () => {
    expect(nomeExigidoNoTitulo(EDITORIAL, INFO)).toEqual({
      usoObjeto: "nome",
      objetoEditorial: "Tráfego Pago Digital",
    });
  });

  it("caduca quando a informação-chave foi editada à mão", () => {
    expect(nomeExigidoNoTitulo(EDITORIAL, INFO + " Editado.")).toBeNull();
  });

  it("não exige nada fora do modo MOSTRAR NOME ou sem item", () => {
    expect(nomeExigidoNoTitulo({ ...EDITORIAL, usoObjeto: "sem_nome" }, INFO)).toBeNull();
    expect(nomeExigidoNoTitulo({ ...EDITORIAL, objetoEditorial: "  " }, INFO)).toBeNull();
    expect(nomeExigidoNoTitulo(undefined, INFO)).toBeNull();
    expect(nomeExigidoNoTitulo({ ...EDITORIAL, linhaEditorial: null }, INFO)).toBeNull();
  });

  it("o título real sem o nome é reprovado", () => {
    expect(
      checkNomeNoTitulo({
        titulo: "Mais clientes, menos visita perdida",
        objeto: "Tráfego Pago Digital",
        usoObjeto: "nome",
      }),
    ).not.toBeNull();
  });
});

describe("tetoDaLimpeza — a limpeza final não pode decepar o nome", () => {
  const nomeNoTitulo = nomeExigidoNoTitulo(EDITORIAL, INFO);

  it("sobe para 7 quando o nome é obrigatório", () => {
    expect(tetoDaLimpeza({ kind: "titulo", nomeNoTitulo })).toEqual({ maxWords: 7 });
  });

  it("um título de 7 palavras com o nome sobrevive à limpeza inteiro", () => {
    const titulo = "Tráfego Pago Digital troca acesso por contato";
    const limpo = applyDeterministicFallback(
      titulo,
      "titulo",
      tetoDaLimpeza({ kind: "titulo", nomeNoTitulo }),
    );
    expect(limpo.toLowerCase()).toContain("contato");
    expect(limpo.toLowerCase()).toContain("tráfego pago digital");
  });

  it("sem o nome obrigatório, a régua normal continua valendo", () => {
    expect(tetoDaLimpeza({ kind: "titulo" })).toBeUndefined();
    expect(tetoDaLimpeza({ kind: "texto", nomeNoTitulo })).toBeUndefined();
  });

  it("a promoção com oferta concreta continua em 9", () => {
    expect(
      tetoDaLimpeza({
        kind: "titulo",
        objetivo: "promocao",
        keyInfo: "Óleo 20W50 por R$ 39,90 até sábado",
      }),
    ).toEqual({ maxWords: 9 });
  });
});
