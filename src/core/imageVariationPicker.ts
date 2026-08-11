// Sorteio de variação de personagem/câmera/ruptura para o prompt de IMAGEM —
// extraído de visualDirection.ts (Fase 8).

import { MoodCode, Segment } from "../types";
import { detectForcedGenderFromCopy, PersonagemGender } from "./visualDirection";
// Importado direto de productHierarchy (e não do re-export em visualDirection)
// para não criar ciclo de import entre este módulo e visualDirection.
import { variationHasFaceNotDominant } from "./productHierarchy";
import {
  pickRandom,
  CLAREZA_CAMERA_VARIATIONS,
  CLAREZA_CHARACTER_VARIATIONS,
  IMPACTO_CAMERA_VARIATIONS,
  IMPACTO_CHARACTER_VARIATIONS,
  INSTANTE_CAMERA_VARIATIONS,
  INSTANTE_CHARACTER_VARIATIONS,
  INSTANTE_POOL_SEM_PDV,
  FRAGMENTO_GRID_VARIATIONS,
  DESVIO_SYMBOLIC_RUPTURE_VARIATIONS,
  DESVIO_CAMERA_VARIATIONS,
  SILENCIO_CAMERA_VARIATIONS,
  INSTANTE_PRECEDENCIA_PLANO,
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
    // ⚠ AQUI SÓ SE SORTEIA CÂMERA. O tipo de sujeito isolado chegou a ser
    // sorteado em 11/08/2026 (religando SILENCIO_OBJECT_VARIATIONS) e foi
    // REVERTIDO em 12/08/2026 por decisão do Aristóteles: o que a Fase 1 podia
    // mexer era posição/distância de câmera, luz e pose — não a gramática do
    // mood. Sortear o sujeito escolhia por ele entre fragmento humano, objeto
    // isolado, silhueta e macro, que é justamente a condição do SILÊNCIO, e
    // ainda atropelava o avatar: as seis variações do pool mandam a peça sair
    // sem rosto, e uma delas pede "mão ou fragmento de braço" — foi o que saiu
    // na peça real do Ari com avatar marcado. Não religar sem decisão dele.
    const camera = pickRandom(SILENCIO_CAMERA_VARIATIONS);
    return `\n⚠ VARIAÇÃO: ${genderBlock}Câmera: ${camera}. O objeto isolado nasce do ofício real da empresa — instrumento, ferramenta, material ou produto específico do negócio (PROIBIDO: livro genérico, caderno, óculos soltos, dispositivo digital como elemento principal). ${TEMA_DERIVATION_RULE}`;
  }

  if (mood === "OP-04") {
    // FRAGMENTO não entrava em nenhum sorteio até 11/08/2026: a grade dos 3-5
    // blocos saía sempre com o mesmo arranjo e o mesmo ponto de vista. Mesma
    // supressão dos outros moods — se a etapa de conteúdo já escreveu a
    // composição, sortear outra grade aqui produziria duas grades diferentes no
    // mesmo prompt.
    if (composicao) return "";
    const grade = pickRandom(FRAGMENTO_GRID_VARIATIONS);
    return `\n⚠ VARIAÇÃO: ${genderBlock}Arranjo da grade desta geração: ${grade} Manter a paleta unificada de 3 tons costurando todos os blocos e a margem de respiro das bordas — nenhum bloco encosta no limite do canvas. ${TEMA_DERIVATION_RULE}`;
  }

  const characterMap: Partial<Record<MoodCode, string[]>> = {
    "OP-01": CLAREZA_CHARACTER_VARIATIONS,
    "OP-02": IMPACTO_CHARACTER_VARIATIONS,
    "OP-03": INSTANTE_CHARACTER_VARIATIONS,
  };

  const variations = characterMap[mood];
  if (!variations) return "";

  const poolBase =
    mood === "OP-03" && segment && segment !== "VAREJO" ? INSTANTE_POOL_SEM_PDV : variations;
  // Avatar selecionado no Kit Imagem é um CONTRATO, não uma sugestão: o usuário
  // escolheu um rosto para aparecer na peça. As variações que retiram o rosto da
  // cena (CLAREZA "DETALHE CONTEXTUAL", IMPACTO "SUJEITO SEM PERSONAGEM
  // DOMINANTE") mandam o contrário — "o personagem existe pela presença parcial
  // (mão, braço, silhueta)" — e saem do sorteio quando há avatar. Achado real
  // 06/08/2026 (PU, Atrevidinha Modas, CLAREZA, VAREJO, mix avatar+cenário+
  // produto): a 1ª geração sorteou EM PÉ e o avatar apareceu; o "gerar
  // novamente" sorteou DETALHE CONTEXTUAL e a pessoa sumiu da peça — sem que
  // nada tivesse mudado na seleção do usuário. hasAvatarRef já chegava aqui,
  // mas só era usado para suprimir a declaração de gênero.
  const pool = hasAvatarRef
    ? (() => {
        const comRosto = poolBase.filter((v) => !variationHasFaceNotDominant(v));
        // Fallback defensivo: se algum mood futuro tiver TODAS as variações sem
        // rosto, é melhor sortear normalmente do que devolver pool vazio.
        return comRosto.length ? comRosto : poolBase;
      })()
    : poolBase;
  const variation = pickRandom(pool);
  const cameraStr = (() => {
    // OP-01 e OP-03: a câmera também é sorteada e escrita na composição pela
    // etapa de conteúdo (visualDirection.ts, mesmo bloco "VARIAÇÕES SORTEADAS")
    // quando leituraCenica.composicao existe — sortear de novo aqui pode
    // contradizer o ângulo que o GPT já registrou (ex.: "frontal" no texto vs.
    // "lateral 3/4" aqui). OP-02 nunca recebe câmera no lado do conteúdo (só
    // estrutura/gênero), então continua decidindo a câmera aqui sempre.
    //
    // OP-03 entrou nessa regra em 11/08/2026: até então a câmera dele era uma
    // string fixa, o que dispensava a reconciliação porque nunca havia dois
    // valores diferentes para conflitar.
    if (mood === "OP-01") {
      return composicao ? "" : `Câmera: ${pickRandom(CLAREZA_CAMERA_VARIATIONS)}. `;
    }
    if (mood === "OP-03") {
      return composicao ? "" : `Câmera: ${pickRandom(INSTANTE_CAMERA_VARIATIONS)}. `;
    }
    if (mood === "OP-02") return `Câmera: ${pickRandom(IMPACTO_CAMERA_VARIATIONS)}. `;
    return "";
  })();

  // Quando leituraCenica.composicao existe, a composição já está em cenaDetalhada —
  // re-sortear aqui contradiz o que GPT-4.1 escreveu. Câmera (só OP-01, acima) e
  // Estrutura (todos os moods deste bloco) são suprimidas nesse caso; gênero
  // ainda se aplica.
  const estruturaBlock = composicao ? "" : `Estrutura: ${variation} `;
  // Só o INSTANTE precisa: é o único mood em que câmera e estrutura de pose
  // declaram plano de forma independente (ver INSTANTE_PRECEDENCIA_PLANO).
  const precedencia =
    mood === "OP-03" && cameraStr && estruturaBlock ? INSTANTE_PRECEDENCIA_PLANO : "";
  // Gênero vem primeiro no bloco — é a restrição mais importante e não pode
  // ficar enterrada depois da câmera/estrutura (ver comentário acima).
  return `\n⚠ VARIAÇÃO: ${genderBlock}${cameraStr}${estruturaBlock}${precedencia}${TEMA_DERIVATION_RULE}`;
}
