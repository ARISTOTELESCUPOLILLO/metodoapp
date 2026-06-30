// Monta a sequência intercalada de peças (estático/carrossel/reels/final) do
// feed, na ordem em que aparecem no plano — extraído de ResultsView.tsx (Fase 8).

import type { CarouselCard, FeedItem, MethodOpResult, ReelsGuide } from "../../../types";

export type DayItem =
  | { type: "feed"; day: number; block: number; item: FeedItem }
  | { type: "final"; day: number; block: number; item: FeedItem }
  | { type: "carousel"; day: number; block: number; cards: CarouselCard[] }
  | { type: "reels"; day: number; block: number; reels: ReelsGuide };

export function buildDaySequence(result: MethodOpResult): {
  sequence: DayItem[];
  estaticos: FeedItem[];
  carousels: CarouselCard[][];
} {
  const allFeed = result.feed || [];
  const estaticos = allFeed.filter((f) => f.formato !== "Estático Final");
  const estaticosFinais = allFeed.filter((f) => f.formato === "Estático Final");

  const sequence: DayItem[] = [];
  let day = 1;
  const reelsList: ReelsGuide[] = result.reels || [];
  const carousels: CarouselCard[][] = [];

  if (result.carousel?.length) {
    for (let i = 0; i < result.carousel.length; i += 5) {
      carousels.push(result.carousel.slice(i, i + 5));
    }
  }

  const maxBlocks = Math.max(
    estaticos.length,
    carousels.length,
    reelsList.length,
    estaticosFinais.length,
  );
  for (let i = 0; i < maxBlocks; i++) {
    if (estaticos[i]) sequence.push({ type: "feed", day: day++, block: i, item: estaticos[i] });
    if (carousels[i])
      sequence.push({ type: "carousel", day: day++, block: i, cards: carousels[i] });
    if (reelsList[i]) sequence.push({ type: "reels", day: day++, block: i, reels: reelsList[i] });
    if (estaticosFinais[i])
      sequence.push({ type: "final", day: day++, block: i, item: estaticosFinais[i] });
  }

  return { sequence, estaticos, carousels };
}
