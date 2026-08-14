// Hierarquia produto×personagem×cenário por segmento — extraído de
// visualDirection.ts (Fase 8). Fonte única para MOP e PU.
//
// Quando o Kit Imagem combina PRODUTO com CENÁRIO e/ou AVATAR, sem uma regra explícita
// de protagonismo o modelo de imagem tende a deixar o produto referenciado virar
// coadjuvante: pequeno, ao fundo, cortado ou encoberto, enquanto outro elemento (móvel
// já presente no cenário, ou o avatar) vira o "herói" da composição. Este bloco força o
// produto a ser sempre o protagonista visual, rebaixa elementos concorrentes do cenário
// a pano de fundo, e instrui o avatar a apresentar o produto em vez de competir com ele.

import { MoodCode, Segment } from "../types";

const PRODUTO_PROTAGONISMO_SINGULAR =
  "REGRA DE PROTAGONISMO DO PRODUTO — INEGOCIÁVEL: o PRODUTO referenciado é o HERÓI ABSOLUTO desta composição. " +
  "DEVE aparecer em primeiro plano, GRANDE — ocupando no mínimo 30-40% da área visível do quadro —, em foco nítido, bem iluminado, e ser o PRIMEIRO elemento que o olho identifica. " +
  "Tudo o mais na cena (ambiente, móveis, objetos, pessoas) é coadjuvante. " +
  'Se a composição "realista" esconderia o produto (ex.: armário encostado na parede ao fundo, cadeira embaixo de alguém sentado, prateleira atrás de uma mesa), ADAPTE A CÂMERA — não o papel do produto: aproxime o enquadramento, escolha um ângulo que revele sua forma por inteiro, use profundidade de campo que mantenha o produto nítido enquanto o resto desfoca. ' +
  "PROIBIDO um enquadramento em que o produto fique pequeno, distante, cortado ou parcialmente encoberto. " +
  "Teste: ao olhar a imagem por 1 segundo, o produto deve ser a primeira coisa que se vê.";

const PRODUTO_PROTAGONISMO_PLURAL =
  "REGRA DE PROTAGONISMO DOS PRODUTOS — INEGOCIÁVEL: os PRODUTOS referenciados são os HERÓIS ABSOLUTOS desta composição. " +
  "DEVEM aparecer em primeiro plano, GRANDES — ocupando juntos no mínimo 30-40% da área visível do quadro —, em foco nítido, bem iluminados, e ser os PRIMEIROS elementos que o olho identifica. " +
  "Tudo o mais na cena (ambiente, móveis, objetos, pessoas) é coadjuvante. " +
  'Se a composição "realista" esconderia algum dos produtos (ex.: armário encostado na parede ao fundo, cadeira embaixo de alguém sentado, prateleira atrás de uma mesa), ADAPTE A CÂMERA — não o papel dos produtos: aproxime o enquadramento, escolha um ângulo que revele a forma de cada um por inteiro, use profundidade de campo que mantenha os produtos nítidos enquanto o resto desfoca. ' +
  "PROIBIDO um enquadramento em que qualquer um dos produtos fique pequeno, distante, cortado ou parcialmente encoberto. " +
  "⚠ ESCALA RELATIVA ENTRE OS PRODUTOS — REGRA ABSOLUTA: os produtos referenciados têm o mesmo porte físico real entre si (ex.: duas cadeiras de escritório, dois eletrodomésticos da mesma categoria) — preserve essa proporção de tamanho no enquadramento. PROIBIDO colocar um produto em primeiro plano gigante (parecendo maior que uma pessoa ou maior que o outro produto em 2x ou mais) enquanto o outro aparece pequeno e distante ao fundo — 'aproximar a câmera' NUNCA significa aumentar um produto à custa do outro. Distribua os produtos lado a lado ou em planos próximos um do outro, ambos em destaque comparável. NEGATIVE: one product oversized compared to the other, mismatched scale between products, one product giant in foreground and the other tiny in background, disproportionate product sizes. " +
  "Teste: ao olhar a imagem por 1 segundo, os produtos devem estar entre as primeiras coisas que se vê.";

const CENARIO_VS_PRODUTO_SINGULAR =
  "CENÁRIO vs PRODUTO — REGRA ANTI-ROUBO DE CENA: o cenário de referência é PANO DE FUNDO e contexto, NUNCA protagonista. " +
  'Outros móveis/objetos que JÁ EXISTEM na foto do cenário e pertencem à mesma categoria do produto (outras cadeiras, outras mesas, outros armários de uma loja de móveis, por exemplo) NÃO PODEM virar o "herói disfarçado" da cena. ' +
  "PROIBIDO qualquer item do cenário aparecer em primeiro plano, maior, mais central ou mais nítido que o produto referenciado. " +
  "Esses outros itens ficam VISIVELMENTE secundários — menores, mais ao fundo, desfocados ou cortados nas bordas. " +
  "Existe um único protagonista nítido e dominante nesta imagem: o produto referenciado.";

const CENARIO_VS_PRODUTO_PLURAL =
  "CENÁRIO vs PRODUTOS — REGRA ANTI-ROUBO DE CENA: o cenário de referência é PANO DE FUNDO e contexto, NUNCA protagonista. " +
  'Outros móveis/objetos que JÁ EXISTEM na foto do cenário e pertencem à mesma categoria dos produtos (outras cadeiras, outras mesas, outros armários de uma loja de móveis, por exemplo) NÃO PODEM virar o "herói disfarçado" da cena. ' +
  "PROIBIDO qualquer item do cenário aparecer em primeiro plano, maior, mais central ou mais nítido que os produtos referenciados. " +
  "Esses outros itens ficam VISIVELMENTE secundários — menores, mais ao fundo, desfocados ou cortados nas bordas. " +
  "Os protagonistas nítidos e dominantes nesta imagem são os produtos referenciados.";

