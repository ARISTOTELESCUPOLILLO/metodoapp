import { describe, it, expect } from "vitest";
import {
  validateScriptReels,
  frasesDoScript,
  SCRIPT_MIN_WORDS,
  SCRIPT_MAX_WORDS,
  SCRIPT_FECHO_MAX_WORDS,
} from "../core/scriptValidation";
import { buildMetodoOpPrompt } from "../core/organizaMethodEngine";
import { normalizeMethodResult } from "../core/normalizeMethodResult";
import { applyDeterministicFallback } from "../core/textValidation";

// Régua do roteiro falado — nasceu do caso real de 09/09/2026 (S3C, conta
// admin). O roteiro que saiu está no primeiro teste: 17 palavras, duas frases
// de mensagem, nenhum fecho. O vídeo terminou no meio de uma ideia.

// O roteiro de 32 palavras em 3 frases que saiu na rodada das 18h de 09/09:
// grande demais para ~10 s de locucao e sem fecho — a ultima frase continua a
// mensagem em vez de encerrar a ideia.
const ROTEIRO_LONGO_REAL =
  "Buscar apoio logo no comeco muda tudo, porque vai direto onde as decisoes de verdade acontecem. Agora, quem comeca antes sai na frente. Consultoria de Marketing Digital ja virou ponto de partida.";

const ROTEIRO_DEFEITUOSO =
  "Muitos cliques não trazem consulta real. Só número alto não resolve o dia a dia do time.";

describe("validateScriptReels — o caso que originou a régua", () => {
  it("reprova o roteiro real que gerou o vídeo sem fecho", () => {
    const motivos = validateScriptReels(ROTEIRO_DEFEITUOSO);
    expect(motivos.length).toBeGreaterThan(0);
    // Duas frases, mas a última tem 11 palavras — é continuação, não fecho.
    expect(motivos.join(" ")).toContain("não é um fecho");
  });

  it("reprova por tamanho: 17 palavras ficam abaixo do mínimo", () => {
    expect(ROTEIRO_DEFEITUOSO.split(/\s+/).length).toBe(17);
    expect(validateScriptReels(ROTEIRO_DEFEITUOSO).join(" ")).toContain(String(SCRIPT_MIN_WORDS));
  });
});

describe("validateScriptReels — o que passa", () => {
  const BOM =
    "Seu site recebe cliques todo dia, e quase nenhum deles vira uma conversa de verdade com quem atende o seu cliente. O numero sozinho nao sustenta o dia.";

  it("aprova roteiro com mensagem, vírgula de respiro e fecho curto", () => {
    expect(validateScriptReels(BOM)).toEqual([]);
  });

  it("as duas partes são reconhecidas como frases separadas", () => {
    const frases = frasesDoScript(BOM);
    expect(frases).toHaveLength(2);
    expect(frases[1].split(/\s+/).length).toBeLessThanOrEqual(SCRIPT_FECHO_MAX_WORDS);
  });
});

describe("validateScriptReels — cada defeito isolado", () => {
  it("cobra a vírgula: sem pausa escrita a locução sai corrida", () => {
    const semVirgula =
      "Seu site recebe cliques todo dia e quase nenhum deles vira uma conversa de verdade com quem atende o seu cliente. O numero sozinho nao sustenta o dia.";
    expect(validateScriptReels(semVirgula).join(" ")).toContain("nenhuma vírgula");
  });

  it("cobra a existência de duas frases", () => {
    const umaFrase =
      "Muitos cliques chegam todo dia, e quase nenhum deles vira conversa de verdade com o seu time comercial.";
    expect(validateScriptReels(umaFrase).join(" ")).toContain("uma frase só");
  });

  it("reprova roteiro longo demais para caber na locução", () => {
    const longo =
      "Seu site recebe cliques todo dia, e quase nenhum deles vira uma conversa de verdade com o seu time comercial, que atende, responde e acompanha cada pessoa que aparece por ali. O numero sozinho nao sustenta o dia.";
    expect(longo.split(/\s+/).length).toBeGreaterThan(SCRIPT_MAX_WORDS);
    expect(validateScriptReels(longo).join(" ")).toContain(String(SCRIPT_MAX_WORDS));
  });

  it("reprova fecho de uma palavra", () => {
    const fechoCurto =
      "Muitos cliques chegam todo dia, e quase nenhum vira conversa de verdade com o time. Pronto.";
    expect(validateScriptReels(fechoCurto).join(" ")).toContain("curta demais");
  });

  it("roteiro vazio não passa em silêncio", () => {
    expect(validateScriptReels("")).toEqual(["roteiro falado vazio"]);
    expect(validateScriptReels("   ")).toEqual(["roteiro falado vazio"]);
  });
});

