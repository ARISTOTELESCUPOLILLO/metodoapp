// Telemetria da variação visual — o que foi REALMENTE sorteado em cada imagem.
//
// Motivo (13/08/2026): até aqui não existia registro nenhum do mood nem dos
// eixos sorteados. Toda conversa sobre "as peças estão repetitivas" dependia da
// impressão de quem olhou um punhado de imagens, e toda correção de rodízio era
// deployada sem nenhuma forma de confirmar que mudou algo no uso real. A fila
// de variação da PU (12-13/08) é o caso extremo: ela tem memória entre peças e
// não havia como auditar se a memória está andando.
//
// ONDE ISSO É GRAVADO — e por que não em `user_generations`: aquela tabela só
// recebe linha quando o usuário clica em ARQUIVAR a peça (único chamador:
// components/metodo-op/ArchiveButton.tsx). Medir variação por lá enviesaria a
// amostra para as peças que o usuário GOSTOU o bastante para salvar — e as
// repetidas, que são justamente o que se quer contar, são as descartadas, que
// nunca chegam na tabela. `usage_logs` recebe uma linha por imagem gerada
// (evento `image.generate`), independente de arquivamento, e já tem a coluna
// `payload jsonb` livre. Nenhuma migration foi necessária.
//
// POR QUE RÓTULO CURTO, E NÃO O TEXTO INTEIRO: a linha de câmera composta pelos
// cinco eixos passa de 700 caracteres. Gravar isso por imagem incharia o log
// sem ganho — para CONTAR repetição basta identificar qual opção de cada eixo
// saiu. O rótulo é o começo do texto do eixo até seu primeiro delimitador
// ("PLANO PRÓXIMO", "lente 50mm", "câmera zenital"), que é legível e agrupável
// direto num GROUP BY.
//
// POR QUE LER DO PROMPT, E NÃO RETORNAR DOS SORTEIOS: buildCameraLine e
// pickImageVariationBlock devolvem string pronta, e são o coração dos moods —
// trocar o retorno delas por objeto para carregar metadado atravessaria
// visualDirection, buildImagePrompt e buildPuPrompt inteiros, com risco real de
// mudar o texto que vai ao modelo. O prompt final já CONTÉM o resultado do
// sorteio, e é o que efetivamente foi enviado: lê-lo é mais fiel do que
// reconstruir, e não toca em nenhuma regra de geração.

/** Marcador único do bloco de variação, escrito por pickImageVariationBlock. */
const MARCADOR_VARIACAO = "⚠ VARIAÇÃO:";

/** Separador entre os cinco eixos de câmera — ver buildCameraLine em cameraAxes.ts. */
const SEPARADOR_EIXOS = " · ";

/** Teto de caracteres de cada rótulo. Não é estético: é o que impede o texto
 *  seguinte do prompt de vazar para dentro do rótulo do último eixo. */
const MAX_ROTULO = 48;

/** Teto de eixos por linha de câmera. Hoje são 5 (distância, altura, ótica,
 *  profundidade, luz); a folga cobre um eixo novo sem virar log sem fim. */
const MAX_EIXOS = 8;

export interface VariacaoTelemetria {
  /** Código do mood (OP-01..OP-06), quando a peça tem mood. */
  mood?: string;
  /** Posição na fila de variação do usuário (nextVariacaoSeed). Ausente quando
   *  o caminho ainda sorteia em vez de andar na fila. */
  seed?: number;
  /** Havia avatar do Kit Imagem entre as referências — muda a faixa de
   *  distância permitida (ver distanciaPreservaOAvatar). */
  avatar?: boolean;
  /** Rótulos dos eixos de câmera, na ordem em que saíram. */
  camera?: string[];
  /** Rótulo da pose/ruptura/grade sorteada. */
  estrutura?: string;
}

/**
 * Reduz o texto de um eixo ao seu rótulo: o trecho inicial até o primeiro
 * delimitador natural, limitado a MAX_ROTULO caracteres.
 *
 * Os delimitadores são os que os próprios pools usam para separar o nome da
 * opção da sua descrição — ":" ("PLANO PRÓXIMO: enquadramento fechado..."),
 * "," ("lente 28mm, angular que exagera...") e "." (fim de frase). O travessão
 * "—" entra também porque vários eixos abrem a ressalva com ele. O hífen comum
 * fica DE FORA de propósito: cortar nele quebraria "CONTRA-PLONGÉE SUAVE" e
 * "alta-chave" no meio.
 */
export function rotuloDoEixo(texto: string): string {
  const limpo = (texto || "").trim();
  if (!limpo) return "";
  let corte = limpo.length;
  for (const delim of [":", ",", "—", ". "]) {
    const i = limpo.indexOf(delim);
    if (i > 0 && i < corte) corte = i;
  }
  let rotulo = limpo.slice(0, corte).trim();
  if (rotulo.length > MAX_ROTULO) {
    // Corta no limite de palavra mais próximo para não deixar rótulo picotado
    // no meio de um termo — e cai no corte seco se a palavra sozinha já estoura.
    const janela = rotulo.slice(0, MAX_ROTULO);
    const ultimoEspaco = janela.lastIndexOf(" ");
    rotulo = (ultimoEspaco > MAX_ROTULO * 0.5 ? janela.slice(0, ultimoEspaco) : janela).trim();
  }
  return rotulo;
}