const AVATAR_VS_PRODUTO_SINGULAR =
  "AVATAR vs PRODUTO — REGRA DE APRESENTAÇÃO: a pessoa existe na cena PARA APRESENTAR o produto, nunca para competir com ele. " +
  "A pose DEVE mostrar o produto: pessoa ao lado dele, gesticulando para ele, exibindo-o ou usando-o de um ângulo que revele sua forma por inteiro. " +
  "PROIBIDO o corpo da pessoa cobrir a maior parte do produto. PROIBIDO a pessoa dominar o quadro enquanto o produto vira coadjuvante. " +
  "Se o produto é algo que se usa sentado ou apoiado (cadeira, poltrona, mesa), prefira a pessoa AO LADO ou ATRÁS dele, apresentando-o — ou um ângulo de câmera em que o produto apareça inteiro e reconhecível mesmo em uso. " +
  "Na dúvida entre valorizar a pessoa ou o produto, valorize SEMPRE o produto.";

const AVATAR_VS_PRODUTO_PLURAL =
  "AVATAR vs PRODUTOS — REGRA DE APRESENTAÇÃO: a pessoa existe na cena PARA APRESENTAR os produtos, nunca para competir com eles. " +
  "A pose DEVE mostrar os produtos: pessoa próxima a eles, gesticulando para eles, exibindo-os ou usando-os de ângulos que revelem suas formas por inteiro. " +
  "PROIBIDO o corpo da pessoa cobrir a maior parte de qualquer um dos produtos. PROIBIDO a pessoa dominar o quadro enquanto os produtos viram coadjuvantes. " +
  "Se algum produto é algo que se usa sentado ou apoiado (cadeira, poltrona, mesa), prefira a pessoa AO LADO ou ATRÁS dele, apresentando-o — ou um ângulo de câmera em que os produtos apareçam inteiros e reconhecíveis mesmo em uso. " +
  "Na dúvida entre valorizar a pessoa ou os produtos, valorize SEMPRE os produtos.";

// LOOK BOOK (produto vestido pela modelo) — a hierarquia produto×personagem
// deste arquivo pressupõe que os dois são objetos distintos disputando o quadro:
// "PROIBIDO o corpo da pessoa cobrir a maior parte do produto", "a pessoa existe
// PARA APRESENTAR o produto". Vestida, a peça está literalmente sobre o corpo —
// as duas frases passam a se contradizer e o modelo tende a resolver duplicando
// a peça (uma vestida, outra exposta ao lado) ou empurrando a pessoa para fora
// do quadro. Estes dois blocos substituem a dupla protagonismo/apresentação
// nesse modo. Ver core/lookBook.ts.
const PRODUTO_PROTAGONISMO_VESTIDO =
  "REGRA DE PROTAGONISMO DO PRODUTO — MODO LOOK BOOK: o PRODUTO referenciado é o herói desta composição, e nesta peça ele está VESTIDO no corpo da modelo (ver bloco PRODUTO VESTIDO PELA MODELO). " +
  "O protagonismo do produto NÃO se expressa aqui por ele ser um objeto grande e separado no primeiro plano, e sim por ser o elemento mais nítido, mais bem iluminado e mais legível da imagem — a primeira coisa que o olho identifica ao olhar a peça por 1 segundo é a roupa que a pessoa veste, não o rosto dela, não o ambiente. " +
  "A peça vestida deve aparecer INTEIRA e sem obstrução, no enquadramento definido no bloco de variação. " +
  "PROIBIDO um enquadramento em que a peça fique cortada, encoberta por braços, cabelo, bolsa ou móvel, ou pequena demais para que cor, estampa e corte sejam lidos. " +
  "PROIBIDO também duplicar a peça: ela aparece UMA vez, vestida — nunca vestida E exposta em cabide/manequim na mesma imagem.";

const AVATAR_VESTE_PRODUTO =
  "MODELO vs PRODUTO — MODO LOOK BOOK: a pessoa e o produto NÃO competem nesta peça, porque a peça está vestida nela. " +
  "A modelo é o SUPORTE do produto: corpo, postura e movimento existem para mostrar como a peça cai, veste e se comporta. " +
  "Isso SUSPENDE, só nesta geração, qualquer instrução deste prompt que mande a pessoa se posicionar ao lado do produto, gesticular na direção dele, exibi-lo com as mãos ou não cobri-lo com o corpo — não há como apresentar de fora uma roupa que se está usando. " +
  "O rosto continua visível e reconhecível, com expressão coerente com o mood; a atenção principal, porém, é da peça vestida.";

// SERVIÇOS inverte a hierarquia: o produto referenciado (ex.: item usado no
// ofício, material de apoio) NÃO é o que se vende — quem vende é o serviço,
// representado pelo personagem. O produto vira apoio de cena, adaptado ao
// ambiente, sem disputar protagonismo.
const PRODUTO_APOIO_SERVICOS_SINGULAR =
  "PAPEL DO PRODUTO NESTA CENA (SERVIÇOS) — o PRODUTO referenciado é elemento de APOIO, adaptado e integrado ao cenário — NUNCA o protagonista visual. " +
  "Mantenha fidelidade ao produto real (mesma cor, forma, rótulo, acabamento), mas em plano secundário: menor, mais ao fundo ou parcialmente em uso/apoiado de forma natural no ambiente — sem ocupar o centro do quadro. " +
  "PROIBIDO ampliar o produto, aproximar a câmera dele ou tratá-lo como herói da composição. O PERSONAGEM é quem ocupa esse papel.";

const PRODUTO_APOIO_SERVICOS_PLURAL =
  "PAPEL DOS PRODUTOS NESTA CENA (SERVIÇOS) — os PRODUTOS referenciados são elementos de APOIO, adaptados e integrados ao cenário — NUNCA os protagonistas visuais. " +
  "Mantenha fidelidade a cada produto real (mesma cor, forma, rótulo, acabamento), mas em plano secundário: menores, mais ao fundo ou parcialmente em uso/apoiados de forma natural no ambiente — sem ocupar o centro do quadro. " +
  "PROIBIDO ampliar os produtos, aproximar a câmera deles ou tratá-los como heróis da composição. O PERSONAGEM é quem ocupa esse papel.";

