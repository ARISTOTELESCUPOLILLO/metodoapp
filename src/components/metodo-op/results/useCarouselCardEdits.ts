// Estado por card do carrossel (titulo/texto/legenda editáveis + contadores),
// persistência em localStorage e resincronização quando D2 corrige os cards
// upstream — extraído de CarouselCardBlock.tsx (PLANO_V2 Fase 9.1). Movido
// 1:1, sem mudança de comportamento.
import { useEffect, useMemo, useRef, useState } from "react";
import type { CarouselCard } from "../../../types";
import { loadCopyEdit, saveCopyEdit } from "../../../utils/copyEditsStorage";

export function useCarouselCardEdits(
  cards: CarouselCard[],
  userId: string | null | undefined,
  dayNumber: number,
) {
  const cardCopyKey = (index: number) => `carousel:${dayNumber}:${cards[index].card}`;
  const savedCardEdits = useMemo(
    () => cards.map((c) => loadCopyEdit(userId, `carousel:${dayNumber}:${c.card}`)),
    [userId, dayNumber, cards],
  );
  const [titulos, setTitulos] = useState(
    cards.map((c, i) => savedCardEdits[i]?.titulo ?? c.titulo),
  );
  const [textos, setTextos] = useState(cards.map((c, i) => savedCardEdits[i]?.texto ?? c.texto));
  const [legendas, setLegendas] = useState(
    cards.map((c, i) => savedCardEdits[i]?.legenda ?? c.legenda ?? ""),
  );
  const [tCounts, setTCounts] = useState(cards.map((_, i) => savedCardEdits[i]?.tCount ?? 0));
  const [xCounts, setXCounts] = useState(cards.map((_, i) => savedCardEdits[i]?.xCount ?? 0));
  const [lCounts, setLCounts] = useState(cards.map((_, i) => savedCardEdits[i]?.lCount ?? 0));
  useEffect(() => {
    cards.forEach((_, i) => {
      saveCopyEdit(userId, cardCopyKey(i), {
        titulo: titulos[i],
        texto: textos[i],
        legenda: legendas[i],
        tCount: tCounts[i],
        xCount: xCounts[i],
        lCount: lCounts[i],
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dayNumber, titulos, textos, legendas, tCounts, xCounts, lCounts]);

  // D2 pode corrigir card.titulo/texto/legenda depois que o bloco já foi
  // montado/aberto — resincroniza por índice quem o usuário não editou.
  const prevUpstreamCardsRef = useRef(
    cards.map((c) => ({ titulo: c.titulo, texto: c.texto, legenda: c.legenda || "" })),
  );
  useEffect(() => {
    const prev = prevUpstreamCardsRef.current;
    setTitulos((arr) =>
      arr.map((cur, i) =>
        cards[i].titulo !== prev[i]?.titulo && cur === prev[i]?.titulo ? cards[i].titulo : cur,
      ),
    );
    setTextos((arr) =>
      arr.map((cur, i) =>
        cards[i].texto !== prev[i]?.texto && cur === prev[i]?.texto ? cards[i].texto : cur,
      ),
    );
    setLegendas((arr) =>
      arr.map((cur, i) => {
        const upstream = cards[i].legenda || "";
        return upstream !== prev[i]?.legenda && cur === prev[i]?.legenda ? upstream : cur;
      }),
    );
    prevUpstreamCardsRef.current = cards.map((c) => ({
      titulo: c.titulo,
      texto: c.texto,
      legenda: c.legenda || "",
    }));
  }, [cards]);

  return {
    titulos,
    setTitulos,
    textos,
    setTextos,
    legendas,
    setLegendas,
    tCounts,
    setTCounts,
    xCounts,
    setXCounts,
    lCounts,
    setLCounts,
  };
}
