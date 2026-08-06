// Modo LOOK BOOK — o personagem VESTE o produto referenciado, em pose e
// enquadramento de modelo. Pedido do Ari em 06/08/2026, na sequência do ajuste
// que fez a peça de moda aparecer EXPOSTA ao lado do personagem: ali o objetivo
// era fidelidade máxima da peça; aqui é a peça em uso, como uma campanha de
// moda de verdade.
//
// Os dois modos convivem e são mutuamente exclusivos por peça — o padrão segue
// sendo o exposto (mais fiel à estampa/logo), e o look book entra quando o
// usuário marca. Ele escolhe também o TIPO da peça, porque é o tipo que decide
// o enquadramento: pedir "plano médio" com um tênis como produto é o mesmo que
// cortar o produto fora do quadro.
//
// Divisão de responsabilidade dentro do prompt:
//   · POSE, CÂMERA e ENQUADRAMENTO vêm daqui (substituem a estrutura sorteada
//     do mood — ver buildPuPrompt, mesmo padrão de buildSemPersonagemVariationBlock);
//   · LUZ, PALETA, clima e detalhe criativo continuam vindo do mood, intactos.
// Sem essa divisão explícita, o vocabulário de moda ("editorial", "campanha")
// puxaria a peça para uma estética própria e o mood viraria decorativo.

import { pickRandom } from "./visualDirection.lexicon";
import type { TipoPecaVestuario } from "../domain/visualSelection";
import type { LogoPosition } from "../types";

/** Rótulos de UI — fonte única, para o seletor e para o texto do prompt. */
export const TIPO_PECA_LABEL: Record<TipoPecaVestuario, string> = {
  cima: "Parte de cima (camiseta, blusa, camisa, jaqueta)",
  baixo: "Parte de baixo (calça, bermuda, saia, short)",
  look: "Look inteiro (vestido, terno, conjunto, macacão)",
  calcado: "Calçado (sapato, tênis, bota, sandália)",
};

/** Nome curto da peça, usado dentro das frases do prompt. */
const TIPO_PECA_NOME: Record<TipoPecaVestuario, string> = {
  cima: "peça de parte de cima (camiseta, blusa, camisa ou jaqueta)",
  baixo: "peça de parte de baixo (calça, bermuda, saia ou short)",
  look: "peça de corpo inteiro (vestido, terno, conjunto ou macacão)",
  calcado: "calçado (sapato, tênis, bota ou sandália)",
};

// Enquadramento obrigatório por tipo. É a regra central do modo: define o que
// NÃO pode ser cortado fora do quadro. Cada entrada fecha as duas pontas — o
// que a peça exige e o que não pode ser sacrificado para consegui-lo.
const ENQUADRAMENTO_POR_TIPO: Record<TipoPecaVestuario, string> = {
  cima:
    "ENQUADRAMENTO OBRIGATÓRIO — PLANO MÉDIO/AMERICANO: a câmera vai da cintura ou do quadril até ACIMA do topo da cabeça, com respiro. " +
    "A peça vestida no torso aparece INTEIRA e de frente — ombros, mangas, gola/decote e barra dentro do quadro, sem que braço, mão, cabelo ou objeto cubram o peito. " +
    "O ROSTO fica inteiramente visível. PROIBIDO cortar a peça na barra, cortar a cabeça, ou fechar tanto o plano que só apareça um trecho do tecido.",
  baixo:
    "ENQUADRAMENTO OBRIGATÓRIO — CORPO INTEIRO OU TRÊS-QUARTOS BAIXO: a peça vestida da cintura para baixo aparece INTEIRA — cós, comprimento e barra dentro do quadro, com os pés visíveis (corpo inteiro) ou o corte da imagem abaixo da barra da peça (três-quartos). " +
    "O ROSTO permanece inteiramente visível no quadro. " +
    "PROIBIDO cortar a peça na altura da coxa ou do joelho, e PROIBIDO resolver o enquadramento cortando a cabeça da pessoa para caber a peça.",
  look:
    "ENQUADRAMENTO OBRIGATÓRIO — CORPO INTEIRO, DOS PÉS AO TOPO DA CABEÇA: esta peça veste o corpo todo, então a figura aparece por inteiro, com respiro acima da cabeça e abaixo dos pés — nada de pessoa encostando nas bordas do quadro. " +
    "Silhueta, comprimento, caimento e proporção da peça precisam ser lidos de uma vez só. " +
    "O ROSTO continua nítido e reconhecível mesmo em plano aberto. PROIBIDO plano médio, PROIBIDO cortar nos joelhos, nos tornozelos ou acima da cabeça.",
  calcado:
    "ENQUADRAMENTO OBRIGATÓRIO — CORPO INTEIRO COM OS PÉS EM EVIDÊNCIA: a figura aparece dos PÉS ao topo da cabeça, e os DOIS pés calçados ficam INTEIRAMENTE dentro do quadro, apoiados no chão e sem corte na borda inferior. " +
    "O calçado é o ponto mais nítido e mais bem iluminado da imagem, e a pose o coloca em evidência (um pé à frente, passo, perna cruzada, pé apoiado em degrau ou meio-fio). " +
    "O ROSTO permanece visível. PROIBIDO cortar a imagem acima dos tornozelos, PROIBIDO pés atrás de móvel, sob mesa, cobertos por barra de calça comprida ou fora do quadro.",
};

