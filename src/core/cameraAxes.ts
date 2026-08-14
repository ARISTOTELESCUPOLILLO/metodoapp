// Decupagem da câmera em EIXOS INDEPENDENTES — Fase 2 do levantamento de
// repetição visual dos moods (11/08/2026). Aplicada ao CLAREZA e, no mesmo dia,
// estendida a IMPACTO e SILÊNCIO (12/08/2026).
//
// Até aqui, "câmera" era UMA frase pronta por mood, escolhida de um pool. Os
// pools eram pequenos e internamente parecidos:
//   · CLAREZA — 2 opções, ambas 50mm/plano médio/altura dos olhos; variava só
//     frontal × 3/4 lateral;
//   · IMPACTO — 2 opções, ambas 35mm/distância média; variava só contra-plongée
//     × 3/4 dinâmico;
//   · SILÊNCIO — 4 opções, misturando distância, altura e lente numa frase só,
//     sem profundidade nem luz.
// Distância, altura, lente, profundidade de campo e qualidade de luz ficavam
// praticamente constantes, e é esse conjunto que o olho lê como "de novo a
// mesma foto" (ver project-moods-rodizio-fase1: as peças que destoavam não
// eram mais criativas, só tinham outra câmera).
//
// Aqui a câmera passa a ser COMPOSTA por eixos independentes, cada um com fila
// própria: distância · altura · ótica · profundidade · luz, mais corpo/textura
// no CLAREZA desde 13/08/2026. É a decupagem que qualquer direção de fotografia
// usa, e permite variar um eixo sem mexer nos outros.
//
// A FILA em si também mudou em 13/08/2026, e só no CLAREZA: o rodízio simples
// dava a volta no pool a cada n peças, e eixos de mesmo tamanho voltavam ao
// início juntos — quatro dos cinco eixos do CLAREZA repetiam de uma vez a cada
// 3 peças. Ver pickEixoNaFila e `filaComCarry`.
//
// A gramática do mood continua mandando no que é LEGAL: cada mood recebe uma
// FAIXA PERMITIDA por eixo, e nenhuma faixa contradiz a regra inegociável do
// próprio mood — o CLAREZA nunca vira dramático, o IMPACTO nunca perde o
// contra-plongée nem ganha plongée, o SILÊNCIO nunca perde o espaço negativo.
// O rodízio escolhe DENTRO da gramática, nunca contra ela (ver
// feedback-escopo-camera-nao-gramatica-do-mood: câmera, altura, lente, luz e
// pose são EXECUÇÃO; o que é o sujeito da cena é gramática e não se sorteia).

import { MoodCode } from "../types";
import { coprimeStep, pickRotating } from "./colorRotation";
import { pickRandom } from "./visualDirection.lexicon";

// ── CLAREZA (OP-01) ─────────────────────────────────────────────────────────
// Faixa sem nada dramático: o mood pede leitura imediata e "sem ângulos
// dramáticos". Macro/detalhe fica fora de propósito — peça sem pessoa legível
// é SILÊNCIO ou FRAGMENTO, não CLAREZA.
//
// A distância só pôde entrar porque a trava de plano médio do mood
// (CLAREZA_PLANO_MEDIO_SENTENCE, "da cintura ao topo da cabeça") foi reescrita
// como CLAREZA_ROSTO_INTEIRO_SENTENCE: ela existia para proteger o rosto de ser
// decapitado, e protegia travando o enquadramento.
export const EIXO_DISTANCIA_CLAREZA: string[] = [
  "PLANO PRÓXIMO: enquadramento fechado no busto — ombros, rosto e mãos (quando entram na ação) ocupando a maior parte do quadro, com a CABEÇA INTEIRA dentro do quadro, sem cortar testa, queixo nem o topo do cabelo",
  // Acrescentado em 13/08/2026 para que a distância tenha 4 opções mesmo COM
  // avatar marcado (o filtro tira só o PLANO GERAL). Sem ela, distância e
  // altura ficavam com 3 opções cada e andavam coladas: na amostra real, PLANO
  // PRÓXIMO saía sempre com "altura dos olhos", PLANO MÉDIO sempre com plongée
  // suave. Tamanhos diferentes é o que desacopla os dois eixos.
  "PLANO MÉDIO-FECHADO: do peito ao topo da cabeça, rosto e expressão dominando o quadro com uma faixa do ambiente de trabalho atrás",
  "PLANO MÉDIO: da cintura ou do quadril ao topo da cabeça, com a superfície de trabalho ou o entorno imediato entrando na base do quadro",
  "PLANO AMERICANO: do meio da coxa ao topo da cabeça — o gesto das mãos e a postura inteira cabem no quadro junto com parte do ambiente",
  "PLANO GERAL: a pessoa ocupa uma parte menor do quadro e o ambiente organizado de trabalho entra inteiro ao redor dela — a ordem do espaço é parte do que a peça comunica",
];

export const EIXO_ALTURA_CLAREZA: string[] = [
  "altura dos olhos, câmera nivelada com o horizonte",
  "levemente acima da linha dos olhos, plongée suave que revela a organização da superfície de trabalho — inclinação discreta, NUNCA ângulo mergulhado",
  "levemente abaixo da linha dos olhos, contra-plongée discreto que assenta a figura no quadro — inclinação mínima, NUNCA ângulo ascendente forte",
];

