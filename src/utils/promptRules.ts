// Regras globais de composição — definidas aqui uma única vez e importadas por
// buildImagePrompt (api.ts) e buildPostUnicoPrompt (postUnico.ts).
// Garante consistência entre os dois sistemas e evita versões divergentes do mesmo bloco.

// Composição por tipo de dispositivo: em vez de só proibir carcaça/logo errados
// (proibição nunca vence o viés do dataset de treino, ex. MacBook), o ÂNGULO da
// cena é definido por tipo para que a tampa/verso errado não possa aparecer por
// geometria. Sorteado a cada chamada (mesmo padrão de pickImageVariationBlock em
// visualDirection.ts) para também evitar que a peça sempre mostre notebook.
// A regra de ponto de vista (ver "FÍSICA DA TELA" em buildDeviceRule) deixou de
// forçar a câmera sempre do lado da tela — celular/tablet também podem compor
// em RETRATO (câmera do lado oposto, vendo o verso liso, personagem olhando
// para a própria tela) — achado real: personagem com tablet cuja tela aparecia
// nítida pra câmera mas o olhar não estava na tela, porque a regra antiga só
// admitia um ângulo e nenhuma regra amarrava olhar→tela.
const DEVICE_CELULAR =
  "CELULAR/SMARTPHONE: tela voltada para cima sobre a mesa, OU em mãos seguindo o ENQUADRAMENTO escolhido mais abaixo (MOSTRAR A TELA ao observador, ou RETRATO DO PERSONAGEM com o verso liso voltado à câmera e o personagem olhando para a própria tela).";
const DEVICE_TABLET =
  "TABLET: mesma lógica do celular — tela voltada para cima sobre a mesa, OU em mãos seguindo o ENQUADRAMENTO escolhido mais abaixo (MOSTRAR A TELA ao observador, ou RETRATO DO PERSONAGEM com o verso liso voltado à câmera e o personagem olhando para a própria tela).";
const DEVICE_NOTEBOOK =
  'NOTEBOOK/LAPTOP: SOMENTE de perfil lateral — câmera paralela ao eixo da dobradiça, mostrando a espessura do aparelho aberto em ângulo "V", nunca de frente nem de costas. A tampa traseira nunca fica visível para a câmera.';
const DEVICE_MONITOR =
  "MONITOR DE DESKTOP: pessoa posicionada de frente para a tela — a câmera fica do mesmo lado da pessoa (o lado da tela), enquadrando o rosto dela e a tela de lado/oblíqua. A parte de trás do gabinete nunca fica visível para a câmera, nenhum logo de fabricante em evidência.";
const DEVICE_TELA_FUNDO =
  "TELA OU TV GRANDE AO FUNDO: equipamento em segundo plano, distante da câmera, como parte do ambiente (sala de apresentação, painel) — nunca em primeiro plano nem como foco da composição.";

// Pool ponderado por repetição (não uniforme): celular/tablet/monitor saem bem
// com mais frequência (confirmado em uso real); notebook reduzido por ainda
// gerar tampa com conteúdo incorreto às vezes; tela/TV de fundo reduzida por
// ser um uso pouco comum no dia a dia do público — não removida, só mais rara.
const DEVICE_TYPE_POOL: string[] = [
  DEVICE_CELULAR,
  DEVICE_CELULAR,
  DEVICE_CELULAR,
  DEVICE_TABLET,
  DEVICE_TABLET,
  DEVICE_TABLET,
  DEVICE_MONITOR,
  DEVICE_MONITOR,
  DEVICE_MONITOR,
  DEVICE_NOTEBOOK,
  DEVICE_NOTEBOOK,
  DEVICE_TELA_FUNDO,
];

export function pickDeviceTypeLine(): string {
  return DEVICE_TYPE_POOL[Math.floor(Math.random() * DEVICE_TYPE_POOL.length)];
}