// Repertório de pose de modelo — sorteado para que "gerar outra" não repita a
// mesma pose. Todas servem a qualquer tipo de peça: o enquadramento acima é que
// muda por tipo, a pose é livre dentro dele. Nenhuma delas vira a pessoa de
// costas nem esconde o rosto — o contrato do mix exige rosto visível.
//
// `catalogo: false` marca as poses que funcionam numa campanha editorial mas
// atrapalham no modo CATÁLOGO: elas jogam a modelo para um dos lados do quadro
// ou mostram a peça de perfil. Achado real do Ari (06/08/2026), na primeira
// peça gerada com o modo: "o personagem ficou encostado numa parede" — pose
// legítima de moda, errada para quem está escolhendo uma roupa e precisa vê-la
// de frente, inteira e no centro.
const POSE_MODELO_VARIATIONS: readonly { texto: string; catalogo: boolean }[] = [
  {
    texto:
      "em pé, de frente para a câmera, peso apoiado numa perna e a outra levemente à frente, ombros relaxados, olhar direto para a câmera — postura de campanha, natural, sem rigidez de foto 3x4",
    catalogo: true,
  },
  {
    texto:
      "em pé, corpo em três-quartos para a câmera e rosto voltado para ela, uma mão no bolso ou apoiada na cintura, queixo levemente erguido",
    catalogo: true,
  },
  {
    texto:
      "caminhando na direção da câmera em passo curto, peso em transição, movimento leve no tecido e no cabelo — flagrante de passarela, não pose estática",
    catalogo: true,
  },
  {
    texto:
      "em pé de perfil ou quase, com o rosto girado para a câmera por cima do ombro, mostrando o caimento lateral da peça",
    catalogo: false,
  },
  {
    texto:
      "encostada de lado numa parede ou superfície do próprio cenário, uma perna cruzada à frente da outra, braços soltos, olhar para a câmera",
    catalogo: false,
  },
  {
    texto:
      "em pé, leve giro de tronco com o tecido em movimento, mãos em gesto natural (ajustando a manga, a gola ou o bolso), sorriso contido ou expressão neutra confiante",
    catalogo: true,
  },
];