// Variar a lente exige mexer na `assinatura` do mood junto: ela é colada no fim
// de todo imagePrompt e declarava uma lente única — variar aqui sem tocar lá
// contradiria o próprio fecho do prompt. Foi por isso que o INSTANTE ficou
// preso em 35mm na Fase 1. As assinaturas dos três moods passaram a declarar a
// FAIXA, no padrão que o SILÊNCIO já usava ("lente 50-70mm").
export const EIXO_OTICA_CLAREZA: string[] = [
  "lente 35mm, que deixa entrar mais ar e contexto do ambiente ao redor da figura",
  "lente 50mm, perspectiva neutra e leitura imediata, sem nenhuma distorção",
  // 70mm entrou em 13/08/2026 para desempatar o tamanho deste pool do de altura
  // e luz, que também tinham 3 (ver pickEixoNaFila). Fica DENTRO da faixa que a
  // assinatura do mood já declara (35-85mm): é um passo intermediário entre a
  // neutralidade do 50 e a compressão do 85, não uma ótica nova de gramática.
  "lente 70mm, compressão suave que assenta a figura no ambiente sem achatá-lo",
  "lente 85mm, que comprime o fundo e recorta a figura com suavidade, sem distorcer traços",
];

// ── CORPO E TEXTURA (CLAREZA) ───────────────────────────────────────────────
// Camada nova, pedida pelo Aristóteles em 13/08/2026 para testar o acabamento
// de imagem ("câmera Sony FX3, lente clara, textura de cinema").
//
// O que JÁ existia e o que é novo: a LENTE já era eixo próprio (EIXO_OTICA
// acima) e a TEXTURA já existia — mas fixa e escondida dentro da assinatura de
// cada mood, nunca sorteada: o INSTANTE declara "lente 35mm com grão sutil", o
// SILÊNCIO declara "lente 50-100mm sem grão". CORPO DE CÂMERA não existia em
// lugar nenhum do sistema. É isto que este eixo acrescenta: o corpo que captou
// a cena e o acabamento que ele produz.
//
// Só o CLAREZA recebe a camada, de propósito. Estender aos outros exigiria
// reconciliar cada assinatura: pedir "textura de cinema" ao SILÊNCIO, cuja
// assinatura manda "sem grão", poria duas ordens opostas no mesmo prompt — a
// classe de bug que já apareceu quatro vezes neste arquivo.
//
// As cinco opções são a MESMA família de acabamento (cinema digital de sensor
// grande, lente clara, textura limpa e luminosa), variando o corpo. Isso é
// deliberado: assim o Aristóteles vê o look que pediu em QUALQUER peça de
// CLAREZA que gerar, em vez de uma em cinco. Nenhuma introduz contraste
// dramático, virada de cor cinematográfica (teal-orange) nem grão pesado — tudo
// isso é IMPACTO, e contradiria "luz natural difusa, sem sombras duras" e a
// paleta fria controlada que o CLAREZA declara.
export const EIXO_CORPO_CLAREZA: string[] = [
  "captada em Sony FX3 full-frame com lente clara de abertura T1.5 — textura de cinema limpa, tons de pele naturais e altas luzes que rolam suavemente, sem grão pesado",
  "captada em ARRI Alexa com lente esférica clara — latitude ampla, altas luzes que se apagam sem estourar, textura de cinema orgânica e discreta",
  "captada em câmera full-frame de sensor grande com lente prime clara — nitidez editorial de revista, microcontraste alto, acabamento limpo e sem grão aparente",
  "captada em corpo de cinema digital com lente prime clara e leve difusão ótica — halo macio nas altas luzes e textura de cinema suave, mantendo o rosto perfeitamente nítido",
  "captada em mirrorless full-frame moderna com lente prime clara — imagem contemporânea de alta definição, cor neutra e textura de cinema discreta no acabamento",
];

// Fundo derretido em bokeh forte fica FORA da faixa do CLAREZA: o ambiente
// organizado é parte do que o mood comunica, e apagá-lo aproxima a peça de um
// retrato genérico de banco de imagem — vício que a própria regra do mood lista.
export const EIXO_PROFUNDIDADE_CLAREZA: string[] = [
  "profundidade ampla: ambiente inteiro legível e nítido, do primeiro ao último plano",
  "separação suave: figura nítida e fundo levemente fora de foco, ainda reconhecível — NUNCA fundo derretido em bokeh forte",
];

// As três são variantes de luz natural suave — a família que o mood declara
// ("luz natural difusa, sem sombras duras, manhã clara e estável"). Nenhuma
// introduz contraste dramático, que seria IMPACTO. O campo `luz` de
// VISUAL_DIRECTIONS["OP-01"] passou a declarar a família e delegar a fonte
// exata a este eixo, para os dois textos não se contradizerem no mesmo prompt.
export const EIXO_LUZ_CLAREZA: string[] = [
  "luz natural difusa entrando por uma janela lateral única, sombras longas e macias",
  "luz alta-chave difusa e envolvente, sombras quase ausentes, ambiente claro e arejado",
  "luz natural difusa somada a uma luminária acesa dentro do quadro, temperatura levemente mista, ainda sem nenhuma sombra dura",
  // Quarta opção acrescentada em 13/08/2026 pelo mesmo motivo do 70mm na ótica:
  // desempatar o tamanho deste pool. Segue na família que o mood declara — luz
  // natural suave, sem nenhuma direção dura.
  "luz natural difusa rebatida por uma superfície clara próxima, parede ou tampo branco devolvendo preenchimento suave e abrindo as sombras",
  // A quinta não é enfeite: leva este pool a 5, o único tamanho pequeno com
  // mais de uma classe de passo utilizável. É o que permite luz e corpo
  // andarem DESACOPLADOS um do outro (ver PASSO_LUZ/PASSO_CORPO) — com 4
  // opções os dois seriam forçados ao mesmo passo e repetiriam juntos.
  "luz de dia nublado entrando ampla e uniforme, sem direção marcada, sombras muito abertas e tonalidade estável",
];

