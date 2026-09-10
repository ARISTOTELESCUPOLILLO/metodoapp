import { describe, it, expect } from "vitest";
import {
  planejarMontagem,
  montarLegendas,
  extrairContatoWhatsapp,
  curvaDaTrilha,
  CAPA_S,
  TRANSICAO_S,
  ASSINATURA_S,
  FPS,
} from "../core/montagemReels";

// A forma do filme foi decidida com o Ari em 10/09/2026 a partir de um vídeo de
// referencia que ele montou por fora (8,363 s, 1080x1920, medido aqui).

describe("linha do tempo da montagem", () => {
  // O clipe real do historico da conta admin: 7,200 s (medido no arquivo).
  const CLIPE = 7.2;

  it("a capa abre o filme e o filme entra depois dela", () => {
    const p = planejarMontagem(CLIPE);
    expect(p.capa).toEqual({ inicio: 0, fim: CAPA_S });
    expect(p.filme.inicio).toBe(CAPA_S);
    expect(p.filme.fim).toBeCloseTo(CAPA_S + CLIPE, 5);
  });

  it("o fade NAO soma tempo — ele corre por cima do fim do filme", () => {
    const p = planejarMontagem(CLIPE);
    // A assinatura comeca a aparecer meio segundo ANTES de o filme acabar...
    expect(p.assinatura.inicio).toBeCloseTo(p.filme.fim - TRANSICAO_S, 5);
    // ...e fica opaca exatamente quando o filme acaba.
    expect(p.assinatura.opacaEm).toBeCloseTo(p.filme.fim, 5);
    // Total = capa + filme + assinatura. O fade nao entra na conta.
    expect(p.totalS).toBeCloseTo(CAPA_S + CLIPE + ASSINATURA_S, 5);
  });

  it("os quadros da assinatura cobrem o fade E a assinatura inteira", () => {
    const p = planejarMontagem(CLIPE);
    expect(p.quadrosAssinatura).toBe(Math.round((TRANSICAO_S + ASSINATURA_S) * FPS));
  });

  it("clipe zerado nao gera tempo negativo", () => {
    const p = planejarMontagem(0);
    expect(p.assinatura.inicio).toBeGreaterThanOrEqual(0);
    expect(p.totalS).toBeCloseTo(CAPA_S + ASSINATURA_S, 5);
  });
});

describe("legendas repartidas pela locucao", () => {
  // Roteiro no formato que a regua exige: MENSAGEM + FECHO.
  const SCRIPT =
    "Criar conteudo mantem a marca viva, com informacao chegando sempre. O proximo passo e comecar.";

  it("uma legenda por frase, comecando quando o filme comeca", () => {
    const ls = montarLegendas(SCRIPT, 6);
    expect(ls).toHaveLength(2);
    expect(ls[0].inicio).toBe(CAPA_S);
  });

  it("a frase mais longa fica mais tempo na tela", () => {
    const ls = montarLegendas(SCRIPT, 6);
    const dur = (i: number) => ls[i].fim - ls[i].inicio;
    expect(dur(0)).toBeGreaterThan(dur(1));
  });

  it("a ultima legenda fecha EXATAMENTE com a fala", () => {
    const ls = montarLegendas(SCRIPT, 6);
    // Sem esse acerto, arredondamento deixa a legenda no ar depois da voz.
    expect(ls[ls.length - 1].fim).toBeCloseTo(CAPA_S + 6, 6);
  });

  it("sem duracao de fala nao inventa legenda", () => {
    expect(montarLegendas(SCRIPT, 0)).toEqual([]);
    expect(montarLegendas("", 6)).toEqual([]);
  });
});

