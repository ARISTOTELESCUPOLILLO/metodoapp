// Tipos e dados estáticos da aba Divulgação — extraído de DivulgacaoTab.tsx (Fase 9.1).

export interface Plan {
  id: string;
  codigo: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  preco_maximo_brl: number;
}

export const CARD_INFO: Record<string, { titulo: string; subtitulo: string }> = {
  EX01: {
    titulo: "CONHEÇA O MÉTODO OP - 3 POSTAGENS",
    subtitulo: "Criação de uma sequência com conteúdo e imagem pronta para postar no Instagram.",
  },
  PU2: {
    titulo: "DUAS POSTAGENS PARA VOCÊ TESTAR",
    subtitulo: "Passo a passo que traz facilidade e qualidade.",
  },
  PU4: {
    titulo: "QUATRO IDEIAS PARA MOVIMENTAR O FEED",
    subtitulo:
      "Conteúdos rápidos para variar temas, reforçar presença e manter sua marca em circulação.",
  },
  PU8: {
    titulo: "OITO POSTAGENS PARA DAR CORPO À PRESENÇA",
    subtitulo:
      "Mais fôlego para testar abordagens, organizar mensagens e deixar o Instagram mais vivo.",
  },
  S3V: {
    titulo: "TRÊS SEQUÊNCIAS VISUAIS COM COMEÇO, MEIO E AÇÃO",
    subtitulo:
      "Conteúdos conectados para apresentar ideias, fortalecer confiança e conduzir o público.",
  },
  S3C: {
    titulo: "TRÊS SEQUÊNCIAS COM MOVIMENTO E RITMO",
    subtitulo:
      "Posts, carrosséis e reels para transformar uma ideia em experiência mais envolvente.",
  },
  S6V: {
    titulo: "SEIS SEQUÊNCIAS PARA ORGANIZAR A COMUNICAÇÃO",
    subtitulo:
      "Um percurso visual mais completo para trabalhar clareza, confiança, autoridade e ação.",
  },
  S6C: {
    titulo: "SEIS SEQUÊNCIAS COM FORÇA DE CAMPANHA",
    subtitulo: "Conteúdo visual e reels para ampliar percepção, ritmo e impacto da comunicação.",
  },
  S9V: {
    titulo: "NOVE PASSOS VISUAIS PARA CONSTRUIR DECISÃO",
    subtitulo:
      "Uma jornada de conteúdo para educar, aproximar, reforçar valor e estimular o próximo passo.",
  },
  S9C: {
    titulo: "NOVE PASSOS COM IMAGEM, MOVIMENTO E INTENÇÃO",
    subtitulo: "Uma experiência completa para transformar atenção em interesse, confiança e ação.",
  },
};

export const USO_NORMAL: Record<string, { imgs: number; renders: number }> = {
  EX01: { imgs: 7, renders: 0 },
  PU2: { imgs: 2, renders: 0 },
  PU4: { imgs: 4, renders: 0 },
  PU8: { imgs: 8, renders: 0 },
  S3V: { imgs: 28, renders: 0 },
  S3C: { imgs: 32, renders: 4 },
  S6V: { imgs: 56, renders: 0 },
  S6C: { imgs: 64, renders: 8 },
  S9V: { imgs: 42, renders: 0 },
  S9C: { imgs: 48, renders: 6 },
};