// ── IMPACTO (OP-02) ─────────────────────────────────────────────────────────
// O mood tem a trava mais estreita dos três: IMPACTO_CAMERA_SENTENCE declara
// "OBRIGATÓRIO contra-plongée leve ou ângulo 3/4 dinâmico, PROIBIDO câmera
// frontal reta na altura dos olhos, PROIBIDO plongée de cima para baixo". Isso
// é gramática do mood — a força dramática vem do ângulo ascendente — e NÃO foi
// tocada. O eixo de altura varia DENTRO dela: são três sabores de ângulo
// ascendente, nenhum frontal reto, nenhum de cima para baixo.
export const EIXO_DISTANCIA_IMPACTO: string[] = [
  "PLANO PRÓXIMO: busto ou rosto recortado pela luz ocupando quase todo o quadro — a proximidade é o que cria a intensidade",
  "PLANO MÉDIO: da cintura ao topo da cabeça, com o vazio escuro do ambiente fechando a composição em volta",
  "PLANO AMERICANO: do meio da coxa ao topo da cabeça — postura e gesto inteiros dentro do quadro, com peso e presença",
  "PLANO ABERTO: a figura recortada pela luz ocupa parte menor do quadro e o vazio escuro domina o resto — a escala do vazio é o que amplifica o sujeito",
];

export const EIXO_ALTURA_IMPACTO: string[] = [
  "contra-plongée leve, câmera pouco abaixo da linha dos olhos, ângulo ascendente sutil",
  "contra-plongée mais marcado, câmera claramente abaixo da linha dos olhos — perspectiva forte, ainda natural, sem caricatura",
  "ângulo 3/4 dinâmico partindo de baixo, câmera lateral e abaixo da linha dos olhos ao mesmo tempo — perspectiva cinematográfica",
];

export const EIXO_OTICA_IMPACTO: string[] = [
  "lente 35mm, perspectiva forte que aumenta a presença do sujeito no quadro",
  "lente 50mm, perspectiva firme sem exagero de profundidade",
  "lente 85mm, que comprime o fundo escuro e recorta o sujeito contra ele",
];

export const EIXO_PROFUNDIDADE_IMPACTO: string[] = [
  "profundidade rasa: sujeito nítido e fundo escuro dissolvido, sem nenhum detalhe competindo",
  "profundidade média: o vazio escuro do ambiente ainda legível atrás do sujeito, dando escala à cena",
];

// Todas dentro do que o mood declara: "luz focal direcional sobre fundo escuro
// médio, contraste pronunciado com alguma gradação, sombras recortadas sem
// extremismo — dramaticidade presente sem apagar completamente o fundo".
export const EIXO_LUZ_IMPACTO: string[] = [
  "foco direcional lateral recortando o sujeito, fundo escuro médio com alguma gradação",
  "contraluz quente desenhando o contorno do sujeito, com preenchimento mínimo que mantém o rosto legível",
  "fonte dura única, alta e lateral, projetando sombra recortada na parede ao lado do sujeito",
];

// ── SILÊNCIO (OP-06) ────────────────────────────────────────────────────────
// A trava aqui é de ESCALA, não de ângulo: SILENCIO_ESCALA_SENTENCE exige que o
// sujeito ocupe NO MÁXIMO 30% do quadro e o resto seja vazio respirado. Isso é
// a identidade do mood ("o espaço vazio É a mensagem") e NÃO foi tocada — cada
// distância abaixo diz explicitamente que o sujeito permanece pequeno, para
// nenhuma delas competir com a regra dentro do mesmo prompt.
// Também não há filtro de avatar aqui: o próprio mood determina que a pessoa,
// quando aparece, é fragmento parcial e pequena. Mexer nisso seria gramática.
export const EIXO_DISTANCIA_SILENCIO: string[] = [
  "CÂMERA PRÓXIMA: distância curta, enquadramento fechado no sujeito — que mesmo assim ocupa proporção discreta do quadro, com vasto entorno respirado em volta",
  "CÂMERA MÉDIA: distância intermediária, sujeito pequeno e centrado ou em regra dos terços, o vazio ocupando a maior parte da composição",
  "CÂMERA ABERTA: distância maior, o sujeito reduzido a um ponto de interesse mínimo dentro de um campo vazio e sereno",
  "CÂMERA MUITO ABERTA: o sujeito quase perdido na amplitude do ambiente — parede, janela ou superfície vazia dominando quase todo o quadro",
];