// EXCEÇÃO — produto-dispositivo cuja TELA é a própria identidade do produto
// (ex.: tablet mostrando a tela do próprio app do negócio), em SERVIÇOS.
// Achado real 2026-07-08 (pasta AJUSTE_CONFLITO, Oficina de Propaganda): a
// regra padrão de SERVIÇOS acima ("menor, mais ao fundo, PROIBIDO ampliar")
// competia sem reconciliação com a exigência de fidelidade de tela
// (screenContentClause em promptRules.ts — "NITIDEZ e LEGIBILIDADE total"),
// e a IA resolvia o conflito de forma errática: tela em branco, tela virada
// de costas, ou um segundo dispositivo inventado ao fundo. Investigação
// (Opus 4.8 + Fable 5) confirmou que produto pequeno/distante também é
// tecnicamente incompatível com fidelidade de tela — não há pixels
// suficientes pra IA copiar o conteúdo real, então ela inventa uma interface
// genérica. Esta exceção SUBSTITUI (não complementa) o bloco padrão de apoio
// quando o produto é um dispositivo com tela=identidade: ele vai pra
// primeiro plano, grande o bastante pra ser lido — sem virar o protagonista
// NARRATIVO da peça (quem vende continua sendo o serviço/personagem).
const PRODUTO_DISPOSITIVO_TELA_SERVICOS_SINGULAR =
  "EXCEÇÃO DE SERVIÇOS — PRODUTO-DISPOSITIVO COM TELA=IDENTIDADE: o produto referenciado é um dispositivo cuja TELA é a própria identidade do produto (o conteúdo exibido nela É o que está sendo divulgado) — por isso, SÓ NESTA PEÇA, ele NÃO segue a regra geral de produto-apoio de SERVIÇOS. " +
  "O dispositivo fica em PRIMEIRO PLANO, próximo da câmera, grande o suficiente para o conteúdo da tela ser lido com nitidez — apoiado sobre uma mesa/superfície/suporte, como elemento de composição independente. " +
  "Isso NÃO transfere o protagonismo NARRATIVO da peça para o produto: quem representa o serviço continua sendo o PERSONAGEM (ver regra de personagem abaixo) — o dispositivo tem destaque de ESCALA e NITIDEZ, não de papel. " +
  "PROIBIDO: empurrar o dispositivo para o fundo, deixá-lo pequeno ou distante, ou evitar aproximar a câmera dele — isso impediria a tela de ser lida.";

const PERSONAGEM_VS_PRODUTO_DISPOSITIVO_TELA_SERVICOS_SINGULAR =
  "PERSONAGEM vs PRODUTO-DISPOSITIVO (SERVIÇOS, TELA=IDENTIDADE) — o PERSONAGEM continua sendo o protagonista HUMANO da cena (expressão, postura, ação), mas NÃO precisa apresentar, segurar nem usar o dispositivo. " +
  "O dispositivo é um objeto de composição EXPOSTO (ver FÍSICA DA TELA — PRODUTO EXPOSTO), separado do personagem — sobre a mesa, ao lado ou próximo dele, nunca nas mãos. " +
  "O personagem ocupa seu papel normal na cena (olhando para a câmera, gesticulando, interagindo com outra coisa) — ele NÃO precisa olhar para a tela do dispositivo, só se ela estiver mostrada de PERFIL/lado (não de frente para a câmera).";

const PERSONAGEM_VS_PRODUTO_SERVICOS_SINGULAR =
  "PERSONAGEM vs PRODUTO (SERVIÇOS) — o PERSONAGEM é o PROTAGONISTA absoluto da composição; o produto é coadjuvante adaptado à cena. " +
  "A postura, a expressão e a ação do personagem são o centro visual da imagem. O produto aparece de forma natural e secundária (sobre a mesa, ao lado, em uso discreto) — sem que o personagem precise se posicionar para apresentá-lo. " +
  "Na dúvida entre valorizar a pessoa ou o produto, valorize SEMPRE a pessoa.";

const PERSONAGEM_VS_PRODUTO_SERVICOS_PLURAL =
  "PERSONAGEM vs PRODUTOS (SERVIÇOS) — o PERSONAGEM é o PROTAGONISTA absoluto da composição; os produtos são coadjuvantes adaptados à cena. " +
  "A postura, a expressão e a ação do personagem são o centro visual da imagem. Os produtos aparecem de forma natural e secundária (sobre a mesa, ao lado, em uso discreto) — sem que o personagem precise se posicionar para apresentá-los. " +
  "Na dúvida entre valorizar a pessoa ou os produtos, valorize SEMPRE a pessoa.";

// MARCA: nem o produto domina (VAREJO) nem o personagem domina (SERVIÇOS) — os
// dois representam a identidade da marca em peso visual equivalente. Decisão
// de Aristóteles em 21/06/2026 (documento de princípios, Parte 2.2): o
// protagonista de MARCA é a identidade da marca, não um elemento fixo —
// quando produto e personagem aparecem juntos, dividem o protagonismo "meio a
// meio" em vez de um virar coadjuvante do outro.
const PRODUTO_EQUILIBRIO_MARCA_SINGULAR =
  "PAPEL DO PRODUTO NESTA CENA (MARCA) — EQUILÍBRIO, NÃO HIERARQUIA: o PRODUTO referenciado representa a identidade/solução da marca com o MESMO peso visual do personagem — nem o produto domina a cena (como em VAREJO) nem fica reduzido a apoio de fundo (como em SERVIÇOS). " +
  "Mantenha fidelidade ao produto real (mesma cor, forma, rótulo, acabamento) e dê a ele destaque claro e nítido — comparável ao destaque do personagem, nunca menor. " +
  "PROIBIDO o produto ficar pequeno, cortado, ao fundo ou encoberto pelo personagem; PROIBIDO também o produto ocupar a cena de forma que o personagem vire mero coadjuvante.";

const PRODUTO_EQUILIBRIO_MARCA_PLURAL =
  "PAPEL DOS PRODUTOS NESTA CENA (MARCA) — EQUILÍBRIO, NÃO HIERARQUIA: os PRODUTOS referenciados representam a identidade/solução da marca com o MESMO peso visual do personagem — nem os produtos dominam a cena (como em VAREJO) nem ficam reduzidos a apoio de fundo (como em SERVIÇOS). " +
  "Mantenha fidelidade a cada produto real (mesma cor, forma, rótulo, acabamento) e dê a eles destaque claro e nítido — comparável ao destaque do personagem, nunca menor. " +
  "PROIBIDO os produtos ficarem pequenos, cortados, ao fundo ou encobertos pelo personagem; PROIBIDO também os produtos ocuparem a cena de forma que o personagem vire mero coadjuvante.";

