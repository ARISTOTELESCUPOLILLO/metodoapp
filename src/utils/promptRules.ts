// Regras globais de composição — definidas aqui uma única vez e importadas por
// buildImagePrompt (api.ts) e buildPostUnicoPrompt (postUnico.ts).
// Garante consistência entre os dois sistemas e evita versões divergentes do mesmo bloco.

// Composição por tipo de dispositivo: em vez de só proibir carcaça/logo errados
// (proibição nunca vence o viés do dataset de treino, ex. MacBook), o ÂNGULO da
// cena é definido por tipo para que a tampa/verso errado não possa aparecer por
// geometria. Sorteado a cada chamada (mesmo padrão de pickImageVariationBlock em
// visualDirection.ts) para também evitar que a peça sempre mostre notebook.
const DEVICE_CELULAR = 'CELULAR/SMARTPHONE: tela voltada para cima sobre a mesa OU na mão da pessoa, mostrando a tela ao observador. A parte de trás do aparelho nunca fica voltada para a câmera.';
const DEVICE_TABLET = 'TABLET: mesma lógica do celular — tela voltada para cima sobre a mesa OU em mãos mostrando a tela ao observador. A tampa/verso nunca fica voltada para a câmera.';
const DEVICE_NOTEBOOK = 'NOTEBOOK/LAPTOP: SOMENTE de perfil lateral — câmera paralela ao eixo da dobradiça, mostrando a espessura do aparelho aberto em ângulo "V", nunca de frente nem de costas. A tampa traseira nunca fica visível para a câmera.';
const DEVICE_MONITOR = 'MONITOR DE DESKTOP: pessoa posicionada de frente para o monitor — a câmera enquadra a pessoa e a tela de lado/oblíqua, nunca a parte traseira do gabinete em destaque, nenhum logo de fabricante em evidência.';
const DEVICE_TELA_FUNDO = 'TELA OU TV GRANDE AO FUNDO: equipamento em segundo plano, distante da câmera, como parte do ambiente (sala de apresentação, painel) — nunca em primeiro plano nem como foco da composição.';

// Pool ponderado por repetição (não uniforme): celular/tablet/monitor saem bem
// com mais frequência (confirmado em uso real); notebook reduzido por ainda
// gerar tampa com conteúdo incorreto às vezes; tela/TV de fundo reduzida por
// ser um uso pouco comum no dia a dia do público — não removida, só mais rara.
const DEVICE_TYPE_POOL: string[] = [
  DEVICE_CELULAR, DEVICE_CELULAR, DEVICE_CELULAR,
  DEVICE_TABLET, DEVICE_TABLET, DEVICE_TABLET,
  DEVICE_MONITOR, DEVICE_MONITOR, DEVICE_MONITOR,
  DEVICE_NOTEBOOK, DEVICE_NOTEBOOK,
  DEVICE_TELA_FUNDO,
];

export function pickDeviceTypeLine(): string {
  return DEVICE_TYPE_POOL[Math.floor(Math.random() * DEVICE_TYPE_POOL.length)];
}

export function buildDeviceRule(): string {
  return `⚠ DISPOSITIVOS DIGITAIS: notebook, laptop, tablet, celular, monitor e outros dispositivos são PERMITIDOS quando a cena pedir, em uso natural — abertos, na mão, apoiados sobre a mesa. NÃO forçar dispositivo fechado. A TELA, quando visível, mostra conteúdo com desfoque LEVE E SUTIL (~5% de intensidade — o mínimo necessário para impedir a leitura, não um borrão pesado); presença visual de conteúdo é desejável, opacidade total não. PROIBIDO desfoque forte, borrão pesado, glitch ou qualquer efeito que pareça defeito de renderização. PROIBIDO: tela apagada, escura ou em branco quando o dispositivo estiver aberto e em uso; conteúdo identificável em tela (logo real, marca reconhecível, texto legível, interface clara, dashboard, gráfico, planilha, barra de dados).

COMPOSIÇÃO POR TIPO DE DISPOSITIVO — define o ÂNGULO da cena para que a tampa/carcaça errada não possa aparecer por geometria (em vez de só proibir). SE a cena envolver dispositivo digital, use o tipo e a composição sorteados para esta geração:
TIPO DESTA GERAÇÃO: ${pickDeviceTypeLine()}
DIVERSIFICAÇÃO OBRIGATÓRIA: não repita sempre notebook entre as peças de uma mesma sequência — alterne com celular, tablet, monitor de desktop ou tela/TV de fundo conforme a atividade da empresa e o que a cena pede.
PROTAGONISMO: o dispositivo digital é elemento de APOIO à cena, nunca o protagonista visual — o foco principal é a pessoa e a ação dela. Mantenha o dispositivo proporcionalmente pequeno no quadro, nunca em primeiro plano ocupando a maior área da composição. EXCEÇÃO: quando o próprio dispositivo for o produto sendo vendido (ex.: loja de eletrônicos/celulares/informática) — nesse caso ele pode ocupar o centro da composição como protagonista.

CARCAÇA E TAMPA — REGRA ABSOLUTA (vale mesmo com a composição correta, como reforço): tampa, verso e carcaça de qualquer dispositivo DEVEM ser completamente lisas, sem nenhuma marca, símbolo, logo, maçã, ícone, adesivo, gravação ou iluminação. Use equipamento genérico, sem marca. MÁXIMO 1 DISPOSITIVO por cena.
NEGATIVE: no blank screen, no dark screen, no empty screen, no sharp readable text on screen, no legible content on screen, no recognizable logo on screen, no images or graphics on device casing or back cover, no duplicated devices, no corded phone, no rotary phone, casing must be plain and unbranded, no Apple logo, no glowing logo on lid, no backlit symbol on laptop, no brand mark on back cover, no laptop logo, generic unbranded laptop only, no dashboard on screen, no charts on screen, no spreadsheet on screen, no data visualization on screen, no laptop screen facing camera directly.`;
}