/** Recorta do prompt o bloco de variação — o trecho que pickImageVariationBlock
 *  injetou. Devolve "" quando a peça não tem bloco de variação (mood ausente,
 *  ou composição já escrita pela etapa de conteúdo, que suprime o sorteio). */
function recortarBlocoVariacao(prompt: string): string {
  const inicio = prompt.indexOf(MARCADOR_VARIACAO);
  if (inicio < 0) return "";
  return prompt.slice(inicio + MARCADOR_VARIACAO.length);
}

/**
 * Extrai os rótulos dos eixos de câmera do bloco de variação.
 *
 * O bloco traz "Câmera: eixo1 · eixo2 · ... · eixoN. <texto seguinte>". Só o
 * ÚLTIMO pedaço do split vem colado no texto seguinte — e é justamente o corte
 * do rótulo que o descarta, sem depender de adivinhar onde a linha termina.
 */
export function extrairEixosDeCamera(prompt: string): string[] {
  const bloco = recortarBlocoVariacao(prompt);
  if (!bloco) return [];
  const i = bloco.indexOf("Câmera: ");
  if (i < 0) return [];
  const depois = bloco.slice(i + "Câmera: ".length);
  return depois.split(SEPARADOR_EIXOS).slice(0, MAX_EIXOS).map(rotuloDoEixo).filter(Boolean);
}

/** Rótulos de estrutura, na ordem em que os moods os nomeiam. "Estrutura da
 *  ruptura" vem ANTES de "Estrutura" porque o segundo é prefixo do primeiro e
 *  casaria antes, devolvendo rótulo vazio. */
const PREFIXOS_ESTRUTURA = [
  "Estrutura da ruptura: ",
  "Estrutura: ",
  "Arranjo da grade desta geração: ",
];

/** Extrai o rótulo da pose/ruptura/grade sorteada. Devolve "" quando a etapa de
 *  conteúdo já escreveu a composição — nesse caso o sorteio é suprimido de
 *  propósito, e a ausência do rótulo é informação, não falha. */
export function extrairEstrutura(prompt: string): string {
  const bloco = recortarBlocoVariacao(prompt);
  if (!bloco) return "";
  for (const prefixo of PREFIXOS_ESTRUTURA) {
    const i = bloco.indexOf(prefixo);
    if (i >= 0) return rotuloDoEixo(bloco.slice(i + prefixo.length));
  }
  return "";
}

/**
 * Monta o registro de telemetria desta imagem. Campos vazios são omitidos —
 * o log guarda o que houve, não uma carcaça de nulos.
 */
export function montarVariacaoTelemetria(opts: {
  prompt: string;
  mood?: string;
  seed?: number;
  avatar?: boolean;
}): VariacaoTelemetria | undefined {
  const { prompt, mood, seed, avatar } = opts;
  const camera = extrairEixosDeCamera(prompt || "");
  const estrutura = extrairEstrutura(prompt || "");
  const meta: VariacaoTelemetria = {};
  if (mood) meta.mood = mood;
  if (typeof seed === "number" && Number.isFinite(seed)) meta.seed = seed;
  if (typeof avatar === "boolean") meta.avatar = avatar;
  if (camera.length) meta.camera = camera;
  if (estrutura) meta.estrutura = estrutura;
  return Object.keys(meta).length ? meta : undefined;
}

/**
 * Saneamento do lado do SERVIDOR. A telemetria é montada no browser e chega
 * pelo corpo da requisição — mesmo vindo de usuário autenticado, o servidor não
 * grava no banco o que o cliente mandar: aceita só as chaves conhecidas, com
 * tipo e tamanho conferidos. Sem isso, um cliente adulterado escreveria texto
 * arbitrário (e de tamanho arbitrário) direto no `payload` de `usage_logs`.
 *
 * Devolve undefined quando não sobra nada aproveitável — e quem chama grava o
 * payload sem o campo, em vez de gravar um objeto vazio.
 */
export function sanitizarVariacaoTelemetria(bruto: unknown): VariacaoTelemetria | undefined {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return undefined;
  const src = bruto as Record<string, unknown>;
  const texto = (v: unknown, max: number): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

  const meta: VariacaoTelemetria = {};
  const mood = texto(src.mood, 16);
  if (mood) meta.mood = mood;
  if (typeof src.seed === "number" && Number.isFinite(src.seed)) {
    meta.seed = Math.trunc(src.seed);
  }
  if (typeof src.avatar === "boolean") meta.avatar = src.avatar;
  if (Array.isArray(src.camera)) {
    const camera = src.camera
      .slice(0, MAX_EIXOS)
      .map((e) => texto(e, MAX_ROTULO))
      .filter((e): e is string => !!e);
    if (camera.length) meta.camera = camera;
  }
  const estrutura = texto(src.estrutura, MAX_ROTULO);
  if (estrutura) meta.estrutura = estrutura;
  return Object.keys(meta).length ? meta : undefined;
}