// ── O roteiro entra no prompt com os mesmos números da validação ────────────

describe("prompt e validação leem o mesmo número", () => {
  it("as constantes aparecem na regra do MOP", () => {
    const prompt = buildMetodoOpPrompt(
      {
        companyName: "Empresa Teste",
        segment: "SERVIÇOS",
        audience: "B2B",
        businessMoment: "consolidação",
        keyInfo: "Gestão de tráfego pago",
        brandVoice: "profissional",
        outputMode: "feed",
        sequenceSize: 3,
        storiesDays: 1,
        storiesQuantity: 3,
        outputFormats: ["feed"],
        track: "cinematica",
        mainActivity: "Agência",
        mood: "OP-01",
      },
      1,
    );
    expect(prompt).toContain(`${SCRIPT_MIN_WORDS} a ${SCRIPT_MAX_WORDS} palavras`);
    expect(prompt).toContain("ISTO É FALA, NÃO TEXTO");
    expect(prompt).toContain("FECHO");
    // A pausa escrita precisa estar pedida explicitamente.
    expect(prompt).toContain("VÍRGULA");
    // E a lista de CTAs prontos deixou de ser o que se pede.
    expect(prompt).toContain("PROIBIDO colar uma frase pronta");
  });
});

// O exemplo que o prompt ensina precisa OBEDECER a régua — se ensinar outra
// coisa, o modelo copia o exemplo e ignora a regra.
describe("o exemplo do prompt obedece a própria régua", () => {
  const EXEMPLO =
    "Seu site recebe cliques todo dia, e quase nenhum deles vira uma conversa de verdade com quem atende o seu cliente. O número sozinho não sustenta o dia.";

  it("o exemplo passa na validação", () => {
    expect(validateScriptReels(EXEMPLO)).toEqual([]);
  });

  it("o exemplo está escrito no prompt, e o antigo saiu", () => {
    const prompt = buildMetodoOpPrompt(
      {
        companyName: "Empresa Teste",
        segment: "SERVIÇOS",
        audience: "B2B",
        businessMoment: "consolidação",
        keyInfo: "Gestão de tráfego pago",
        brandVoice: "profissional",
        outputMode: "feed",
        sequenceSize: 3,
        storiesDays: 1,
        storiesQuantity: 3,
        outputFormats: ["feed"],
        track: "cinematica",
        mainActivity: "Agência",
        mood: "OP-01",
      },
      1,
    );
    expect(prompt).toContain(EXEMPLO);
    // O exemplo antigo tinha 5 frases e terminava no CTA de lista — ensinava
    // exatamente o que a régua nova proíbe.
    expect(prompt).not.toContain("Sua marca fala. Seu time entrega.");
  });
});

describe("o fio entre a regua e o autoRegenerate", () => {
  // Este teste existe por causa do defeito de 09/09/2026: a regua reprovava o
  // roteiro e ninguem lia. normalizeMethodResult emitia "reels[i].script", e o
  // autoRegenerate so reconhece os sufixos titulo/texto/legenda — a flag caia
  // no ramo generico, que procura um campo "texto" inexistente em reels e
  // acabava mandando a correcao para a legenda. O sufixo TEM que ser ".texto".
  const SUFIXOS_QUE_O_AUTOREGENERATE_LE = /^(.*)\.(titulo|texto|legenda)$/;

  it("emite reels[i].texto — sufixo que o autoRegenerate reconhece", () => {
    const raw = {
      reels: [
        {
          hook: "Um titulo qualquer",
          script: ROTEIRO_LONGO_REAL,
          imagePrompt: "x",
          screenText: "y",
        },
      ],
    };
    const result = normalizeMethodResult(raw, "cinematica", 3);
    const doScript = (result.flags || []).filter(
      (f) => f.campo.startsWith("reels[0].") && f.campo !== "reels[0].titulo",
    );
    expect(doScript.length).toBeGreaterThan(0);
    for (const f of doScript) {
      expect(f.campo).toBe("reels[0].texto");
      expect(SUFIXOS_QUE_O_AUTOREGENERATE_LE.test(f.campo)).toBe(true);
    }
  });

  it("o roteiro de 32 palavras que o Ari reprovou vira flag", () => {
    const motivos = validateScriptReels(ROTEIRO_LONGO_REAL);
    expect(motivos.length).toBeGreaterThanOrEqual(2);
    expect(motivos.join(" ")).toContain("32 palavras");
  });
});