// REESCRITO EM 14/08/2026 — o motivo está em NAO_COMPARTILHAVEL_COM_CLAREZA, no
// fim deste arquivo. Resumo: as três alturas antigas ("nivelada sem inclinação",
// "plongée suave", "ângulo ascendente mínimo") eram gêmeas textuais das três do
// CLAREZA, e o mesmo valia para 2 de 3 lentes, 2 de 3 luzes e a profundidade. Em
// ~33% dos sorteios o SILÊNCIO compunha uma câmera 100% legal em CLAREZA — e foi
// exatamente isso que o Aristóteles flagrou em peça real (14/08/2026): uma peça
// de SILÊNCIO indistinguível de uma de CLAREZA, olho nivelado, 50mm, janela
// difusa, pessoa em plano de busto.
//
// Toda opção abaixo é EXCLUSIVA do mood: nenhuma pode ser sorteada em nenhum
// outro. É a assimetria de repertório pedida pelo Aristóteles — moods não têm as
// mesmas possibilidades. O SILÊNCIO é o mood da economia e da estase, e um
// repertório estreito de câmera é coerência, não defeito (o INSTANTE vive de uma
// lente só e é reconhecível por isso). A variedade dele migra para o OBJETO do
// ofício, a SUPERFÍCIE e a PALETA — que já têm rodízio próprio.
//
// A geometria comum às quatro é a FRONTALIDADE ABSOLUTA ou a VERTICAL PURA:
// eixos perpendiculares, planos paralelos, nada de três-quartos naturalista. É a
// gramática do minimalismo — e é o oposto da câmera "com jeito de fotógrafo
// dentro da sala" que o CLAREZA usa.
export const EIXO_ALTURA_SILENCIO: string[] = [
  "CÂMERA ZENITAL: vista de cima a pino, eixo perfeitamente vertical — composição plana e geométrica, sombra curta projetada na superfície, nenhuma perspectiva de profundidade",
  "CÂMERA FRONTAL ORTOGONAL: eixo rigorosamente perpendicular ao fundo, sem nenhuma fuga de perspectiva nem ponto de vista de três-quartos — o quadro lido como um plano chapado e simétrico, quase um desenho técnico, com o sujeito alinhado ao eixo central ou a um terço exato. A frontalidade aqui é geométrica e deliberada, JAMAIS o ponto de vista naturalista de quem está de pé dentro da sala",
  "CÂMERA RASANTE À SUPERFÍCIE: lente baixada até o nível do tampo, do piso ou do plano onde o sujeito repousa, olhando reto para a frente — a superfície vazia corta a base do quadro como uma linha horizontal limpa. Eixo paralelo ao plano, SEM diagonal, sem rotação e sem angulação lateral",
  "CÂMERA ALTA E DISTANTE: ponto de vista muito acima e afastado, o sujeito visto de longe e de cima como um elemento pequeno sobre uma superfície ampla — o olhar é sereno e cartográfico, contemplativo, NUNCA dramático nem de tensão",
];

// A ótica sai da faixa neutra (50mm existe nos quatro moods; 70mm é do CLAREZA
// desde 13/08) e vai para a TELEOBJETIVA, que é gramática de silêncio: quanto
// maior a compressão, mais os planos se achatam um contra o outro e mais parada
// a imagem fica. O campo `camera` e a `assinatura` de VISUAL_DIRECTIONS["OP-06"]
// passaram a declarar 100-200mm no mesmo movimento — é a SEXTA vez que a
// assinatura precisa acompanhar o eixo de ótica, e continua sendo a classe de
// bug mais recorrente deste arquivo.
export const EIXO_OTICA_SILENCIO: string[] = [
  "lente 100mm, compressão que achata os planos e aumenta a sensação de quietude",
  "lente 135mm, compressão marcada — o fundo sobe para junto do sujeito e a cena perde qualquer sensação de profundidade agitada",
  "lente 200mm, teleobjetiva longa que empilha os planos num único plano gráfico, imóvel e distante",
];

export const EIXO_PROFUNDIDADE_SILENCIO: string[] = [
  "tudo nítido: fundo liso e limpo, sem desfoque, a nitidez uniforme reforçando a quietude",
  "compressão telefoto: planos achatados um contra o outro, o fundo liso empurrado para junto do sujeito — NUNCA bokeh forte nem fundo derretido, que trariam drama a um mood que não o tem",
];

// A luz do SILÊNCIO é da mesma FAMÍLIA da do CLAREZA (natural, suave, sem
// direção dura) — e é por isso que nenhuma redação de "janela difusa" separava
// os dois. O que separa é o PAPEL da luz: aqui ela não ilumina uma cena, ela É
// o acontecimento gráfico do quadro. Nenhuma das três existe no pool do CLAREZA.
export const EIXO_LUZ_SILENCIO: string[] = [
  "luz difusa vinda de cima, como de claraboia ou teto translúcido, com sombra curta e suave sob o sujeito",
  "faixa de luz desenhada sobre a parede ou superfície vazia, com o sujeito à MARGEM dela — a mancha de luz é o próprio acontecimento gráfico do quadro, e o resto fica em penumbra clara e uniforme, nunca escura",
  "luz muito suave e rasante correndo pelo fundo liso, revelando apenas a textura da superfície vazia e quase nenhum volume no sujeito — a cena parece iluminada por reflexo, sem fonte identificável",
];

