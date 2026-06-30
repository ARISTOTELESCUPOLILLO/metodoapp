// Tabelas de configuração por objetivo do Post Único.
// UMA definição canônica — importar daqui em vez de redeclarar nas rotas.

import type { PostUnicoObjetivo } from "../types";

/** Tom/vibe resumido para orientar prompt de texto e imagem. */
export const OBJETIVO_TOM: Record<PostUnicoObjetivo, string> = {
  promocao: "comercial, desejo, chamada para ação clara",
  homenagem: "afetivo, respeitoso, contemplativo",
  aviso: "institucional, claro, objetivo",
  oportunidade: "urgência elegante, momento decisivo",
  institucional: "institucional de marca, posicionamento, propósito, sóbrio e confiante",
  fatos: "documental, registro fiel, objetivo",
  venda: "comercial, demonstrativo, prático, autêntico",
  nenhum: "neutro, livre — foco no contexto real da empresa",
};

/** CTA fallback determinístico (E4) quando o modelo não preenche o campo. */
export const OBJETIVO_CTA_FALLBACK: Record<PostUnicoObjetivo, string> = {
  promocao: "Aproveite agora.",
  homenagem: "Celebre com a gente.",
  aviso: "Saiba mais.",
  oportunidade: "Garanta a sua vaga.",
  institucional: "Conheça nosso trabalho.",
  fatos: "Saiba mais.",
  venda: "Fale com a gente.",
  nenhum: "Saiba mais.",
};

/** Hashtags fallback determinístico (E4). */
export const OBJETIVO_HASHTAG_FALLBACK: Record<PostUnicoObjetivo, string[]> = {
  promocao: ["promocao", "oferta", "novidade"],
  homenagem: ["gratidao", "historia", "conquista"],
  aviso: ["aviso", "informacao", "novidade"],
  oportunidade: ["oportunidade", "novidade", "momento"],
  institucional: ["marca", "qualidade", "confianca"],
  fatos: ["registro", "momento", "historia"],
  venda: ["produto", "qualidade", "novidade"],
  nenhum: ["novidade", "empresa", "qualidade"],
};