describe("o trilho do texto de apoio nao serve ao roteiro", () => {
  // Terceiro fio solto do mesmo defeito (09/09, tarde). O script viaja no
  // trilho do campo "texto", e as tres paradas desse trilho supoem uma frase
  // de apoio de 12 palavras:
  //   1. regenerate-block cortava em rule.max palavras (fragmento sem fecho);
  //   2. validava a volta com validateTexto (a regua errada);
  //   3. a limpeza determinista corta na ultima frase completa — e um roteiro
  //      bem-feito TEM duas frases, entao ela jogava fora justamente o fecho.
  // Este teste trava o item 3: se alguem religar a limpeza no reels, quebra.
  const ROTEIRO_CERTO =
    "Quem lidera produto novo ja busca apoio antes, e nao so na hora de divulgar o que o time acabou de criar. O proximo passo e calibrar juntos.";

  it("a limpeza determinista do texto de apoio decepa o fecho do roteiro", () => {
    const depois = applyDeterministicFallback(ROTEIRO_CERTO, "texto");
    expect(ROTEIRO_CERTO).toContain("O proximo passo e calibrar juntos.");
    expect(depois).not.toContain("O proximo passo e calibrar juntos.");
  });

  it("o roteiro certo passa na regua — nao ha por que limpar nada", () => {
    expect(validateScriptReels(ROTEIRO_CERTO)).toEqual([]);
  });
});

describe("a rodada de 42 palavras — a regua nao dizia ONDE cortar", () => {
  // Segunda rodada real de 09/09, linha EXPERIENCIA, produto "Criacao de
  // conteudo". O fecho estava CERTO (7 palavras) e mesmo assim o roteiro tinha
  // 42 palavras em 3 frases: duas de mensagem empilhadas. A regua reprovava com
  // uma queixa so — "acima de 24" — e uma queixa generica faz o modelo cortar
  // do fecho, que era a unica parte boa.
  const ROTEIRO_42 =
    "Quando a escolha de criar conteudo so entra em pauta apos um alerta, a chance de retomar fluxo cai. O que mantem o ciclo e disciplina com rotina feita hoje, sem deixar brecha para amanha. Antecipe o proximo passo, nao espere travar.";

  it("aponta as 3 frases e manda preservar o fecho", () => {
    const motivos = validateScriptReels(ROTEIRO_42);
    const texto = motivos.join(" | ");
    expect(texto).toContain("3 frases");
    expect(texto).toContain("nunca o fecho");
  });

  it("aponta a mensagem longa, nao so o total", () => {
    const texto = validateScriptReels(ROTEIRO_42).join(" | ");
    expect(texto).toContain("preserve o fecho");
    expect(texto).toContain("42 palavras");
  });
});

describe("a checagem final do roteiro fecha o prompt", () => {
  // A regra da fala mora no MEIO do prompt e vem muita ordem depois dela —
  // linha editorial, objeto, ineditismo. Pela doutrina do projeto (o ultimo a
  // falar vence) ela perdia, e o script saia do tamanho de um texto escrito.
  const BASE = {
    companyName: "Empresa Teste",
    segment: "SERVIÇOS",
    audience: "B2C",
    businessMoment: "consolidação",
    keyInfo: "Atendimento com hora marcada",
    brandVoice: "profissional e acessível",
    outputMode: "feed",
    sequenceSize: 3,
    storiesDays: 1,
    storiesQuantity: 3,
    outputFormats: ["feed"],
    track: "cinematica",
    mainActivity: "Consultoria de negócios",
    mood: "OP-01",
  } as Parameters<typeof buildMetodoOpPrompt>[0];

  it("a trilha cinematica termina com a checagem do script, depois da linha editorial", () => {
    const prompt = buildMetodoOpPrompt(BASE);
    const iRegra = prompt.indexOf("ÚLTIMA CHECAGEM");
    const iFormato = prompt.indexOf("FORMATO DE SAÍDA");
    expect(iRegra).toBeGreaterThan(-1);
    expect(iFormato).toBeGreaterThan(iRegra);
    expect(prompt).toContain("A LINHA EDITORIAL DEFINE O ÂNGULO DA FALA");
  });

  it("a trilha visual nao ganha a checagem — ela nao tem reels", () => {
    const prompt = buildMetodoOpPrompt({ ...BASE, track: "visual" });
    expect(prompt).not.toContain("ÚLTIMA CHECAGEM");
  });
});

