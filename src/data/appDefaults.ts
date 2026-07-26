import { BRAND_ACCENT } from "./brandColors";
import { defaultVoice } from "./brandVoice";
import type { BrandKit, ContentFormData, PostUnicoFormData, PostUnicoVisualSelection } from "../types";
import { lsGet, lsSetQuotaSafe } from "../lib/storage/store";
import { POSTUNICO_FORM_KEY } from "../lib/storage/keys";

export type Modo = "metodo" | "postUnico" | "imageKit";

export const defaultKit: BrandKit = {
  companyName: "",
  segment: "SERVIÇOS",
  logoHasName: true,
  primaryColor: "#123a63",
  secondaryColor: "#0f172a",
  accentColor: BRAND_ACCENT,
  fontPair: "Montserrat",
  brandVoice: defaultVoice("SERVIÇOS"),
  mainActivity: "",
  logoPosition: "bottom-right",
};

export const defaultForm: ContentFormData = {
  companyName: "",
  segment: "SERVIÇOS",
  audience: "B2C",
  businessMoment: "consolidação",
  keyInfo: "",
  brandVoice: defaultVoice("SERVIÇOS"),
  outputMode: "feed",
  sequenceSize: 3,
  storiesDays: 3,
  storiesQuantity: 3,
  outputFormats: ["feed", "carrossel", "reels"],
  track: "visual",
  mood: "OP-01",
};

export const defaultPostUnico: PostUnicoFormData = {
  companyName: "",
  mainActivity: "",
  audience: "B2C",
  keyInfo: "",
  objetivo: "nenhum",
  direcao: "livre",
};

export const defaultVisualSelection: PostUnicoVisualSelection = {
  useAvatar: false,
  avatarSelecionado: 1,
  useFachada: false,
  useCenario: false,
  useProdutos: false,
  produtosSelecionados: [],
  cenarioSelecionado: null,
  useUniforme: false,
  semPersonagem: false,
  useFato: false,
  useVenda: false,
};

export function loadPostUnico(userId?: string | null): PostUnicoFormData {
  if (typeof window === "undefined") return { ...defaultPostUnico };
  try {
    const raw = lsGet(POSTUNICO_FORM_KEY, userId);
    return raw ? { ...defaultPostUnico, ...JSON.parse(raw) } : { ...defaultPostUnico };
  } catch {
    return { ...defaultPostUnico };
  }
}

export function savePostUnico(d: PostUnicoFormData, userId?: string | null) {
  lsSetQuotaSafe(POSTUNICO_FORM_KEY, JSON.stringify(d), userId);
}