// Atividades cujo ofício real é manual/físico/artístico — o trabalho não passa
// por tela. Lista por palavra-chave (mesmo padrão de classificação usado em
// SEGMENT_LENS/classifyItemType) em vez de depender da IA interpretar "se a
// cena envolver dispositivo": sem essa trava, o sorteio de dispositivo do pool
// entra sempre, e a IA tende a materializar o tipo sugerido mesmo quando não
// faz sentido pro ofício (ex.: artista/poetisa com notebook).
// Sem acentos — comparados contra mainActivity já normalizado (NFD + strip).
const NON_DIGITAL_ACTIVITY_KEYWORDS = [
  "artist",
  "poet",
  "pint", // pintor, pintura
  "escult", // escultor, escultura
  "artesa", // artesã, artesão, artesanato
  "artesan",
  "ceramic",
  "ceramist",
  "music", // músico, música
  "instrumentist",
  "costur", // costureira, costura
  "alfaiat",
  "bordad",
  "tecel", // tecelagem
  "marcenari",
  "marceneir",
  "carpintari",
  "carpinteir",
  "ferreir",
  "joalheri",
  "ourivesari",
  "florist", // florista, arranjos
  "jardinagem",
  "jardineir",
  "culinari",
  "confeitari",
  "padeir",
  "pasteleir",
  "cabeleireir",
  "barbeari",
  "tatuad",
  "fotograf", // fotógrafo, fotografia
  "dancarin", // bailarino, dançarino
  "danca", // dança
  "atriz",
  "teatr",
  "ilustrad",
  "ilustrac",
  "desenhist",
  "grafit",
  "yoga",
  "pilates",
  "massoterapeuta",
  "fisioterapeut",
  "personal trainer",
  "agricultur",
  "pecuari",
  "pesc",
];

export function isNonDigitalActivity(mainActivity?: string): boolean {
  if (!mainActivity) return false;
  const normalized = mainActivity.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return NON_DIGITAL_ACTIVITY_KEYWORDS.some((kw) => normalized.includes(kw));
}

function buildNoDeviceRule(): string {
  return `⚠ DISPOSITIVOS DIGITAIS — PROIBIDOS NESTA CENA: o ofício real da empresa/profissional é manual, físico ou artístico e NÃO passa por tela. PROIBIDO incluir notebook, laptop, tablet, celular, monitor, computador ou qualquer dispositivo digital na composição, mesmo como elemento de apoio. A cena mostra o trabalho real com as mãos, ferramentas, materiais ou instrumentos do próprio ofício.
NEGATIVE: laptop, notebook, tablet, smartphone, computer monitor, desktop computer, screen, digital device, phone in hand.`;
}

// Quando há produto físico de referência selecionado (Kit Imagem) e ele NÃO é
// ele mesmo uma tela (produtoTelaInformativa), esse produto já é o elemento
// concreto e o foco da peça — sortear um dispositivo digital pelo pool abaixo
// não tem relação narrativa com ele e só dilui o foco. Achado real: peça sobre
// ração (Pronto Vet) recebeu um notebook sem nenhum motivo na cena. A regra de
// atividade (isNonDigitalActivity) não cobre este caso porque a atividade da
// empresa pode ser digital (ex. clínica com recepção) mesmo quando O PRODUTO
// desta peça específica é físico — a decisão é por peça, não por empresa.
function buildNoDeviceProdutoFisicoRule(): string {
  return `⚠ DISPOSITIVOS DIGITAIS — PROIBIDOS NESTA CENA: o produto físico referenciado já é o elemento concreto e o foco desta peça. PROIBIDO incluir notebook, laptop, tablet, celular, monitor, computador ou qualquer dispositivo digital na composição, mesmo como elemento de apoio — eles não têm relação com o produto e disputariam atenção sem motivo narrativo.
NEGATIVE: laptop, notebook, tablet, smartphone, computer monitor, desktop computer, screen, digital device, phone in hand.`;
}

