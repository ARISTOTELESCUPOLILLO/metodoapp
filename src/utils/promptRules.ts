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
// Enquadramento descrito SÓ pela face frontal (tela + moldura + pé de apoio).
// Antes o texto citava "a parte de trás do gabinete nunca fica visível" e o
// "logo de fabricante" — nomear a face traseira/o logo prima o gpt-image-2 a
// desenhá-los justamente ali (efeito "não pense no elefante"); a supressão de
// marca continua garantida pela regra de CARCAÇA e pelo NEGATIVE. Aqui só
// descrevemos o que DEVE aparecer.
// ATENÇÃO (achado real 2026-07-22): a 1ª versão desta frase terminava com "a
// tela sempre voltada para a pessoa E para a câmera" — fisicamente impossível
// (uma face só encara UM lado). O modelo obedecia "voltada para a pessoa" na
// geometria e resolvia o "para a câmera" estampando o conteúdo na carcaça, que
// é o que a câmera vê. Nunca peça a mesma face para dois lados opostos.
const DEVICE_MONITOR =
  "MONITOR DE DESKTOP: o PERSONAGEM fica de frente para a tela; a câmera do OBSERVADOR fica do mesmo lado dele (por cima/ao lado do ombro), enquadrando o rosto do personagem e a tela em ângulo oblíquo. Só a face frontal do monitor entra no quadro: a moldura fina ao redor da tela e o pé de apoio.";
const DEVICE_TELA_FUNDO =
  "TELA OU TV GRANDE AO FUNDO: equipamento em segundo plano, distante da câmera, como parte do ambiente (sala de apresentação, painel) — nunca em primeiro plano nem como foco da composição.";

// Variantes "EXPOSTO" — usadas só no modo PRODUTO EXPOSTO — NÃO EM USO
// (produtoEhDispositivo && preserveScreenContent, ver buildDeviceRule). Ao
// contrário das variantes padrão acima, NENHUMA delas oferece a opção
// "personagem segurando/olhando para a própria tela" — o dispositivo é um
// objeto de composição, ninguém o usa, então essa opção não existe aqui.
const DEVICE_CELULAR_EXPOSTO =
  "CELULAR/SMARTPHONE EXPOSTO: apoiado sobre a mesa/superfície (nunca nas mãos de alguém usando), tela voltada para CIMA ou para a CÂMERA, legível — ninguém o segura nem olha para ela.";
const DEVICE_TABLET_EXPOSTO =
  "TABLET EXPOSTO: apoiado sobre a mesa/suporte (nunca nas mãos de alguém usando), tela voltada para CIMA ou para a CÂMERA, legível — ninguém o segura nem olha para ela.";
const DEVICE_NOTEBOOK_EXPOSTO =
  "NOTEBOOK/LAPTOP EXPOSTO: aberto sobre a mesa, tela voltada o suficiente para a câmera ler o conteúdo — câmera frontal/oblíqua (não estritamente de perfil, que esconderia o conteúdo). Ninguém está sentado usando-o.";
const DEVICE_MONITOR_EXPOSTO =
  "MONITOR DE DESKTOP EXPOSTO: sobre a mesa, tela voltada para a câmera o suficiente para ser lida. Ninguém está posicionado usando-o.";

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

// Negócios cujo PRODUTO é, ele mesmo, vestuário/calçado — moda, boutique,
// confecção, loja de roupas, sapataria. Nesses casos o produto referenciado
// entra em rota de colisão com o figurino do avatar: o prompt sorteia uma cor
// neutra de roupa para o personagem (buildClothingPool) e, no parágrafo
// seguinte, exige que o produto — uma camiseta — seja o herói do quadro. A IA
// resolve o conflito vestindo a cor sorteada e jogando a peça real para o
// fundo (achado real 06/08/2026, PU Atrevidinha Modas: "VESTUÁRIO: Roupa
// preta" + camiseta Colcci como produto-herói).
// Regex (e não `includes` como a lista acima) porque os termos curtos deste
// campo são ambíguos por dentro de outras palavras: "moda" aparece em
// "modalidade" e "acomodação"; "tenis" em "tenista". A âncora \b evita esses
// falsos positivos.
const APPAREL_ACTIVITY_PATTERNS: RegExp[] = [
  /\bmodas?\b/, // "moda feminina", "Atrevidinha Modas"
  /\broupas?\b/,
  /\bvestuari/,
  /\bconfec[cs]/, // confecção, confecções
  /\bboutique/,
  /\bmalhari/,
  /\bcamisari/,
  /\bjeans\b/,
  /\blingerie/,
  /\bcalcad/, // calçados
  /\bsapat/, // sapataria, sapatos
  /\btenis\b/,
  /\bbrecho/,
  /\bfashion/,
  /\benxoval/,
];

