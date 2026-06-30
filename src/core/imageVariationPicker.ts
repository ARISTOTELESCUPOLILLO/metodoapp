// Sorteio de variação de personagem/câmera/ruptura para o prompt de IMAGEM —
// extraído de visualDirection.ts (Fase 8).

import { MoodCode, Segment } from "../types";
import { detectForcedGenderFromCopy, PersonagemGender } from "./visualDirection";
import {
  pickRandom,
  CLAREZA_CAMERA_VARIATIONS,
  CLAREZA_CHARACTER_VARIATIONS,
  IMPACTO_CAMERA_VARIATIONS,
  IMPACTO_CHARACTER_VARIATIONS,
  INSTANTE_CHARACTER_VARIATIONS,
  DESVIO_SYMBOLIC_RUPTURE_VARIATIONS,
  DESVIO_CAMERA_VARIATIONS,
  SILENCIO_CAMERA_VARIATIONS,
  PERSONAGEM_GENDER_VARIATIONS,
} from "./visualDirection.lexicon";

// Sorteia uma variação de personagem/ruptura para injetar no prompt de IMAGEM a cada geração.
// Garante que "Gerar outra" nunca reuse a mesma pose — chame a cada vez que o prompt for construído.
export function pickImageVariationBlock(
  mood: MoodCode | undefined,
  hasAvatarRef?: boolean,
  titulo?: string,
  texto?: string,
  forcedGender?: PersonagemGender,
  anchoraPersonagem?: string,
  composicao?: string,
  hasCenarioRef?: boolean,
  segment?: Segment,
): string {
  if (!mood) return "";

  // Calculado aqui (antes dos early-returns de OP-05/06) para que todos os
  // moods recebam a restrição de gênero. Antes, OP-05/06 retornavam sem nenhum
  // genderBlock, deixando o modelo livre para cair no viés masculino mesmo
  // quando o usuário havia marcado "Feminino" no form.
  const genderBlock = hasAvatarRef
    ? ""
    : (() => {
        const decidido = forcedGender ?? detectForcedGenderFromCopy(titulo, texto);
        // Sem decisão explícita, só sorteia quando não há composicao — evita
        // contradizer o personagem que o GPT já escreveu na etapa de conteúdo.
        const gender = decidido ?? (composicao ? null : pickRandom(PERSONAGEM_GENDER_VARIATIONS));
        if (!gender) return "";
        const oposto = gender === "mulher" ? "homem" : "mulher";
        const anchoraDesc = anchoraPersonagem ? `, ${anchoraPersonagem}` : "";
        return `PERSONAGEM — GÊNERO OBRIGATÓRIO (PRECEDÊNCIA MÁXIMA, sobrepõe qualquer outra descrição de cena, pose ou contexto): a pessoa retratada DEVE ser ${gender}${anchoraDesc}. PROIBIDO gerar ${oposto} ou personagem de gênero ambíguo/indefinido. `;
      })();

  const TEMA_DERIVATION_RULE =
    'Gesto/ação do personagem deriva do que o título e texto comunicam (ex: "comunicação" → revisar material, direcionar produção ou apresentar plano a alguém; "atendimento" → atender; "transparência" → mostrar/revisar). Metáforas/modificadores do título ("rumo", "avançar", "longe", "crescimento", "rápido", "forte", "claro") = intenção ou qualidade do ofício — nunca deslocamento físico nem propriedade literal.';

  if (mood === "OP-05") {
    // Quando leituraCenica.composicao já existe, a ruptura simbólica e a câmera
    // desta peça já foram sorteadas e escritas pela etapa de conteúdo (mesmo
    // bloco "VARIAÇÕES SORTEADAS" em buildVisualDirectionBlock) — sortear de
    // novo aqui pode tirar uma ruptura DIFERENTE da que o GPT já escreveu no
    // imagePrompt/leituraCenica, produzindo duas rupturas contraditórias no
    // mesmo prompt (ex.: ambiente industrial da ruptura já escrita vs. ambiente
    // doméstico de uma ruptura re-sorteada "OBJETO DESLOCADO").
    if (composicao) return "";
    // Cada item de DESVIO_SYMBOLIC_RUPTURE_VARIATIONS termina com uma cláusula
    // "AMBIENTE: ..." fixa — quando há foto real de cenário de referência, essa
    // cláusula compete e contradiz o local registrado (ver hasCenarioRef em
    // buildImagePrompt). Removemos a cláusula, mantendo o resto da ruptura.
    const rupturaRaw = pickRandom(DESVIO_SYMBOLIC_RUPTURE_VARIATIONS);
    const ruptura = hasCenarioRef ? rupturaRaw.replace(/\s*AMBIENTE:.*$/, "") : rupturaRaw;
    const camera = pickRandom(DESVIO_CAMERA_VARIATIONS);
    return `\n⚠ VARIAÇÃO: ${genderBlock}Câmera: ${camera}. Estrutura da ruptura: ${ruptura}. ${TEMA_DERIVATION_RULE} O elemento da ruptura deriva do tema — nunca clichê genérico (ver regra CONCEITO-FIRST). Uma ruptura por cena.`;
  }

  if (mood === "OP-06") {
    // Mesmo motivo do OP-05 acima — o objeto isolado e a câmera desta peça já
    // foram decididos pela etapa de conteúdo quando composicao existe.
    if (composicao) return "";
    const camera = pickRandom(SILENCIO_CAMERA_VARIATIONS);
    return `\n⚠ VARIAÇÃO: ${genderBlock}Câmera: ${camera}. O objeto isolado nasce do ofício real da empresa — instrumento, ferramenta, material ou produto específico do negócio (PROIBIDO: livro genérico, caderno, óculos soltos, dispositivo digital como elemento principal). ${TEMA_DERIVATION_RULE}`;
  }

  const characterMap: Partial<Record<MoodCode, string[]>> = {
    "OP-01": CLAREZA_CHARACTER_VARIATIONS,
    "OP-02": IMPACTO_CHARACTER_VARIATIONS,
    "OP-03": INSTANTE_CHARACTER_VARIATIONS,
  };

  const variations = characterMap[mood];
  if (!variations) return "";

  const pool =
    mood === "OP-03" && segment && segment !== "VAREJO"
      ? [
          INSTANTE_CHARACTER_VARIATIONS[2],
          INSTANTE_CHARACTER_VARIATIONS[5],
          INSTANTE_CHARACTER_VARIATIONS[6],
        ]
      : variations;
  const variation = pickRandom(pool);
  const cameraStr = (() => {
    if (mood === "OP-01") return `Câmera: ${pickRandom(CLAREZA_CAMERA_VARIATIONS)}. `;
    if (mood === "OP-02") return `Câmera: ${pickRandom(IMPACTO_CAMERA_VARIATIONS)}. `;
    if (mood === "OP-03") return "Câmera: 35mm levemente alta, distância natural, grão sutil. ";
    return "";
  })();

  // Quando leituraCenica.composicao existe, a composição já está em cenaDetalhada —
  // re-sortear aqui contradiz o que GPT-4.1 escreveu. Câmera e gênero ainda se aplicam.
  const estruturaBlock = composicao ? "" : `Estrutura: ${variation} `;
  // Gênero vem primeiro no bloco — é a restrição mais importante e não pode
  // ficar enterrada depois da câmera/estrutura (ver comentário acima).
  return `\n⚠ VARIAÇÃO: ${genderBlock}${cameraStr}${estruturaBlock}${TEMA_DERIVATION_RULE}`;
}