const PERSONAGEM_VS_PRODUTO_EQUILIBRIO_MARCA_SINGULAR =
  "PERSONAGEM vs PRODUTO (MARCA) — PESO VISUAL IGUAL, MEIO A MEIO: personagem e produto compartilham o protagonismo desta cena. " +
  "Componha de forma que os dois sejam percebidos ao mesmo tempo e com destaque equivalente — ex.: produto nas mãos ou bem próximo ao personagem, ambos em foco nítido, nenhum dos dois cortado ou em segundo plano. " +
  "PROIBIDO o personagem dominar o quadro reduzindo o produto a detalhe secundário; PROIBIDO o produto dominar o quadro reduzindo o personagem a figurante. Na dúvida, mantenha os dois em igual destaque — não escolha um lado.";

const PERSONAGEM_VS_PRODUTO_EQUILIBRIO_MARCA_PLURAL =
  "PERSONAGEM vs PRODUTOS (MARCA) — PESO VISUAL IGUAL, MEIO A MEIO: personagem e produtos compartilham o protagonismo desta cena. " +
  "Componha de forma que todos sejam percebidos ao mesmo tempo e com destaque equivalente — ex.: produtos nas mãos ou bem próximos ao personagem, todos em foco nítido, nenhum cortado ou em segundo plano. " +
  "PROIBIDO o personagem dominar o quadro reduzindo os produtos a detalhe secundário; PROIBIDO os produtos dominarem o quadro reduzindo o personagem a figurante. Na dúvida, mantenha todos em igual destaque — não escolha um lado.";

// MARCA PESSOAL: o dono/profissional É a marca (artista, terapeuta, coach,
// influenciador) — ver documento de princípios, Parte 2.1. Aqui a hierarquia
// equilíbrio 50/50 não se aplica: o produto (quando existir, ex.: um livro,
// um curso, um material assinado) é representação secundária da pessoa, não
// um elemento de peso igual — o mesmo padrão de protagonismo de SERVIÇOS,
// mas com redação própria de MARCA pessoal.
const PRODUTO_APOIO_MARCA_PESSOAL_SINGULAR =
  "PAPEL DO PRODUTO NESTA CENA (MARCA PESSOAL) — o PRODUTO referenciado é elemento de APOIO, adaptado e integrado à cena — NUNCA o protagonista visual. Quem representa a marca aqui é a PESSOA. " +
  "Mantenha fidelidade ao produto real (mesma cor, forma, rótulo, acabamento), mas em plano secundário: menor, mais ao fundo ou parcialmente em uso/apoiado de forma natural — sem ocupar o centro do quadro. " +
  "PROIBIDO ampliar o produto, aproximar a câmera dele ou tratá-lo como herói da composição. O PERSONAGEM é quem ocupa esse papel.";

const PRODUTO_APOIO_MARCA_PESSOAL_PLURAL =
  "PAPEL DOS PRODUTOS NESTA CENA (MARCA PESSOAL) — os PRODUTOS referenciados são elementos de APOIO, adaptados e integrados à cena — NUNCA os protagonistas visuais. Quem representa a marca aqui é a PESSOA. " +
  "Mantenha fidelidade a cada produto real (mesma cor, forma, rótulo, acabamento), mas em plano secundário: menores, mais ao fundo ou parcialmente em uso/apoiados de forma natural — sem ocupar o centro do quadro. " +
  "PROIBIDO ampliar os produtos, aproximar a câmera deles ou tratá-los como heróis da composição. O PERSONAGEM é quem ocupa esse papel.";

const PERSONAGEM_PROTAGONISTA_MARCA_PESSOAL_SINGULAR =
  "PERSONAGEM vs PRODUTO (MARCA PESSOAL) — o PERSONAGEM é o PROTAGONISTA absoluto da composição: nesta marca, a pessoa É a marca, não um elemento que disputa espaço com o produto. " +
  "A postura, a expressão e a ação do personagem são o centro visual da imagem. O produto aparece de forma natural e secundária (nas mãos, sobre a mesa, ao lado, em uso discreto) — sem que o personagem precise se posicionar para apresentá-lo. " +
  "Na dúvida entre valorizar a pessoa ou o produto, valorize SEMPRE a pessoa.";

const PERSONAGEM_PROTAGONISTA_MARCA_PESSOAL_PLURAL =
  "PERSONAGEM vs PRODUTOS (MARCA PESSOAL) — o PERSONAGEM é o PROTAGONISTA absoluto da composição: nesta marca, a pessoa É a marca, não um elemento que disputa espaço com os produtos. " +
  "A postura, a expressão e a ação do personagem são o centro visual da imagem. Os produtos aparecem de forma natural e secundária (nas mãos, sobre a mesa, ao lado, em uso discreto) — sem que o personagem precise se posicionar para apresentá-los. " +
  "Na dúvida entre valorizar a pessoa ou os produtos, valorize SEMPRE a pessoa.";

