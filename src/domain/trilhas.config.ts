// AS TRILHAS DA MONTAGEM — acervo curado, não upload do cliente.
//
// ⚠ POR QUE CURADO E NÃO UPLOAD (decisão de 11/09/2026): se o campo fosse
// "envie sua música", cada cliente subiria o que tem no computador, que quase
// sempre é música protegida. O Instagram silencia ou derruba o post, e o
// problema volta para a agência, não para o cliente. Ele escolhe de uma lista
// que o Ari montou — sem decidir sobre licença, que é justamente o que ele não
// sabe fazer.
//
// ⚠ OS ARQUIVOS SÃO CORTADOS EM 25 s. A montagem usa os primeiros ~11 s e o
// corte é feito em fronteira de quadro MPEG, sem recodificar (o original é
// 320 kbps, 44,1 kHz, entre 1,6 e 1,9 min). Guardar as faixas inteiras
// significaria o navegador baixar 4 MB para usar 11 s.
//
// ⚠ E ELAS COMEÇAM SEM FADE, de propósito: a música entra por baixo da fala já
// em movimento. Quem faz o volume é a montagem (baixo na locução, subindo no
// fim), não o arquivo.

export interface Trilha {
  /** Guardado no Kit. Mudar isto quebra a escolha de quem já escolheu. */
  id: string;
  /** O que o cliente lê na lista — nome do clima, não o nome da faixa. */
  nome: string;
  /** Para que serve, em uma linha. É o que ajuda alguém a escolher. */
  uso: string;
  arquivo: string;
}

export const TRILHAS: Trilha[] = [
  {
    id: "vibe-mountain",
    nome: "Leve e otimista",
    uso: "Serviço, consultoria, saúde — clima claro, sem peso.",
    arquivo: "/trilhas/vibe-mountain.mp3",
  },
  {
    id: "magic-in-the-other",
    nome: "Urbana e moderna",
    uso: "Loja, moda, tecnologia — ritmo de cidade, energia contida.",
    arquivo: "/trilhas/magic-in-the-other.mp3",
  },
  {
    id: "headphones",
    nome: "Calma e profissional",
    uso: "Escritório, jurídico, contabilidade — sobriedade sem frieza.",
    arquivo: "/trilhas/headphones.mp3",
  },
];

/** A que toca quando a marca ainda não escolheu nenhuma. */
export const TRILHA_PADRAO_ID = "vibe-mountain";

/**
 * Endereço do arquivo a partir do que está guardado no Kit.
 *
 * Devolve "" quando a marca escolheu SEM TRILHA — e aí o filme sai só com a
 * locução, que é uma escolha legítima e não uma falha.
 */
export function arquivoDaTrilha(id: string | null | undefined): string {
  if (id === "nenhuma") return "";
  const escolhida = TRILHAS.find((t) => t.id === id);
  if (escolhida) return escolhida.arquivo;
  return TRILHAS.find((t) => t.id === TRILHA_PADRAO_ID)?.arquivo || "";
}