// Centralização — só no modo catálogo. A frase precisa dizer POR QUE não há
// espaço a reservar: numa peça normal o bloco de título ancora no alto e a cena
// se organiza em volta dele, então o modelo de imagem aprendeu a deixar uma
// metade do quadro respirando. Sem texto e sem essa explicação, ele mantém o
// vazio e empurra a modelo para o canto do mesmo jeito.
const CENTRALIZACAO_CATALOGO =
  "COMPOSIÇÃO CENTRADA: a modelo ocupa o EIXO CENTRAL do quadro — corpo alinhado ao centro horizontal, com espaço equilibrado à esquerda e à direita dela. " +
  "Nesta peça NÃO existe título nem bloco de texto para ocupar metade do quadro: o espaço todo é da modelo e da peça. " +
  "PROIBIDO empurrar a figura para uma das laterais, encostá-la numa parede, quina ou batente, ou deixar metade do quadro vazia esperando um texto que não vem. ";

/** Bloco de POSE + CÂMERA + ENQUADRAMENTO do look book.
 *  Substitui a estrutura de cena sorteada pelo mood (que fala de "gesto do
 *  ofício", atendimento e bancada — vocabulário que não descreve um look book).
 *
 *  `catalogo` restringe o sorteio às poses frontais e acrescenta a
 *  centralização — ver CENTRALIZACAO_CATALOGO e buildCatalogoSemTextoBlock. */
export function buildLookVariationBlock(tipo: TipoPecaVestuario, catalogo = false): string {
  const pool = POSE_MODELO_VARIATIONS.filter((p) => !catalogo || p.catalogo);
  const pose = pickRandom(pool.map((p) => p.texto));
  return (
    `\n⚠ VARIAÇÃO — PEÇA DE MODA COM MODELO: esta peça é um LOOK BOOK. A pessoa em cena é a MODELO que veste o produto: ela existe para mostrar a peça vestida, e a composição inteira é organizada em torno disso. ` +
    `POSE DESTA GERAÇÃO: ${pose}. ` +
    `CÂMERA: lente 50mm a 85mm, altura entre o peito e o quadril da modelo, ponto de vista frontal ou três-quartos, sem distorção de grande-angular e sem ângulo dramático. ` +
    `${catalogo ? CENTRALIZACAO_CATALOGO : ""}` +
    `${ENQUADRAMENTO_POR_TIPO[tipo]} ` +
    `A pose e o enquadramento acima SUBSTITUEM qualquer estrutura de cena, gesto de ofício ou pose de trabalho descrita em outro ponto deste prompt (atendimento, bancada, mesa, documento, operação) — nesta peça a modelo não está trabalhando, está vestindo. ` +
    `O que NÃO muda: luz, paleta, clima e detalhe criativo continuam sendo os do mood definido na DIREÇÃO — o look book governa pose, câmera e enquadramento, nunca a gramática visual do mood.`
  );
}

/** Bloco de FIDELIDADE da peça vestida — substitui, no modo look book, o bloco
 *  "PRODUTO DE VESTUÁRIO — EXPOSTO, NÃO VESTIDO" do modo padrão.
 *
 *  A fidelidade é o ponto fraco conhecido deste modo: quando a roupa vai para o
 *  corpo, o modelo de imagem reinterpreta caimento, gola, comprimento e —
 *  principalmente — estampa e logo aplicada. Daí o bloco insistir na foto de
 *  referência como fonte da verdade, item por item. */