// PEÇA SEM PERSONAGEM (PU) — em SERVIÇOS e MARCA as regras acima apontam o
// protagonismo para o PERSONAGEM ("o PERSONAGEM é quem ocupa esse papel",
// "peso visual igual entre personagem e produto"). Sem ninguém em cena, essas
// instruções apontam para um elemento inexistente e o modelo resolve o vácuo
// inventando uma pessoa. Decisão de 26/07/2026: o sujeito passa a ser o
// produto marcado (aqui), com o ambiente/objeto do ofício cobrindo os casos
// sem produto (ver buildSemPersonagemBlock em core/semPersonagem.ts).
// VAREJO não precisa deste ramo: sua regra já é produto-herói e não depende
// de personagem.
const PRODUTO_SUJEITO_SEM_PERSONAGEM_SINGULAR =
  "SUJEITO DA COMPOSIÇÃO — PRODUTO, SEM PERSONAGEM: esta peça não tem pessoas (ver regra de precedência máxima no início do prompt); o PRODUTO referenciado é o sujeito visual da cena. " +
  "Ele aparece nítido, bem iluminado e imediatamente legível como aquilo que a peça mostra — em primeiro plano ou plano médio, integrado ao ambiente, nunca pequeno, cortado, encoberto ou perdido ao fundo. " +
  "O restante da cena (ambiente, superfícies, objetos de apoio) existe para dar contexto, escala e verdade ao produto. " +
  "Isto NÃO transforma a peça em anúncio de catálogo nem em foto de e-commerce: a composição continua editorial, com direção de arte, respiro, atmosfera e a gramática visual definida acima. " +
  "Fidelidade obrigatória ao produto real: mesma cor, forma, rótulo, embalagem e acabamento da referência.";

const PRODUTO_SUJEITO_SEM_PERSONAGEM_PLURAL =
  "SUJEITO DA COMPOSIÇÃO — PRODUTOS, SEM PERSONAGEM: esta peça não tem pessoas (ver regra de precedência máxima no início do prompt); os PRODUTOS referenciados são o sujeito visual da cena. " +
  "Aparecem nítidos, bem iluminados e imediatamente legíveis como aquilo que a peça mostra — em primeiro plano ou plano médio, integrados ao ambiente, nenhum deles pequeno, cortado, encoberto ou perdido ao fundo. " +
  "O restante da cena (ambiente, superfícies, objetos de apoio) existe para dar contexto, escala e verdade aos produtos. " +
  "Isto NÃO transforma a peça em anúncio de catálogo nem em foto de e-commerce: a composição continua editorial, com direção de arte, respiro, atmosfera e a gramática visual definida acima. " +
  "Fidelidade obrigatória a cada produto real: mesma cor, forma, rótulo, embalagem e acabamento da referência.";

// Marca textual presente nas variações de personagem que retiram o rosto do
// centro da composição (CLAREZA "DETALHE CONTEXTUAL", IMPACTO "SUJEITO SEM
// PERSONAGEM DOMINANTE" — ver CLAREZA_CHARACTER_VARIATIONS/IMPACTO_CHARACTER_VARIATIONS
// no léxico). Usada para reconciliar a REGRA DE PROTAGONISMO DO PRODUTO com a
// ausência de rosto dominante: sem essa reconciliação, as duas instruções
// competem no mesmo prompt e o modelo de imagem tende a resolver o conflito
// inventando um retrato de rosto em primeiro plano com luz dramática — visto
// em geração real (Loja Rocha, PU, CLAREZA, DETALHE CONTEXTUAL + produto VAREJO).
const FACE_NOT_DOMINANT_MARKERS = [
  "rosto não é dominante",
  "presença humana secundária ou parcial",
];

export function variationHasFaceNotDominant(variationBlock: string): boolean {
  return FACE_NOT_DOMINANT_MARKERS.some((marker) => variationBlock.includes(marker));
}

// SILÊNCIO exige objeto/fragmento humano ocupando NO MÁXIMO 30% da composição
// (ver MOOD_RULES["OP-06"] no léxico, "ESPAÇO NEGATIVO OBRIGATÓRIO") — numericamente quase
// oposto à regra de protagonismo do produto, que exige NO MÍNIMO 30-40% e
// "herói absoluto, primeiro elemento identificado". Sem reconciliação, as duas
// instruções competem no mesmo prompt sempre que SILÊNCIO é combinado com
// produto referenciado (achado de auditoria, não confirmado em produção ainda).
const PRODUTO_RECONCILIACAO_SILENCIO_HERO =
  "RECONCILIAÇÃO COM O MOOD SILÊNCIO: o mood SILÊNCIO exige que o objeto ocupe NO MÁXIMO 30% da composição, com vasto espaço negativo ao redor — isso SUBSTITUI, PARA ESTA PEÇA, a exigência de tamanho mínimo (30-40%) da regra acima. O produto continua sendo o ÚNICO elemento da composição além do fundo — nada mais compete com ele visualmente —, mas o protagonismo se expressa pela centralidade, nitidez e isolamento dentro do vasto espaço vazio, NÃO pelo tamanho grande. Mantenha as demais regras (foco nítido, fidelidade ao produto real, sem competir com outros elementos) — só a escala muda.";

const PRODUTO_RECONCILIACAO_SILENCIO_EQUILIBRIO =
  "RECONCILIAÇÃO COM O MOOD SILÊNCIO: o mood SILÊNCIO exige vasto espaço negativo e objeto/fragmento humano ocupando NO MÁXIMO 30% da composição — isso SUBSTITUI, PARA ESTA PEÇA, a proibição de o produto ficar pequeno da regra acima. O equilíbrio de peso visual entre produto e personagem permanece (nenhum dos dois domina o outro), mas ambos pequenos e isolados dentro do espaço vazio — não grandes ou centrais.";

// SERVIÇOS e MARCA PESSOAL nunca recebiam reconciliação de mood (só VAREJO e
// MARCA institucional tinham) — achado real 27/07/2026 na PU do Ari: SERVIÇOS +
// avatar + SILÊNCIO saiu com ZERO linha de reconciliação no prompt. Aqui o
// produto é apoio, então o conflito não é de tamanho mínimo, é de ocupação do
// vazio que o mood exige.
const PRODUTO_RECONCILIACAO_SILENCIO_APOIO =
  "RECONCILIAÇÃO COM O MOOD SILÊNCIO: o mood exige vasto espaço negativo, com os elementos da cena somados ocupando NO MÁXIMO 30% da composição. O produto continua em papel de apoio conforme a regra acima — mas apoio aqui significa PEQUENO, ISOLADO e silencioso dentro do vazio, nunca um segundo foco competindo nem um elemento que preencha o espaço que o mood exige vazio.";