// Quando o produto referenciado (Kit Imagem) É ele mesmo um dispositivo cujo
// conteúdo de tela é a identidade do produto (ex.: tablet mostrando o próprio
// app/print do negócio), a regra padrão de "desfoque/oculte conteúdo de tela"
// abaixo entraria em conflito direto com "preservar fidelidade ao produto" —
// resultado real observado: a tela saía vazia/borrada, perdendo o conteúdo
// que era o ponto inteiro da referência. Este bloco substitui a cláusula de
// tela quando preserveScreenContent=true, mantendo as demais regras de
// dispositivo (ponto de vista, carcaça, protagonismo) intactas.
function screenContentClause(preserveScreenContent: boolean): string {
  if (preserveScreenContent) {
    return `A TELA do dispositivo referenciado como produto exibe o CONTEÚDO REAL da imagem de referência — esse conteúdo É a identidade do produto sendo mostrado. PROIBIDO desfocar, apagar, escurecer ou substituir esse conteúdo por outra interface: reproduza-o com NITIDEZ e LEGIBILIDADE total, exatamente como aparece na referência.`;
  }
  return `A TELA, quando visível, mostra conteúdo com desfoque LEVE E SUTIL (~5% de intensidade — o mínimo necessário para impedir a leitura, não um borrão pesado); presença visual de conteúdo é desejável, opacidade total não. PROIBIDO desfoque forte, borrão pesado, glitch ou qualquer efeito que pareça defeito de renderização. PROIBIDO: tela apagada, escura ou em branco quando o dispositivo estiver aberto e em uso; conteúdo identificável em tela (logo real, marca reconhecível, texto legível, interface clara, dashboard, gráfico, planilha, barra de dados).`;
}

