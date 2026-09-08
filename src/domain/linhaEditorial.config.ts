// Linha Editorial — tabelas de configuração da Informação-chave Editorial
// (piloto, atrás da flag profiles.beta_editorial).
//
// O QUE É: a Linha Editorial entra ANTES da manifestação. Ela não substitui o
// Objetivo da Peça (PU), a Intenção declarada, nem a progressão psicológica do
// MOP — ela decide POR QUAL PERSPECTIVA o assunto será abordado, e com isso
// permite que a Informação-chave deixe de ser um assunto curto (4-9 palavras,
// caminho Legacy em core/sugestaoEngine.ts) e passe a ser uma PROPOSIÇÃO
// EDITORIAL completa (~14-22 palavras).
//
// POR QUE UM ARQUIVO DE DADOS SEPARADO: mesmo contrato de
// domain/objetivo.config.ts e domain/audienceSegment.config.ts — dados de
// domínio ficam fora do motor, para que o motor (core/editorialKeyInfo.ts)
// seja lógica pura e testável, e para que ajustar uma redação de linha
// editorial não exija tocar em código de geração.

import type { PostUnicoObjetivo } from "../types";

/** As cinco linhas editoriais do Método OP. */
export type LinhaEditorial =
  | "diagnostico"
  | "conhecimento"
  | "experiencia"
  | "transformacao"
  | "decisao";

/** O que o usuário escolhe na tela — "auto" deixa a decisão com o motor. */
export type LinhaEditorialEscolha = LinhaEditorial | "auto";

/**
 * Como o Produto/Serviço/Tema selecionado participa da comunicação.
 * A escolha manual do usuário SEMPRE prevalece sobre o "auto".
 */
export type UsoDoObjeto = "auto" | "nome" | "sem_nome" | "nao_usar";

export const LINHAS_EDITORIAIS: readonly LinhaEditorial[] = [
  "diagnostico",
  "conhecimento",
  "experiencia",
  "transformacao",
  "decisao",
] as const;

export const USOS_DO_OBJETO: readonly UsoDoObjeto[] = [
  "auto",
  "nome",
  "sem_nome",
  "nao_usar",
] as const;

interface LinhaEditorialSpec {
  /** Rótulo exibido na tela e na etiqueta de cada sugestão. */
  label: string;
  /** Pergunta conceitual — vira subtítulo do seletor, em linguagem de cliente. */
  pergunta: string;
  /** Direção dada ao modelo. É a única parte que entra no prompt. */
  guia: string;
  /** Erro típico desta linha — proibição específica, evita o desvio conhecido. */
  evitar: string;
  /** Exemplo de calibração (referência interna, o modelo não deve copiar). */
  exemplo: string;
}

export const LINHA_EDITORIAL_SPEC: Record<LinhaEditorial, LinhaEditorialSpec> = {
  diagnostico: {
    label: "Diagnóstico",
    pergunta: "O que pode estar acontecendo?",
    guia: "Faça o público RECONHECER uma situação que ele pode estar vivendo — um sintoma, uma dificuldade, uma lacuna, uma dúvida ou uma oportunidade que passa despercebida. A frase descreve o que acontece, não o que fazer. Use forma de possibilidade ('pode', 'costuma', 'às vezes'), nunca de acusação.",
    evitar:
      "PROIBIDO virar conselho, receita ou chamada para ação ('faça', 'invista', 'contrate'), e PROIBIDO culpar o leitor ('você não sabe', 'você está perdendo'). Diagnóstico NOMEIA a situação; quem indica o caminho é a linha DECISÃO.",
    exemplo:
      "Receber muitas visitas no perfil e poucos contatos pode indicar um problema na comunicação da oferta.",
  },
  conhecimento: {
    label: "Conhecimento",
    pergunta: "O que é importante compreender?",
    guia: "Ajude o público a COMPREENDER algo — uma diferença entre dois termos, uma causa, uma relação, um critério ou o funcionamento de alguma coisa. A frase ensina uma distinção útil, com os dois lados nomeados quando houver dois lados.",
    evitar:
      "PROIBIDO fundir os dois lados da distinção numa afirmação única, PROIBIDO virar dica de execução ('use isso', 'faça assim') e PROIBIDO tom de aula ('entenda que', 'saiba que').",
    exemplo:
      "Alcance mostra quantas pessoas receberam a mensagem; conversão mostra quantas avançaram para uma ação importante.",
  },
  experiencia: {
    label: "Experiência",
    pergunta: "O que a prática nos mostra?",
    guia: "Apresente uma CONSTATAÇÃO derivada da prática, do uso real ou da observação de situações que se repetem. A frase relata o que se observa acontecer, com marca de repetição ('costuma', 'na maioria das vezes', 'na prática', 'quase sempre').",
    evitar:
      "ATENÇÃO — EXPERIÊNCIA NÃO É EXPERIMENTO: PROIBIDO transformar em teste, tutorial ou convite a experimentar ('faça um teste', 'experimente', 'tente'). PROIBIDO também virar caso de sucesso, depoimento ou número de resultado da própria empresa. É o que a prática REVELA, não o que a empresa conquistou.",
    exemplo:
      "Na prática, aumentar a verba dos anúncios não costuma resolver uma mensagem que o público ainda não compreendeu.",
  },
  transformacao: {
    label: "Transformação",
    pergunta: "O que está mudando?",
    guia: "Mostre uma MUDANÇA EM CURSO — uma nova possibilidade ou uma nova maneira de fazer algo. A frase precisa deixar visíveis os DOIS momentos: de onde vem e para onde vai ('está deixando de X e começando a Y', 'antes era X, hoje é Y'). O agente da mudança pode ser tecnologia, dados, automação, comportamento, novos hábitos ou novos processos.",
    evitar:
      "PROIBIDO apagar o ponto de partida e sobrar só o estado novo — sem o 'de onde vem' a frase deixa de ser transformação e vira conhecimento. PROIBIDO futurologia sem base ('vai revolucionar', 'o futuro chegou') e PROIBIDO tratar inteligência artificial como se ela mesma fosse a linha editorial: ela é apenas um dos agentes possíveis da mudança.",
    exemplo:
      "A inteligência artificial está deixando de apenas produzir conteúdos e começando a ajudar empresas a decidir melhor.",
  },
  decisao: {
    label: "Decisão",
    pergunta: "Diante disso, o que vale escolher?",
    guia: "Ajude o público a COMPARAR e ESCOLHER — colocando duas alternativas reais lado a lado, ou nomeando o critério que separa uma da outra. A frase apresenta a escolha; ela não a faz pelo leitor nem empurra uma das opções.",
    evitar:
      "PROIBIDO virar chamada comercial ('contrate', 'fale com a gente', 'garanta já') e PROIBIDO apresentar uma alternativa só — sem duas opções ou sem critério explícito, deixa de ser decisão e vira conselho.",
    exemplo:
      "Antes de aumentar a verba, vale decidir se a campanha precisa de mais alcance ou de uma mensagem mais direta.",
  },
};