export function isApparelActivity(mainActivity?: string): boolean {
  if (!mainActivity) return false;
  const normalized = mainActivity.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return APPAREL_ACTIVITY_PATTERNS.some((re) => re.test(normalized));
}

export function buildNoDeviceRule(): string {
  return `⚠ DISPOSITIVOS DIGITAIS — PROIBIDOS NESTA CENA: o ofício real da empresa/profissional é manual, físico ou artístico e NÃO passa por tela. PROIBIDO incluir notebook, laptop, tablet, celular, monitor, computador ou qualquer dispositivo digital na composição, mesmo como elemento de apoio. A cena mostra o trabalho real com as mãos, ferramentas, materiais ou instrumentos do próprio ofício.
NEGATIVE: laptop, notebook, tablet, smartphone, computer monitor, desktop computer, screen, digital device, phone in hand.`;
}

// Quando há produto físico de referência selecionado (Kit Imagem) mas o
// checkbox de tela (produtoEhDispositivo) está desmarcado, NÃO SABEMOS se o
// produto de fato não é um dispositivo — o checkbox pode só não ter sido
// marcado. A versão antiga desta regra bania categoricamente notebook/tablet/
// celular/monitor "mesmo como elemento de apoio", o que apagava o PRÓPRIO
// produto referenciado sempre que ele por acaso fosse um dispositivo com tela
// (app, dashboard, print de sistema) — bug real confirmado ao vivo (PU, mood
// SILÊNCIO, empresa Oficina de Propaganda, 2026-07-17): o produto sumiu da
// peça inteira porque a proibição de "tablet/celular/monitor" incluía sem
// querer o próprio produto referenciado. Referências visuais enviadas pelo
// usuário têm PRIORIDADE MÁXIMA sobre qualquer proibição do resto do prompt
// (documento de princípios, Parte 1.5) — "produto pedido pra aparecer sempre
// aparece", em qualquer segmento, independente do checkbox de tela. Por isso
// esta regra só pode proibir um SEGUNDO dispositivo inventado, nunca o
// produto de referência em si. Mantém a motivação original (achado real:
// peça sobre ração recebeu um notebook sem nenhum motivo na cena) sem mais
// apagar o produto quando ele acontece de ser uma tela. Nitidez de tela
// garantida (PRODUTO EXPOSTO, ver buildDeviceRule) continua exigindo o
// checkbox — aqui só garantimos que o produto EXISTE na composição.
function buildNoDeviceProdutoFisicoRule(): string {
  return `⚠ DISPOSITIVOS DIGITAIS — SEM INVENÇÃO ADICIONAL: o produto físico referenciado já é o elemento concreto e o foco desta peça — ele DEVE aparecer normalmente, com fidelidade total (embalagem, formato, cores, tela, se houver), independente de ele ser ou não, ele mesmo, um dispositivo digital. Esta regra PROÍBE apenas um SEGUNDO dispositivo digital ADICIONAL (notebook, laptop, tablet, celular, monitor, computador) inventado sem relação narrativa com o produto — nunca proíbe o produto de referência em si, seja ele qual for.
NEGATIVE: second unrelated digital device, extra invented laptop, extra invented tablet, extra invented smartphone, extra invented computer monitor unrelated to the referenced product, decorative electronic gadget added without narrative reason.`;
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
    return `A TELA do dispositivo referenciado como produto exibe o CONTEÚDO REAL da imagem de referência — esse conteúdo É a identidade do produto sendo mostrado. PROIBIDO desfocar, apagar, escurecer ou substituir esse conteúdo por outra interface: reproduza-o com NITIDEZ e LEGIBILIDADE total, exatamente como aparece na referência.
⚠ CONTENÇÃO ABSOLUTA DO CONTEÚDO DE TELA: tudo o que esse conteúdo contém — interface, imagens, textos e QUALQUER logomarca ou marca que faça parte da tela — existe EXCLUSIVAMENTE dentro do retângulo da face ativa da tela, e em NENHUM outro lugar da composição. PROIBIDO repetir, espelhar, estampar ou fazer "sangrar" esse conteúdo (ou a logomarca contida nele) na carcaça, na tampa, no verso, na moldura/bezel do aparelho, na mesa, na parede, no fundo da cena ou flutuando como grafismo solto. A logomarca da marca NÃO deve ser desenhada por você em parte alguma da peça fora dessa tela — a logo oficial é aplicada depois, fora da IA, por composição; qualquer logo adicional que você desenhar é ERRO.`;
  }
  // Sem exigência de desfoque artificial (removida 2026-07-07 — decisão do
  // usuário após revisão Opus 4.8 + Fable 5): a IA decide a nitidez natural
  // da cena; o que importa é não inventar conteúdo específico/identificável
  // que pareça um produto real não referenciado, nem deixar a tela vazia.
  return `A TELA, quando visível, mostra conteúdo genérico e discreto (textura de interface, cores e formas plausíveis) — sem forçar desfoque nem nitidez artificial, a composição decide naturalmente. PROIBIDO: tela apagada, escura ou em branco quando o dispositivo estiver aberto e em uso; conteúdo identificável e específico em tela (logo real, marca reconhecível, texto legível, interface clara, dashboard, gráfico, planilha, barra de dados) que pareça um produto real não referenciado.`;
}

