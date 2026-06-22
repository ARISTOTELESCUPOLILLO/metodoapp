export type Segment = "SERVIÇOS" | "VAREJO" | "MARCA";
export type Audience = "B2C" | "B2B";
export type BusinessMoment = "lançamento" | "consolidação" | "reativação" | "sazonalidade";
export type OutputMode = "feed" | "stories" | "feed+stories";
export type OutputFormat = "feed" | "carrossel" | "reels" | "stories" | "estatico_final";
export type MoodCode = "OP-01" | "OP-02" | "OP-03" | "OP-04" | "OP-05" | "OP-06";
export type FontPair =
  | "Inter"
  | "Montserrat"
  | "Playfair Display"
  | "Roboto Slab"
  | "Poppins"
  | "Lora"
  | "Raleway"
  | "Merriweather";
// Tipografia secundária opcional (manuscrita) — destaca 1 palavra-chave do título.
export type SecondaryFont = "fina" | "grossa";
export type LogoPosition = "bottom-right" | "top-center" | "bottom-center";

// Trilha narrativa do Método OP — define qual peça fecha a sequência
// 'cinematica'      → reels no fechamento (comportamento atual, default)
// 'visual'          → estatico_final no fechamento
// 'experimentacao'  → estatico_final em sequência reduzida de 2 períodos
export type Track = "cinematica" | "visual" | "experimentacao";