export function buildProdutoVestidoBlock(tipo: TipoPecaVestuario, plural: boolean): string {
  const nome = TIPO_PECA_NOME[tipo];
  const artigo = plural ? "as peças referenciadas" : "a peça referenciada";
  const outrasPecas =
    tipo === "look"
      ? "O look de referência veste o corpo inteiro — as demais peças do figurino (calçado, acessórios) ficam neutras e discretas, sem competir com ele."
      : tipo === "calcado"
        ? "O restante do figurino (calça, saia, vestido) é neutro, de cor sóbria e comprimento que NÃO cubra o calçado — ele precisa aparecer inteiro."
        : tipo === "cima"
          ? "A parte de baixo do figurino é neutra e sóbria (jeans liso, calça escura, saia lisa), sem estampa nem cor vibrante que dispute atenção com a peça referenciada."
          : "A parte de cima do figurino é neutra e sóbria (camiseta lisa, blusa básica), sem estampa nem cor vibrante que dispute atenção com a peça referenciada.";
  return (
    `PRODUTO VESTIDO PELA MODELO — MODO LOOK BOOK: ${artigo} ${plural ? "são" : "é"} uma ${nome} e a pessoa em cena a VESTE de fato, no corpo, em uso real. ` +
    `Este bloco SUBSTITUI qualquer instrução deste prompt que mande expor a peça separada da pessoa (em cabide, arara, manequim ou dobrada) — nesta peça específica ela está vestida. ` +
    `FIDELIDADE À FOTO DE REFERÊNCIA — INEGOCIÁVEL, item por item: mesma COR exata, mesma ESTAMPA (mesmo desenho, mesma posição, mesma escala), mesmo TIPO DE GOLA/DECOTE, mesmo comprimento de manga e de barra, mesmo corte, mesmo tecido e mesmo acabamento. ` +
    `Se houver logo, escrita ou aplicação na peça de referência, ela é reproduzida no MESMO lugar, no MESMO tamanho e com a MESMA grafia — PROIBIDO reposicionar, aumentar, apagar, inventar outra ou substituir por marca genérica. ` +
    `A peça veste bem: caimento natural no corpo, sem amassados, sem dobras estranhas, sem deformar o desenho da estampa e sem parecer colagem sobreposta ao corpo. ` +
    `${outrasPecas} ` +
    `PROIBIDO: trocar a cor da peça, simplificar ou recriar a estampa, mudar a gola, alterar o comprimento, ou vestir a modelo com uma peça apenas "parecida" com a da referência. ` +
    `NEGATIVE: different garment, altered print, redrawn logo, wrong collar, wrong sleeve length, garment recolored, generic clothing replacing the referenced piece, flat pasted-on garment.`
  );
}

/** Ajuste do contrato do mix para o look book: no modo padrão o produto é um
 *  objeto à parte do personagem; aqui os dois são a mesma coisa no quadro, e o
 *  item da lista precisa dizer isso — senão o contrato pede um produto "inteiro
 *  e nítido, não encoberto" e o modelo pode entender que deve haver uma segunda
 *  unidade da peça exposta em cena, além da vestida. */