// PONTO DE VISTA — PERSONAGEM × OBSERVADOR (ideia do usuário, 2026-07-22, após
// o conteúdo voltar a aparecer na carcaça do monitor). Todas as regras de tela
// eram PROIBIÇÕES ("não desenhe no verso"), enquanto screenContentClause impõe
// uma OBRIGAÇÃO POSITIVA forte ("reproduza o conteúdo com nitidez total — é a
// identidade do produto"). Proibição não vence obrigação: sem uma saída
// declarada, quando a geometria põe a tela oblíqua/voltada ao personagem o
// modelo satisfaz a obrigação na única superfície que a câmera enxerga — a
// carcaça. Este bloco fecha o buraco de duas formas: (1) nomeia os dois pontos
// de vista, desfazendo a ambiguidade de "para quem" a tela está voltada, e
// (2) dá a VÁLVULA DE ESCAPE — tela não voltada ao observador ⇒ zero conteúdo
// na peça inteira é o resultado CORRETO, não uma falha a compensar.
// No modo PRODUTO EXPOSTO a válvula não pode virar desculpa pra tela vazia: lá
// a geometria já obriga a tela a encarar o observador, então o conteúdo é
// obrigatório — por isso o texto muda conforme dispositivoExposto.
function pontoDeVistaBlock(dispositivoExposto: boolean): string {
  const base = `⚠ DOIS PONTOS DE VISTA — DEFINIÇÃO (estes termos valem com este sentido exato em TODAS as regras abaixo):
· PERSONAGEM = a pessoa que existe DENTRO da imagem gerada, na cena.
· OBSERVADOR = quem vê a peça pronta depois de publicada, olhando a imagem de fora. É o ponto de vista da câmera.
São dois lugares OPOSTOS: o que o personagem enxerga não é o que o observador enxerga. Uma tela é uma face única e plana — ela encara UM dos dois por vez, JAMAIS os dois ao mesmo tempo.

⚠ REGRA DA TELA VOLTADA — TEM PRECEDÊNCIA SOBRE QUALQUER EXIGÊNCIA DE CONTEÚDO: conteúdo de tela (interface, print, app, dashboard, imagem, texto, logo) só pode existir na peça quando a FACE ATIVA da tela estiver voltada para o OBSERVADOR na imagem gerada.
SE a face ativa da tela NÃO estiver voltada para o observador — porque encara o personagem, o lado, o teto, a mesa ou fica fora de quadro — então NENHUMA imagem de tela aparece em NENHUM lugar da peça: nem na carcaça, nem na tampa, nem no verso, nem na moldura/bezel, nem no pé/base, nem na mesa, nem na parede, nem flutuando. O equipamento aparece normalmente, apenas SEM nenhum conteúdo visível. Esse é o resultado CORRETO e esperado, não uma falha — é PROIBIDO "compensar" a tela invisível desenhando o conteúdo em qualquer superfície que o observador consiga ver.`;
  if (!dispositivoExposto) return base;
  return `${base}
NESTA PEÇA a geometria já foi resolvida a favor do observador: o enquadramento PRODUTO EXPOSTO (abaixo) obriga a face ativa da tela a encarar o OBSERVADOR. Logo, a condição acima está satisfeita e o conteúdo da referência É obrigatório — dentro do retângulo da tela, e só ali. A válvula acima NUNCA autoriza tela vazia, apagada ou borrada nesta peça.`;
}