// ── DESVIO (OP-05) ──────────────────────────────────────────────────────────
// Quarto mood a receber eixos (13/08/2026). Era o mais variado dos seis — 5
// câmeras próprias, contra 2 do CLAREZA — mas cada uma amarrava ângulo, lente,
// distância e às vezes profundidade numa frase só, então os eixos não podiam se
// combinar: das 5, quatro pediam distância média ou curta, e três fixavam
// 28-35mm. Variar o ângulo obrigava a variar a lente junto.
//
// A TRAVA AQUI É A NÃO-NEUTRALIDADE, e é a mais delicada dos quatro moods:
// DESVIO_CAMERA_SENTENCE declara "a câmera NUNCA pode estar na altura dos olhos
// em enquadramento neutro — PROIBIDO câmera frontal neutra em qualquer
// hipótese, essa é a assinatura inegociável do mood".
//
// Isso cria um risco que os outros três não tinham: com eixos INDEPENDENTES, a
// fila pode compor "altura dos olhos" + "plano médio" + "50mm" + "profundidade
// ampla" — que é exatamente a frontal neutra proibida. Nenhum eixo sozinho erra;
// a COMBINAÇÃO erra. Por isso a não-neutralidade vive dentro do eixo de altura:
// TODA opção abaixo carrega o próprio desvio (ângulo, rasância ou rotação de
// quadro) e repete que a frontal neutra não vale — do mesmo modo que cada
// distância do SILÊNCIO repete que o sujeito permanece pequeno. É a classe de
// bug recorrente aqui: dois trechos do mesmo prompt mandando coisas opostas.
export const EIXO_DISTANCIA_DESVIO: string[] = [
  "PLANO PRÓXIMO: enquadramento fechado em rosto, mãos ou detalhe, com o objeto da ruptura no entorno imediato e legível dentro do quadro — a proximidade aumenta a tensão e a leitura íntima do estranhamento",
  "PLANO MÉDIO: da cintura ao topo da cabeça, com o elemento deslocado da ruptura visível no mesmo quadro que o personagem",
  "PLANO AMERICANO: do meio da coxa ao topo da cabeça — postura inteira e objeto da ruptura convivendo no quadro, a relação entre os dois legível de imediato",
  "PLANO ABERTO: a figura ocupa parte menor do quadro e o ambiente entra inteiro — a ruptura permanece identificável, e é a relação de escala entre pessoa, espaço e elemento deslocado que produz o estranhamento",
];

// Cada opção é NÃO-NEUTRA por si — nenhuma pode compor uma frontal reta com os
// outros eixos. A diagonal holandesa é a única na altura dos olhos, e só entra
// porque a rotação do quadro é o que quebra a neutralidade ali (era assim na 4ª
// das 5 câmeras antigas, que este eixo preserva).
export const EIXO_ALTURA_DESVIO: string[] = [
  "CONTRA-PLONGÉE SUAVE: câmera ligeiramente abaixo da linha dos olhos do personagem ou do objeto — inclinação discreta, NUNCA extrema ou caricata. O leve ângulo ascendente sugere o estranhamento no segundo olhar, e já basta para que o enquadramento não seja frontal neutro",
  "PLONGÉE ACENTUADA: câmera nitidamente acima da cabeça do personagem ou do objeto — o observador olha de cima, e o distanciamento revela o estranhamento; enquadramento claramente não-neutro",
  "LATERAL RASANTE AO CHÃO: câmera quase ao nível do piso, ângulo lateral extremo — composição diagonal que distorce a perspectiva sem recorrer ao eixo vertical; jamais confundível com frontal neutra",
  "DIAGONAL HOLANDESA (DUTCH ANGLE): câmera na altura dos olhos, porém o quadro inteiro rotacionado em diagonal (10-15°) — horizonte e linhas verticais visivelmente tortos. É a ROTAÇÃO que quebra a neutralidade aqui: sem ela, esta altura seria a frontal neutra proibida pelo mood, então a inclinação do quadro é obrigatória nesta variação",
  "ANGULAÇÃO LATERAL MARCADA: câmera deslocada para um dos lados do sujeito, três-quartos acentuado que nunca se alinha de frente — a assimetria do ponto de vista é o que afasta o enquadramento do neutro",
];

// O mood declara "distorção de perspectiva visível" e a assinatura fixava
// 28-35mm. A faixa abre até 50mm — que a 5ª câmera antiga já usava, ou seja, tem
// precedente dentro do próprio mood — e PARA AÍ de propósito: 85mm comprime os
// planos e elimina a distorção de perspectiva, que é gramática declarada do
// DESVIO ("Instabilidade + Distorção... perspectiva alteradas"), não execução.
// Ampliar até a teleobjetiva seria decidir contra o mood — o tipo de extrapolação
// revertida em feedback-escopo-camera-nao-gramatica-do-mood.
// O campo `camera` e a `assinatura` de VISUAL_DIRECTIONS["OP-05"] passaram a
// declarar a faixa 28-50mm no mesmo movimento: é a QUARTA vez que a assinatura
// precisa acompanhar o eixo de ótica.
export const EIXO_OTICA_DESVIO: string[] = [
  "lente 28mm, angular que exagera a perspectiva e faz as linhas do ambiente convergirem de forma incomum",
  "lente 35mm, angular suave com distorção de perspectiva perceptível sem caricatura",
  "lente 50mm, perspectiva neutra na ótica — aqui a distorção vem do ÂNGULO da câmera e da composição, não da lente",
];

// "sujeito principal sempre nítido e legível" é o que o mood declara em
// `composicao` — as duas opções preservam isso, e a ruptura nunca se dissolve.
export const EIXO_PROFUNDIDADE_DESVIO: string[] = [
  "profundidade ampla: ambiente inteiro legível e nítido, a ruptura lida dentro do contexto que a torna estranha",
  "profundidade rasa: sujeito e elemento da ruptura nítidos, fundo dissolvido — o estranhamento isolado, sem detalhe competindo",
];

// As três direções que o próprio mood nomeia em `luz`: "luz teatral em direção
// inesperada (de baixo, atrás, lateral extrema)". Nenhuma é invenção nova — o
// campo `luz` passou a delegar a fonte exata a este eixo, como já faziam CLAREZA
// e SILÊNCIO, para os dois textos não se contradizerem no mesmo prompt.
export const EIXO_LUZ_DESVIO: string[] = [
  "luz teatral vinda de baixo, iluminando o sujeito em direção invertida à esperada, sombras subindo pelas superfícies",
  "contraluz teatral vinda de trás do sujeito, recortando o contorno e deixando a frente em penumbra legível",
  "luz lateral extrema e rasante, quase paralela à parede, alongando sombras e revelando texturas que a luz frontal esconderia",
];

