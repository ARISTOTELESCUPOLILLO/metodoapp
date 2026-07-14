// Instruções de estilo visual por mood — extraído de services/api.ts
// (PLANO_V2 Fase 9.1). Movido 1:1, sem mudança de comportamento.
import { MoodCode } from "../../types";

export const moodVisualInstructions: Record<MoodCode, string> = {
  "OP-01": `ESTILO VISUAL (raiz: Renascentista):
- Composição organizada por alinhamento ortogonal (grid invisível) — fundo contínuo de borda a borda, SEM dividir a peça em blocos, faixas ou painéis de cor
- Título alinhado à ESQUERDA, em CAIXA ALTA bold
- Texto de apoio como SUBTÍTULO DE REVISTA logo abaixo do título — corpo entre 55% e 70% do título, legível sem zoom, alinhado à esquerda; nunca tamanho de legenda
- Luz natural equilibrada, composição simétrica
- Fundo limpo, sem elementos decorativos desnecessários
- Paleta fria e controlada, cor de destaque apenas no elemento-chave`,

  "OP-02": `ESTILO VISUAL (raiz: Barroco):
- Fundo muito escuro, contraste extremo
- Imagem com iluminação dramática, luz focal sobre o elemento principal
- Texto em cor quente de destaque (amarelo ou laranja)
- Título CENTRALIZADO, bold, dominando o terço superior
- Assinatura da marca pequena e direta no rodapé
- Composição assimétrica com tensão visual intencional
- Sombras profundas, luz e sombra como protagonistas`,

  "OP-03": `ESTILO VISUAL (raiz: Impressionista):
- Foto de bastidor ou cena cotidiana capturada ao vivo
- Filtro quente e orgânico, luz ambiente natural sem estúdio
- Título sobreposto à imagem em posição LIVRE e informal, sem alinhamento rígido
- Sem simetria rígida, sem moldura formal
- Sensação de captura espontânea, autêntica
- Cores vibrantes e quentes, textura visível`,

  "OP-04": `ESTILO VISUAL (raiz: Cubista):
- Post-colagem com 3 a 5 blocos visuais distintos
- Cada bloco carrega uma informação ou ângulo diferente
- Título sobreposto à composição em posição LIVRE e informal, sem ficar preso a um bloco de cor — pode ancorar sobre a grade modular, tratado como tipografia livre e não como um dos blocos de conteúdo; mantenha-o legível e fora do canto inferior direito (reservado para a assinatura)
- Texto de apoio posicionado no centro ou terço superior, longe do canto inferior direito
- Grid visível ou implícito organizando os fragmentos
- Paleta controlada unificando os blocos
- O canto inferior direito deve permanecer SEMPRE limpo e livre de texto, reservado para assinatura`,

  "OP-05": `ESTILO VISUAL (raiz: Surrealista):
- Imagem-conceito com elemento inesperado ou metáfora visual
- Composição ousada que provoca estranhamento controlado
- Título DESLOCADO e assimétrico — fora do centro, quebrando o equilíbrio esperado
- ELEMENTO INESPERADO — ESCALA E PESO VISUAL: o objeto ou forma inusitado é COADJUVANTE EXPRESSIVO da mensagem — deve ocupar área visual significativa na composição (não um detalhe periférico ou diminuto), grande o suficiente para chamar atenção à primeira vista e orientar o olhar, harmônico com o conjunto e sem dominar o sujeito principal. PROIBIDO: reduzir o elemento surreal a detalhe sutil, pequeno ou escondido na periferia da peça.
- Paleta incomum mas legível — combinações: verde frio + magenta, azul profundo + ferrugem, lilás seco + mostarda, petróleo + coral queimado, vinho + azul elétrico suave — evitar excesso carnavalesco
- Sombras presentes mas LEVES — o rosto e a cabeça das pessoas NUNCA podem ficar encobertos por escurecimento
- Iluminação equilibrada: o elemento surreal não pode obscurecer o sujeito principal`,

  "OP-06": `ESTILO VISUAL (raiz: Minimalista):
- Fundo de paleta suave (areia, off-white, cinza quente, bege rosado, verde sálvia claro, azul névoa, taupe, marfim envelhecido) — evitar branco puro dominante; espaço vazio como elemento principal
- Título alinhado à DIREITA, ocupando a metade direita do quadro, fonte tipográfica como protagonista, com muito respiro ao redor. A metade DIREITA permanece livre de outros elementos — nenhuma pessoa, produto ou equipamento aparece sob ou atrás do título
- PROIBIDO concentrar o título espremido na base do quadro, colado imediatamente acima da zona da logomarca (canto inferior direito) — mantenha respiro generoso entre o título e essa zona, e distribua o peso vertical da composição de forma equilibrada (nunca tudo embaixo com o topo da metade direita vazio)
- Detalhe mínimo de cor como assinatura
- Composição com muito respiro, elementos reduzidos ao essencial
- Sensação de premium, contenção e autoridade`,
};
