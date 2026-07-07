import { BrandKit, PostUnicoFormData, ValidationFlag } from "../types";
import { composeFeedPng } from "../utils/canvasComposer";
import type { FeedItem } from "../types";
import { generateImageAsync } from "./imageGeneration";
import { getAuthHeaders } from "./authHeaders";
import { PersonagemGender } from "../core/visualDirection";
import type { PostUnicoReferences } from "../shared/visual/references";
export type { PostUnicoReferences } from "../shared/visual/references";
import { orderedReferenceImages } from "../shared/visual/references";
export { orderedReferenceImages } from "../shared/visual/references";
import { buildPostUnicoPrompt } from "./buildPuPrompt";

// Fase 8 (fatiamento de megafiles) extraiu a configuração estática por objetivo
// para ./objetivoConfig.ts, o bloco de referências visuais para ./puReferencesBlock.ts
// e a montagem do prompt de imagem para ./buildPuPrompt.ts. buildPostUnicoPrompt
// permanece re-exportado daqui para não quebrar quem já importa de "./postUnico".
export { buildPostUnicoPrompt };

// Tópico com ícone — elemento do formato alternativo "topicos" (ver
// PostUnicoFormatoTexto em types.ts). O ícone é um conceito de um vocabulário
// fechado (TOPICO_ICON_VOCAB, core/topicoValidation.ts) desenhado pela própria
// IA de imagem junto com o texto — não é um asset SVG nosso.
export interface PostUnicoTopico {
  texto: string;
  icone: string;
}

export interface PostUnicoCopy {
  titulo: string;
  // Em modo "topicos", sintetizado como os 3 textos unidos (" • ") — só para
  // compatibilidade com código que já lê copy.texto (nenhum consumidor crítico
  // depende disso; legenda usa keyInfo, não copy.texto).
  texto: string;
  // Presente (com exatamente 3 itens) quando formatoTexto === "topicos".
  topicos?: PostUnicoTopico[];
  flags?: ValidationFlag[];
}

