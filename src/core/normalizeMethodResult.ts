import { MethodOpResult, FeedItem, GenerationSummary, Track, ValidationFlag } from "../types";
import { SEQUENCE_COMPOSITION } from "./organizaMethodEngine";
import {
  truncateWords,
  validatePieceFields,
  normalizeLegenda,
  enforceLegendaLimits,
  checkObserverSubject,
  checkCrossPieceLabelRepeat,
  checkCrossPieceTitleRepeat,
  correctPortugueseSpelling,
} from "./textValidation";
function buildSummary(
  result: Pick<MethodOpResult, "feed" | "carousel" | "reels" | "stories">,
): GenerationSummary {
  const feed = result.feed || [];
  const estaticos = feed.filter((f) => f.formato === "Estático").length;
  const estaticosFinais = feed.filter((f) => f.formato === "Estático Final").length;

  const carouselCards = result.carousel?.length || 0;
  const carrosseis = Math.ceil(carouselCards / 5);

  const reels = result.reels?.length || 0;
  const stories = result.stories?.length || 0;

  return { estaticos, carrosseis, reels, estaticosFinais, stories };
}

// Filtro defensivo. Se a IA desobedeceu e retornou reels numa trilha que
// não pede reels (Visual ou Experimentação), descartamos silenciosamente.
// Um aviso é gravado no console para você monitorar via DevTools sem poluir a UI do usuário.
function shouldDiscardReels(track: Track | undefined, hasReels: boolean): boolean {
  if (!hasReels) return false;
  return track === "visual" || track === "experimentacao";
}

// Forma bruta do JSON devolvido pela IA (resposta da OpenAI), antes da
// normalização. Só os campos de topo que o parser realmente lê estão aqui;
// as formas internas não são garantidas pelo prompt, então ficam como
// FeedItem[]/unknown[] e são validadas/transformadas defensivamente abaixo.
// Não é um contrato — é a documentação do que este normalizador consome.
type RawCarouselGroup = { cards?: unknown[]; legenda?: string };
type RawEstaticoFinalItem = {
  dia?: number;
  titulo?: string;
  texto?: string;
  legenda?: string;
  imagem?: string;
  imagePrompt?: string;
  leituraCenica?: import("../types").LeituraCenica;
};
interface RawMethodResult {
  carousel?: unknown[];
  reels?: unknown;
  feed?: FeedItem[];
  estaticoFinal?: RawEstaticoFinalItem[];
  stories?: unknown;
  ancora_visual?: import("../types").AnchoraVisual;
}