// Variante para produto-dispositivo com tela = identidade (usuário marcou "tela
// visível"): ali a regra acima NÃO é "produto em apoio", é o oposto — dispositivo
// em primeiro plano, exposto. Dizer "continua em apoio" contradiria a regra
// imediatamente anterior no mesmo prompt (achado real 27/07/2026, na peça de
// teste do Ari logo após o primeiro deploy desta reconciliação).
const PRODUTO_RECONCILIACAO_SILENCIO_TELA =
  "RECONCILIAÇÃO COM O MOOD SILÊNCIO: o mood exige vasto espaço negativo, com os elementos da cena somados ocupando NO MÁXIMO 30% da composição. O dispositivo CONTINUA em primeiro plano, exposto e com a tela nítida e legível conforme a regra acima — o que muda é a ESCALA e o entorno: ele aparece isolado e silencioso dentro do vazio, próximo o suficiente para a tela ser lida, sem preencher o quadro nem ocupar o espaço que o mood exige vazio.";

// Conflito PERSONAGEM × MOOD — não existia nenhuma reconciliação para pessoa,
// só para produto (achado real 27/07/2026). A gramática do SILÊNCIO diz "se
// aparecer pessoa: fragmento parcial APENAS — NUNCA rosto inteiro posado",
// enquanto o bloco do AVATAR (que tem PRIORIDADE MÁXIMA no prompt) manda usar
// a pessoa como personagem com semelhança de rosto, e o segmento SERVIÇOS
// afirma que o personagem é "protagonista absoluto". Resultado: retrato em
// plano médio, luz baixa, sujeito dominando — o oposto do mood.
// Decisão de produto do Ari (27/07/2026): RETRATO EM CHAVE DE SILÊNCIO — o
// rosto continua aparecendo, mas obedece luz, paleta, escala e espaço do mood.
// Proibição sozinha não vence obrigação positiva: por isso o bloco suspende
// nominalmente a exigência de fragmento e redefine COMO o protagonismo se
// expressa, em vez de só proibir o retrato.
const PERSONAGEM_RECONCILIACAO_SILENCIO =
  "RECONCILIAÇÃO COM O MOOD SILÊNCIO — ESTA PEÇA É UM RETRATO EM CHAVE DE SILÊNCIO: o rosto do avatar CONTINUA visível e reconhecível (a exigência de semelhança facial permanece integralmente válida); fica SUSPENSA, apenas para esta peça, a exigência do mood de que a pessoa apareça somente como fragmento parcial (mão, nuca, silhueta). Em troca, a pessoa OBEDECE o resto da gramática do mood, sem exceção: (a) aparece de CORPO INTEIRO ou de três-quartos de corpo, PEQUENA dentro do quadro, ocupando no máximo um terço lateral da composição — o enquadramento é aberto, com a figura inteira cabendo dentro dele e muito espaço sobrando em volta; (b) fica DESLOCADA do centro, com vasto espaço negativo respirando ao redor; (c) é iluminada em LUZ ALTA-CHAVE suave e difusa, sombras quase ausentes — PROIBIDO luz baixa, penumbra, fundo escuro ou clima dramático, MESMO QUE a foto de referência do avatar tenha sido tirada assim; (d) o fundo segue a paleta clara do mood (areia, off-white, cinza quente, bege rosado, verde sálvia claro), é LISO e NU — nenhuma parede com quadros, prateleira, planta ou objeto reconhecível atrás dela; da foto original do avatar aproveite APENAS o rosto e as características físicas, NUNCA a iluminação, a cor ou o ambiente dela. PROIBIÇÃO DE COMBINAÇÃO — a mais importante desta regra: esta peça JAMAIS pode sair como a pessoa SENTADA A UMA MESA DE TRABALHO, em PLANO DE BUSTO ou meio corpo, fotografada na ALTURA DOS OLHOS com LUZ DE JANELA lateral. Mesa + busto + janela é a fotografia do mood CLAREZA, e foi exatamente assim que esta reconciliação falhou em geração real (14/08/2026) — a peça saiu indistinguível de uma peça de CLAREZA. Sem mesa de escritório, sem tampo cortando a base do quadro, sem cadeira, sem laptop, sem papéis. O protagonismo humano exigido pelo segmento permanece — a pessoa continua sendo o único sujeito e o centro de atenção —, mas se expressa pelo ISOLAMENTO dentro do vazio, não pelo tamanho no quadro. NEGATIVE: dark background, low-key lighting, dramatic shadows, medium shot portrait filling the frame, bust shot, subject dominating composition, person sitting at a desk, office desk in foreground, cluttered background, framed pictures on wall, shelves with objects, papers in foreground, olive or dark muted backdrop.";

/** Reconciliação entre o personagem de referência (avatar) e a gramática do
 * mood, quando as duas se contradizem. Hoje só SILÊNCIO (OP-06) precisa.
 * Consumido pelos dois motores: PU (puReferencesBlock) e MOP (buildAnchorPrefix). */
export function buildPersonagemMoodReconciliation(mood?: MoodCode): string {
  return mood === "OP-06" ? PERSONAGEM_RECONCILIACAO_SILENCIO : "";
}

// FRAGMENTO exige 3 a 5 blocos visuais distintos com "múltiplos focos pequenos
// coexistindo" (ver MOOD_RULES["OP-04"] no léxico) — estruturalmente oposto à regra de
// protagonismo do produto, que exige UM herói único e dominante. Mesma classe
// de conflito do SILÊNCIO acima, achado na mesma auditoria.
const PRODUTO_RECONCILIACAO_FRAGMENTO_HERO =
  "RECONCILIAÇÃO COM O MOOD FRAGMENTO: o mood FRAGMENTO exige uma composição de 3 a 5 blocos visuais distintos, sem um único elemento dominando o quadro inteiro — isso SUBSTITUI, PARA ESTA PEÇA, a exigência de o produto ocupar 30-40% do quadro inteiro da regra acima. O produto referenciado deve aparecer com destaque e nitidez em PELO MENOS UM dos blocos (preferencialmente o bloco mais central ou de maior área) — os demais blocos trazem outros ângulos, detalhes ou contexto do mesmo produto ou do universo do negócio, nunca um segundo produto ou objeto-conceito concorrente.";