export function buildDeviceRule(
  mainActivity?: string,
  preserveScreenContent?: boolean,
  hasProdutoFisicoRef?: boolean,
  produtoEhDispositivo?: boolean,
): string {
  if (isNonDigitalActivity(mainActivity)) return buildNoDeviceRule();
  // Só proíbe dispositivo quando o produto de referência NÃO é ele mesmo um
  // dispositivo. Quando o produto É um dispositivo (produtoEhDispositivo) mas a
  // nitidez de tela foi degradada por causa do avatar (preserveScreenContent
  // false), banir dispositivo transformaria o próprio produto num objeto
  // genérico (pasta, placa) — bug real 2026-07-08. Nesse caso cai no
  // tratamento comum de dispositivo abaixo (permite o aparelho, sem forçar
  // nitidez de tela), preservando a forma reconhecível de dispositivo.
  if (hasProdutoFisicoRef && !preserveScreenContent && !produtoEhDispositivo)
    return buildNoDeviceProdutoFisicoRule();
  const screenNegative = preserveScreenContent
    ? "no blurred screen, no blank screen, no dark screen, no empty screen, no different content on screen than the reference image, screen content must stay strictly inside the screen, no brand logo outside the screen, no logo on wall or background, no logo on device casing or bezel, no floating brand mark, no duplicated logo, no screen content bleeding onto casing or desk, no screen content on laptop lid, no screenshot on notebook back cover, no interface on monitor rear, no content on the back of the device, screen face must be turned toward the camera"
    : "no blank screen, no dark screen, no empty screen, no sharp readable text on screen, no legible content on screen, no recognizable logo on screen, no dashboard on screen, no charts on screen, no spreadsheet on screen, no data visualization on screen";
  // Quando o dispositivo já é o produto de referência (preserveScreenContent),
  // ele não é sorteado nem varia entre peças — é fixo, ditado pela foto real.
  // Por isso o bloco RETRATO DO PERSONAGEM (framing exclusivo de celular/
  // tablet, substituído por MOSTRAR A TELA neste modo) e a linha
  // DIVERSIFICAÇÃO OBRIGATÓRIA (varia o tipo ENTRE peças de uma sequência —
  // não se aplica a um dispositivo fixo numa peça só) não se aplicam.
  // ATENÇÃO: "TIPO DESTA GERAÇÃO" (pickDeviceTypeLine) NÃO é dead code aqui —
  // achado real de teste ao vivo (2026-07-08): apesar do nome "sorteio", essa
  // linha carrega a REGRA GEOMÉTRICA por tipo (ex. DEVICE_NOTEBOOK: "a tampa
  // traseira nunca fica visível para a câmera"), que o modelo precisa mesmo
  // quando o tipo já é fixo — removê-la incondicionalmente (1ª tentativa desta
  // sessão) causou EXATAMENTE o defeito que ela previne (notebook mostrado
  // pela tampa/verso, tela não visível) em teste real. Mantida sempre.
  // PRODUTO EXPOSTO — NÃO EM USO: achado real 2026-07-08 (dilema AJUSTE_CONFLITO,
  // Oficina de Propaganda). Quando o produto É um dispositivo com tela=identidade,
  // o usuário decidiu que ele NÃO precisa estar nas mãos nem "em uso" por ninguém —
  // fica exposto sobre uma superfície, tela voltada pra câmera, como objeto de
  // composição independente do personagem. Isso evita a armadilha física da
  // imagem 3 do dilema: pedir a tela de frente pra câmera E o personagem "usando"
  // (olhando para) o mesmo dispositivo ao mesmo tempo é fisicamente impossível
  // (a tela só pode encarar UM lado por vez — câmera OU o rosto de quem usa,
  // nunca os dois). Ao declarar que ninguém usa o aparelho, a exigência de
  // "olhos na tela" (ver FÍSICA DA TELA item 1 abaixo) deixa de se aplicar.
  const dispositivoExposto = !!produtoEhDispositivo && !!preserveScreenContent;
  const enquadramentoRetrato = dispositivoExposto
    ? `Quando o conteúdo da tela É o produto referenciado (ver regra de tela acima), use SEMPRE o enquadramento PRODUTO EXPOSTO — a peça existe para exibir esse conteúdo, não para mostrar alguém usando o aparelho.
⚠ PRODUTO EXPOSTO — NÃO EM USO: o dispositivo fica APOIADO sobre uma mesa/superfície/suporte, SEPARADO do personagem (fora das mãos dele, sem contato) — a TELA fica voltada para a CÂMERA, legível, como se estivesse sendo exibida diretamente para quem for ver a peça. NINGUÉM segura, usa ou lê o aparelho. O personagem (quando presente) NÃO precisa olhar para essa tela — ele ocupa seu papel normal na cena (olhando para a câmera, gesticulando, interagindo com outra coisa) — só olharia para ela se a tela estivesse mostrada DE PERFIL/lado para a câmera (não é o caso aqui, onde a tela encara a câmera de frente). PROIBIDO: personagem segurando o aparelho na frente do rosto; personagem com pose de "lendo"/"olhando" uma tela que está voltada para a câmera (fisicamente impossível — se a tela encara a câmera, ela não encara o personagem). JAMAIS resolva a exigência de legibilidade desenhando o conteúdo (ou qualquer parte dele) na tampa, no verso ou na carcaça: o verso permanece SEMPRE totalmente liso e vazio, mesmo que a tela apareça apenas parcialmente. Uma tela parcialmente visível é aceitável; conteúdo no verso NUNCA é.`
    : `· RETRATO DO PERSONAGEM (inclui contra-plongée e planos fechados no rosto): válido APENAS para CELULAR e TABLET em mãos — câmera de frente para o rosto do personagem (plenamente visível e enquadrado, nunca coberto), do lado oposto à tela: o aparelho pequeno nas mãos, abaixo do rosto, mostra o verso liso enquanto o personagem olha para baixo, para a própria tela (ver regra de OLHAR acima) — o dispositivo NUNCA se posiciona entre a câmera e o rosto. NOTEBOOK e MONITOR NUNCA usam este enquadramento — a carcaça traseira desses equipamentos é grande demais e esconderia o personagem, violando a regra de rosto acima; eles seguem sempre a composição de perfil/oblíqua definida abaixo.`;
  const diversificacao = preserveScreenContent
    ? ""
    : `
DIVERSIFICAÇÃO OBRIGATÓRIA: não repita sempre notebook entre as peças de uma mesma sequência — alterne com celular, tablet, monitor de desktop ou tela/TV de fundo conforme a atividade da empresa e o que a cena pede.`;
  // Quando o produto referenciado É um dispositivo (produtoEhDispositivo), o
  // TIPO já está determinado pela foto real enviada — sortear um tipo daqui
  // (pickDeviceTypeLine) pode contradizer a referência (achado real
  // 2026-07-08: referência era um TABLET, sorteio escolheu CELULAR, o modelo
  // desenhou um celular em vez do tablet da foto). Nesse caso, lista as 4
  // composições possíveis e manda a IA usar a que corresponde ao tipo real da
  // foto, em vez de sortear. No modo EXPOSTO (tela=identidade), usa as
  // variantes EXPOSTO — sem a opção "personagem segurando/olhando pra tela",
  // que não existe quando ninguém usa o aparelho.
  const composicaoPorTipo = produtoEhDispositivo
    ? `COMPOSIÇÃO DO DISPOSITIVO — O TIPO JÁ ESTÁ DEFINIDO PELA FOTO DE REFERÊNCIA DO PRODUTO: mantenha EXATAMENTE o mesmo tipo de aparelho mostrado nela — NÃO troque celular por tablet, tablet por notebook, notebook por monitor, ou qualquer outra troca. O tipo não é uma escolha sua, é ditado pela imagem de referência enviada. Aplique só a composição abaixo que corresponde ao tipo real da foto:
${dispositivoExposto ? DEVICE_CELULAR_EXPOSTO : DEVICE_CELULAR}
${dispositivoExposto ? DEVICE_TABLET_EXPOSTO : DEVICE_TABLET}
${dispositivoExposto ? DEVICE_NOTEBOOK_EXPOSTO : DEVICE_NOTEBOOK}
${dispositivoExposto ? DEVICE_MONITOR_EXPOSTO : DEVICE_MONITOR}
`
    : `COMPOSIÇÃO POR TIPO DE DISPOSITIVO — aplica o enquadramento escolhido acima a cada formato. SE a cena envolver dispositivo digital, use o tipo e a composição sorteados para esta geração:
TIPO DESTA GERAÇÃO: ${pickDeviceTypeLine()}${diversificacao}
`;
  return `⚠ DISPOSITIVOS DIGITAIS: notebook, laptop, tablet, celular, monitor e outros dispositivos são PERMITIDOS quando a cena pedir, em uso natural — abertos, na mão, apoiados sobre a mesa. NÃO forçar dispositivo fechado. ${screenContentClause(!!preserveScreenContent)}

${pontoDeVistaBlock(dispositivoExposto)}

FÍSICA DA TELA — PRINCÍPIO DE CENA (entenda a geometria; as proibições abaixo são reforço, não a regra primária): todo dispositivo com tela tem DUAS faces opostas — a TELA (face ativa, único lugar onde existe conteúdo) e o VERSO/carcaça (face lisa e opaca, sem nada). A tela fica sempre voltada para o rosto de quem está usando o aparelho. Disso decorrem 3 consequências:
1. OLHAR: se o personagem está usando o dispositivo, os olhos dele estão NA TELA — olhar dirigido a ela, nunca solto, nunca para o lado, nunca para fora de quadro. Essa regra tem PRECEDÊNCIA sobre qualquer instrução de câmera do mood que peça "olhar para longe" ou "espaço negativo à frente do olhar" — quando há dispositivo em uso, o olhar vai para a tela, e o espaço negativo (se o mood exigir) se organiza ao redor desse eixo, não contra ele. Se a cena pede olhar em outra direção, o dispositivo fica em REPOUSO (abaixado, sobre a mesa) — não erguido como se estivesse em uso. ⚠ EXCEÇÃO — PRODUTO EXPOSTO: quando o dispositivo está EXPOSTO como objeto de composição (ninguém o segura nem o usa — ver enquadramento PRODUTO EXPOSTO abaixo), esta regra de olhar NÃO se aplica — o personagem não está "usando" o aparelho, então seus olhos não precisam ir para a tela; ele olha para onde a cena pedir (câmera, interlocutor, ação). Ver a tela do dispositivo exigiria estar do mesmo lado dela — impossível quando a tela está voltada para a câmera/espectador.
2. O QUE A CÂMERA VÊ: a câmera vê OU a tela (quando está do mesmo lado do olhar do personagem) OU o verso liso (quando está do lado oposto, de frente para o personagem). Nunca as duas faces ao mesmo tempo — é fisicamente impossível. Ver o verso é natural e correto nesse ângulo; NÃO torça o aparelho nem o personagem para a tela "aparecer" mesmo assim.
3. CONTEÚDO: existe SOMENTE na face da tela. Conteúdo, logo ou interface no verso/carcaça é fisicamente impossível — PROIBIDO em qualquer ângulo de câmera, sem exceção.

REGRA INVIOLÁVEL DE ROSTO — vale para QUALQUER enquadramento abaixo: o rosto do personagem NUNCA pode ficar escondido, cortado ou obstruído pelo dispositivo, em nenhuma hipótese. É essa garantia — não a posição da câmera em si — que torna cada enquadramento abaixo válido.

ENQUADRAMENTO COM DISPOSITIVO — escolha a geometria coerente com a câmera sorteada para esta cena:
· MOSTRAR A TELA: câmera do mesmo lado do olhar do personagem (lateral, por cima do ombro, oblíqua) — a tela aparece ao observador com o conteúdo tratado pela regra acima, rosto do personagem sempre visível.
${enquadramentoRetrato}

${composicaoPorTipo}PROTAGONISMO: o dispositivo digital é elemento de APOIO à cena, nunca o protagonista visual — o foco principal é a pessoa e a ação dela. Mantenha o dispositivo proporcionalmente pequeno no quadro, nunca em primeiro plano ocupando a maior área da composição. EXCEÇÃO: quando o próprio dispositivo for o produto sendo vendido (ex.: loja de eletrônicos/celulares/informática) OU quando sua tela for a identidade do produto referenciado (PRODUTO EXPOSTO, ver acima) — nesses casos ele pode, e deve, ocupar primeiro plano/centro da composição, grande o suficiente para o conteúdo da tela ser lido; isso não faz dele o protagonista NARRATIVO da peça quando há personagem (ver regra de hierarquia produto×personagem), só o protagonista de ESCALA/NITIDEZ.

CARCAÇA E TAMPA — REGRA ABSOLUTA (vale mesmo com a composição correta, como reforço): tampa, verso e carcaça de qualquer dispositivo DEVEM ser completamente lisas, sem nenhuma marca, símbolo, logo, maçã, ícone, adesivo, gravação ou iluminação. Use equipamento genérico, sem marca. MÁXIMO 1 DISPOSITIVO por cena.
NEGATIVE: ${screenNegative}, no screen content anywhere in the image when the active screen face is turned away from the viewer, no user interface rendered on any surface other than the active screen face, no images or graphics on device casing or back cover, no content or interface visible on back casing under any camera angle, no duplicated devices, no second device in background, no corded phone, no rotary phone, casing must be plain and unbranded, no Apple logo, no glowing logo on lid, no backlit symbol on laptop, no brand mark on back cover, no laptop logo, generic unbranded laptop only, no laptop screen facing camera directly, no monitor seen from behind, no back of monitor facing camera, no notebook rear casing facing camera, character holding device but gaze not directed at its screen while in use, no device covering, blocking or obscuring the character's face${dispositivoExposto ? ", no character reading or gazing at a screen that faces the camera, no character holding the exposed product device, device must rest on a surface not in anyone's hands" : ""}.`;
}