/**
 * Compatibilidade Objetivo da Peça × Linha Editorial — usada APENAS quando a
 * Linha Editorial está em "auto". Escolha manual do usuário sempre prevalece.
 *
 * A ordem dentro de cada lista é ordem de PREFERÊNCIA: a primeira sugestão da
 * rodada tende a nascer da primeira linha listada. "nenhum" recebe o rodízio
 * completo, na ordem canônica.
 */
export const OBJETIVO_LINHAS_PREFERIDAS: Record<PostUnicoObjetivo, readonly LinhaEditorial[]> = {
  promocao: ["decisao", "conhecimento", "experiencia", "diagnostico", "transformacao"],
  homenagem: ["experiencia", "conhecimento", "transformacao"],
  aviso: ["conhecimento", "decisao", "diagnostico", "transformacao"],
  oportunidade: ["decisao", "conhecimento", "experiencia", "transformacao"],
  institucional: ["experiencia", "transformacao", "conhecimento"],
  fatos: ["conhecimento", "experiencia", "transformacao"],
  // "venda" não aparece na tabela do pedido; segue a mesma lógica comercial de
  // promoção/oportunidade (o objetivo pede decisão de compra).
  venda: ["decisao", "conhecimento", "experiencia", "diagnostico"],
  nenhum: ["diagnostico", "conhecimento", "experiencia", "transformacao", "decisao"],
};

/** Preferência do MOP — o Método OP não tem Objetivo da Peça. */
export const MOP_LINHAS_PREFERIDAS: readonly LinhaEditorial[] = [
  "diagnostico",
  "conhecimento",
  "experiencia",
  "transformacao",
  "decisao",
];

export function isLinhaEditorial(v: unknown): v is LinhaEditorial {
  return typeof v === "string" && (LINHAS_EDITORIAIS as readonly string[]).includes(v);
}

export function isUsoDoObjeto(v: unknown): v is UsoDoObjeto {
  return typeof v === "string" && (USOS_DO_OBJETO as readonly string[]).includes(v);
}

/** Normaliza o que veio do cliente; qualquer lixo vira null (fecha o beta). */
export function parseLinhaEditorial(v: unknown): LinhaEditorial | null {
  return isLinhaEditorial(v) ? v : null;
}

export function parseUsoDoObjeto(v: unknown): UsoDoObjeto {
  return isUsoDoObjeto(v) ? v : "auto";
}

/**
 * Resolve a Linha Editorial de UMA sugestão quando o usuário deixou em "auto".
 *
 * REGRA (item 20 do pedido): não é rodízio cego. No PU, a lista de preferência
 * vem do Objetivo da Peça; no MOP, da ordem canônica. Dentro da lista, as
 * linhas JÁ USADAS nesta rodada saem do sorteio primeiro — é isso que faz a
 * sugestão 2 vir de uma perspectiva diferente da 1 sem precisar de estado no
 * servidor (o cliente manda `linhasUsadas`, o motor é puro).
 *
 * Quando todas as preferidas já foram usadas (rodada de 3 sobre uma lista de
 * 3, caso de "homenagem"), volta a girar sobre a lista cheia em vez de
 * devolver null — a rodada nunca fica sem linha.
 */
export function resolverLinhaAuto(params: {
  mode: "postunico" | "metodo";
  objetivo?: PostUnicoObjetivo | string;
  /** Linhas já entregues nesta MESMA rodada (não no histórico da conta). */
  linhasUsadas: LinhaEditorial[];
  /** Índice da sugestão dentro da rodada: 0, 1 ou 2. */
  attempt: number;
}): LinhaEditorial {
  const { mode, objetivo, linhasUsadas, attempt } = params;
  const preferidas =
    mode === "postunico"
      ? (OBJETIVO_LINHAS_PREFERIDAS[objetivo as PostUnicoObjetivo] ??
        OBJETIVO_LINHAS_PREFERIDAS.nenhum)
      : MOP_LINHAS_PREFERIDAS;

  const disponiveis = preferidas.filter((l) => !linhasUsadas.includes(l));
  const pool = disponiveis.length > 0 ? disponiveis : preferidas;
  // `attempt` só desempata quando a rodada é reiniciada sem limpar as usadas —
  // no caminho normal `disponiveis[0]` já é a próxima preferida ainda livre.
  return pool[attempt % pool.length] ?? preferidas[0];
}
