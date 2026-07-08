// Bloco de referências visuais (avatar/uniforme/fachada/cenário/fato/venda/produtos)
// do Post Único — extraído de postUnico.ts (Fase 8).

import { MoodCode, PostUnicoObjetivo, Segment } from "../types";
import { PersonagemGender, buildProductHierarchyBlock } from "../core/visualDirection";
import { buildClothingPool } from "../core/clothingPool";
import type { PostUnicoReferences } from "../shared/visual/references";
import { buildUltimaVerificacaoBlock } from "../shared/visual/referenceBlocks";

function segmentRules(segment?: string, hasCenarioRef?: boolean): string {
  if (segment === "VAREJO") {
    return "CONTEXTO — SEGMENTO VAREJO: negócio de comercialização de produtos ao consumidor. Quando presentes, produtos comunicam desejo de compra e benefícios (apresentar de forma atraente, não como catálogo técnico); cenário cria atmosfera de experiência de compra ou lifestyle; avatar contextualiza atendimento ou uso do produto. O tom visual e textual é convidativo e orientado ao consumo.";
  }
  if (segment === "MARCA") {
    // "Cenário" só entra na frase quando há foto de cenário de fato enviada —
    // caso contrário o texto empurrava o modelo a inventar um ambiente/estilo
    // de vida mesmo sem referência, mesmo com a trava de fundo neutro ativa.
    const cenarioClause = hasCenarioRef
      ? "Cenário e avatar transmitem percepção, estilo de vida e valores da marca"
      : "Avatar transmite percepção e valores da marca";
    return `CONTEXTO — SEGMENTO MARCA: construção de identidade e posicionamento. ${cenarioClause}; a composição reforça aspiração e propósito; produtos, se presentes, são ícones da identidade. O tom visual e textual é aspiracional e alinhado ao posicionamento da marca.`;
  }
  return "CONTEXTO — SEGMENTO SERVIÇOS: prestação de serviços especializados. Avatar (quando presente) transmite autoridade, competência e confiança do profissional ou da equipe; cenário reforça o contexto profissional; a composição comunica expertise, credibilidade e entrega de valor. O tom visual e textual é confiante e orientado ao resultado.";
}