// ── Composição dos eixos ────────────────────────────────────────────────────

interface EixosDoMood {
  distancia: string[];
  altura: string[];
  otica: string[];
  profundidade: string[];
  luz: string[];
  /** Corpo de câmera + textura de acabamento. Opcional: só o CLAREZA tem, e
   *  quem não tem simplesmente não recebe o trecho na linha de câmera — ver
   *  EIXO_CORPO_CLAREZA para por que a camada não foi estendida aos outros. */
  corpo?: string[];
  /** Se a distância mais afastada deve sair da faixa quando há avatar
   *  selecionado no Kit Imagem — ver distanciaPreservaOAvatar. */
  filtraDistanciaComAvatar: boolean;
  /**
   * Se a fila deste mood usa o carry entre voltas (pickEixoNaFila) ou o rodízio
   * simples de sempre (pickRotating).
   *
   * Hoje só o CLAREZA. O carry exige pools de tamanhos variados para render:
   * IMPACTO tem quatro eixos de 3 opções e um de 2, e nessa configuração ele
   * fazia a câmera INTEIRA repetir entre a 2ª e a 4ª peça — pior que o defeito
   * que veio corrigir. SILÊNCIO (4·4·3·2·3) e DESVIO (4·5·3·2·3) sofrem menos
   * do defeito original justamente porque seus tamanhos já são variados.
   *
   * Para ligar o carry nos outros: crescer os pools de 3 primeiro, medir a
   * repetição real com a telemetria (core/variacaoTelemetria.ts), e só então
   * virar a chave. Não ligar antes — o teste que provou isso está em
   * __tests__/cameraFilaCarry.test.ts.
   */
  filaComCarry?: boolean;
}

const EIXOS_POR_MOOD: Partial<Record<MoodCode, EixosDoMood>> = {
  "OP-01": {
    distancia: EIXO_DISTANCIA_CLAREZA,
    altura: EIXO_ALTURA_CLAREZA,
    otica: EIXO_OTICA_CLAREZA,
    profundidade: EIXO_PROFUNDIDADE_CLAREZA,
    luz: EIXO_LUZ_CLAREZA,
    corpo: EIXO_CORPO_CLAREZA,
    filtraDistanciaComAvatar: true,
    filaComCarry: true,
  },
  "OP-02": {
    distancia: EIXO_DISTANCIA_IMPACTO,
    altura: EIXO_ALTURA_IMPACTO,
    otica: EIXO_OTICA_IMPACTO,
    profundidade: EIXO_PROFUNDIDADE_IMPACTO,
    luz: EIXO_LUZ_IMPACTO,
    filtraDistanciaComAvatar: true,
  },
  // DESVIO entra COM filtro de avatar, ao contrário do SILÊNCIO: aqui a pessoa
  // é personagem inteiro e presente (as rupturas falam em "o personagem percebe,
  // observa, toca, segura"), não fragmento parcial — então reduzir o avatar
  // contratado a figura pequena é o mesmo problema do CLAREZA e do IMPACTO, não
  // uma exigência do mood.
  "OP-05": {
    distancia: EIXO_DISTANCIA_DESVIO,
    altura: EIXO_ALTURA_DESVIO,
    otica: EIXO_OTICA_DESVIO,
    profundidade: EIXO_PROFUNDIDADE_DESVIO,
    luz: EIXO_LUZ_DESVIO,
    filtraDistanciaComAvatar: true,
  },
  // SILÊNCIO fica de fora do filtro de avatar de propósito: a gramática do mood
  // já determina que a pessoa é fragmento parcial e pequeno no quadro. Filtrar
  // a distância aqui seria decidir contra o mood, não a favor do avatar.
  "OP-06": {
    distancia: EIXO_DISTANCIA_SILENCIO,
    altura: EIXO_ALTURA_SILENCIO,
    otica: EIXO_OTICA_SILENCIO,
    profundidade: EIXO_PROFUNDIDADE_SILENCIO,
    luz: EIXO_LUZ_SILENCIO,
    filtraDistanciaComAvatar: false,
  },
};

// Marcador de texto, não índice: os pools crescem e reordenam com o tempo, e
// filtrar por posição é a armadilha que já causou um P0 em 11/08/2026 (índice
// fixo apontando para fora do array). Mesmo motivo de variationHasFaceNotDominant.
const DISTANCIA_REDUZ_O_ROSTO = /^PLANO (GERAL|ABERTO)\b/;

/**
 * Avatar selecionado no Kit Imagem é um CONTRATO: o usuário escolheu um rosto
 * para aparecer na peça (achado real 06/08/2026 — a pessoa sumiu no "gerar
 * novamente"). A distância mais afastada não retira o rosto da cena, mas reduz
 * a pessoa a uma figura pequena, que é como o usuário lê "o avatar sumiu". Com
 * avatar marcado, ela sai da faixa; as demais continuam.
 */
export function distanciaPreservaOAvatar(distancia: string): boolean {
  return !DISTANCIA_REDUZ_O_ROSTO.test(distancia);
}

/** Moods cuja câmera já foi decupada em eixos. Os demais (INSTANTE e FRAGMENTO)
 *  seguem com os pools de frase pronta no léxico — o INSTANTE por decisão do
 *  Aristóteles (aprovado em peça real, não se mexe no que funciona) e o
 *  FRAGMENTO porque roda por bloco dentro da mesma peça, caso diferente. */
export function moodTemEixosDeCamera(mood?: MoodCode): boolean {
  return !!mood && !!EIXOS_POR_MOOD[mood];
}

