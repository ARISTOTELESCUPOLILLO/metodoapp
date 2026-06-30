// Gênero do personagem por bloco (estático + carrossel + fechamento + reels) —
// extraído de ResultsView.tsx (Fase 8). Ver computeBlockGenders em ./utils.

import { useMemo } from "react";
import type { CarouselCard, MethodOpResult } from "../../../types";
import { PersonagemGender } from "../../../core/visualDirection";
import { computeBlockGenders } from "./utils";

export interface BlockGenders {
  estatico: PersonagemGender;
  carrossel: PersonagemGender[];
  reels: PersonagemGender;
  final: PersonagemGender;
}

// Memoizado em `result`: persiste entre re-renders e entre "gerar de novo" de
// cada peça, e só recalcula quando um novo plano é gerado (result muda de
// referência).
export function useBlockGenders(
  result: MethodOpResult | undefined,
  anchorGenderEffective: PersonagemGender | undefined,
): BlockGenders[] {
  return useMemo(() => {
    const feed = result?.feed || [];
    const estaticosM = feed.filter((f) => f.formato !== "Estático Final");
    const estaticosFinaisM = feed.filter((f) => f.formato === "Estático Final");
    const reelsM = result?.reels || [];
    const carouselsM: CarouselCard[][] = [];
    if (result?.carousel?.length) {
      for (let i = 0; i < result.carousel.length; i += 5) {
        carouselsM.push(result.carousel.slice(i, i + 5));
      }
    }
    const maxBlocksM = Math.max(
      estaticosM.length,
      carouselsM.length,
      reelsM.length,
      estaticosFinaisM.length,
    );
    const blocks: BlockGenders[] = [];
    for (let i = 0; i < maxBlocksM; i++) {
      const pieces: { titulo: string; texto: string }[] = [];
      if (estaticosM[i]) pieces.push({ titulo: estaticosM[i].titulo, texto: estaticosM[i].texto });
      (carouselsM[i] || []).forEach((c) => pieces.push({ titulo: c.titulo, texto: c.texto }));
      if (reelsM[i]) pieces.push({ titulo: reelsM[i].hook, texto: reelsM[i].script });
      if (estaticosFinaisM[i])
        pieces.push({ titulo: estaticosFinaisM[i].titulo, texto: estaticosFinaisM[i].texto });
      const genders = computeBlockGenders(pieces, anchorGenderEffective);
      let p = 0;
      const estatico: PersonagemGender = estaticosM[i] ? genders[p++] : "homem";
      const carrossel: PersonagemGender[] = (carouselsM[i] || []).map(() => genders[p++]);
      const reels: PersonagemGender = reelsM[i] ? genders[p++] : "homem";
      const final: PersonagemGender = estaticosFinaisM[i] ? genders[p++] : "homem";
      blocks.push({ estatico, carrossel, reels, final });
    }
    return blocks;
  }, [result, anchorGenderEffective]);
}