describe("contato lido da assinatura do Kit", () => {
  // ⚠ CORPUS REAL: strings copiadas do campo `assinatura` das contas em
  // producao (10/09/2026). Nao inventar caso de teste aqui — o valor deste
  // teste esta em ser exatamente o que os clientes digitaram.
  it("le os formatos que os clientes realmente usam", () => {
    expect(extrairContatoWhatsapp("Contato pelo Whatsapp: (66) 99239-9246")).toBe(
      "(66) 99239-9246",
    );
    expect(extrairContatoWhatsapp("Contato pelo WhatsApp (66) 98417-0316.")).toBe(
      "(66) 98417-0316",
    );
    expect(extrairContatoWhatsapp("Marmitex pelo WhatsApp (66) 99281-1616. ")).toBe(
      "(66) 99281-1616",
    );
  });

  it("tolera o espaco perdido dentro do parenteses", () => {
    // "( 66)98467-1866" — digitacao real da conta FERRIMAQ.
    expect(
      extrairContatoWhatsapp("Fale Conosco : Whatsapp. ( 66)98467-1866  / (66)99714-4040"),
    ).toBe("(66) 98467-1866");
  });

  it("quando ha dois numeros, fica com o primeiro", () => {
    expect(extrairContatoWhatsapp("WhatsApp (66) 99912-7370. (66) 99648 2046 Av. Ministro")).toBe(
      "(66) 99912-7370",
    );
  });

  it("assinatura sem telefone devolve vazio — a peca sai so com a marca", () => {
    // Caso real da propria conta do Ari.
    expect(
      extrairContatoWhatsapp(
        "Acesse a bio @apropagandabr ou site: metodoapp.oficinadepropaganda.com.br",
      ),
    ).toBe("");
    expect(extrairContatoWhatsapp("Interessados entrar em contato pela bio.")).toBe("");
    expect(extrairContatoWhatsapp(undefined)).toBe("");
  });
});

describe("curva de volume da trilha", () => {
  it("sobe em rampa quando a locucao acaba, nao em degrau", () => {
    const p = planejarMontagem(7.2);
    const c = curvaDaTrilha(p);
    // A rampa comeca no fim do filme e termina meio segundo depois.
    expect(c).toContain(p.filme.fim.toFixed(3));
    expect(c).toContain((p.filme.fim + 0.5).toFixed(3));
    // Interpolacao linear entre os dois volumes — nao um valor fixo.
    expect(c).toContain("(t-");
  });
});

describe("o filme cresce com o roteiro — a conta tem que escalar", () => {
  // Observacao do Ari (10/09): "o tempo do filme vai ser maior porque o reels
  // tem o texto". Exato — o roteiro varia de 18 a 24 palavras (scriptValidation)
  // e a locucao varia junto. Deduzir a duracao de um exemplo antigo era o erro:
  // a montagem MEDE o clipe. Estes casos travam a aritmetica em varios tamanhos.
  const CASOS = [5.0, 6.4, 7.2, 8.5, 10.0];

  it("o total e sempre capa + clipe + assinatura, qualquer que seja o clipe", () => {
    for (const clipe of CASOS) {
      const p = planejarMontagem(clipe);
      expect(p.totalS, `clipe ${clipe}`).toBeCloseTo(CAPA_S + clipe + ASSINATURA_S, 5);
    }
  });

  it("a assinatura acompanha o fim do filme, nunca uma marca fixa", () => {
    for (const clipe of CASOS) {
      const p = planejarMontagem(clipe);
      expect(p.assinatura.opacaEm, `clipe ${clipe}`).toBeCloseTo(CAPA_S + clipe, 5);
    }
  });

  it("a quantidade de quadros da assinatura NAO depende do clipe", () => {
    // Ela e sempre fade + assinatura: se variasse com o clipe, o desenho e o
    // grafo do FFmpeg discordariam sobre quantos PNGs existem.
    const q = CASOS.map((c) => planejarMontagem(c).quadrosAssinatura);
    expect(new Set(q).size).toBe(1);
  });

  it("roteiro mais longo estica as legendas, sem estourar a fala", () => {
    const curto = montarLegendas("Uma frase curta aqui. Fecho.", 4);
    const longo = montarLegendas("Uma frase curta aqui. Fecho.", 9);
    const dur = (ls: ReturnType<typeof montarLegendas>) => ls[ls.length - 1].fim - ls[0].inicio;
    expect(dur(longo)).toBeGreaterThan(dur(curto));
    expect(dur(longo)).toBeCloseTo(9, 6);
  });
});