// Passos diferentes por eixo para que a ORDEM de cada fila não ande colada à
// dos outros. A co-primalidade com o tamanho de cada pool é corrigida dentro de
// pickRotating (coprimeStep) — não se confia no chamador, porque os pools
// crescem com o tempo e um passo que deixa de ser co-primo passa a visitar meio
// pool sem erro e sem sintoma.
const PASSO_DISTANCIA = 1;
const PASSO_ALTURA = 2;
const PASSO_OTICA = 3;
const PASSO_PROFUNDIDADE = 1;
// Luz e corpo têm 5 opções no CLAREZA justamente para poderem usar passos de
// CLASSES diferentes (2 e 3) e não andarem colados. Pool de 3 ou 4 não permite
// isso: sobra uma classe só depois da regra do passo ≠ n-1.
const PASSO_LUZ = 2;
const PASSO_CORPO = 3;

/**
 * Avança um eixo na fila do usuário — com CARRY entre voltas.
 *
 * O rodízio simples (`pickRotating`: índice = seed·passo % n) tem um limite que
 * nenhum passo corrige: seu ciclo é o tamanho do pool. Um eixo de 3 opções
 * volta ao início a cada 3 peças, sempre. Quando VÁRIOS eixos têm o mesmo
 * tamanho de pool, todos dão a volta no mesmo momento — e é isso que o olho lê
 * como "de novo a mesma foto".
 *
 * Achado real (13/08/2026, na primeira amostra da telemetria de variação): no
 * CLAREZA, quatro dos cinco eixos têm 3 opções — altura, ótica, luz e, quando há
 * avatar marcado, também a distância (o filtro a reduz de 4 para 3). As peças
 * nas posições 0 e 3 da fila saíam com plano, altura, lente e luz IDÊNTICOS;
 * só a profundidade, de pool 2, diferia. Isso não era do avatar: sem ele, três
 * dos cinco ainda coincidiam.
 *
 * O termo `floor(seed / n)` é o carry: conta quantas voltas completas a fila já
 * deu naquele pool e desloca a entrada da volta seguinte. O ciclo de cada eixo
 * passa de n para n² — de 3 para 9 peças no CLAREZA — e a ordem de cada volta
 * muda, em vez de reexibir a mesma sequência.
 *
 * O que o carry NÃO resolve, e é honesto registrar: dois eixos de mesmo tamanho
 * e mesmo passo efetivo continuam correlacionados entre si (andam juntos, com
 * valores diferentes porque os pools são outros). Com pool de 3 opções isso é
 * inevitável em qualquer fórmula linear — só existem duas classes de passo
 * co-primo com 3. Por isso os pools pequenos do CLAREZA também cresceram nesta
 * mesma mudança: correlação entre eixos distintos é bem menos visível que um
 * eixo repetindo o próprio valor, mas o remédio de fundo é pool maior.
 *
 * Dentro de cada volta a fila continua visitando TODAS as opções antes de
 * repetir qualquer uma — o passo segue passando por `coprimeStep`, e o carry é
 * constante ao longo da volta.
 *
 * DUAS REGRAS QUE O CÓDIGO PRECISA RESPEITAR, cada uma custou teste vermelho:
 *
 * 1. O passo tem de ser co-primo com n E diferente de n-1. Na virada de uma
 *    volta o carry soma 1 ao deslocamento; num eixo de passo n-1 esse +1
 *    completa a volta e devolve o índice da peça ANTERIOR. Sem essa regra, o
 *    CLAREZA repetia 4 dos 6 eixos entre a 4ª e a 5ª peça — vizinhas.
 * 2. Pool de 2 fica SEM carry. Ali o único passo co-primo é justamente n-1,
 *    então as duas exigências são incompatíveis; alternar (e repetir a cada 2,
 *    que é o teto de 2 opções) vale mais do que adiar a repetição ao custo de
 *    duas vizinhas iguais.
 *
 * O PREÇO, aceito de olhos abertos: como a regra 1 costuma deixar um único
 * passo válido nos pools pequenos, eixos de mesmo tamanho andam acoplados —
 * valores diferentes, porque os pools são outros, mas voltando ao início
 * juntos. Isso reduz o número de combinações distintas, e é bem menos visível
 * que um eixo repetindo o próprio valor. O remédio de fundo é pool maior, não
 * aritmética: com quatro eixos de 3 opções não existe fórmula linear que
 * garanta ao mesmo tempo vizinhas distintas, sem repetição por volta e eixos
 * desacoplados — só há duas classes de passo co-primo com 3.
 *
 * É exatamente por isso que a fila nova vale HOJE só para o CLAREZA, cujos
 * pools cresceram junto (ver `filaComCarry` em EIXOS_POR_MOOD).
 */
function passoDaFila(n: number, desejado: number): number {
  const base = coprimeStep(n, desejado);
  if (base % n !== n - 1) return base;
  for (let s = base + 1; s < base + 1 + n; s++) {
    if (coprimeStep(n, s) === s && s % n !== n - 1) return s;
  }
  return 1;
}

export function pickEixoNaFila<T>(pool: T[], seed: number, passo: number): T {
  const n = pool.length;
  if (n <= 1) return pool[0];
  const s = Math.trunc(seed);
  // Regra 2: pool de 2 alterna, sem carry.
  const voltas = n === 2 ? 0 : Math.floor(s / n);
  const i = (((s * passoDaFila(n, passo) + voltas) % n) + n) % n;
  return pool[i];
}