describe("a ideia tem que chegar cedo — retencao do reels (11/09/2026)", () => {
  // ⚠ LEVANTAMENTO QUE ORIGINOU A REGRA: dos cinco roteiros que este sistema
  // produziu de verdade, QUATRO comecavam por subordinada ou infinitivo e so
  // entregavam a ideia por volta da decima palavra. O unico que abria afirmando
  // foi o que o Ari elogiou. Em reels, os primeiros segundos decidem se a pessoa
  // fica. Isto NAO e formula de viralizar: e a mesma frase comecando pelo que
  // importa.
  const ADIAM = [
    "Quando a escolha de criar conteúdo só entra em pauta após um alerta, a chance cai. Antecipe o próximo passo.",
    "Buscar apoio logo no começo muda tudo, porque vai direto onde decidem. Quem começa antes sai na frente.",
    "Só repetir passo de vendas não resolve, pois cada conversa traz algo fora do previsto. É ouvindo que se evolui.",
  ];

  it("reprova as aberturas que adiam a ideia", () => {
    for (const s of ADIAM) {
      const motivos = validateScriptReels(s).join(" | ");
      expect(motivos, s.slice(0, 30)).toContain("adia a ideia");
    }
  });

  it("reprova a virgula cumprida com adverbio solto", () => {
    // Saida real: a regua exigia virgula de respiro e o modelo cumpriu do jeito
    // mais barato — um adverbio na frente. Quem assiste ouve "agora" e continua
    // sem saber do que se trata.
    const motivos = validateScriptReels(
      "Agora, quem lidera produto novo já busca apoio para ajustar o plano. O próximo passo é calibrar juntos.",
    ).join(" | ");
    expect(motivos).toContain("antes da primeira vírgula");
  });

  it("aprova o roteiro que abre afirmando e fala com quem assiste", () => {
    expect(
      validateScriptReels(
        "Seu site recebe muita visita todo dia, e quase nenhuma delas vira uma conversa com quem atende o seu cliente. O numero sozinho nao sustenta o dia.",
      ),
    ).toEqual([]);
  });

  it("nao confunde abertura legitima com infinitivo", () => {
    // "Muitos", "Seu", "Cada" abrem afirmando — nao podem ser reprovados.
    for (const s of [
      "Muitos cliques chegam todo dia, e quase nenhum vira conversa com o time. O número não sustenta.",
      "Cada visita ao site custa dinheiro, e poucas viram contato de verdade. Vale olhar de perto.",
    ]) {
      const motivos = validateScriptReels(s).join(" | ");
      expect(motivos, s.slice(0, 30)).not.toContain("adia a ideia");
    }
  });
});

describe("as tres regras novas chegam ao prompt do MOP", () => {
  const BASE = {
    companyName: "Empresa Teste",
    segment: "SERVIÇOS",
    audience: "B2C",
    businessMoment: "consolidação",
    keyInfo: "Atendimento com hora marcada",
    brandVoice: "profissional e acessível",
    outputMode: "feed",
    sequenceSize: 3,
    storiesDays: 1,
    storiesQuantity: 3,
    outputFormats: ["feed"],
    track: "cinematica",
    mainActivity: "Consultoria de negócios",
    mood: "OP-01",
  } as Parameters<typeof buildMetodoOpPrompt>[0];

  it("manda abrir pela afirmacao", () => {
    const p = buildMetodoOpPrompt(BASE);
    expect(p).toContain("OS PRIMEIROS SEGUNDOS DECIDEM SE A PESSOA FICA");
    expect(p).toContain("ABRA PELA AFIRMAÇÃO");
  });

  it("autoriza segunda pessoa SO no script, e nao revoga a proibicao de criticar", () => {
    const p = buildMetodoOpPrompt(BASE);
    expect(p).toContain("SEGUNDA PESSOA, e só aqui");
    expect(p).toContain('vale SOMENTE para o campo "script"');
    expect(p).toContain("NÃO REVOGA A PROIBIÇÃO DE CRITICAR O LEITOR");
  });

  it("liga a fala a capa — continua, nao repete", () => {
    const p = buildMetodoOpPrompt(BASE);
    expect(p).toContain("A FALA CONTINUA A CAPA, NÃO A REPETE");
  });

  it("arbitra a contradicao das silabas com o nome do produto", () => {
    // A regra TTS proibia mais de 3 silabas e o nome cadastrado costuma ter 5+.
    // As duas se contradiziam e o modelo decidia sozinho qual obedecer.
    const p = buildMetodoOpPrompt(BASE);
    expect(p).toContain("EXCEÇÃO ÚNICA, E ELA VENCE ESTE LIMITE");
    expect(p).toContain("Fora o nome do produto, PROIBIDO");
  });
});
