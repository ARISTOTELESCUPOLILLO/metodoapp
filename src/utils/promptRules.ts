// Regras globais de composição — definidas aqui uma única vez e importadas por
// buildImagePrompt (api.ts) e buildPostUnicoPrompt (postUnico.ts).
// Garante consistência entre os dois sistemas e evita versões divergentes do mesmo bloco.

export const DEVICE_RULE = `⚠ DISPOSITIVOS DIGITAIS — REGRA GLOBAL INVIOLÁVEL: PROIBIDO qualquer tela visível com conteúdo em notebook, laptop, tablet, iPad, celular, iPhone, monitor ou qualquer dispositivo — tela frontal ou traseira. CONTEÚDO PROIBIDO: gráfico, dashboard, imagem, interface, app, texto legível. DISPOSITIVO PERMITIDO APENAS COMO OBJETO: fechado, de lado, de costas, desfocado ou com tela apagada/neutra. MÁXIMO 1 DISPOSITIVO por cena — duplicação proibida. NEGATIVE: no visible screen content, no laptop screen facing viewer, no charts on screen, no dashboard, no UI, no app interface, no readable text on devices, no duplicated devices, screen must be blank dark off or out of focus.`;

export const AMBIENTES_RULE = `⚠ AMBIENTES VISUAIS: PROIBIDO paredes de concreto aparente, galpões industriais, estruturas arquitetônicas frias, corredores vazios como elemento dominante ou fundo para tipografia. Use fundos coloridos, texturas orgânicas, desfoque, gradiente ou fotografia quente. PROIBIDO TAMBÉM: formas geométricas abstratas flutuando (círculos, esferas, polígonos, espirais) sem propósito narrativo. A composição deve ter TEMA CONCRETO — humano, objeto real, natureza, tipografia ou cenário com sentido.`;

export const HUMANIZACAO_RULE = `⚠ HUMANIZAÇÃO: imagens devem parecer humanas, autênticas e reais. PROIBIDO inserir vasos, plantas ornamentais, folhas ou flores apenas para preencher cantos — todo elemento deve contribuir para a mensagem.`;

export const FORBIDDEN_MOOD_WORDS = `PALAVRAS PROIBIDAS NA IMAGEM: NUNCA escreva, desenhe ou renderize como texto/lettering/título/etiqueta, em nenhum lugar da peça, as palavras CLAREZA, IMPACTO, INSTANTE, FRAGMENTO, DESVIO, SILÊNCIO, MOOD, OP-01, OP-02, OP-03, OP-04, OP-05, OP-06 — são códigos internos do sistema e nunca devem aparecer na arte final.`;