export function lookContratoItem(tipo: TipoPecaVestuario, plural: boolean): string {
  const alvo =
    tipo === "calcado"
      ? "nos pés da pessoa, com os dois pés inteiros dentro do quadro"
      : tipo === "look"
        ? "no corpo da pessoa, da cabeça aos pés, sem corte"
        : tipo === "baixo"
          ? "no corpo da pessoa, da cintura à barra, sem corte"
          : "no torso da pessoa, dos ombros à barra, sem corte";
  return (
    `${plural ? "AS PEÇAS REFERENCIADAS, VESTIDAS" : "A PEÇA REFERENCIADA, VESTIDA"} ${alvo} — ` +
    `fiel à foto de referência em cor, estampa e corte. ` +
    `Não existe uma segunda unidade da peça exposta em cena: ela aparece uma única vez, no corpo de quem a veste`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODO CATÁLOGO — peça sem nenhum texto na imagem
//
// Pedido do Ari em 06/08/2026, ao ver a primeira geração do look book: o uso
// real que ele tem em mente é a loja mandar para o cliente as peças que tem
// disponíveis, vestidas, para despertar vontade de comprar. Nesse uso o título
// e o texto de apoio atrapalham — quem fala é a roupa no corpo. Fica só a
// logomarca, que já é aplicada por composição fora da IA.
//
// É um modo dentro do look book, nunca solto: sem peça vestida não existe
// catálogo. O Post Único comum continua com texto obrigatório.
// ─────────────────────────────────────────────────────────────────────────────

// Onde o enquadramento não pode invadir, por posição de logo. É o conflito que
// aparece assim que a peça perde o texto: sem bloco tipográfico ocupando o
// quadro, a modelo cresce e vai parar em cima da área reservada da logomarca —
// e nos tipos "look" e "calcado" o enquadramento é corpo inteiro, com pés
// obrigatórios dentro do quadro, exatamente onde costuma ficar a faixa de baixo.
const RESPIRO_LOGO_POR_POSICAO: Record<LogoPosition, string> = {
  "top-center":
    "O TOPO DA CABEÇA da modelo fica ABAIXO da faixa reservada no alto do canvas, com folga visível — a faixa chega inteira vazia à logomarca. Se não couber, AFASTE a câmera; nunca corte a cabeça nem invada a faixa.",
  "bottom-center":
    "A BASE do enquadramento (pés, barra da peça ou corte de três-quartos, conforme o tipo) termina ACIMA da faixa reservada embaixo do canvas, com folga visível — a faixa chega inteira vazia à logomarca. Se não couber, AFASTE a câmera; nunca corte os pés nem invada a faixa.",
  "bottom-right":
    "NENHUMA parte da modelo, da peça vestida ou de objeto em destaque entra na área reservada do canto inferior direito — ela chega inteira vazia à logomarca. Componha a figura deslocando o cenário, não a modelo, para fora dessa área; se não couber, AFASTE a câmera.",
};

/** Bloco de "zero texto" do modo catálogo — SUBSTITUI o bloco de título/texto
 *  de apoio do Post Único (o único ponto do app em que a peça sai sem lettering).
 *
 *  A força tem de ser máxima porque o prompt inteiro do PU foi escrito partindo
 *  do princípio de que toda peça tem texto: a regra padrão chega a dizer "a peça
 *  DEVE ter lettering — texto é SEMPRE obrigatório". Uma instrução morna aqui
 *  perde para ela. */
export function buildCatalogoSemTextoBlock(logoPosition: LogoPosition = "bottom-right"): string {
  return (
    `⚠ PEÇA DE CATÁLOGO — ZERO TEXTO NA IMAGEM (PRECEDÊNCIA MÁXIMA, VENCE QUALQUER REGRA DE TEXTO DESTE PROMPT):\n` +
    `Esta peça é uma FOTO DE CATÁLOGO DE MODA. Ela NÃO tem título, NÃO tem texto de apoio, NÃO tem tópicos, NÃO tem selo, etiqueta, preço, tagline, hashtag, assinatura, legenda embutida, número, marca d'água nem qualquer palavra escrita — em nenhum ponto do quadro, em nenhum tamanho, nem no fundo, nem em placa, cartaz, vitrine, espelho, sacola, etiqueta de roupa ou embalagem dentro da cena.\n` +
    `A ÚNICA coisa que aparecerá sobre a imagem é a logomarca oficial, aplicada DEPOIS por composição, FORA da IA — você não desenha logo nenhuma.\n` +
    `Se alguma outra instrução deste prompt mandar criar título, texto de apoio, lettering ou "texto obrigatório", essa instrução está CANCELADA para esta peça. A informação-chave do briefing serve só para escolher clima, cenário e paleta — jamais vira palavra escrita.\n` +
    `${RESPIRO_LOGO_POR_POSICAO[logoPosition]}\n` +
    `NEGATIVE: text, lettering, typography, caption, headline, watermark, signature, price tag, label with text, poster with text, sign with letters, written words anywhere in the image.`
  );
}

/** Reforço final do modo catálogo — repetido na ÚLTIMA linha do prompt.
 *  Mesma tática de SEM_PERSONAGEM_REFORCO_FINAL e do contrato do mix: em prompt
 *  longo, a última instrução pesa mais que a do meio. */
export const CATALOGO_REFORCO_FINAL =
  "⚠ ÚLTIMA VERIFICAÇÃO — PEÇA DE CATÁLOGO: antes de fechar a imagem, confira que NÃO existe nenhuma palavra, letra, número ou símbolo tipográfico em lugar nenhum do quadro, e que a modelo está CENTRADA, de frente, com a peça inteira e nítida. Se houver qualquer texto, remova-o e refaça a composição sem ele.";