export function buildDeviceRule(
  mainActivity?: string,
  preserveScreenContent?: boolean,
  hasProdutoFisicoRef?: boolean,
): string {
  if (isNonDigitalActivity(mainActivity)) return buildNoDeviceRule();
  if (hasProdutoFisicoRef && !preserveScreenContent) return buildNoDeviceProdutoFisicoRule();
  const screenNegative = preserveScreenContent
    ? "no blurred screen, no blank screen, no dark screen, no empty screen, no different content on screen than the reference image"
    : "no blank screen, no dark screen, no empty screen, no sharp readable text on screen, no legible content on screen, no recognizable logo on screen, no dashboard on screen, no charts on screen, no spreadsheet on screen, no data visualization on screen";
  return `⚠ DISPOSITIVOS DIGITAIS: notebook, laptop, tablet, celular, monitor e outros dispositivos são PERMITIDOS quando a cena pedir, em uso natural — abertos, na mão, apoiados sobre a mesa. NÃO forçar dispositivo fechado. ${screenContentClause(!!preserveScreenContent)}

FÍSICA DA TELA — PRINCÍPIO DE CENA (entenda a geometria; as proibições abaixo são reforço, não a regra primária): todo dispositivo com tela tem DUAS faces opostas — a TELA (face ativa, único lugar onde existe conteúdo) e o VERSO/carcaça (face lisa e opaca, sem nada). A tela fica sempre voltada para o rosto de quem está usando o aparelho. Disso decorrem 3 consequências:
1. OLHAR: se o personagem está usando o dispositivo, os olhos dele estão NA TELA — olhar dirigido a ela, nunca solto, nunca para o lado, nunca para fora de quadro. Essa regra tem PRECEDÊNCIA sobre qualquer instrução de câmera do mood que peça "olhar para longe" ou "espaço negativo à frente do olhar" — quando há dispositivo em uso, o olhar vai para a tela, e o espaço negativo (se o mood exigir) se organiza ao redor desse eixo, não contra ele. Se a cena pede olhar em outra direção, o dispositivo fica em REPOUSO (abaixado, sobre a mesa) — não erguido como se estivesse em uso.
2. O QUE A CÂMERA VÊ: a câmera vê OU a tela (quando está do mesmo lado do olhar do personagem) OU o verso liso (quando está do lado oposto, de frente para o personagem). Nunca as duas faces ao mesmo tempo — é fisicamente impossível. Ver o verso é natural e correto nesse ângulo; NÃO torça o aparelho nem o personagem para a tela "aparecer" mesmo assim.
3. CONTEÚDO: existe SOMENTE na face da tela. Conteúdo, logo ou interface no verso/carcaça é fisicamente impossível — PROIBIDO em qualquer ângulo de câmera, sem exceção.

REGRA INVIOLÁVEL DE ROSTO — vale para QUALQUER enquadramento abaixo: o rosto do personagem NUNCA pode ficar escondido, cortado ou obstruído pelo dispositivo, em nenhuma hipótese. É essa garantia — não a posição da câmera em si — que torna cada enquadramento abaixo válido.

ENQUADRAMENTO COM DISPOSITIVO — escolha a geometria coerente com a câmera sorteada para esta cena:
· MOSTRAR A TELA: câmera do mesmo lado do olhar do personagem (lateral, por cima do ombro, oblíqua) — a tela aparece ao observador com o conteúdo tratado pela regra acima, rosto do personagem sempre visível.
· RETRATO DO PERSONAGEM (inclui contra-plongée e planos fechados no rosto): válido APENAS para CELULAR e TABLET em mãos — câmera de frente para o rosto do personagem (plenamente visível e enquadrado, nunca coberto), do lado oposto à tela: o aparelho pequeno nas mãos, abaixo do rosto, mostra o verso liso enquanto o personagem olha para baixo, para a própria tela (ver regra de OLHAR acima) — o dispositivo NUNCA se posiciona entre a câmera e o rosto. NOTEBOOK e MONITOR NUNCA usam este enquadramento — a carcaça traseira desses equipamentos é grande demais e esconderia o personagem, violando a regra de rosto acima; eles seguem sempre a composição de perfil/oblíqua definida abaixo.${preserveScreenContent ? "\nQuando o conteúdo da tela É o produto referenciado (ver regra de tela acima), use SEMPRE o enquadramento MOSTRAR A TELA — a peça existe para exibir esse conteúdo, o enquadramento RETRATO não se aplica aqui." : ""}

COMPOSIÇÃO POR TIPO DE DISPOSITIVO — aplica o enquadramento escolhido acima a cada formato. SE a cena envolver dispositivo digital, use o tipo e a composição sorteados para esta geração:
TIPO DESTA GERAÇÃO: ${pickDeviceTypeLine()}
DIVERSIFICAÇÃO OBRIGATÓRIA: não repita sempre notebook entre as peças de uma mesma sequência — alterne com celular, tablet, monitor de desktop ou tela/TV de fundo conforme a atividade da empresa e o que a cena pede.
PROTAGONISMO: o dispositivo digital é elemento de APOIO à cena, nunca o protagonista visual — o foco principal é a pessoa e a ação dela. Mantenha o dispositivo proporcionalmente pequeno no quadro, nunca em primeiro plano ocupando a maior área da composição. EXCEÇÃO: quando o próprio dispositivo for o produto sendo vendido (ex.: loja de eletrônicos/celulares/informática) — nesse caso ele pode ocupar o centro da composição como protagonista.

CARCAÇA E TAMPA — REGRA ABSOLUTA (vale mesmo com a composição correta, como reforço): tampa, verso e carcaça de qualquer dispositivo DEVEM ser completamente lisas, sem nenhuma marca, símbolo, logo, maçã, ícone, adesivo, gravação ou iluminação. Use equipamento genérico, sem marca. MÁXIMO 1 DISPOSITIVO por cena.
NEGATIVE: ${screenNegative}, no images or graphics on device casing or back cover, no content or interface visible on back casing under any camera angle, no duplicated devices, no corded phone, no rotary phone, casing must be plain and unbranded, no Apple logo, no glowing logo on lid, no backlit symbol on laptop, no brand mark on back cover, no laptop logo, generic unbranded laptop only, no laptop screen facing camera directly, no monitor seen from behind, no back of monitor facing camera, no notebook rear casing facing camera, character holding device but gaze not directed at its screen while in use, no device covering, blocking or obscuring the character's face.`;
}