export const AMBIENTES_RULE = `⚠ AMBIENTES VISUAIS: PROIBIDO paredes de concreto aparente, galpões industriais, estruturas arquitetônicas frias, corredores vazios como elemento dominante ou fundo para tipografia. Use fundos coloridos, texturas orgânicas, desfoque, gradiente ou fotografia quente. PROIBIDO TAMBÉM: formas geométricas abstratas flutuando (círculos, esferas, polígonos, espirais) sem propósito narrativo. A composição deve ter TEMA CONCRETO — humano, objeto real, natureza, tipografia ou cenário com sentido.`;

export const HUMANIZACAO_RULE = `⚠ HUMANIZAÇÃO: imagens devem parecer humanas, autênticas e reais. PROIBIDO inserir vasos, plantas ornamentais, folhas ou flores apenas para preencher cantos — todo elemento deve contribuir para a mensagem.`;

export const FORBIDDEN_MOOD_WORDS = `PALAVRAS PROIBIDAS NA IMAGEM: NUNCA escreva, desenhe ou renderize como texto/lettering/título/etiqueta, em nenhum lugar da peça, as palavras CLAREZA, IMPACTO, INSTANTE, FRAGMENTO, DESVIO, SILÊNCIO, MOOD, OP-01, OP-02, OP-03, OP-04, OP-05, OP-06 — são códigos internos do sistema e nunca devem aparecer na arte final.`;

