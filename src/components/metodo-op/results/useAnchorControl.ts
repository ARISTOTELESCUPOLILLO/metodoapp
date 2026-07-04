// Estado e cálculo da âncora visual (gênero/idade/modo do personagem
// ancorado) — extraído de ResultsView.tsx (PLANO_V2 Fase 9.1, item já citado
// na tabela de hooks a criar). Lógica movida 1:1, sem mudança de
// comportamento.
import { useEffect, useState } from "react";
import type { MethodOpResult, FaixaEtaria } from "../../../types";
import { mapFaixaToAnchorAge } from "../../../core/audienceAge";
import type { PersonagemGender } from "../../../core/visualDirection";
import { type AnchorControl } from "./AnchorIndicator";

export function useAnchorControl(
  result: MethodOpResult | undefined,
  faixaEtariaForm: FaixaEtaria | null | undefined,
  generoPrefForm: "M" | "F" | null | undefined,
) {
  const [anchorGenderFlipped, setAnchorGenderFlipped] = useState(false);
  const [anchorAgeOverride, setAnchorAgeOverride] = useState<string | undefined>(undefined);
  const [anchorBannerOpen, setAnchorBannerOpen] = useState(false);
  const [anchorMode, setAnchorMode] = useState<"ancora" | "livre">("ancora");
  // Seed de cor de roupa da sequência — sorteado UMA vez por geração (result
  // novo) e repassado a todas as peças, pra que o avatar sem uniforme real
  // vista a MESMA cor prevista no estático, carrossel, fechamento e reels
  // (ver buildAnchorPrefix em regenerateWithKit).
  const [clothingSeed, setClothingSeed] = useState<number>(() => Math.random());

  // A cada nova geração, pré-preenche a âncora visual com a faixa etária e
  // o gênero escolhidos no form. O usuário pode ajustar depois no painel.
  useEffect(() => {
    if (!result) return;
    const mappedAge = mapFaixaToAnchorAge(faixaEtariaForm);
    setAnchorAgeOverride(mappedAge);
    if (generoPrefForm && result.ancora_visual) {
      const iaGenero = result.ancora_visual.genero; // "M" | "F"
      setAnchorGenderFlipped(iaGenero !== generoPrefForm);
    }
    setClothingSeed(Math.random());
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  // ancora_visual gerada pela IA junto com a sequência. Mostra sempre que existir —
  // a supressão por avatar acontece POR CARD em regenerateWithKit (hasAvatarRef),
  // não aqui: ter avatar no kit ≠ avatar sendo usado nesta geração específica.
  const ancoragem = result?.ancora_visual;
  const anchorAgeEffective = anchorAgeOverride ?? ancoragem?.faixa_etaria ?? "";
  // No modo 'livre' o gerador de imagem não recebe constraint de tipo —
  // gênero é balanceado livremente por peça (M/F alternados).
  const anchorGenderEffective: PersonagemGender | undefined =
    ancoragem && anchorMode === "ancora"
      ? anchorGenderFlipped
        ? ancoragem.genero === "F"
          ? "homem"
          : "mulher"
        : ancoragem.genero === "F"
          ? "mulher"
          : "homem"
      : undefined;
  const anchoraPersonagem: string | undefined =
    ancoragem && anchorMode === "ancora"
      ? [anchorAgeEffective].filter(Boolean).join(", ") || undefined
      : undefined;
  const ancoragePapel: string | undefined = ancoragem?.papel;
  const anchorControl: AnchorControl | undefined = ancoragem
    ? {
        ancoragem,
        genderEffective: anchorGenderEffective ?? (ancoragem.genero === "F" ? "mulher" : "homem"),
        ageEffective: anchorAgeEffective,
        onFlipGender: () => setAnchorGenderFlipped((f) => !f),
        onChangeAge: (age) => setAnchorAgeOverride(age),
      }
    : undefined;

  return {
    anchorBannerOpen,
    setAnchorBannerOpen,
    anchorMode,
    setAnchorMode,
    anchorControl,
    anchorGenderEffective,
    anchoraPersonagem,
    ancoragePapel,
    clothingSeed,
  };
}