export function referencesBlock(
  refs?: PostUnicoReferences,
  segment?: string,
  kitColors?: { primary: string; accent: string },
  objetivo?: PostUnicoObjetivo,
  forcedGender?: PersonagemGender,
  isPersonalBrand?: boolean,
  mainActivity?: string,
  faceNotDominant?: boolean,
  mood?: MoodCode,
): string {
  if (!refs) return "";
  const parts: string[] = [];
  const elementos: string[] = [];
  if (refs.avatar) elementos.push("AVATAR");
  if (refs.uniforme) elementos.push("UNIFORME");
  if (refs.fachada) elementos.push("FACHADA");
  if (refs.cenario) elementos.push("CENÁRIO");
  if (refs.fato) elementos.push("FATO");
  if (refs.venda) elementos.push("VENDA");
  if (refs.produtos && refs.produtos.length) elementos.push("PRODUTOS");
  if (!elementos.length) return "";

  parts.push(
    `ESTRUTURA VISUAL DA PEÇA — usar como REFERÊNCIA VISUAL (não copiar literalmente, não fazer colagem):`,
  );
  parts.push(`Elementos enviados: ${elementos.join(", ")}.`);
  parts.push(segmentRules(segment, !!refs.cenario));

  if (refs.avatar) {
    const clothingHint = refs.uniforme
      ? " VESTUÁRIO: vista o avatar com o uniforme obrigatório da próxima imagem de referência — não escolha figurino livre."
      : kitColors
        ? (() => {
            const pool = buildClothingPool(kitColors.primary, kitColors.accent);
            return ` VESTUÁRIO: ${pool[Math.floor(Math.random() * pool.length)]}`;
          })()
        : "";
    parts.push(
      `AVATAR: a primeira imagem de referência é o avatar. Use como personagem da peça mantendo semelhança visual (rosto, perfil físico, faixa etária, gênero, expressão e características predominantes). Adapte postura e linguagem corporal ao contexto da atividade da empresa e ao mood. Aparência publicitária e realista — sem caricatura, sem distorção facial, sem clonagem exata da foto original.${clothingHint} REPERTÓRIO DE POSE/ENQUADRAMENTO (escolha conscientemente — NÃO caia automaticamente em "sentado à mesa com notebook olhando para a câmera"): pode estar em pé, andando, de perfil, de costas parcial, em meio gesto, em conversa com alguém fora de quadro, com material/produto em mãos, encostado em parede, em ambiente externo. NÃO é obrigatório olhar para a câmera. NÃO é obrigatório estar atrás de mesa com notebook. Enquadramento pode variar: close de rosto, meio corpo, corpo inteiro, três-quartos, OU peça sem rosto visível (mãos trabalhando, detalhe de gesto, ambiente com presença implícita). Escolha a combinação que melhor serve à mensagem desta peça específica.`,
    );
  }
  if (refs.uniforme) {
    const personagemClause = refs.avatar
      ? " NÃO copie a pessoa do uniforme; aplique somente a roupa ao personagem já definido pelo avatar."
      : ` NÃO copie a pessoa do uniforme — ela é só referência de roupa.`;
    parts.push(
      `UNIFORME OBRIGATÓRIO: uma das imagens de referência enviadas é o uniforme da empresa — vista o personagem da peça EXATAMENTE com esta peça de roupa: mesma cor, mesmo modelo/corte e mesma posição da logomarca aplicada ao tecido. IGNORE COMPLETAMENTE quem aparece nesta foto de referência — rosto, corpo, idade, pose e identidade dessa pessoa NÃO importam, apenas a peça de roupa em si.${personagemClause}`,
    );
  }
  // Personagem sem avatar — representa o público-alvo por padrão (figurino
  // livre); só veste o uniforme acima quando o usuário marcou explicitamente
  // que esse personagem é o emissor (comUniforme + refs.uniforme presente).
  if (!refs.avatar && refs.personagemSemAvatarAtivo) {
    const idadeClause = refs.personagemIdade ? `, aparentando ${refs.personagemIdade}` : "";
    const generoClause = forcedGender ? forcedGender : "homem ou mulher";
    const roupaClause = refs.uniforme
      ? "vestindo o uniforme descrito acima"
      : "com roupa coerente com a cena e o contexto da empresa (figurino livre, sem uniforme)";
    const papelClause = refs.uniforme
      ? "EMISSOR — representa a empresa"
      : "PÚBLICO-ALVO — representa quem recebe a comunicação, NÃO a empresa";
    // Sem isso, a única instrução de PAPEL/AÇÃO do personagem (buildSceneRoleRule)
    // fica suprimida quando há qualquer referência de Kit Imagem ativa (ver
    // showConcreteAction mais abaixo) — o personagem sem avatar ficava com
    // identidade declarada mas nenhuma orientação de postura, e a cláusula do
    // CENÁRIO ("preserve a sala, móveis, equipamentos") empurra sozinha para a
    // leitura de "pessoa pertence a este ambiente de trabalho" = emissor. Achado
    // real: peça de Pronto Vet (cenário de clínica, sem avatar) saiu com a
    // personagem em postura de atendente. Esta frase ancora o papel correto sem
    // reativar a máquina de "monte a cena" do buildSceneRoleRule.
    const acaoClause = !refs.uniforme
      ? ` AÇÃO/POSTURA: este personagem é CLIENTE/RECEPTOR — aparece recebendo, vivendo ou se beneficiando de algo relacionado a "${mainActivity || "a atividade da empresa"}", NUNCA executando o ofício nem em postura de atendente/equipe (atrás de balcão ou mesa, de uniforme operando, conduzindo o atendimento). É quem chega ou é atendido, não quem atende.`
      : "";
    parts.push(
      `PERSONAGEM OBRIGATÓRIO (sem avatar — ${papelClause}): esta peça DEVE ter um personagem humano claramente visível${idadeClause}, gênero: ${generoClause}, ${roupaClause}. Aparência publicitária e realista, sem caricatura. Invente o personagem livremente (rosto, etnia, expressão)${refs.uniforme ? " — apenas a roupa é fixa (a do uniforme)" : ""}.${acaoClause}`,
    );
  }
  if (refs.fachada) {
    parts.push(
      `FACHADA OBRIGATÓRIA: preserve FIELMENTE este espaço como ele é na imagem de referência. Mantenha a arquitetura, a volumetria, a vitrine, os materiais e as cores do local, o ângulo da câmera e a atmosfera reconhecíveis. A pessoa ou produto deve aparecer à frente, na entrada ou com a fachada claramente visível ao fundo. Quem conhece o local deve reconhecê-lo pela arquitetura e pelas cores. TEXTO/NOME DO ESTABELECIMENTO NA FACHADA: se o nome ou a marca do estabelecimento JÁ aparecer nítido e legível na foto de referência (pintado na parede, em placa, testeira, faixa ou letreiro), PRESERVE-O fielmente como está na foto — mesma grafia, mesma posição, mesmas cores — exatamente como você preserva a arquitetura e as cores do local; NÃO apague, NÃO borre e NÃO substitua esse nome por uma área lisa/branca/genérica. O que é PROIBIDO é INVENTAR ou redesenhar do zero um letreiro/marca que NÃO esteja legível na referência: onde não houver escrita clara, mantenha apenas a forma/o suporte (a placa, a testeira, a faixa) de modo neutro, SEM criar letras ou marca fictícia. A logomarca oficial é aplicada depois, fora da IA, em outra área da peça — ela NÃO substitui o nome que já existe na fachada real. É PERMITIDO limpar a composição de elementos visuais indesejados — fios elétricos, postes, cabos aéreos, lixo ou poluição visual cruzando a fachada — e, se o céu aparecer, substituí-lo por um céu mais bonito e coerente com o mood/horário (azul limpo, entardecer dourado, nublado suave), desde que a arquitetura, as cores e o nome do local permaneçam plenamente reconhecíveis e a peça não pareça artificial ou colada. NÃO invente outro lugar, NÃO substitua a arquitetura, NÃO mude o ângulo. O local deve ser reconhecível na imagem final pela sua arquitetura e cores.`,
    );
  }
  if (refs.cenario) {
    const temProduto = !!(refs.produtos && refs.produtos.length);
    // Só avisa pra desfocar/excluir mercadoria do CENÁRIO quando NÃO há produto
    // de referência selecionado — esse aviso existe pra evitar que um item
    // qualquer visível na foto do cenário seja confundido com "o produto".
    // Quando HÁ produto de referência real, esse mesmo texto ("desfoque,
    // exclua...") competia com o bloco PRODUTOS SELECIONADOS + a regra de
    // hierarquia (que já define o papel do produto por segmento), e o modelo
    // às vezes "cumpria" o aviso do cenário excluindo o produto inteiro da
    // cena — visto no caso real em que o produto referenciado simplesmente
    // não apareceu na peça.
    const produtoGuard =
      segment !== "VAREJO" && !temProduto
        ? " Itens de mercadoria, produtos de terceiros ou embalagens com marcas visíveis em primeiro plano NÃO devem ser reproduzidos como elementos centrais da composição — desfoque, exclua ou mantenha discretos ao fundo, priorizando o avatar e a ação de serviço."
        : "";
    const ambienteClause = temProduto
      ? "preserve a arquitetura, paredes, piso, iluminação geral e identidade visual do ambiente — móveis e objetos do cenário aparecem apenas como FUNDO de apoio, atrás e ao redor do produto referenciado, nunca à frente dele nem maiores ou mais nítidos que ele"
      : "preserve a sala, móveis, equipamentos, paredes e ponto de vista";
    // "Dar protagonismo ao produto" só faz sentido em VAREJO — em SERVIÇOS
    // (produto-apoio) e MARCA (equilíbrio 50/50, ou personagem-dominante se
    // marca pessoal) isso contradiria a regra de hierarquia já definida no
    // bloco PRODUTOS SELECIONADOS abaixo.
    const anguloClause = temProduto
      ? segment === "VAREJO"
        ? "Pode reposicionar ÂNGULO e DISTÂNCIA da câmera para dar protagonismo ao produto referenciado — mas o ambiente deve continuar reconhecível como o mesmo local."
        : "Pode reposicionar ÂNGULO e DISTÂNCIA da câmera para integrar o produto à cena com naturalidade — mas o ambiente deve continuar reconhecível como o mesmo local."
      : "NÃO mude o ângulo.";
    // Sem avatar nem checkbox de personagem, a restrição de gênero DEVE entrar
    // aqui — dentro do bloco que vai para referenceAnchorBlock com PRECEDÊNCIA
    // MÁXIMA. Fora dele (livreGenderBlock/genderBlock), a própria âncora diz
    // "PRECEDÊNCIA sobre qualquer personagem descrito no restante deste prompt",
    // o que subordina o gênero e deixa o modelo livre para cair no viés masculino.
    const cenarioGenderClause =
      !refs.avatar && !refs.personagemSemAvatarAtivo && forcedGender
        ? ` O personagem inserido na cena DEVE ser ${forcedGender} — PROIBIDO gerar ${forcedGender === "mulher" ? "homem" : "mulher"} ou gênero ambíguo.`
        : "";
    parts.push(
      `CENÁRIO OBRIGATÓRIO — AMBIENTE: preserve FIELMENTE este espaço como ele é na imagem de referência. ${ambienteClause.charAt(0).toUpperCase()}${ambienteClause.slice(1)}. Adicione personagem e ação dentro deste espaço real sem inventar novos elementos.${cenarioGenderClause}${produtoGuard} NÃO invente outro lugar, NÃO substitua a arquitetura. ${anguloClause} O local deve ser reconhecível na imagem final.`,
    );
  }
  if (refs.fato) {
    parts.push(`⚠ FATO OBRIGATÓRIO — PRESERVAÇÃO TOTAL DA FOTO DO EVENTO:
Esta peça é um REGISTRO DOCUMENTAL. A foto enviada é o evento real — preserve-a fielmente.
PESSOAS: não altere rostos, poses, roupas nem número de pessoas. Mantenha exatamente como estão.
AMBIENTE: preserve arquitetura, móveis, decoração e espaço físico. O local deve ser reconhecível e idêntico.
LUZ: respeite a luz real do evento (sol, lâmpada, luz de janela). PERMITIDO melhorar tecnicamente: balanço de branco, contraste equilibrado, nitidez, clareza. PROIBIDO: criar luz cinematográfica artificial, mudar temperatura de cor radicalmente, dramatizar atmosfera.
COMPOSIÇÃO: respeite o enquadramento e ponto de vista originais.
PROIBIDO ABSOLUTAMENTE: alterar ou substituir pessoas, mudar ambiente, adicionar/remover elementos, dramatizar cores, inventar atmosfera, aplicar efeitos especiais.
A imagem final deve ser reconhecidamente o MESMO evento — apenas mais clara, nítida e tecnicamente melhorada.`);
  }
  if (refs.venda) {
    parts.push(`⚠ VENDA OBRIGATÓRIA — PRESERVAÇÃO TOTAL DA FOTO DO COLABORADOR COM O PRODUTO:
Esta peça é um REGISTRO REAL de apresentação/uso do produto. A foto enviada é a cena real — preserve-a fielmente.
PESSOA: não altere rosto, pose, roupa. Mantenha exatamente como está.
PRODUTO: preserve cor, formato, rótulo e embalagem — não troque, não invente outra versão.
AMBIENTE: preserve o espaço físico onde a foto foi tirada.
LUZ: respeite a luz real da foto. PERMITIDO melhorar tecnicamente: balanço de branco, contraste equilibrado, nitidez, clareza. PROIBIDO: criar luz cinematográfica artificial, dramatizar atmosfera.
PROIBIDO ABSOLUTAMENTE: alterar ou substituir a pessoa, trocar o produto, mudar ambiente, adicionar/remover elementos, dramatizar cores, aplicar efeitos especiais.
A imagem final deve ser reconhecidamente a MESMA cena — apenas mais clara, nítida e tecnicamente melhorada.`);
  }
  if (refs.produtos && refs.produtos.length) {
    const lista = refs.produtos.map((p) => `Produto ${p.num}`).join(", ");
    // Versão curta — o texto completo (nitidez, contenção do conteúdo dentro
    // da tela, proibição de vazar pra carcaça/verso) já vive em
    // screenContentClause (src/utils/promptRules.ts, via buildDeviceRule) que
    // entra no MESMO prompt final; repetir tudo aqui só inchava o prompt sem
    // ganho real (auditoria Opus 4.8 + Fable 5, 2026-07-07 — ajuda a evitar o
    // 422 "string_too_long" do fal.ai em combinações com muitas referências).
    const telaClause = refs.produtoTelaInformativa
      ? " A TELA deste produto exibe conteúdo que É a identidade do produto — reproduza-o com nitidez (ver ⚠ CONTENÇÃO ABSOLUTA DO CONTEÚDO DE TELA no início do prompt)."
      : refs.produtoEhDispositivo
        ? " Este produto É um DISPOSITIVO DIGITAL (tablet, notebook, celular ou monitor) — mantenha a forma reconhecível de dispositivo com tela; PROIBIDO transformá-lo em objeto físico não-digital (pasta, porta-documentos, placa, plaquinha de mesa, caderno, quadro)."
        : "";
    parts.push(
      `PRODUTOS SELECIONADOS (${lista}): elementos principais da composição. Preservar embalagem, formato, cores principais e características físicas. Apresentar de forma integrada à cena, evitando aparência de catálogo técnico ou montagem artificial.${telaClause}`,
    );
    parts.push(
      buildProductHierarchyBlock({
        produtosCount: refs.produtos.length,
        hasCenario: !!refs.cenario,
        hasAvatar: !!refs.avatar,
        segment: segment as Segment | undefined,
        isPersonalBrand,
        faceNotDominant,
        mood,
      }),
    );
    if (refs.produtos.length >= 2) {
      const n = refs.produtos.length;
      parts.push(
        `REGRA DE CONTAGEM — INEGOCIÁVEL: a imagem final DEVE conter EXATAMENTE ${n} produtos visíveis e identificáveis, todos enviados como referência. PROIBIDO omitir, esconder atrás de objetos, cortar fora do quadro ou substituir qualquer um deles. Se o plano aberto não acomodar os ${n}, APROXIME o enquadramento em vez de mostrar um cenário amplo com apenas parte dos produtos.`,
      );
    }
  }
  // Quando há avatar mas NENHUMA referência de ambiente real (cenário,
  // fachada, fato ou venda): suprimir construção de ambiente pelo modelo —
  // sem isso, a edição de imagem tende a reaproveitar/estender o fundo da
  // própria foto do avatar como cenário, ou (em MARCA) inventar um ambiente
  // de "estilo de vida" para ilustrar o segmento. Antes essa trava também
  // desligava quando havia produto selecionado, deixando o caso avatar+produto
  // sem cenário sem nenhuma instrução de fundo.
  const hasAmbienteRef = !!(refs.cenario || refs.fachada || refs.fato || refs.venda);
  if (refs.avatar && !hasAmbienteRef) {
    const temProduto = !!(refs.produtos && refs.produtos.length);
    parts.push(
      `FUNDO NEUTRO OBRIGATÓRIO: nenhuma imagem de cenário foi enviada como referência. ` +
        `Usar FUNDO LIMPO, SUAVE e DESFOCADO: bokeh suave, gradiente neutro, textura vaga ou superfície indefinida atrás do avatar${temProduto ? " e do produto" : ""}. ` +
        `NÃO construir ambiente físico específico, sala, escritório, local identificável ou cenário de "estilo de vida" como fundo — mesmo que outras partes deste prompt mencionem contexto, atividade ou segmento.` +
        `${temProduto ? " O produto continua nítido e em destaque conforme a regra de protagonismo acima — apenas o ambiente ao redor fica neutro." : ""} ` +
        `NEGATIVE: detailed background, specific room interior, identifiable location behind person, lifestyle environment, sharp background, busy background, office furniture behind subject.`,
    );
  }
  parts.push(
    `INTEGRAÇÃO: combinar os elementos de forma natural, elegante e coerente — adapte iluminação, profundidade e atmosfera ao mood. Resultado deve parecer campanha visual profissional, não colagem.`,
  );
  // Reforço final repetido como ÚLTIMA linha do bloco de referências — modelos
  // de imagem tendem a dar mais peso à instrução mais recente em prompts longos.
  if (refs.produtos && refs.produtos.length >= 2) {
    parts.push(buildUltimaVerificacaoBlock(refs.produtos.length));
  }
  return parts.join("\n\n");
}
