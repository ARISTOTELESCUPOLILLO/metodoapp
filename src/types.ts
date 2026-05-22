export type Segment = 'SERVIÇOS' | 'VAREJO' | 'MARCA';
export type Audience = 'B2C' | 'B2B';
export type BusinessMoment = 'lançamento' | 'consolidação' | 'reativação' | 'sazonalidade';
export type OutputMode = 'feed' | 'stories' | 'feed+stories';
export type OutputFormat = 'feed' | 'carrossel' | 'reels' | 'stories' | 'estatico_final';
export type MoodCode = 'OP-01' | 'OP-02' | 'OP-03' | 'OP-04' | 'OP-05' | 'OP-06';
export type FontPair = 'Inter' | 'Montserrat' | 'Playfair Display' | 'Roboto Slab' | 'Poppins' | 'Lora' | 'Raleway' | 'Merriweather';
export type LogoPosition = 'bottom-right' | 'top-center' | 'bottom-center';

// Trilha narrativa do Método OP — define qual peça fecha a sequência
// 'cinematica'      → reels no fechamento (comportamento atual, default)
// 'visual'          → estatico_final no fechamento
// 'experimentacao'  → estatico_final em sequência reduzida de 2 períodos
export type Track = 'cinematica' | 'visual' | 'experimentacao';

export interface BrandKit {
  companyName: string;
  segment: Segment;
  logoDataUrl?: string;
  logoHasName: boolean;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  fontPair: FontPair;
  brandVoice: string;
  mainActivity?: string;
  logoPosition?: LogoPosition;
}

export interface ContentFormData {
  companyName: string;
  segment: Segment;
  audience: Audience;
  businessMoment: BusinessMoment;
  keyInfo?: string;
  brandVoice: string;
  outputMode: OutputMode;
  sequenceSize: 3 | 6 | 9;
  storiesDays: 1 | 2 | 3 | 4 | 5;
  storiesQuantity: 3 | 6;
  outputFormats: OutputFormat[];
  // Trilha narrativa — opcional na Fase 1 (default: 'cinematica' = comportamento atual).
  // Usado de fato a partir da Fase 2.
  track?: Track;
  // Vindo do BrandKit no momento da geração — usado pelo motor para ancorar cenário e vocabulário.
  mainActivity?: string;
  // Mood OP — OBRIGATÓRIO. Governa a Direção Visual Dominante da sequência.
  mood: MoodCode;
}

export interface FeedItem {
  dia: number;
  formato: 'Estático' | 'Carrossel' | 'Reels' | 'Estático Final';
  titulo: string;
  texto: string;
  legenda: string;
  imagem: string;
}

export interface StoryItem {
  ordem: number;
  tipo: 'vídeo' | 'post';
  texto: string;
}

export interface StoriesSequence {
  dia: number;
  sequencia: string;
  stories: StoryItem[];
}

export interface CarouselCard {
  card: number;
  titulo: string;
  texto: string;
  imagePrompt: string;
  legenda?: string;
}

export interface ReelsGuide {
  hook: string;
  script: string;
  imagePrompt: string;
  screenText: string;
  legenda?: string;
}

// Contagem de itens gerados — ponte mínima para integração futura com o ERP
// Permite ao ERP debitar consumo do plano contratado sem refatorar este app.
export interface GenerationSummary {
  estaticos: number;
  carrosseis: number;
  reels: number;
  estaticosFinais: number;
  stories: number;
}

export interface MethodOpResult {
  feed?: FeedItem[];
  carousel?: CarouselCard[];
  reels?: ReelsGuide[];
  stories?: StoriesSequence[];
  raw?: unknown;
  summary?: GenerationSummary;
}

export type PostUnicoObjetivo = 'promocao' | 'homenagem' | 'aviso' | 'oportunidade' | 'institucional';
export type PostUnicoDirecao = 'livre' | 'mood';

export interface PostUnicoFormData {
  companyName: string;
  mainActivity: string;
  keyInfo: string;
  objetivo: PostUnicoObjetivo;
  direcao: PostUnicoDirecao;
  mood?: MoodCode;
}

export interface TemplateMood {
  code: MoodCode;
  name: string;
  intent: string;
  recommendedFor: Segment[];
  color: string;
}

// Kit Imagem — biblioteca visual da marca usada como referência na geração de imagens.
// Avatar é único. Cenários têm 2 slots numerados FIXOS. Produtos têm 8 slots
// numerados FIXOS — apagar o slot 3 não reorganiza nada; o slot fica vazio
// até receber outra imagem.
export interface ImageKit {
  avatar?: string;
  // Tamanho fixo 2; cada posição é dataURL ou null.
  cenarios: (string | null)[];
  // Tamanho fixo 8; cada posição é dataURL ou null.
  produtos: (string | null)[];
}

// Seleção da Composição Visual no Post Único — diz quais elementos do Kit Imagem
// devem ser enviados como referência para a geração desta peça específica.
export interface PostUnicoVisualSelection {
  useAvatar: boolean;
  useCenario: boolean;
  // Marca o bloco "Usar Produtos". Se true mas a lista estiver vazia, o usuário
  // ainda não escolheu quais produtos — o envio ignora a categoria.
  useProdutos: boolean;
  // Lista de números (1..8) dos produtos selecionados.
  produtosSelecionados: number[];
  // Número (1..2) do cenário escolhido. Apenas 1 cenário por peça.
  cenarioSelecionado: number | null;
}
