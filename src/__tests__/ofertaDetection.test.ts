import { describe, expect, it } from "vitest";
import { isOfertaConcreta } from "../core/ofertaDetection";

// isOfertaConcreta decide se o PU objetivo=promocao ganha o titulo ajustado de 9
// palavras em vez do padrao de 6. O teste guarda os dois lados: oferta concreta
// precisa passar, e promocao generica precisa continuar reprovando — se o segundo
// grupo comecar a passar, a regra travada em 15/07/2026 deixou de valer e todo
// texto promocional viraria manchete longa.
describe("isOfertaConcreta", () => {
  describe("reconhece oferta concreta", () => {
    const concretas = [
      // Caso real que motivou a ampliacao de 21/07/2026: nenhum digito, nenhum
      // R$, nenhum %, e ainda assim e a oferta mais concreta que existe.
      "Compre uma e leve duas",
      "compre 1 leve 2",
      "leve 3 pague 2",
      "Compre duas e ganhe uma",
      "leve tres pague duas",
      // Valor e percentual
      "R$ 120 no corte",
      "20% de desconto",
      "120 reais a peca",
      "de 200 por 150",
      "2 por 1 nas camisas",
      "50 off nas bermudas",
      // Condicao de pagamento
      "a partir de 90",
      "parcelado em ate 6 vezes",
      "aceitamos cartao",
      "a vista tem vantagem",
      "por apenas 39",
      "em 3x sem juros",
      "3x de 40",
      "pague metade agora",
      // Brinde e gratuidade
      "frete gratis para a capital",
      "brinde na primeira compra",
      "sobremesa de cortesia",
      "combo com dois lanches",
      "na compra do kit, ganhe a bolsa",
      // Preco mencionado
      "preco fechado para o mes",
    ];
    it.each(concretas)("%s", (texto) => {
      expect(isOfertaConcreta(texto)).toBe(true);
    });
  });

  describe("nao confunde promocao generica com oferta", () => {
    const genericas = [
      "Promocao de inverno na loja",
      "Oferta especial para clientes antigos",
      "Aproveite nossa promocao",
      "Novidade chegando na loja esta semana",
      "Estamos com condicoes especiais",
      "Venha conferir as novidades",
      // "metade" fora de contexto de pagamento nao e oferta
      "metade dos clientes ja voltou",
      // vazio e espaco em branco
      "",
      "   ",
    ];
    it.each(genericas)("%s", (texto) => {
      expect(isOfertaConcreta(texto)).toBe(false);
    });
  });

  it("nao casa dois numeros sem relacao atravessando a frase", () => {
    // A folga do leve-e-pague e curta de proposito: sem isso, um texto com dois
    // numerais distantes viraria "oferta" por acidente.
    expect(
      isOfertaConcreta(
        "compre um produto da nossa linha nova, que foi desenvolvida ao longo de tres anos de pesquisa e leva o nome do fundador",
      ),
    ).toBe(false);
  });
});