export async function generatePostUnicoCopy(
  data: PostUnicoFormData,
  brandVoice?: string,
  segment?: string,
  preferredSlot?: string,
  tituloFixo?: string,
): Promise<PostUnicoCopy> {
  const auth = await getAuthHeaders();
  const res = await fetch("/api/generate-pu-copy", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...auth },
    body: JSON.stringify({
      companyName: data.companyName,
      mainActivity: data.mainActivity,
      objetivo: data.objetivo,
      audience: data.audience,
      faixaEtaria: data.faixaEtaria ?? null,
      keyInfo: data.keyInfo,
      brandVoice: brandVoice || "",
      segment: segment || "",
      formatoTexto: data.formatoTexto || "corrido",
      ...(preferredSlot ? { preferredSlot } : {}),
      ...(tituloFixo ? { tituloFixo } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Falha ao gerar título e texto (${res.status})`);
  }
  const json = await res.json();
  const topicos: PostUnicoTopico[] | undefined = Array.isArray(json.topicos)
    ? json.topicos.map((t: { texto?: string; icone?: string }) => ({
        texto: String(t?.texto || "").trim(),
        icone: String(t?.icone || "").trim(),
      }))
    : undefined;
  return {
    titulo: String(json.titulo || "").trim(),
    texto: topicos?.length
      ? topicos.map((t) => t.texto).join(" • ")
      : String(json.texto || "").trim(),
    ...(topicos?.length ? { topicos } : {}),
    ...(Array.isArray(json.flags) && json.flags.length > 0
      ? { flags: json.flags as ValidationFlag[] }
      : {}),
  };
}

// isClothingFriendly/buildClothingPool agora moram em core/clothingPool.ts —
// compartilhadas com regenerateWithKit.ts (MOP) pra evitar duplicação literal.

export interface PostUnicoCaption {
  texto: string;
  cta: string;
  hashtags: string[];
  full: string;
}

export async function generatePostUnicoCaption(
  data: PostUnicoFormData,
  opts?: { debit?: boolean; brandVoice?: string; preferredSlot?: string; previousCaption?: string },
): Promise<PostUnicoCaption> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts?.debit) {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch {
      /* sem sessão: segue sem Authorization, o servidor trata */
    }
  }
  const res = await fetch("/api/generate-caption", {
    method: "POST",
    headers,
    body: JSON.stringify({
      companyName: data.companyName,
      mainActivity: data.mainActivity,
      objetivo: data.objetivo,
      keyInfo: data.keyInfo,
      brandVoice: opts?.brandVoice || "",
      debit: opts?.debit === true,
      ...(opts?.preferredSlot ? { preferredSlot: opts.preferredSlot } : {}),
      ...(opts?.previousCaption ? { previousCaption: opts.previousCaption } : {}),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Falha ao gerar legenda (${res.status})`);
  }
  const json = await res.json();
  const texto: string = json.texto || "";
  const cta: string = json.cta || "";
  const hashtags: string[] = Array.isArray(json.hashtags) ? json.hashtags : [];
  const tagLine = hashtags.map((t) => `#${t}`).join(" ");
  const bodyParts = [texto, cta].filter(Boolean);
  const body = bodyParts.length === 2 ? `${bodyParts[0]}\n\n${bodyParts[1]}` : bodyParts[0] || "";
  const full = body + (tagLine ? `\n\n${tagLine}` : "");
  return { texto, cta, hashtags, full };
}

export async function generatePostUnico(params: {
  data: PostUnicoFormData;
  kit: BrandKit;
  copy?: PostUnicoCopy;
  references?: PostUnicoReferences;
  preferredSlot?: string;
  forcedGender?: PersonagemGender;
  /** true quando é "Gerar outra imagem" — força execução visual diferente. */
  variationHint?: boolean;
  /** Índice-base do rodízio de tonalidade (Direção Livre + Objetivo "nenhum") — ver core/colorRotation.ts. */
  tonalidadeSeed?: number;
}): Promise<string> {
  const {
    data,
    kit,
    copy,
    references,
    preferredSlot,
    forcedGender,
    variationHint,
    tonalidadeSeed,
  } = params;
  const prompt = buildPostUnicoPrompt({
    data,
    kit,
    copy,
    references,
    forcedGender,
    variationHint,
    tonalidadeSeed,
  });

  // Coleta refs ordenadas: avatar -> uniforme -> cenário -> produtos por número.
  // Uniforme não é removido no retry sem avatar (foto sem rosto, não deve
  // disparar a recusa de rosto do gpt-image que motiva esse retry).
  const buildRefs = (withAvatar: boolean): string[] =>
    orderedReferenceImages(references, { withAvatar });

  const referenceImages = buildRefs(true);

  let dataUrl: string;
  try {
    dataUrl = await generateImageAsync({
      prompt,
      format: "post",
      referenceImages: referenceImages.length ? referenceImages : undefined,
      modulo: "pu",
      preferredSlot,
    });
  } catch (e) {
    // Se falhou com avatar + downstream_service_error (GPT Image 2 recusa rostos),
    // tenta novamente sem o avatar mantendo os demais refs.
    const msg = (e as Error).message || "";
    const isDownstream = msg.includes("downstream_service_error") || msg.includes("500");
    const hasAvatar = !!references?.avatar;
    if (isDownstream && hasAvatar) {
      const refsWithoutAvatar = buildRefs(false);
      dataUrl = await generateImageAsync({
        prompt,
        format: "post",
        referenceImages: refsWithoutAvatar.length ? refsWithoutAvatar : undefined,
        modulo: "pu",
        preferredSlot,
      });
    } else {
      throw e;
    }
  }

  // Aplica a logomarca localmente via canvas (mesma lógica do Método OP)
  const placeholderItem: FeedItem = {
    dia: 1,
    formato: "Estático",
    titulo: "",
    texto: "",
    legenda: "",
    imagem: "",
  };
  // A IA nunca desenha a logomarca (nem no uniforme, nem na fachada) — o canvas
  // do app é a ÚNICA fonte da logo, sempre, independentemente das referências.
  try {
    return await composeFeedPng(kit, placeholderItem, dataUrl);
  } catch {
    return dataUrl;
  }
}
