// Monta o bloco de texto "IMAGEM #N = ..." que ancora cada referência visual
// (avatar/uniforme/fachada/cenário/produtos) enviada ao modelo de imagem.
// Extraído de regenerateWithKit.ts (PLANO_V2 Fase 9.1) — movido 1:1, sem
// mudança de comportamento, junto com as constantes que só ele usa
// (MOODS_CLAROS, CENARIO_FRAMING_POOL, PRODUTO_DETALHE_POOL).
import type { MoodCode, Segment } from "../../types";
import type { PostUnicoReferences } from "../../shared/visual/references";
import { buildUltimaVerificacaoBlock } from "../../shared/visual/referenceBlocks";
import { buildClothingPool } from "../../core/clothingPool";
import { buildProductHierarchyBlock } from "../../core/visualDirection";

const MOODS_CLAROS: ReadonlySet<MoodCode> = new Set<MoodCode>(["OP-01", "OP-06"]);

// Variações de ângulo + distância de câmera para o cenário do carrossel —
// o MESMO cenário é compartilhado pelos 5 cards, então sem variação os fundos
// saem quase idênticos. Cada item troca o ENQUADRAMENTO, nunca o lugar: o
// espaço, a arquitetura e os objetos continuam os mesmos e reconhecíveis.
// Escolha determinística por índice do card (não aleatória) — regenerar o
// mesmo card individualmente preserva a mesma variação.
const CENARIO_FRAMING_POOL: readonly string[] = [
  "plano aberto / visão geral do ambiente — câmera mais afastada, mostrando o espaço por inteiro",
  "plano médio com a câmera deslocada para o lado — outro ponto de vista do mesmo espaço, ângulo lateral",
  "close-up / plano de detalhe — aproxime de um elemento específico do ambiente (uma parede, prateleira, bancada, equipamento ou decoração), mantendo pistas do entorno reconhecíveis",
  "ângulo de câmera mais baixo ou mais alto — ponto de vista vertical diferente do mesmo espaço",
  "enquadramento diagonal / outro canto do ambiente — plano médio-fechado, recorte diferente do mesmo local",
];

// Variações de enquadramento para o card de "PRODUTO EM DETALHE" do carrossel
// (VAREJO) — quando a distribuição de fotos (distributeProduto, ResultsView)
// decide que este card mostra um RECORTE/APROXIMAÇÃO do produto em vez do
// produto inteiro. Escolha determinística por índice do card, mesma lógica
// do CENARIO_FRAMING_POOL — dá variedade visual sem repetir o mesmo recorte.
const PRODUTO_DETALHE_POOL: readonly string[] = [
  "aproxime em DETALHE de uma parte específica do produto — uma textura, acabamento, etiqueta, encaixe ou material — sem mostrar o produto inteiro",
  "plano de DETALHE em outro ângulo do mesmo produto — uma borda, canto, costura, botão ou elemento funcional, em close-up, sem mostrar o produto inteiro",
  "RECORTE/aproximação de uma seção do produto em uso ou em destaque (ex.: mãos manipulando ou apresentando essa parte), sem revelar o produto completo",
];