export function normalizeMethodResult(
  rawInput: unknown,
  track?: Track,
  sequenceSize?: 3 | 6 | 9,
  keyInfo?: string,
): MethodOpResult {
  // O JSON da IA chega como `unknown`. Esta função é a fronteira que o
  // interpreta defensivamente (guards de Array/truthiness abaixo); o cast
  // único para RawMethodResult documenta os campos de topo consumidos.
  const raw = (rawInput ?? {}) as RawMethodResult;
  const isExperimentacao = track === "experimentacao";
  const effectiveSize: 3 | 6 | 9 = isExperimentacao ? 3 : ((sequenceSize || 6) as 3 | 6 | 9);
  const comp = SEQUENCE_COMPOSITION[effectiveSize];
  let carousel: import("../types").CarouselCard[] | undefined;
  if (Array.isArray(raw?.carousel)) {
    const groups = raw.carousel as RawCarouselGroup[];
    if (groups[0]?.cards) {
      carousel = groups.flatMap((seq) => {
        const cards = ((seq.cards || []) as import("../types").CarouselCard[]).map((c, i) => ({
          ...c,
          card: i + 1,
        }));
        if (cards.length > 0 && seq.legenda) {
          cards[cards.length - 1].legenda = seq.legenda;
        }
        return cards;
      });
    } else {
      carousel = raw.carousel.slice(0, 5) as import("../types").CarouselCard[];
    }
  }

  let reels: import("../types").ReelsGuide[] | undefined;
  if (Array.isArray(raw?.reels)) {
    reels = raw.reels.filter(Boolean) as import("../types").ReelsGuide[];
  } else if (raw?.reels) {
    reels = [raw.reels as import("../types").ReelsGuide];
  }

  // Defesa em profundidade: se a trilha pedida não comporta reels e a IA mandou,
  // descartamos silenciosamente. Aviso fica registrado no DevTools.
  if (shouldDiscardReels(track, !!(reels && reels.length))) {
    console.warn(
      `[Método OP] A IA retornou "reels" na trilha "${track}". Descartado para preservar coerência da trilha pedida.`,
      { trackPedida: track, reelsDescartado: reels },
    );
    reels = undefined;
  }

  let feed: FeedItem[] | undefined = Array.isArray(raw?.feed) ? raw.feed : undefined;
  if (Array.isArray(raw?.estaticoFinal) && raw.estaticoFinal.length > 0) {
    const extras: FeedItem[] = raw.estaticoFinal.map((item, idx: number) => ({
      dia: item.dia ?? (feed?.length || 0) + idx + 1,
      formato: "Estático Final" as const,
      titulo: item.titulo || "",
      texto: item.texto || "",
      legenda: item.legenda || "",
      imagem: item.imagem || item.imagePrompt || "",
      ...(item.leituraCenica ? { leituraCenica: item.leituraCenica } : {}),
    }));
    feed = [...(feed || []), ...extras];
  }

  // Filtro defensivo adicional: se a trilha não comporta reels, remove qualquer
  // item de feed com formato "Reels" que tenha vindo embutido.
  if (track === "visual" || track === "experimentacao") {
    if (feed) {
      const before = feed.length;
      feed = feed.filter((f) => f.formato !== "Reels");
      if (feed.length < before) {
        console.warn(
          `[Método OP] Itens com formato "Reels" foram filtrados do feed na trilha "${track}".`,
        );
      }
    }
  }

  // Cap estrutural pela composição da trilha/tamanho — evita "4ª peça" quando a IA gera além.
  if (feed) {
    const estaticos = feed.filter((f) => f.formato !== "Estático Final").slice(0, comp.estatico);
    const finais = feed.filter((f) => f.formato === "Estático Final").slice(0, comp.fechamento);
    feed = [...estaticos, ...finais];
  }
  if (carousel) {
    const maxCards = comp.carrossel * 5;
    carousel = carousel.slice(0, maxCards);
  }
  if (reels) {
    if (comp.fechamento === 0) {
      reels = undefined;
    } else {
      reels = reels.slice(0, comp.fechamento);
      if (reels.length === 0) reels = undefined;
    }
  }

  // Guard de limite de palavras: garante que texto nunca ultrapasse os limites
  // definidos no prompt, independente do que o LLM retornou. Mesmos limites do
  // prompt. Título NÃO é truncado aqui — cortar geraria fragmento ("...o
  // motor"); título fora da faixa de palavras é flagado por validateTitulo
  // (abaixo) e regenerado via E3/E4. Legenda passa por normalizeLegenda:
  // remove CTA duplicado no fim do corpo e CTA indireto (bio/site) extra no
  // parágrafo de CTA (ver REGRA DE LEGENDA).
  if (feed) {
    feed = feed.map((item) => ({
      ...item,
      titulo: correctPortugueseSpelling((item.titulo || "").trim()),
      texto: correctPortugueseSpelling(truncateWords(item.texto || "", 15)),
      legenda: item.legenda
        ? correctPortugueseSpelling(enforceLegendaLimits(normalizeLegenda(item.legenda)))
        : item.legenda,
    }));
  }
  if (carousel) {
    carousel = carousel.map((card) => ({
      ...card,
      titulo: correctPortugueseSpelling((card.titulo || "").trim()),
      texto: correctPortugueseSpelling(truncateWords(card.texto || "", 12)),
      ...(card.legenda
        ? {
            legenda: correctPortugueseSpelling(
              enforceLegendaLimits(normalizeLegenda(card.legenda)),
            ),
          }
        : {}),
    }));
  }
  if (reels) {
    reels = reels.map((r) => ({
      ...r,
      hook: correctPortugueseSpelling(r.hook || ""),
      script: correctPortugueseSpelling(r.script || ""),
      screenText: correctPortugueseSpelling(r.screenText || ""),
      ...(r.legenda
        ? { legenda: correctPortugueseSpelling(enforceLegendaLimits(normalizeLegenda(r.legenda))) }
        : {}),
    }));
  }

  // D1 — validação heurística pós-geração (palavra cortada, pontuação
  // pendente, repetição morfológica, promessa numérica sem respaldo na
  // keyInfo). Não bloqueia a entrega — fica marcada em `flags` para
  // regeneração pontual via regenerate-block (E3).
  const flags: ValidationFlag[] = [];
  if (feed) {
    feed.forEach((item, i) => {
      flags.push(
        ...validatePieceFields(
          `feed[${i}]`,
          { titulo: item.titulo, texto: item.texto, legenda: item.legenda },
          keyInfo,
        ),
      );
    });
  }
  if (carousel) {
    carousel.forEach((card, i) => {
      flags.push(
        ...validatePieceFields(
          `carousel[${i}]`,
          { titulo: card.titulo, texto: card.texto, legenda: card.legenda },
          keyInfo,
        ),
      );
    });
  }
  if (reels) {
    reels.forEach((r, i) => {
      flags.push(
        ...validatePieceFields(
          `reels[${i}]`,
          { titulo: r.hook, texto: r.script, legenda: r.legenda },
          keyInfo,
        ),
      );
    });
  }

  // Medida C — "rótulo do leitor" (gestores/decisores/equipe/time) como
  // sujeito do título: checkObserverSubject flaga qualquer ocorrência;
  // checkCrossPieceLabelRepeat flaga repetição do mesmo rótulo entre peças
  // da sequência (ver item 11 / FUNÇÕES COMUNICATIVAS POR PEÇA acima).
  const allTitles: { campo: string; titulo: string }[] = [];
  if (feed)
    feed.forEach((item, i) => {
      if (item.titulo) allTitles.push({ campo: `feed[${i}]`, titulo: item.titulo });
    });
  if (carousel)
    carousel.forEach((card, i) => {
      if (card.titulo) allTitles.push({ campo: `carousel[${i}]`, titulo: card.titulo });
    });
  if (reels)
    reels.forEach((r, i) => {
      if (r.hook) allTitles.push({ campo: `reels[${i}]`, titulo: r.hook });
    });
  for (const { campo, titulo } of allTitles) {
    const observerSubject = checkObserverSubject(titulo);
    if (observerSubject) flags.push({ campo: `${campo}.titulo`, motivo: observerSubject });
  }
  flags.push(...checkCrossPieceLabelRepeat(allTitles));
  // checkCrossPieceTitleRepeat flaga título de abertura e fechamento que
  // ancoram o mesmo elemento concreto (ver ANCORAGEM CONCRETA DO EIXO) mas
  // saem como a mesma frase disfarçada (ex.: "X digital ativa" / "X digital
  // resolve") — a EXCEÇÃO AO ITEM 8 permite repetir o substantivo-núcleo,
  // não a frase inteira.
  flags.push(...checkCrossPieceTitleRepeat(allTitles));

  // Validação de completude — detecta componentes esperados mas ausentes/incompletos.
  if (comp.carrossel > 0 && (!carousel || carousel.length === 0)) {
    console.warn("[Método OP] SEQUÊNCIA INCOMPLETA: carrossel esperado mas ausente ou vazio.", {
      esperados: comp.carrossel * 5,
      recebidos: carousel?.length ?? 0,
      rawCarousel: raw?.carousel,
    });
  } else if (comp.carrossel > 0 && carousel && carousel.length < comp.carrossel * 5) {
    console.warn("[Método OP] SEQUÊNCIA INCOMPLETA: carrossel com cards faltando.", {
      esperados: comp.carrossel * 5,
      recebidos: carousel.length,
    });
  }
  if (carousel && carousel.length > 0) {
    const cardsVazios = carousel.filter((c) => !c.titulo || !c.texto || !c.imagePrompt);
    if (cardsVazios.length > 0) {
      console.warn("[Método OP] SEQUÊNCIA INCOMPLETA: cards de carrossel com campos vazios.", {
        cardsVazios: cardsVazios.length,
        cards: cardsVazios.map((c) => c.card),
      });
    }
  }
  if (feed) {
    const estaticosRecebidos = feed.filter((f) => f.formato === "Estático").length;
    const finaisRecebidos = feed.filter((f) => f.formato === "Estático Final").length;
    if (estaticosRecebidos < comp.estatico) {
      console.warn("[Método OP] SEQUÊNCIA INCOMPLETA: estáticos faltando.", {
        esperados: comp.estatico,
        recebidos: estaticosRecebidos,
      });
    }
    if ((track === "visual" || track === "experimentacao") && finaisRecebidos < comp.fechamento) {
      console.warn("[Método OP] SEQUÊNCIA INCOMPLETA: estático final faltando.", {
        esperados: comp.fechamento,
        recebidos: finaisRecebidos,
      });
    }
  }
  if (track === "cinematica" || !track) {
    if (comp.fechamento > 0 && (!reels || reels.length === 0)) {
      console.warn("[Método OP] SEQUÊNCIA INCOMPLETA: reels esperado mas ausente.", {
        esperados: comp.fechamento,
        recebidos: reels?.length ?? 0,
      });
    }
  }

  const partial = {
    feed,
    carousel,
    reels,
    stories: Array.isArray(raw?.stories) ? raw.stories : undefined,
  };
  const summary = buildSummary(partial);

  return {
    ...partial,
    raw,
    summary,
    ...(flags.length > 0 ? { flags } : {}),
    ...(raw?.ancora_visual ? { ancora_visual: raw.ancora_visual } : {}),
  };
}