// Camada GLOBAL do anti-clichê (roda em toda geração, MOP e PU). Duas outras
// camadas reforçam PARTE dos mesmos itens em escopo mais estreito — NÃO são
// cópias, são reforço em nível diferente (auditoria 2026-06-16/2026-07-05):
// `OBJETIVO_VISUAL_EXCLUSIONS.oportunidade` (objetivoConfig.ts) estende
// "porta entreaberta"/"seta pra cima" com uma lista maior específica de
// oportunidade (portal luminoso, corredor, pôr do sol); `VISUAL_DIRECTIONS`
// OP-04/OP-05 (visualDirection.lexicon.ts) reforça "kit papelaria genérico"/
// "porta luminosa" só para os moods Fragmento/Desvio. Ao adicionar um clichê
// novo aqui que já apareça num desses dois, considere se vale reforçar lá
// também — não mesclar as 3 listas numa só (perderiam a especificidade por
// objetivo/mood que justifica a redundância).
export const CONCEITO_FIRST_RULE = `⚠ CONCEITO-FIRST — INEGOCIÁVEL: A cena nasce do conceito do título. O sujeito, verbo ou promessa central do título deve aparecer visualmente na imagem — a imagem NUNCA pode negar o que o título afirma. Se o título menciona equipe ou interação, há ao menos dois sujeitos ou troca visível entre pessoas; se menciona decisão, há o ato concreto de decidir; se menciona método ou processo, há ordem e etapas visíveis; se menciona escuta, há presença de interlocutor ou elemento de recepção. PROIBIDO como elemento central da cena: porta entreaberta com feixe de luz dourada · kit papelaria corporativa genérico (cartões + caneta + clipe sem relação com o tema do título) · mão escrevendo em caderno como substituto de cena concreta com personagem. PROIBIDO — TRADUÇÃO LITERAL DE PALAVRAS DO TÍTULO EM SÍMBOLOS GENÉRICOS: "ideia" ≠ lâmpada acesa; "crescimento" ou "ação" ≠ seta apontando para cima; "conexão" ou "juntos" ≠ mosquetões/carabiner/corda de escalada/engrenagens; "estratégia" ≠ peça de xadrez; "inovação" ≠ foguete; "sucesso" ≠ troféu ou pódio; "planejamento" ≠ Post-it com ícones de negócios; "avançar" ou "longe" ≠ degraus/pódio/horizonte vazio. A cena mostra o que acontece no negócio real quando a promessa do título se realiza — não o símbolo universal da palavra. ADJETIVOS/ADVÉRBIOS DO TÍTULO ancoram-se no ofício, não na sua propriedade física literal: "rápido" = eficiência no atendimento, não velocidade; "claro" = transparência, não iluminação; "forte" = coesão da equipe, não músculo; "sólido" = confiança, não material rígido. Exceção: quando o modificador é visível no negócio (equipe organizada, escritório cheio, produto artesanal), mantenha-o literal. SE O TÍTULO TEM "PESSOAS" COMO SUJEITO EXPLÍCITO, PESSOAS REAIS APARECEM NA IMAGEM — nunca espaço decorativo vazio, nunca pódio sem ocupante. NEGATIVE: lightbulb, upward arrow, chess piece, gear, carabiner, climbing rope, rocket, trophy, podium, post-it with business icons, empty stage as main element.`;