export const AMBIENTES_RULE = `⚠ AMBIENTES VISUAIS: PROIBIDO paredes de concreto aparente, galpões industriais, estruturas arquitetônicas frias, corredores vazios como elemento dominante ou fundo para tipografia. Use fundos coloridos, texturas orgânicas, desfoque, gradiente ou fotografia quente. PROIBIDO TAMBÉM: formas geométricas abstratas flutuando (círculos, esferas, polígonos, espirais) sem propósito narrativo. A composição deve ter TEMA CONCRETO — humano, objeto real, natureza, tipografia ou cenário com sentido.`;

export const HUMANIZACAO_RULE = `⚠ HUMANIZAÇÃO: imagens devem parecer humanas, autênticas e reais. PROIBIDO inserir vasos, plantas ornamentais, folhas ou flores apenas para preencher cantos — todo elemento deve contribuir para a mensagem.`;

export const FORBIDDEN_MOOD_WORDS = `PALAVRAS PROIBIDAS NA IMAGEM: NUNCA escreva, desenhe ou renderize como texto/lettering/título/etiqueta, em nenhum lugar da peça, as palavras CLAREZA, IMPACTO, INSTANTE, FRAGMENTO, DESVIO, SILÊNCIO, MOOD, OP-01, OP-02, OP-03, OP-04, OP-05, OP-06 — são códigos internos do sistema e nunca devem aparecer na arte final.`;

export const CONCEITO_FIRST_RULE = `⚠ CONCEITO-FIRST — INEGOCIÁVEL: A cena nasce do conceito do título. O sujeito, verbo ou promessa central do título deve aparecer visualmente na imagem — a imagem NUNCA pode negar o que o título afirma. Se o título menciona equipe ou interação, há ao menos dois sujeitos ou troca visível entre pessoas; se menciona decisão, há o ato concreto de decidir; se menciona método ou processo, há ordem e etapas visíveis; se menciona escuta, há presença de interlocutor ou elemento de recepção. PROIBIDO como elemento central da cena: porta entreaberta com feixe de luz dourada · kit papelaria corporativa genérico (cartões + caneta + clipe sem relação com o tema do título) · mão escrevendo em caderno como substituto de cena concreta com personagem. PROIBIDO — TRADUÇÃO LITERAL DE PALAVRAS DO TÍTULO EM SÍMBOLOS GENÉRICOS: "ideia" ≠ lâmpada acesa; "crescimento" ou "ação" ≠ seta apontando para cima; "conexão" ou "juntos" ≠ mosquetões/carabiner/corda de escalada/engrenagens; "estratégia" ≠ peça de xadrez; "inovação" ≠ foguete; "sucesso" ≠ troféu ou pódio; "planejamento" ≠ Post-it com ícones de negócios; "avançar" ou "longe" ≠ degraus/pódio/horizonte vazio. A cena mostra o que acontece no negócio real quando a promessa do título se realiza — não o símbolo universal da palavra. ADJETIVOS/ADVÉRBIOS DO TÍTULO ancoram-se no ofício, não na sua propriedade física literal: "rápido" = eficiência no atendimento, não velocidade; "claro" = transparência, não iluminação; "forte" = coesão da equipe, não músculo; "sólido" = confiança, não material rígido. Exceção: quando o modificador é visível no negócio (equipe organizada, escritório cheio, produto artesanal), mantenha-o literal. SE O TÍTULO TEM "PESSOAS" COMO SUJEITO EXPLÍCITO, PESSOAS REAIS APARECEM NA IMAGEM — nunca espaço decorativo vazio, nunca pódio sem ocupante. NEGATIVE: lightbulb, upward arrow, chess piece, gear, carabiner, climbing rope, rocket, trophy, podium, post-it with business icons, empty stage as main element.`;