/**
 * Monta a linha de câmera do mood compondo os eixos.
 *
 * Sem `seed`, cada eixo é sorteado (comportamento dos caminhos ainda não
 * fiados na fila). Com `seed`, cada eixo ANDA na fila do usuário — e como todos
 * andam a cada posição, duas gerações consecutivas nunca compartilham a mesma
 * câmera em nenhum eixo.
 *
 * Espaço de combinações: CLAREZA 4·3·4·2·4·4 = 1536 (1152 com avatar marcado,
 * que tira a distância mais afastada) — os pools de ótica e luz cresceram e o
 * eixo de corpo/textura entrou em 13/08/2026; IMPACTO 4·3·3·2·3 = 216 (162 com
 * avatar); SILÊNCIO 4·4·3·2·3 = 288; DESVIO 4·5·3·2·3 = 360 (270 com avatar).
 *
 * O CICLO da fila é o que o usuário percorre antes de reencontrar a mesma
 * combinação exata — o número honesto, não o tamanho do espaço. Cada eixo
 * agora fecha em n² posições, não n (ver pickEixoNaFila), então o ciclo é o mmc
 * dos QUADRADOS dos tamanhos: no CLAREZA com avatar, mmc(9,9,16,4,16,16) = 144;
 * antes desta mudança eram 12 posições, com quatro eixos repetindo já na 4ª.
 *
 * Devolve "" para mood sem eixos — quem chama mantém o pool antigo.
 */
export function buildCameraLine(
  mood: MoodCode | undefined,
  opts: { seed?: number; hasAvatarRef?: boolean },
): string {
  const eixos = mood ? EIXOS_POR_MOOD[mood] : undefined;
  if (!eixos) return "";
  const { seed, hasAvatarRef } = opts;
  const distancias =
    hasAvatarRef && eixos.filtraDistanciaComAvatar
      ? eixos.distancia.filter(distanciaPreservaOAvatar)
      : eixos.distancia;
  const pick = <T>(pool: T[], passo: number): T => {
    if (seed === undefined) return pickRandom(pool);
    return eixos.filaComCarry ? pickEixoNaFila(pool, seed, passo) : pickRotating(pool, seed, passo);
  };
  return [
    pick(distancias, PASSO_DISTANCIA),
    pick(eixos.altura, PASSO_ALTURA),
    pick(eixos.otica, PASSO_OTICA),
    pick(eixos.profundidade, PASSO_PROFUNDIDADE),
    pick(eixos.luz, PASSO_LUZ),
    // Corpo/textura entra por último: é o acabamento sobre a cena já enquadrada
    // e iluminada pelos eixos anteriores. Mood sem a camada não recebe o
    // trecho, em vez de receber um placeholder vazio.
    ...(eixos.corpo?.length ? [pick(eixos.corpo, PASSO_CORPO)] : []),
  ].join(" · ");
}

// ── Assimetria de repertório entre moods ────────────────────────────────────
// Princípio adotado em 14/08/2026, a partir de um achado em peça real: uma peça
// de SILÊNCIO saiu indistinguível de uma de CLAREZA. A causa não era o sorteio —
// era GEOMETRIA DE CONJUNTO. Os dois moods compartilhavam 3 de 4 alturas, 2 de 3
// lentes, 2 de 3 luzes e as duas profundidades. Enquanto existe interseção, ela
// vai ser sorteada; nenhuma redação, fila ou passo conserta isso.
//
// A REGRA, que vale para qualquer pool novo daqui em diante: cada mood precisa
// de PELO MENOS UM eixo em que nenhum valor é compartilhável com nenhum outro
// mood. Não é preciso que todos os eixos sejam exclusivos — a lente 50mm sozinha
// não carrega mood nenhum. É preciso que exista um eixo onde a identidade seja
// consequência do CONJUNTO, e não esperança do sorteio.
//
// Por que isso é diferente de "faixas diferentes dentro dos mesmos eixos":
// faixa só preserva identidade quando as faixas NÃO SE TOCAM. A altura do
// IMPACTO (toda ascendente) nunca encosta na do CLAREZA, e por isso ninguém
// confunde os dois. CLAREZA×SILÊNCIO era o único par construído como "mesmos
// valores, frases diferentes" — e foi o único que colapsou.
//
// CONSEQUÊNCIA ACEITA: pool exclusivo costuma ser pool menor, e pool menor
// repete mais rápido. Isso é aceitável quando o que repete é a ASSINATURA do
// mood e não a peça — e a variedade migra para os eixos que o mood tem de sobra
// (objeto do ofício, superfície, paleta). O contrário — crescer o pool na
// direção do vizinho — compra variedade pagando com identidade, que foi
// exatamente o erro do 70mm acrescentado ao CLAREZA em 13/08/2026.
//
// Consumido por __tests__/cameraAxesExclusividade.test.ts, que trava a regra
// para o crescimento de pool de amanhã não recriar o problema de hoje.
export const NAO_COMPARTILHAVEL_COM_CLAREZA: Record<string, string[]> = {
  altura: EIXO_ALTURA_SILENCIO,
  otica: EIXO_OTICA_SILENCIO,
  luz: EIXO_LUZ_SILENCIO,
  profundidade: EIXO_PROFUNDIDADE_SILENCIO,
};

/** Os eixos do CLAREZA na mesma ordem, para o teste de exclusividade comparar
 *  par a par. Ver NAO_COMPARTILHAVEL_COM_CLAREZA. */
export const EIXOS_CLAREZA_PARA_COMPARACAO: Record<string, string[]> = {
  altura: EIXO_ALTURA_CLAREZA,
  otica: EIXO_OTICA_CLAREZA,
  luz: EIXO_LUZ_CLAREZA,
  profundidade: EIXO_PROFUNDIDADE_CLAREZA,
};