export function buildProductHierarchyBlock(opts: {
  produtosCount: number;
  hasCenario: boolean;
  hasAvatar: boolean;
  segment?: Segment;
  isPersonalBrand?: boolean;
  /** true quando a variação de personagem sorteada nesta geração já determina
   * que o rosto não é dominante (ver variationHasFaceNotDominant) — evita que
   * a regra de protagonismo do produto, lida isoladamente, empurre o modelo
   * de imagem para um retrato de rosto em primeiro plano. */
  faceNotDominant?: boolean;
  /** Mood desta geração — usado só para reconciliar SILÊNCIO/FRAGMENTO, cuja
   * composição (objeto pequeno/vasto espaço; múltiplos blocos sem hero único)
   * contradiz a regra de protagonismo do produto se lida isoladamente. */
  mood?: MoodCode;
  /** true quando o único produto referenciado é um dispositivo cuja TELA é a
   * própria identidade do produto (produtoEhDispositivo && produtoTelaInformativa,
   * ver buildReferences.ts) — achado real 2026-07-08 (dilema AJUSTE_CONFLITO):
   * em SERVIÇOS, a regra padrão de produto-apoio (pequeno, ao fundo) é
   * tecnicamente incompatível com a exigência de tela legível. Só se aplica
   * com 1 produto (produtosCount === 1) — caso plural não tem uso real ainda. */
  produtoTelaIdentidade?: boolean;
  /** Peça sem nenhuma pessoa (PU — ver core/semPersonagem.ts): substitui, em
   * SERVIÇOS e MARCA, as regras que dão o protagonismo ao personagem. */
  semPersonagem?: boolean;
  /** Modo look book: a peça está vestida no corpo da pessoa, e não é um objeto
   * separado disputando o quadro com ela (ver core/lookBook.ts). */
  produtoVestido?: boolean;
}): string {
  const {
    produtosCount,
    hasCenario,
    hasAvatar,
    segment,
    isPersonalBrand,
    faceNotDominant,
    mood,
    produtoTelaIdentidade,
    semPersonagem,
    produtoVestido,
  } = opts;
  if (produtosCount <= 0) return "";
  const multi = produtosCount > 1;

  // Look book atravessa os três segmentos: quem marcou "o produto veste o
  // personagem" já decidiu o papel de cada elemento, e essa decisão explícita
  // do usuário vence a hierarquia padrão do segmento (produto-herói em VAREJO,
  // produto-apoio em SERVIÇOS, equilíbrio em MARCA).
  if (produtoVestido && !semPersonagem) {
    const lines: string[] = [PRODUTO_PROTAGONISMO_VESTIDO];
    if (hasCenario) lines.push(multi ? CENARIO_VS_PRODUTO_PLURAL : CENARIO_VS_PRODUTO_SINGULAR);
    // Sem condicionar a hasAvatar: quem veste a peça pode ser o avatar do Kit
    // ou o personagem criado sem foto — o flag só chega aqui quando existe
    // pessoa em cena (garantido em buildReferences).
    lines.push(AVATAR_VESTE_PRODUTO);
    return lines.join("\n");
  }

  // Sem personagem: SERVIÇOS e MARCA (institucional ou pessoal) trocam a regra
  // de protagonismo humano pelo produto como sujeito. VAREJO segue adiante
  // para sua regra normal de produto-herói, que já não depende de pessoa.
  if (semPersonagem && segment !== "VAREJO") {
    const lines: string[] = [
      multi ? PRODUTO_SUJEITO_SEM_PERSONAGEM_PLURAL : PRODUTO_SUJEITO_SEM_PERSONAGEM_SINGULAR,
    ];
    // A exceção de tela=identidade (PRODUTO_DISPOSITIVO_TELA_SERVICOS_*) NÃO
    // entra aqui: ela existe para reconciliar produto-apoio com tela legível e
    // termina dizendo que "quem representa o serviço continua sendo o
    // PERSONAGEM". Sem personagem o problema já não existe — o produto é o
    // sujeito, em primeiro plano e nítido —, e a fidelidade da tela continua
    // garantida por buildDeviceRule/screenContentClause no mesmo prompt.
    if (hasCenario) lines.push(multi ? CENARIO_VS_PRODUTO_PLURAL : CENARIO_VS_PRODUTO_SINGULAR);
    return lines.join("\n");
  }

  // SERVIÇOS: produto em segundo plano, adaptado ao cenário — quem protagoniza
  // é o personagem (o que se vende é o serviço, não o item de apoio).
  // EXCEÇÃO (produtoTelaIdentidade, singular): produto-dispositivo com tela=
  // identidade vai pra primeiro plano — ver blocos PRODUTO_DISPOSITIVO_TELA_*
  // acima. Não se aplica a produtosCount > 1 (caso plural sem uso real ainda).
  if (segment === "SERVIÇOS") {
    const useTelaIdentidade = !multi && produtoTelaIdentidade;
    const lines: string[] = [
      useTelaIdentidade
        ? PRODUTO_DISPOSITIVO_TELA_SERVICOS_SINGULAR
        : multi
          ? PRODUTO_APOIO_SERVICOS_PLURAL
          : PRODUTO_APOIO_SERVICOS_SINGULAR,
    ];
    if (mood === "OP-06") {
      lines.push(
        useTelaIdentidade
          ? PRODUTO_RECONCILIACAO_SILENCIO_TELA
          : PRODUTO_RECONCILIACAO_SILENCIO_APOIO,
      );
    }
    if (hasAvatar) {
      lines.push(
        useTelaIdentidade
          ? PERSONAGEM_VS_PRODUTO_DISPOSITIVO_TELA_SERVICOS_SINGULAR
          : multi
            ? PERSONAGEM_VS_PRODUTO_SERVICOS_PLURAL
            : PERSONAGEM_VS_PRODUTO_SERVICOS_SINGULAR,
      );
      if (faceNotDominant) {
        lines.push(
          useTelaIdentidade
            ? "RECONCILIAÇÃO COM A VARIAÇÃO DE PERSONAGEM DESTA GERAÇÃO: a variação sorteada determina que o ROSTO do personagem NÃO é dominante nesta cena (presença parcial — mão, braço, gesto, silhueta). Isso NÃO reduz o protagonismo humano do personagem definido acima: ele continua sendo o centro visual da composição através do GESTO, da AÇÃO ou da PRESENÇA PARCIAL, nunca do rosto. PROIBIDO recorrer a um retrato de rosto em primeiro plano só para satisfazer o protagonismo do personagem — expresse-o por mão, gesto ou ação. O dispositivo continua em primeiro plano, exposto e separado do personagem, conforme a regra acima."
            : "RECONCILIAÇÃO COM A VARIAÇÃO DE PERSONAGEM DESTA GERAÇÃO: a variação sorteada determina que o ROSTO do personagem NÃO é dominante nesta cena (presença parcial — mão, braço, gesto, silhueta). Isso NÃO reduz o protagonismo do personagem definido acima: ele continua sendo o centro visual da composição através do GESTO, da AÇÃO ou da PRESENÇA PARCIAL, nunca do rosto. PROIBIDO recorrer a um retrato de rosto em primeiro plano só para satisfazer o protagonismo do personagem — expresse-o por mão, gesto ou ação, mantendo o produto em apoio conforme a regra acima.",
        );
      }
    }
    return lines.join("\n");
  }

  // MARCA PESSOAL: o dono/profissional É a marca — personagem sempre
  // protagonista, produto em apoio (não entra no equilíbrio 50/50 abaixo).
  if (segment === "MARCA" && isPersonalBrand) {
    const lines: string[] = [
      multi ? PRODUTO_APOIO_MARCA_PESSOAL_PLURAL : PRODUTO_APOIO_MARCA_PESSOAL_SINGULAR,
    ];
    if (mood === "OP-06") lines.push(PRODUTO_RECONCILIACAO_SILENCIO_APOIO);
    if (hasAvatar) {
      lines.push(
        multi
          ? PERSONAGEM_PROTAGONISTA_MARCA_PESSOAL_PLURAL
          : PERSONAGEM_PROTAGONISTA_MARCA_PESSOAL_SINGULAR,
      );
      if (faceNotDominant) {
        lines.push(
          "RECONCILIAÇÃO COM A VARIAÇÃO DE PERSONAGEM DESTA GERAÇÃO: a variação sorteada determina que o ROSTO do personagem NÃO é dominante nesta cena (presença parcial — mão, braço, gesto, silhueta). Isso NÃO reduz o protagonismo absoluto do personagem definido acima (nesta marca, a pessoa É a marca): o protagonismo se expressa pelo GESTO, pela AÇÃO ou pela PRESENÇA PARCIAL — não pelo rosto. PROIBIDO recorrer a um retrato de rosto em primeiro plano só para satisfazer 'a pessoa é a marca' — expresse a marca por mão, gesto ou ação, mantendo o produto em apoio conforme a regra acima.",
        );
      }
    }
    return lines.join("\n");
  }

  // MARCA (institucional): nem produto nem personagem dominam — peso visual
  // equivalente entre os dois, o protagonista é a identidade da marca,
  // representada por ambos.
  if (segment === "MARCA") {
    const lines: string[] = [
      multi ? PRODUTO_EQUILIBRIO_MARCA_PLURAL : PRODUTO_EQUILIBRIO_MARCA_SINGULAR,
    ];
    if (mood === "OP-06") lines.push(PRODUTO_RECONCILIACAO_SILENCIO_EQUILIBRIO);
    if (hasAvatar) {
      lines.push(
        multi
          ? PERSONAGEM_VS_PRODUTO_EQUILIBRIO_MARCA_PLURAL
          : PERSONAGEM_VS_PRODUTO_EQUILIBRIO_MARCA_SINGULAR,
      );
      if (faceNotDominant) {
        lines.push(
          "RECONCILIAÇÃO COM A VARIAÇÃO DE PERSONAGEM DESTA GERAÇÃO: a variação sorteada determina que o ROSTO do personagem NÃO é dominante nesta cena (presença parcial — mão, braço, gesto, silhueta). Isso NÃO reduz o peso visual igual definido acima: o EQUILÍBRIO 50/50 passa a ser entre o produto e a PRESENÇA PARCIAL do personagem (mão segurando ou próxima ao produto, gesto, silhueta) — ambos igualmente nítidos e perceptíveis ao mesmo tempo, sem que nenhum rosto em primeiro plano seja necessário para cumprir o equilíbrio. PROIBIDO recorrer a um retrato de rosto em primeiro plano só para satisfazer o peso visual igual.",
        );
      }
    }
    return lines.join("\n");
  }

  // VAREJO: produto é o herói da composição (regra original).
  const lines: string[] = [multi ? PRODUTO_PROTAGONISMO_PLURAL : PRODUTO_PROTAGONISMO_SINGULAR];
  if (mood === "OP-06") lines.push(PRODUTO_RECONCILIACAO_SILENCIO_HERO);
  if (mood === "OP-04") lines.push(PRODUTO_RECONCILIACAO_FRAGMENTO_HERO);
  if (faceNotDominant) {
    lines.push(
      "RECONCILIAÇÃO COM A VARIAÇÃO DE PERSONAGEM DESTA GERAÇÃO: a variação sorteada determina que o ROSTO do personagem NÃO é dominante nesta cena (presença parcial — mão, braço, silhueta — ou nenhuma pessoa visível). Isso NÃO reduz a regra de protagonismo do produto acima: o produto continua sendo o centro visual nítido, grande e em primeiro plano, ocupando o papel que seria do rosto. PROIBIDO compensar a ausência de rosto dominante com um retrato de rosto em primeiro plano, luz dramática teatral ou composição de moda — a cena permanece fiel à gramática de luz, paleta e composição do mood descrita acima, com o produto (não o rosto) como protagonista.",
    );
  }
  if (hasCenario) lines.push(multi ? CENARIO_VS_PRODUTO_PLURAL : CENARIO_VS_PRODUTO_SINGULAR);
  if (hasAvatar) lines.push(multi ? AVATAR_VS_PRODUTO_PLURAL : AVATAR_VS_PRODUTO_SINGULAR);
  return lines.join("\n");
}