export interface BrandKit {
  companyName: string;
  segment: Segment;
  logoDataUrl?: string;
  logoHasName: boolean;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  fontPair: FontPair;
  secondaryFont?: SecondaryFont;
  brandVoice: string;
  mainActivity?: string;
  logoPosition?: LogoPosition;
  assinatura?: string;
  // Foto do uniforme da empresa (plano médio, sem rosto) — usada como
  // referência de cor/modelo/posição da logo ao vestir o avatar ou o
  // personagem sem avatar nas peças, quando "Gerar com uniforme" é marcado.
  uniformeDataUrl?: string;
  // Produtos, serviços, categorias ou especialidades reais — matéria-prima
  // concreta para a Sugestão (Informação-chave). Mínimo 3, máximo 10.
  products?: string[];
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

// Leitura cênica produzida pela IA por peça — orienta a geração de imagem
// (intenção, personagem, ambiente etc.). Opcional: nem toda peça a recebe.
export interface LeituraCenica {
  intencao?: string;
  personagem?: string;
  ambiente?: string;
  expressao?: string;
  clima?: string;
  composicao?: string;
}

export interface FeedItem {
  dia: number;
  formato: "Estático" | "Carrossel" | "Reels" | "Estático Final";
  titulo: string;
  texto: string;
  legenda: string;
  imagem: string;
  leituraCenica?: LeituraCenica;
}

export interface StoryItem {
  ordem: number;
  tipo: "vídeo" | "post";
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
  leituraCenica?: LeituraCenica;
}

export interface ReelsGuide {
  hook: string;
  script: string;
  imagePrompt: string;
  screenText: string;
  legenda?: string;
  leituraCenica?: LeituraCenica;
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

export interface AnchoraVisual {
  genero: "M" | "F";
  // 'publico_alvo' = personagem é o receptor da comunicação, vivendo o
  //   contexto/benefício (SERVIÇOS, MARCA) — o emissor (dono/profissional)
  //   só aparece via avatar de referência real, nunca como personagem-padrão
  // 'contexto_de_uso' = personagem complementa; produto é o foco (VAREJO)
  // 'protagonista' = legado, não emitido mais pelo motor (mantido por
  //   compatibilidade com sequências antigas já salvas)
  papel: "protagonista" | "contexto_de_uso" | "publico_alvo";
  faixa_etaria: string;
  marcadores_profissionais: string;
  ambiente_base: string;
}

export interface MethodOpResult {
  feed?: FeedItem[];
  carousel?: CarouselCard[];
  reels?: ReelsGuide[];
  stories?: StoriesSequence[];
  raw?: unknown;
  summary?: GenerationSummary;
  // D1 — reprovações heurísticas pós-geração (não bloqueiam a entrega; usadas
  // pela orquestração de regeneração pontual no cliente, ver E3).
  flags?: ValidationFlag[];
  ancora_visual?: AnchoraVisual;
}

export interface ValidationFlag {
  campo: string;
  motivo: string;
}

export type PostUnicoObjetivo =
  | "promocao"
  | "homenagem"
  | "aviso"
  | "oportunidade"
  | "institucional"
  | "fatos"
  | "venda"
  | "nenhum";
export type PostUnicoDirecao = "livre" | "mood";

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
// Avatar é único. Fachada é única — slot próprio na sequência do Kit, ANTES
// dos cenários (antes era um tipo dentro do pool de cenários; agora é uma
// foto independente, como avatar/uniforme). Cenários têm 2 slots numerados
// FIXOS. Produtos têm 8 slots numerados FIXOS — apagar o slot 3 não
// reorganiza nada; o slot fica vazio até receber outra imagem.
export interface ImageKit {
  avatar?: string;
  avatar2?: string;
  // Foto da fachada/frente do estabelecimento.
  fachada?: string;
  // Tamanho fixo 2; cada posição é dataURL ou null.
  cenarios: (string | null)[];
  // Tamanho fixo 8; cada posição é dataURL ou null.
  produtos: (string | null)[];
  // Foto de um acontecimento (visita, confraternização, feira) — usada na PU
  // com objetivo "Fatos", aplicação direta sem reinvenção pela IA.
  fato?: string;
  // Foto de colaborador com o produto (apresentação, uso prático) — usada na
  // PU com objetivo "Venda", aplicação direta sem reinvenção pela IA (mesmo
  // tratamento de "Fato").
  venda?: string;
}

// Seleção da Composição Visual no Post Único — diz quais elementos do Kit Imagem
// devem ser enviados como referência para a geração desta peça específica.
export interface PostUnicoVisualSelection {
  useAvatar: boolean;
  // Qual avatar usar: 1 = principal, 2 = avatar 2.
  avatarSelecionado: 1 | 2;
  // Usa a foto de fachada do Kit Imagem (slot próprio, fora do pool de cenários).
  useFachada?: boolean;
  useCenario: boolean;
  // Marca o bloco "Usar Produtos". Se true mas a lista estiver vazia, o usuário
  // ainda não escolheu quais produtos — o envio ignora a categoria.
  useProdutos: boolean;
  // Lista de números (1..8) dos produtos selecionados.
  produtosSelecionados: number[];
  // Número (1..3) do cenário escolhido. Apenas 1 cenário por peça.
  cenarioSelecionado: number | null;
  // Veste o avatar com a foto de uniforme cadastrada no Kit de Marca, em vez
  // do figurino livre sorteado pelo motor. Só tem efeito com useAvatar=true
  // e com kit.uniformeDataUrl cadastrado.
  useUniforme: boolean;
  // Personagem criado do zero (sem foto de avatar) — representa o
  // público-alvo (não precisa de uniforme cadastrado pra existir; disponível
  // em qualquer segmento). comUniforme veste esse personagem com o uniforme
  // do Kit de Marca quando o usuário escolhe que ele seja o EMISSOR em vez do
  // público-alvo; só tem efeito quando kit.uniformeDataUrl está cadastrado.
  personagemSemAvatar?: {
    ativo: boolean;
    genero: "mulher" | "homem";
    idade: string;
    comUniforme?: boolean;
  };
  // Usa a foto de Fato do Kit Imagem (objetivo "Fatos") — aplicação direta
  // sem reinvenção pela IA, só overlay de marca/título/texto.
  useFato?: boolean;
  // Usa a foto de Venda do Kit Imagem (objetivo "Venda") — mesmo
  // tratamento de preservação do "Fato".
  useVenda?: boolean;
  // O(s) produto(s) selecionados são, eles mesmos, uma tela/dispositivo cujo
  // CONTEÚDO exibido é a identidade do produto (ex.: tablet mostrando o
  // próprio app/print do negócio). Quando true, suspende a regra global de
  // "desfoque de tela" só para esta geração e instrui a IA a preservar o
  // conteúdo da tela com nitidez, em vez de borrá-lo.
  produtoTelaInformativa?: boolean;
}