export function buildAnchorPrefix(
  refs: PostUnicoReferences,
  mood: MoodCode,
  kitColors?: { primary: string; accent: string },
  cardCarrossel?: number,
  segment?: Segment,
  produtoDetalhe?: boolean,
  isPersonalBrand?: boolean,
): string {
  // Ordem dos prefixos espelha a ordem em que as imagens são enviadas
  // (avatar → uniforme → fachada → cenário → produtos), pra que a numeração
  // "imagem #1/#2/#3" case com a posição em image_urls no servidor.
  const lines: string[] = [];
  let idx = 1;
  // Quando há produto referenciado, o cenário deixa de "travar" móveis/ângulo
  // originais — vira pano de fundo de apoio, e a câmera pode se reposicionar
  // para dar protagonismo ao produto (ver buildProductHierarchyBlock abaixo).
  const temProduto = !!refs.produtos?.length;
  if (refs.avatar) {
    const clothingHint = refs.uniforme
      ? " COR/MODELO DO VESTUÁRIO: ver IMAGEM seguinte (UNIFORME OBRIGATÓRIO) — não escolha roupa livre."
      : kitColors
        ? (() => {
            const pool = buildClothingPool(kitColors.primary, kitColors.accent);
            return ` COR DO VESTUÁRIO: ${pool[Math.floor(Math.random() * pool.length)]}`;
          })()
        : "";
    const figurinoSentence = refs.uniforme
      ? "Vista o avatar com o uniforme obrigatório da próxima imagem. Não escolha figurino livre."
      : "Vista o avatar com roupa NOVA, coerente com a cena e o contexto da empresa descritos abaixo (pode ser polo, camisa social, jaleco, uniforme, regata de treino, moletom, terno — escolha o que faz sentido para a situação e o ambiente).";
    lines.push(
      `IMAGEM #${idx} = AVATAR (referência de IDENTIDADE, não de figurino). PRESERVE EXATAMENTE: rosto, traços faciais, idade, cabelo, barba, tom de pele, etnia, sexo, biótipo/estatura/porte físico, óculos e acessórios fixos do rosto. NÃO rejuvenesça, NÃO envelheça, NÃO troque etnia, NÃO mude o gênero, NÃO altere o porte físico. IGNORE a roupa, a cor da roupa, a pose exata e os acessórios de vestuário (relógio, anéis, colares) da foto — eles servem só pra mostrar a pessoa, não o figurino. ${figurinoSentence}${clothingHint}`,
    );
    idx++;
  }
  if (refs.uniforme) {
    lines.push(
      `IMAGEM #${idx} = UNIFORME OBRIGATÓRIO. Vista o personagem da cena EXATAMENTE com esta peça de roupa: mesma cor, mesmo modelo/corte e mesma posição da logomarca aplicada ao tecido. IGNORE COMPLETAMENTE quem aparece nesta foto de referência — rosto, corpo, idade, pose e identidade dessa pessoa NÃO importam, apenas a peça de roupa em si. NÃO copie a pessoa do uniforme; aplique somente a roupa ao personagem da cena.`,
    );
    idx++;
  }
  if (refs.fachada) {
    const reiluminaFachada = MOODS_CLAROS.has(mood);
    // Com produto referenciado, a fachada vira FUNDO DE APOIO — igual ao tratamento
    // que o cenário recebe em temProduto: a arquitetura fica ao fundo/reconhecível,
    // e a câmera pode se reposicionar para dar protagonismo ao produto.
    const fachadaAmbienteClause = temProduto
      ? "preserve a arquitetura, a volumetria, a vitrine, os materiais e as cores do local — a fachada aparece como FUNDO DE APOIO ao fundo da cena, reconhecível pela arquitetura e pelas cores, nunca maior ou mais nítida que o produto referenciado"
      : "preserve a arquitetura, a volumetria, a vitrine, os materiais e as cores do local — a fachada deve ser reconhecível na imagem final pela arquitetura e pelas cores, com personagem ou produto posicionado à frente ou com a fachada claramente visível ao fundo";
    const fachadaFramingClause = temProduto
      ? "Pode reposicionar ÂNGULO e DISTÂNCIA da câmera para dar protagonismo ao produto referenciado — mas a fachada deve continuar reconhecível ao fundo como contexto de marca."
      : "NÃO invente outro local, NÃO troque os elementos, NÃO mude o ângulo.";
    const fachadaClause = `${fachadaAmbienteClause}. NÃO desenhe, NÃO reproduza e NÃO tente recriar o letreiro, a placa ou a logomarca do estabelecimento como texto/símbolo legível: onde houver letreiro ou marca, mantenha apenas a forma/o suporte (a placa, a testeira, a faixa) de modo genérico, neutro ou desfocado, SEM escrita de marca nítida — a logomarca oficial é aplicada depois, fora da IA. Se houver fios elétricos, postes, cabos aéreos, lixo ou poluição visual cruzando a fachada, é PERMITIDO retocar/remover esses elementos da composição final — desde que a arquitetura e as cores do local continuem plenamente reconhecíveis. Se o céu aparecer na cena, é PERMITIDO substituí-lo por um céu mais bonito e coerente com o mood e o horário do dia (ex.: azul limpo, entardecer dourado, nublado suave) — sem look artificial ou composição com aparência de colagem`;
    lines.push(
      reiluminaFachada
        ? `IMAGEM #${idx} = FACHADA OBRIGATÓRIA. Use EXATAMENTE este local: ${fachadaClause}. ${fachadaFramingClause} A ILUMINAÇÃO DEVE SER REINTERPRETADA conforme o ESTILO VISUAL do mood descrito abaixo: clarear o ambiente, equilibrar luz natural, suavizar sombras profundas — preserve a arquitetura e os elementos do local, mas adapte a luz para casar com o mood claro.`
        : `IMAGEM #${idx} = FACHADA OBRIGATÓRIA. Use EXATAMENTE este local: ${fachadaClause}. ${fachadaFramingClause} Apenas adicione/adapte o personagem e a ação descritos abaixo neste local real.`,
    );
    idx++;
  }
  if (refs.cenario) {
    const reilumina = MOODS_CLAROS.has(mood);
    // Carrossel reaproveita o MESMO cenário em todos os cards — sem variar o
    // enquadramento, os 5 fundos saem quase idênticos. Aqui trocamos a regra
    // fixa "NÃO mude o ângulo" por uma instrução de enquadramento específica
    // para este card (determinística pelo índice), preservando o mesmo espaço.
    const variaEnquadramento = cardCarrossel != null;
    const framingPick = variaEnquadramento
      ? CENARIO_FRAMING_POOL[(cardCarrossel! - 1) % CENARIO_FRAMING_POOL.length]
      : null;

    // "ponto de vista da câmera" só entra na lista de preservação quando NÃO
    // estamos variando o enquadramento — caso contrário a frase contradiria
    // a liberação de ângulo/distância dada pelo framingClause abaixo.
    // Com produto referenciado, os móveis/objetos do cenário viram fundo de
    // apoio (não competem pelo protagonismo) e a câmera fica livre para se
    // reposicionar a favor do produto — ver framingClause abaixo.
    const ambienteInternoClause = temProduto
      ? "preserve a arquitetura, paredes, piso, iluminação geral e identidade visual do ambiente — móveis e objetos do cenário aparecem apenas como FUNDO de apoio, atrás e ao redor do produto referenciado, nunca à frente dele nem maiores ou mais nítidos que ele"
      : variaEnquadramento
        ? "preserve sala, móveis, equipamentos e paredes"
        : "preserve sala, móveis, equipamentos, paredes e ponto de vista da câmera";
    // "Dar protagonismo ao produto" só faz sentido em VAREJO — em SERVIÇOS
    // (produto-apoio) e MARCA (equilíbrio 50/50) isso contradiria a regra de
    // hierarquia já definida pelo bloco PRODUTO(S) mais abaixo.
    const framingClause = framingPick
      ? `Pode variar o ÂNGULO e a DISTÂNCIA DA CÂMERA — mas continue sendo claramente reconhecível como o MESMO AMBIENTE, com a mesma arquitetura, móveis/objetos e identidade visual. ENQUADRAMENTO DESTE CARD: ${framingPick}.`
      : temProduto
        ? segment === "VAREJO"
          ? "NÃO invente outro local, NÃO troque os objetos. Pode reposicionar ÂNGULO e DISTÂNCIA da câmera para dar protagonismo ao produto referenciado — mas o ambiente deve continuar reconhecível como o mesmo local."
          : "NÃO invente outro local, NÃO troque os objetos. Pode reposicionar ÂNGULO e DISTÂNCIA da câmera para integrar o produto à cena com naturalidade — mas o ambiente deve continuar reconhecível como o mesmo local."
        : "NÃO invente outro local, NÃO troque os objetos, NÃO mude o ângulo.";
    // SERVIÇOS/MARCA: produtos de terceiros visíveis no cenário real (ex.: embalagens
    // de marca em obra) não devem "vazar" pra peça. Só dispara quando NÃO há
    // produto de referência selecionado — com produto real selecionado, esse
    // mesmo texto ("desfoque, exclua...") competia com o bloco PRODUTO(S) e a
    // regra de hierarquia, e o modelo às vezes "cumpria" o aviso do cenário
    // excluindo o produto referenciado inteiro da cena (visto em geração real).
    const produtoGuard =
      segment !== "VAREJO" && !temProduto
        ? " Itens de mercadoria, produtos de terceiros ou embalagens com marcas visíveis em primeiro plano NÃO devem ser reproduzidos como elementos centrais da composição — desfoque, exclua ou mantenha discretos ao fundo, priorizando o avatar e a ação."
        : "";
    lines.push(
      reilumina
        ? `IMAGEM #${idx} = CENÁRIO OBRIGATÓRIO. Use EXATAMENTE este espaço: ${ambienteInternoClause}.${produtoGuard} NÃO invente outro local, NÃO troque os objetos. ${framingClause} A ILUMINAÇÃO DEVE SER REINTERPRETADA conforme o ESTILO VISUAL do mood descrito abaixo: clarear o ambiente, equilibrar luz natural, suavizar sombras profundas — preserve a arquitetura e os objetos do ambiente, mas adapte a luz para casar com o mood claro.`
        : `IMAGEM #${idx} = CENÁRIO OBRIGATÓRIO. Use EXATAMENTE este espaço: ${ambienteInternoClause}${variaEnquadramento || temProduto ? "" : ", mesma iluminação"}.${produtoGuard} NÃO invente outro local, NÃO troque os objetos. ${framingClause} Apenas adicione/adapte o personagem e a ação descritos abaixo dentro deste espaço real.`,
    );
    idx++;
  }
  if (refs.produtos?.length) {
    const n = refs.produtos.length;
    // Produto é ele mesmo uma tela/dispositivo cujo conteúdo exibido é a
    // identidade do produto (ex.: tablet mostrando o app/print do negócio) —
    // a regra global de desfoque de tela (buildDeviceRule) é suspensa para
    // esta geração (ver mainActivity/preserveScreenContent em generatePostImage),
    // então aqui reforçamos que o conteúdo da tela deve ficar nítido.
    const telaClause = refs.produtoTelaInformativa
      ? " A TELA deste produto exibe conteúdo que É a identidade do produto — reproduza esse conteúdo de tela com NITIDEZ e LEGIBILIDADE total, sem desfoque, sem apagar, sem substituir por outra interface."
      : "";
    if (n === 1 && produtoDetalhe) {
      const detalhePick =
        cardCarrossel != null
          ? PRODUTO_DETALHE_POOL[(cardCarrossel - 1) % PRODUTO_DETALHE_POOL.length]
          : PRODUTO_DETALHE_POOL[0];
      lines.push(
        `IMAGEM #${idx} = PRODUTO DE REFERÊNCIA — DETALHE/RECORTE OBRIGATÓRIO (não o produto inteiro): ${detalhePick}. Mantenha fidelidade ao produto real: mesma cor, material, rótulo e acabamento da referência — apenas o ENQUADRAMENTO é parcial/aproximado. Não invente outro produto, não troque a marca, não altere o design.${telaClause}`,
      );
    } else {
      lines.push(
        `IMAGEM${n > 1 ? "NS" : ""} #${idx}${n > 1 ? `..#${idx + n - 1}` : ""} = PRODUTO${n > 1 ? "S" : ""} OBRIGATÓRIO${n > 1 ? "S" : ""}. Use EXATAMENTE este produto, com mesmo formato, mesma cor, mesmo rótulo e mesma embalagem. Não invente outra versão, não troque a marca, não altere o design.${telaClause}`,
      );
    }
    // Em modo detalhe/recorte, a hierarquia padrão de produto não se aplica:
    // AVATAR_VS_PRODUTO_SINGULAR pede um ângulo que "revele a forma por
    // inteiro" do produto, o que contradiria o recorte pedido acima.
    if (!(n === 1 && produtoDetalhe)) {
      lines.push(
        buildProductHierarchyBlock({
          produtosCount: n,
          hasCenario: !!refs.cenario,
          hasAvatar: !!refs.avatar,
          segment,
          isPersonalBrand,
          mood,
        }),
      );
    }
    if (n >= 2) {
      lines.push(
        `REGRA DE CONTAGEM — INEGOCIÁVEL: a imagem final DEVE conter EXATAMENTE ${n} produto${n > 1 ? "s" : ""} visíveis e identificáveis, todos enviados como referência. PROIBIDO omitir, esconder atrás de objetos, cortar fora do quadro ou substituir qualquer um deles. Se o plano aberto não acomodar os ${n}, APROXIME o enquadramento (close-up de produto, detalhe do pé com o tênis, bancada/prateleira com os ${n} itens lado a lado, flat-lay) em vez de mostrar um cenário amplo com apenas parte dos produtos. Conte os produtos na composição final: o número deve ser ${n}.`,
      );
    }
  }
  // Quando apenas avatar enviado (sem cenário, fachada ou produto): suprimir
  // construção de ambiente pelo modelo. O campo leituraCenica.ambiente continua
  // indo ao prompt mas deve orientar vestuário/postura, não gerar fundo detalhado.
  if (refs.avatar && !refs.cenario && !refs.fachada && !refs.produtos?.length) {
    lines.push(
      "FUNDO NEUTRO OBRIGATÓRIO: apenas avatar de referência enviado — sem imagem de cenário. " +
        "Usar FUNDO LIMPO, SUAVE e DESFOCADO: bokeh suave, gradiente neutro, textura vaga ou superfície indefinida. " +
        "NÃO construir ambiente físico específico, sala, escritório ou local identificável como fundo — mesmo que a leitura de cena abaixo descreva um local. " +
        'O campo "Ambiente" da leitura de cena orienta apenas VESTUÁRIO e POSTURA do personagem, não o fundo a renderizar. ' +
        "NEGATIVE: detailed background, specific room interior, identifiable location behind person, sharp background, busy background, office furniture behind subject.",
    );
  }
  // Reforço final da contagem de produtos — repetida como a ÚLTIMA linha
  // deste bloco (que já tem prioridade máxima no prompt) porque modelos de
  // imagem tendem a dar mais peso à instrução mais recente quando há
  // conflito ou esquecimento ao longo de um prompt longo. Visto em produção:
  // com cenário + 2 produtos, o modelo às vezes renderiza só 1 produto.
  if (refs.produtos?.length && refs.produtos.length >= 2) {
    lines.push(buildUltimaVerificacaoBlock(refs.produtos.length));
  }
  if (!lines.length) return "";
  return `${lines.join("\n")}\n\n`;
}