export const AMBIENTES_RULE = `⚠ AMBIENTES VISUAIS: PROIBIDO paredes de concreto aparente, galpões industriais, estruturas arquitetônicas frias, corredores vazios como elemento dominante ou fundo para tipografia. Use fundos coloridos, texturas orgânicas, desfoque, gradiente ou fotografia quente. PROIBIDO TAMBÉM: formas geométricas abstratas flutuando (círculos, esferas, polígonos, espirais) sem propósito narrativo. A composição deve ter TEMA CONCRETO — humano, objeto real, natureza, tipografia ou cenário com sentido.`;

export const HUMANIZACAO_RULE = `⚠ HUMANIZAÇÃO: imagens devem parecer humanas, autênticas e reais. PROIBIDO inserir vasos, plantas ornamentais, folhas ou flores apenas para preencher cantos — todo elemento deve contribuir para a mensagem.`;

export const FORBIDDEN_MOOD_WORDS = `PALAVRAS PROIBIDAS NA IMAGEM: NUNCA escreva, desenhe ou renderize como texto/lettering/título/etiqueta, em nenhum lugar da peça, as palavras CLAREZA, IMPACTO, INSTANTE, FRAGMENTO, DESVIO, SILÊNCIO, MOOD, OP-01, OP-02, OP-03, OP-04, OP-05, OP-06 — são códigos internos do sistema e nunca devem aparecer na arte final.`;

export const CONCEITO_FIRST_RULE = `⚠ CONCEITO-FIRST — INEGOCIÁVEL: A cena nasce do conceito do título. O sujeito, verbo ou promessa central do título deve aparecer visualmente na imagem — a imagem NUNCA pode negar o que o título afirma. Se o título menciona equipe ou interação, há ao menos dois sujeitos ou troca visível entre pessoas; se menciona decisão, há o ato concreto de decidir; se menciona método ou processo, há ordem e etapas visíveis; se menciona escuta, há presença de interlocutor ou elemento de recepção. PROIBIDO como elemento central da cena: porta entreaberta com feixe de luz dourada · kit papelaria corporativa genérico (cartões + caneta + clipe sem relação com o tema do título) · mão escrevendo em caderno como substituto de cena concreta com personagem. PROIBIDO — TRADUÇÃO LITERAL DE PALAVRAS DO TÍTULO EM SÍMBOLOS GENÉRICOS: "ideia" ≠ lâmpada acesa; "crescimento" ou "ação" ≠ seta apontando para cima; "conexão" ou "juntos" ≠ mosquetões/carabiner/corda de escalada/engrenagens; "estratégia" ≠ peça de xadrez; "inovação" ≠ foguete; "sucesso" ≠ troféu ou pódio; "planejamento" ≠ Post-it com ícones de negócios; "avançar" ou "longe" ≠ degraus/pódio/horizonte vazio. A cena mostra o que acontece no negócio real quando a promessa do título se realiza — não o símbolo universal da palavra. ADJETIVOS/ADVÉRBIOS DO TÍTULO ancoram-se no ofício, não na sua propriedade física literal: "rápido" = eficiência no atendimento, não velocidade; "claro" = transparência, não iluminação; "forte" = coesão da equipe, não músculo; "sólido" = confiança, não material rígido. Exceção: quando o modificador é visível no negócio (equipe organizada, escritório cheio, produto artesanal), mantenha-o literal. SE O TÍTULO TEM "PESSOAS" COMO SUJEITO EXPLÍCITO, PESSOAS REAIS APARECEM NA IMAGEM — nunca espaço decorativo vazio, nunca pódio sem ocupante. NEGATIVE: lightbulb, upward arrow, chess piece, gear, carabiner, climbing rope, rocket, trophy, podium, post-it with business icons, empty stage as main element.`;
