import { createFileRoute } from "@tanstack/react-router";
import {
  truncateWords,
  validatePieceFields,
  correctPortugueseSpelling,
  TECNICISMO_RULE,
} from "@/core/textValidation";
import { getVoiceProfile } from "@/data/brandVoice";
import {
  resolveEffectiveUser,
  checkBalance,
  checkRateLimit,
  balanceFailMessage,
  debitUsage,
} from "@/lib/usage.server";
import { isAdmin as checkIsAdmin } from "@/repository/authz";
import { hasBetaIntencao } from "@/repository/betaFlags";
import {
  buildIntencaoBlock,
  buildIntencaoRegraOferta,
  parseIntencao,
  parseTransformacao,
} from "@/core/intencao";
import { COST_USD } from "@/lib/costs";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";
import { FAIXA_ETARIA_REGISTRO } from "@/core/audienceAge";
import type { FaixaEtaria, TransformacaoPretendida } from "@/types";
import { OBJETIVO_TOM } from "@/domain/objetivo.config";
import { isOfertaConcreta } from "@/core/ofertaDetection";
import {
  TOPICO_MAX_WORDS,
  TOPICOS_COUNT,
  TOPICO_ICON_VOCAB,
  validateTopico,
  finalizeTopicoTexto,
  normalizeTopicoIcone,
} from "@/core/topicoValidation";

// Objetivos que aceitam o formato alternativo "topicos" (3 tópicos com ícone
// no lugar do texto de apoio corrido) — mesmo conjunto documentado em
// PostUnicoFormatoTexto (types.ts).
const OBJETIVOS_TOPICOS = new Set(["institucional", "oportunidade", "promocao", "venda"]);

const OBJETIVO_INTENCAO: Record<string, string> = {
  institucional:
    "Construa confiança, presença e identidade. Mostre como a empresa atua, cuida ou se posiciona. Evite promessa comercial, urgência e frase grandiosa.",
  promocao:
    "Gere desejo e movimento comercial. Destaque produto, benefício ou condição de forma simples e atrativa. Sem inventar preço, desconto ou prazo não informado.",
  oportunidade:
    "Mostre chance, momento favorável ou próximo passo concreto. Sem urgência falsa, clichê motivacional ou promessa de futuro garantido.",
  aviso:
    "Informe com objetividade e leitura rápida. Sem dramatização, suspense ou excesso de gentileza que esconda a informação.",
  homenagem:
    "Reconheça, valorize ou celebre com humanidade e simplicidade. Sem clichê sentimental, frase de calendário ou emoção forçada.",
  fatos:
    "Registre o que aconteceu com fidelidade e objetividade. Sem dramatizar, inventar emoção ou transformar em campanha.",
  nenhum:
    "Seja útil para comunicação de negócio, marca, produto ou serviço. Evite frase decorativa, motivacional genérica ou texto sem função mercadológica.",
};

export const Route = createFileRoute("/api/generate-pu-copy")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const companyName = String(body.companyName || "").slice(0, 200);
          const mainActivity = String(body.mainActivity || "").slice(0, 300);
          const objetivo = String(body.objetivo || "promocao");
          const keyInfo = String(body.keyInfo || "").slice(0, 1000);
          const brandVoice = String(body.brandVoice || "").slice(0, 80);
          const segment = String(body.segment || "").slice(0, 30);
          const audience: "B2C" | "B2B" = body.audience === "B2B" ? "B2B" : "B2C";
          const faixaEtariaRaw = body.faixaEtaria;
          const faixaEtaria: FaixaEtaria | null =
            faixaEtariaRaw === "18-34" || faixaEtariaRaw === "35-49" || faixaEtariaRaw === "50-65"
              ? faixaEtariaRaw
              : null;
          // "topicos" só é honrado nos objetivos que aceitam o formato — fora
          // deles, cai em silêncio pro modo corrido de sempre (mesmo padrão
          // de "objetivo desconhecido → promocao" logo acima).
          const wantsTopicos = body.formatoTexto === "topicos" && OBJETIVOS_TOPICOS.has(objetivo);
          // Presente só quando o cliente pede "gerar outros tópicos" mantendo
          // o título já escolhido (ver regenTopicos em usePostUnicoCopy.ts) —
          // mesmo princípio do bloco TÍTULO FIXO já usado em regenerate-block.ts.
          const tituloFixo = wantsTopicos ? String(body.tituloFixo || "").trim() || null : null;
          // Tópicos já mostrados na tela, enviados só no "Gerar outros tópicos"
          // — usados como lista de "não repita" (ver naoRepetirBlock abaixo).
          const topicosAtuais: string[] = Array.isArray(body.topicosAtuais)
            ? body.topicosAtuais
                .map((t: unknown) =>
                  String(t || "")
                    .trim()
                    .slice(0, 200),
                )
                .filter(Boolean)
                .slice(0, TOPICOS_COUNT)
            : [];
          // Modo AJUSTADO (PU objetivo=promocao + informação-chave descreve
          // oferta/promoção concreta): título vira manchete de até 9 palavras
          // fiel ao que foi escrito, sem buscar ângulo diferente — decisão
          // travada com o Ari 15/07/2026 (ver memória
          // project-mic-equalizacao-keyinfo-2026-07-15). tituloFixo já pula a
          // geração de título (regen só de tópicos), então não entra aqui.
          const ajustePromocional =
            !tituloFixo && objetivo === "promocao" && isOfertaConcreta(keyInfo);
          const TITULO_MAX_WORDS_AJUSTADO = 9;

          if (!keyInfo.trim()) {
            return Response.json({ error: "keyInfo obrigatório" }, { status: 400 });
          }

          const apiKey = process.env.OPENAI_API_KEY_CONTENT;
          if (!apiKey) {
            return Response.json(
              { error: "OPENAI_API_KEY_CONTENT não configurada" },
              { status: 500 },
            );
          }

          const effective = await resolveEffectiveUser(request);
          if (!effective) {
            return Response.json({ error: "Não autenticado" }, { status: 401 });
          }
          const userId = effective.userId;
          if (!effective.impersonatedBy) {
            const rate = await checkRateLimit(userId);
            if (!rate.ok) {
              return Response.json(
                {
                  error:
                    "Limite de 15 gerações por hora atingido. Aguarde antes de tentar novamente.",
                },
                { status: 429 },
              );
            }
          }
          const preferredSlot = ["plano1", "plano2", "bonus"].includes(body.preferredSlot)
            ? (body.preferredSlot as "plano1" | "plano2" | "bonus")
            : undefined;
          const isAdminUser = await checkIsAdmin(userId);

          // GATE DE BACKEND da intenção declarada — obrigatório. O gate de
          // interface não basta: sem esta reconferência, um usuário fora do
          // beta pode gerar com um campo que não vê (cache antigo, aba aberta
          // há dois dias, deploy no meio do uso) e a saída dele muda sem
          // explicação possível. A flag só é consultada quando o cliente
          // realmente mandou o campo — quem está fora não paga query nenhuma.
          const intencao =
            body.intencao && (await hasBetaIntencao(userId)) ? parseIntencao(body.intencao) : null;
          const transformacaoPrincipal = intencao
            ? parseTransformacao(body.transformacaoPrincipal)
            : null;
          // Secundárias e aviso ignorado NÃO entram no prompt — são só
          // instrumentação do piloto (ver payload do debitUsage no fim). Apenas
          // a transformação PRINCIPAL alimenta a medição futura; as secundárias
          // existem para não amputar o cliente sem estragar o denominador.
          const secundariasRaw: unknown[] = Array.isArray(body.transformacoesSecundarias)
            ? body.transformacoesSecundarias
            : [];
          const transformacoesSecundarias: TransformacaoPretendida[] = intencao
            ? secundariasRaw
                .map(parseTransformacao)
                .filter((t): t is TransformacaoPretendida => !!t)
                .slice(0, 2)
            : [];
          const avisoCoerenciaIgnorado = intencao ? body.avisoCoerenciaIgnorado === true : false;
          // Bloco de instrumentação — só existe quando há intenção, para não
          // sujar o payload de toda geração fora do piloto.
          const intencaoPayload = intencao
            ? {
                intencao,
                transformacao_principal: transformacaoPrincipal,
                transformacao_secundaria: transformacoesSecundarias,
                // Na Fase 1 não existe sugestão de intenção por IA — o campo é
                // sempre preenchido pelo usuário. O valor já é gravado para não
                // migrar dado quando a sugestão existir.
                intencao_origem: "usuario" as const,
                aviso_coerencia_ignorado: avisoCoerenciaIgnorado,
                // Natureza do negócio = segmento do Kit de Marca (não há coluna
                // nova). Guardado junto porque o kit pode mudar depois.
                natureza: segment || null,
              }
            : null;

          if (tituloFixo) {
            // "Gerar outros tópicos" é uma REGENERAÇÃO (título já existe, só
            // troca os tópicos) — mesmo tratamento de billing do "Gerar outro
            // texto/título" (regenerate-block.ts): unidade regenTexto, SEM o
            // gate geral de geracoes:1 nem o de "Primeira Geração" (evitaria
            // cobrar 2x pelo mesmo post — o clique inicial já debitou).
            if (!isAdminUser) {
              const balRegen = await checkBalance(userId, 0, 0, 0, preferredSlot, {
                regenTexto: 1,
              });
              if (!balRegen.ok) {
                return Response.json(
                  { error: balanceFailMessage(balRegen.reason) },
                  { status: 402 },
                );
              }
            }
          } else {
            // Gate PRINCIPAL existente (geracoes:1) — intocado, mesma checagem
            // "qualquer slot" de antes (sem preferredSlot).
            const bal = await checkBalance(userId, 0, 0, 1);
            if (!bal.ok) {
              return Response.json({ error: balanceFailMessage(bal.reason) }, { status: 402 });
            }

            // Camada ADICIONAL: "Primeira Geração" (título+texto desta chamada —
            // 1 clique = 1 unidade, a legenda tem seu próprio fluxo em
            // generate-caption.ts). Chamada SEPARADA da checagem acima pra não
            // alterar o comportamento existente (que nunca teve preferredSlot).
            // Isenta para admin.
            if (!isAdminUser) {
              const balPrimeira = await checkBalance(userId, 0, 0, 0, preferredSlot, {
                primeiraGeracao: 1,
              });
              if (!balPrimeira.ok) {
                return Response.json(
                  { error: balanceFailMessage(balPrimeira.reason) },
                  { status: 402 },
                );
              }
            }
          }

          const tom = OBJETIVO_TOM[objetivo as keyof typeof OBJETIVO_TOM] ?? OBJETIVO_TOM.promocao;
          const voiceProfile = getVoiceProfile(brandVoice);
          const voiceBlock = voiceProfile
            ? `DIREÇÃO DE VOZ — "${voiceProfile.label}":
- Ritmo: ${voiceProfile.ritmo}
- Vocabulário: ${voiceProfile.vocabulario}
- Registro: ${voiceProfile.registro}
- Evitar: ${voiceProfile.evitar}
- Calibração de abertura (referência interna, NÃO copiar literalmente): "${voiceProfile.exemploAbertura}"
Quando houver conflito entre tom do objetivo e direção de voz, PREVALECE a voz; o objetivo modula apenas a intenção comercial.
Proibido mencionar literalmente o nome da voz no texto final.
`
            : "";

          const segmentLabel: Record<string, string> = {
            VAREJO: "Varejo — comercialização de produtos ao consumidor final",
            MARCA: "Marca — construção de identidade e posicionamento",
            SERVIÇOS: "Serviços — prestação de serviços especializados",
          };
          const segmentBlock = segment
            ? `SEGMENTO: ${segmentLabel[segment] || segment} — adapte vocabulário, estilo e apelo do texto ao perfil deste tipo de negócio.\n`
            : "";

          const audienceBlock =
            audience === "B2B"
              ? 'PÚBLICO-ALVO: EMPRESARIAL (B2B). Fale com o dono, sócio ou responsável pelo negócio. Foco em resultado de trabalho concreto (prazo, equipe, custo, atendimento, volume). PROIBIDO: "gestores", "decisores", "receita previsível", "riscos operacionais", "maximizar", linguagem de grande consultoria. O título ancora no produto/serviço, nunca no papel do comprador.\n'
              : 'PÚBLICO-ALVO: CONSUMIDOR FINAL (B2C). Fale com a pessoa que usa o produto/serviço na própria vida. PROIBIDO usar "gestor", "empresa", "equipe" como interlocutor.\n';

          const faixaBlock = faixaEtaria ? `${FAIXA_ETARIA_REGISTRO[faixaEtaria]}\n` : "";

          // String VAZIA quando não há intenção (retorno antecipado dentro do
          // builder) — o prompt de quem está fora do beta fica idêntico ao de
          // hoje, byte a byte. A "natureza do negócio" que decide COMO a
          // percepção se constrói é o `segment` que o Kit de Marca já grava.
          const intencaoBlock = buildIntencaoBlock({
            intencao,
            transformacaoPrincipal,
            segment,
          });
          // O alvo perceptual precisa ser dito DE NOVO dentro do bloco de regras
          // quando o modo AJUSTADO está ligado — lá o bloco de regras do título é
          // trocado por "não busque ângulo diferente / preserve o preço", e a
          // ordem mais concreta e mais próxima do fim vencia o alvo que ficou no
          // contexto. Ver a nota de buildIntencaoRegraOferta para a prova (teste
          // cego de 16/08, par do capacete). Vazia fora do modo AJUSTADO e vazia
          // sem intenção — nos dois casos o prompt fica idêntico ao de hoje.
          const intencaoRegraOferta = ajustePromocional
            ? buildIntencaoRegraOferta({
                intencao,
                transformacaoPrincipal,
                segment,
                apoio: wantsTopicos ? "topicos" : "texto",
              })
            : "";

          const topicIconList = TOPICO_ICON_VOCAB.join(", ");
          const topicosSchemaLines = `  "topicos": [
    { "texto": "texto do tópico 1, no MÁXIMO ${TOPICO_MAX_WORDS} palavras", "icone": "um destes: ${topicIconList}" },
    { "texto": "texto do tópico 2, mesmas regras", "icone": "..." },
    { "texto": "texto do tópico 3, mesmas regras", "icone": "..." }
  ]`;
          // Descrição do "titulo" no schema JSON — ramifica no modo AJUSTADO
          // (ver ajustePromocional acima): teto de 9 palavras (preço = 1
          // token) em vez de 6, sem exigência de sílaba (manchete de oferta
          // prioriza os dados concretos, não compactação silábica).
          const tituloSchemaDesc = ajustePromocional
            ? `título de OFERTA/PROMOÇÃO, reescrevendo a informação-chave como manchete publicitária clara, no MÁXIMO ${TITULO_MAX_WORDS_AJUSTADO} palavras (um valor monetário como "R$ 120,00" conta como 1 palavra — CONTE antes de retornar), em português brasileiro`
            : `título curto, no MÁXIMO 6 palavras, cada palavra com no máximo 4 sílabas (exceto o substantivo concreto central da informação-chave, se houver — limitado a 5 sílabas, nunca mais), impactante, em português brasileiro`;
          const schemaBlock = tituloFixo
            ? `Retorne JSON com EXATAMENTE este formato (o TÍTULO já está definido e fixo — NÃO o gere de novo, retorne APENAS os tópicos):
{
${topicosSchemaLines}
}`
            : wantsTopicos
              ? `Retorne JSON com EXATAMENTE este formato:
{
  "titulo": "${tituloSchemaDesc}",
${topicosSchemaLines}
}`
              : `Retorne JSON com EXATAMENTE este formato:
{
  "titulo": "${tituloSchemaDesc}",
  "texto": "texto de apoio curto, no MÁXIMO 14 palavras (CONTE antes de retornar), complementa o título sem repetir, em português brasileiro"
}`;
          const tituloRulesBlock = tituloFixo
            ? `- ⚠ TÍTULO FIXO (DEFINIDO PELO USUÁRIO): o título FINAL desta peça é exatamente "${tituloFixo}" — ele pode ter sido escrito ou editado à mão pelo usuário depois da primeira geração. NÃO o reescreva, NÃO gere um título novo: gere APENAS os tópicos. Ele é a ÂNCORA DE SENTIDO dos tópicos abaixo.`
            : ajustePromocional
              ? `- "titulo" no máximo ${TITULO_MAX_WORDS_AJUSTADO} palavras (um valor monetário como "R$ 120,00" conta como 1 palavra — CONTE antes de retornar), sem ponto final, sem aspas, sem emoji, sem hashtag. EXCEÇÃO OBRIGATÓRIA: se o título for uma pergunta (direta ou retórica), terminar com "?" — NUNCA omitir.`
              : `- "titulo" no máximo 6 palavras, cada palavra com no máximo 4 sílabas (ex.: "resultado" 4 sílabas ✓, "comunicação" 5 sílabas ✗ — use "contato", "presença"), sem ponto final, sem aspas, sem emoji, sem hashtag. EXCEÇÃO AO LIMITE DE SÍLABAS (restrita): se a informação-chave contém um substantivo concreto central (produto, peça, serviço, objeto ou procedimento — ex.: "equipamento", "manutenção", "orçamento", "diagnóstico", "estratégia"), esse termo pode ter NO MÁXIMO 5 sílabas — nunca mais — quando for essencial para a clareza do título; não o troque por uma palavra genérica só para encurtar, mas termos com 6+ sílabas devem ser trocados por sinônimo mais curto. EXCEÇÃO OBRIGATÓRIA: se o título for uma pergunta (direta ou retórica), terminar com "?" — NUNCA omitir. Ex.: "Por que é assim?" ✓, "O que está faltando?" ✓`;
          // POSIÇÃO IMPORTA (achado real 22/07/2026, Ari): não bastou declarar
          // a coerência no meio das regras. No modo tituloFixo o bloco de
          // CONTEXTO terminava na INFORMAÇÃO-CHAVE — o material da PRIMEIRA
          // geração ficava no ponto de maior saliência do prompt, entre aspas,
          // enquanto o título novo (editado à mão) aparecia lá embaixo, no meio
          // de ~15 regras. Resultado: parte dos tópicos seguia o título e algum
          // deles escorregava de volta para a informação-chave antiga. O título
          // agora fecha o bloco de contexto, com a informação-chave rebaixada
          // explicitamente a material de origem possivelmente desatualizado.
          const tituloAncoraContexto = tituloFixo
            ? `TÍTULO FINAL DA PEÇA (JÁ DEFINIDO PELO USUÁRIO — NÃO REESCREVER): "${tituloFixo}"
⚠ PRECEDÊNCIA: a INFORMAÇÃO-CHAVE acima é o material de origem da PRIMEIRA geração e pode estar DESATUALIZADA — o usuário pode ter reescrito o título depois dela. Em qualquer divergência entre os dois, vale o TÍTULO. Os ${TOPICOS_COUNT} tópicos apoiam o TÍTULO; a informação-chave serve só como fonte de dados concretos (item, preço, prazo, condição, canal) que NÃO contradigam o título.
`
            : "";
          // "Gerar outros tópicos" precisa entregar tópicos DIFERENTES. Os
          // tópicos atuais não eram enviados, então o modelo — partindo do mesmo
          // título e da mesma informação-chave — reconstruía frases quase iguais
          // às que já estavam na tela (queixa real: "veio texto do tópico
          // anterior"). Listá-los como material a NÃO repetir é a única forma de
          // o modelo saber o que já foi entregue.
          const naoRepetirBlock =
            tituloFixo && topicosAtuais.length
              ? `\nTÓPICOS JÁ ENTREGUES NESTA PEÇA (o usuário pediu OUTROS — NÃO os repita):
${topicosAtuais.map((t, i) => `${i + 1}. ${t}`).join("\n")}
⚠ Os ${TOPICOS_COUNT} tópicos novos precisam trazer ângulo, benefício ou informação DIFERENTE dos acima — não vale reescrever os mesmos com sinônimos ou ordem trocada. Continuam valendo o título e a precedência declarados acima.
`
              : "";
          const textoOuTopicosRulesBlock = wantsTopicos
            ? `- Cada "texto" dos ${TOPICOS_COUNT} tópicos: no máximo ${TOPICO_MAX_WORDS} palavras (CONTE antes de retornar), frase direta e concreta — um ângulo, benefício ou ponto DIFERENTE em cada tópico, sem repetir a mesma ideia com palavras trocadas entre eles, sem hashtag, sem emoji, sem numeração própria (não escreva "1.", "Tópico 1" etc.).
- Cada "icone" DEVE ser EXATAMENTE um destes termos, copiado literalmente (não traduza, não invente outro): ${topicIconList}. Escolha o mais coerente com o conteúdo de cada tópico; varie entre os ${TOPICOS_COUNT} quando fizer sentido, sem repetir o mesmo ícone à toa.`
            : `- "texto" no máximo 14 palavras (CONTE antes de retornar — 15ª palavra em diante é cortada), frase completa terminando com PONTO FINAL obrigatório, sem hashtag, sem emoji`;

          const userPrompt = `${
            tituloFixo
              ? "Você cria APENAS os tópicos de apoio que aparecerão TIPOGRAFADOS dentro de uma peça publicitária para Instagram. O TÍTULO desta peça JÁ ESTÁ DEFINIDO (ver abaixo) e não deve ser gerado nem reescrito."
              : `Você cria o título ${wantsTopicos ? "e os tópicos de apoio" : "e o texto de apoio"} que aparecerão TIPOGRAFADOS dentro de uma peça publicitária para Instagram.`
          }

EMPRESA: ${companyName}
ATIVIDADE: ${mainActivity}
${segmentBlock}${audienceBlock}${faixaBlock}${voiceBlock}OBJETIVO: ${objetivo} (tom: ${tom})
${OBJETIVO_INTENCAO[objetivo] ? `INTENÇÃO: ${OBJETIVO_INTENCAO[objetivo]}\n` : ""}${intencaoBlock}INFORMAÇÃO-CHAVE: "${keyInfo.trim()}"
${tituloAncoraContexto}${naoRepetirBlock}
${schemaBlock}

Regras:
${tituloRulesBlock}
${textoOuTopicosRulesBlock}
- Português brasileiro, sem inglês, sem markdown
${TECNICISMO_RULE}
- Linguagem simples, natural e profissional. Ensino médio deve entender sem esforço. Evite "maximizar", "estratégias eficazes", "impacto real", "soluções digitais", "transformar seu negócio". Prefira: "melhorar", "vender", "organizar", "atender", "crescer", "mostrar".
${
  tituloFixo
    ? // Achado real 22/07/2026 (Ari, PU Promoção com oferta concreta, título
      // 9/9 editado à mão): com tituloFixo este bloco inteiro virava STRING
      // VAZIA — sumia justamente "Título e tópicos reforçam a MESMA oferta" e
      // a ANCORAGEM CONCRETA. Sobrava só "não gere título novo", que é uma
      // instrução de NÃO-GERAÇÃO, não de COERÊNCIA: os tópicos novos eram
      // derivados da informação-chave e ignoravam a edição manual do título.
      // Mesmo princípio do tituloAncoraBlock de regenerate-block.ts, que já
      // resolvia isso no modo TEXTO CORRIDO — o modo TÓPICOS ficou de fora.
      `- ⚠ COERÊNCIA COM O TÍTULO FIXO — REGRA PRINCIPAL DESTA GERAÇÃO: os ${TOPICOS_COUNT} tópicos são o APOIO deste título e precisam sustentar a MESMA mensagem que ele afirma, exatamente como está escrito. Cada tópico desenvolve, comprova ou detalha algo que o título promete — nenhum tópico abre ângulo paralelo, tema novo ou oferta diferente da anunciada no título.
- O TÍTULO PREVALECE SOBRE A INFORMAÇÃO-CHAVE: se o título acima apontar para direção diferente da que a informação-chave descreve, siga o TÍTULO — ele é a decisão final do usuário. A informação-chave serve só como fonte de dados concretos (item, preço, prazo, condição de pagamento, canal) que NÃO contradigam o título.
- PRESERVAÇÃO DOS DADOS CONCRETOS: quando a informação-chave traz preço, desconto, prazo ou condição, mantenha-os fiéis nos tópicos — sem inventar valor, prazo, parcelamento ou condição que não estejam lá, e sem omitir os que sustentam o que o título promete.`
    : ajustePromocional
      ? `- Este título é uma OFERTA/PROMOÇÃO concreta: item, preço, prazo e condição de pagamento citados na informação-chave são OBRIGATÓRIOS no título e vêm literais (troque por sinônimo direto só se for estritamente necessário para caber no limite de palavras). Não é hora de buscar um ângulo que fuja da oferta. PROIBIDO inventar valor, prazo, parcelamento ou condição que não estejam na informação-chave. PROIBIDO omitir o preço/condição citados só para "soar mais criativo".
- ⚠ COMPOR, NÃO TRANSCREVER — REGRA QUE DECIDE ESTE TÍTULO: os dados acima são o MATERIAL da manchete, nunca a frase pronta. PROIBIDO devolver a informação-chave na mesma ordem e com as mesmas palavras acrescentando um fecho no fim ou uma chamada no começo — trocar o fecho por outro ("aproveite hoje", "chegou agora", "confira já", "não perca") não resolve nada: o defeito é a transcrição, não a palavra colada. PROIBIDO TAMBÉM apenas embaralhar os mesmos elementos: trocar a ordem e acrescentar um adjetivo continua sendo a mesma frase de vitrine.
- ⚠ O TÍTULO PRECISA AFIRMAR ALGO — TESTE OBRIGATÓRIO ANTES DE RESPONDER: o título tem VERBO e diz alguma coisa sobre a oferta? Nomear o produto e pendurar o preço ao lado não é manchete, é etiqueta — não afirma nada, e nada do que a peça pretende provocar em quem vê se constrói a partir de uma etiqueta. Afirme: o que a oferta resolve, o que ela permite, o que ela protege, o que ela garante.
- O QUE É OBRIGATÓRIO E O QUE NÃO É: obrigatórios são item, preço, prazo e condição de pagamento. Público-alvo, adjetivos e complementos que aparecem na informação-chave NÃO são obrigatórios — deixe de fora o que for preciso para a frase caber e respirar (ex.: em "Capacete para motociclista por R$ 129,00", o "para motociclista" pode sair; o capacete e o preço, não).
- Exemplos, com a informação-chave "Óleo lubrificante 20W50 por R$ 39,90": ✗ "Óleo lubrificante 20W50 por R$ 39,90 confira" (a frase do usuário com uma palavra colada) — ✗ "Seu óleo 20W50 novo por R$ 39,90" (os mesmos elementos embaralhados, sem verbo: etiqueta) — ✓ "R$ 39,90 no óleo que seu motor pede" (mesmos dados obrigatórios, frase com verbo, afirma algo).
- Título e texto/tópicos reforçam a MESMA oferta — não abra um ângulo paralelo que fuja da promoção anunciada no título.${intencaoRegraOferta}`
      : `- O título deve soar natural — evite sintaxe artificial, metáfora confusa ou promessa exagerada.
- SUJEITO DO TÍTULO — LIBERDADE GRAMATICAL: qualquer classe gramatical pode exercer função de sujeito quando substantivada — substantivo (concreto ou abstrato), adjetivo, verbo no infinitivo, advérbio, pronome ou locução (ex.: "Cuidar bem...", "Quem decide...", "Pronto para..."). O título NÃO precisa repetir a estrutura "[item] + [complemento]" da informação-chave — pode assumir outra construção, desde que a ANCORAGEM CONCRETA — PRESERVAÇÃO DO ELEMENTO abaixo seja respeitada. PROIBIDA construção passiva sem agente (ex.: "Entrega sem atraso garantida"). ATENÇÃO — sujeito abstrato + predicado abstrato vira frase vazia: se o sujeito escolhido for abstrato ou um verbo no infinitivo substantivado (ex.: "Responder...", "Cuidar..."), o predicado NÃO pode ser "faz/traz/gera/vira/se torna/transforma [outro abstrato]" (ex.: "Responder faz diferença de verdade" ✗ — nada para fotografar). Troque por ação, agente ou elemento concreto observável (ex.: "Responder rápido resolve o dia do cliente" ✓). PROIBIDO TAMBÉM terminar o título em fechamento abstrato/intercambiável entre qualquer empresa — "decisão certa", "escolha certa", "caminho certo", "confiança", "tranquilidade", "paz de espírito", "rotina resolvida" (e variações). Troque por um ganho de negócio ESPECÍFICO da atividade descrita (ex.: em vez de "...a escolha certa", "...mais clientes voltando").
- ANCORAGEM CONCRETA — ANTI-SÍMBOLO: o título deve poder virar uma FOTO de pessoa(s) real(is) em ação observável (decidir, atender, revisar, fechar, apresentar, entregar). Teste: "dá para fotografar isso sem recorrer a objeto-metáfora ou cenário espacial genérico?" Se a única imagem possível for engrenagem, peão, seta, xadrez, escada, degraus, horizonte vazio, mosquetão ou aperto de mãos → título conceitual demais; reescreva com verbo de ação + agente. Prefira "Time alinhado fecha mais" a "Equipe forte traz bom ganho". PADRÕES PROIBIDOS DE ESTRUTURA: "[abstrato] traz/gera/faz/vira/se torna/transforma [resultado]", "[abstrato] é [abstrato]". Metáforas de jornada ("longe", "avançar", "crescer", "subir") e adjetivos de qualidade ("rápido", "forte", "claro", "sólido") SÃO PERMITIDOS nos títulos — a cena os traduzirá pelo ofício real, não por cenário físico nem propriedade literal.
- ANCORAGEM CONCRETA — PRESERVAÇÃO DO ELEMENTO: se a informação-chave contém um produto, serviço, canal, objeto, procedimento ou situação concreta nomeada, o título OU o texto deve preservar pelo menos um desses elementos — literal ou sinônimo direto —, salvo se isso prejudicar gravemente a naturalidade da frase.
- VIRADA OBRIGATÓRIA: o título NÃO pode ser a informação-chave reescrita com 2-3 palavras trocadas. Encontre um ÂNGULO que a informação-chave não expressa diretamente — um benefício, convite, contraste, pergunta ou observação sobre o elemento concreto preservado acima — em vez de apenas anunciá-lo.
- CICLO DA PALAVRA — O TÍTULO GERA A CENA: este título será a base da imagem da peça; a cena vai responder ao núcleo do título (sujeito + ação ou promessa central). Escreva pensando na AÇÃO ou MOMENTO que o título evoca (alguém fazendo algo), não numa descrição estática do produto/serviço — isso dá à imagem algo concreto para mostrar.`
}
- PROIBIDO ABSOLUTO usar as palavras: "clareza", "impacto", "instante", "fragmento", "desvio", "silêncio", "OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06", "mood". Use sinônimos.
- PROIBIDO repetir a mesma palavra OU qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue — todas proibidas juntas no mesmo texto) em frases próximas ou consecutivas. Use sinônimos ou reformule completamente. Ex. a evitar: "O digital traz mais alcance. Quer mais? Venha saber mais." — correto: "O digital amplia seu alcance. Quer crescer? Conheça nossa solução."
- Respeitar rigorosamente as normas gramaticais e ortográficas do português brasileiro: concordância nominal e verbal, pontuação correta, acentuação gráfica conforme o Acordo Ortográfico vigente. Nenhum erro de gramática, ortografia ou regência será tolerado.
${objetivo === "institucional" ? `- REGRA INSTITUCIONAL — ATEMPORALIDADE OBRIGATÓRIA: a informação-chave pode conter datas ou marcos de lançamento ("a partir de", "disponível em", "começa em" etc.). IGNORE esses elementos completamente — NÃO os mencione no título nem no texto de apoio. Extraia apenas a ESSÊNCIA do serviço, da capacidade ou do posicionamento da empresa. PROIBIDO: datas, urgência, "a partir de", "em breve", "lançamento", "novo serviço". OBRIGATÓRIO: atemporalidade, autoridade de marca, posicionamento sóbrio.` : ""}
${objetivo === "homenagem" ? `- REGRA HOMENAGEM — DATAS SÃO CONTEXTO, NÃO URGÊNCIA: se a informação-chave contiver datas, use-as apenas para situar a conquista ou o evento celebrado — NUNCA como gatilho de urgência, chamada para ação temporal ou linguagem de lançamento. PROIBIDO: "não perca", "somente até", "a partir de", "já disponível", urgência qualquer. O copy celebra com emoção e respeito — não pressiona.` : ""}
${tituloFixo || ajustePromocional ? "" : `- REGRA DE URGÊNCIA NO TÍTULO (só para "titulo", não para "texto"/"topicos"): PROIBIDO urgência temporal clichê — "hoje", "agora", "já", "última chance", "corra" (e variações), em qualquer objetivo. O título expressa valor, produto ou contexto favorável — nunca depende de urgência.`}`;

          const result = await fetchOpenAIChat(apiKey, {
            model: "gpt-4.1",
            messages: [
              {
                role: "system",
                content:
                  'Você é diretor de criação publicitário brasileiro. Escreva com gramática e ortografia impecáveis conforme as normas do português brasileiro. Responda SEMPRE com JSON válido. Prefira sempre a palavra mais simples: "ganho" em vez de "resultado percebido", "melhorar" em vez de "otimizar", "vender" em vez de "converter". Antes de retornar: título soa natural? texto é claro para ensino médio? algum termo reservado (clareza/impacto/instante/fragmento/desvio/silêncio) apareceu? Se sim, reescreva.',
              },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.95,
            response_format: { type: "json_object" },
          });

          if (!result.ok) {
            return Response.json({ error: result.error }, { status: result.status });
          }
          const content = result.data.choices?.[0]?.message?.content;
          if (!content) return Response.json({ error: "Resposta vazia" }, { status: 502 });

          let parsed: {
            titulo?: string;
            texto?: string;
            topicos?: { texto?: string; icone?: string }[];
          };
          try {
            parsed = JSON.parse(content);
          } catch {
            return Response.json({ error: "JSON inválido" }, { status: 502 });
          }

          // Não debita aqui — o rascunho de copy pode ser regenerado livremente.
          // A cobrança de 1 geração + custo ocorre só no clique final "Gerar Post
          // Único" (generate-caption.ts), evitando cobrar 2x pelo mesmo post.

          // Título NÃO é truncado aqui — cortar geraria fragmento; fora da
          // faixa de 4-6 palavras (TITULO_MIN_WORDS/TITULO_MAX_WORDS) é flagado
          // por validateTitulo (D1) abaixo e regenerado pelo cliente (E3/E4),
          // igual ao fluxo MOP. Com tituloFixo, o título já veio pronto do
          // cliente (regenerar só tópicos) — não passa pela IA de novo.
          const titulo =
            tituloFixo || correctPortugueseSpelling(String(parsed.titulo || "").trim());
          if (!titulo)
            return Response.json({ error: "Título vazio na resposta da IA" }, { status: 502 });

          let texto = "";
          let topicos: { texto: string; icone: string }[] | undefined;
          let flags: { campo: string; motivo: string }[];
          // ecoKeyInfo só no modo AJUSTADO: é lá que a obrigação de preservar
          // os dados torna a transcrição atraente para o modelo (achado de
          // 17/08 — "Capacete para motociclista por R$129,00 chegou agora").
          // O motivo volta ao prompt de regeneração via autoRegenerate.
          const titleOpts = ajustePromocional
            ? { maxWords: TITULO_MAX_WORDS_AJUSTADO, skipUrgencyCheck: true, ecoKeyInfo: keyInfo }
            : undefined;

          if (wantsTopicos) {
            const rawTopicos = Array.isArray(parsed.topicos) ? parsed.topicos : [];
            topicos = rawTopicos.slice(0, TOPICOS_COUNT).map((t) => ({
              texto: correctPortugueseSpelling(finalizeTopicoTexto(String(t?.texto || ""))),
              icone: normalizeTopicoIcone(String(t?.icone || "")),
            }));
            if (topicos.length !== TOPICOS_COUNT || topicos.some((t) => !t.texto)) {
              return Response.json(
                { error: "Tópicos incompletos na resposta da IA" },
                { status: 502 },
              );
            }
            // D1 — heurísticas pós-geração por tópico, mesmo padrão leve já
            // usado na Sugestão (sem juiz LLM — fora de escopo do v1 deste
            // formato).
            const topicoFlags = topicos.flatMap((t, i) =>
              validateTopico(t.texto).map((motivo) => ({ campo: `copy.topico${i + 1}`, motivo })),
            );
            flags = tituloFixo
              ? topicoFlags
              : [...validatePieceFields("copy", { titulo }, keyInfo, titleOpts), ...topicoFlags];
          } else {
            texto = correctPortugueseSpelling(truncateWords(String(parsed.texto || ""), 14));
            if (!texto)
              return Response.json({ error: "Texto vazio na resposta da IA" }, { status: 502 });
            // Garante ponto final no texto quando a IA esquece.
            if (!/[.!?]$/.test(texto)) texto = texto + ".";
            // D1 — heurísticas pós-geração: não bloqueiam a resposta, mas
            // sinalizam para a orquestração de regeneração no cliente (E3).
            flags = validatePieceFields("copy", { titulo, texto }, keyInfo, titleOpts);
          }

          if (!isAdminUser) {
            try {
              if (tituloFixo) {
                // Regeneração de tópicos — mesma unidade/custo de "Gerar outro
                // texto" (regenerate-block.ts), não "Primeira Geração".
                await debitUsage(userId, 0, 0, {
                  evento: "regenerate_pu_topicos",
                  modulo: "topicos",
                  regenTexto: 1,
                  custoUsd: COST_USD.regen_bloco,
                  impersonatedBy: effective.impersonatedBy,
                  preferredSlot,
                });
              } else {
                // Debita 1 unidade de "Primeira Geração" (camada adicional,
                // nunca para admin). SEM custoUsd — o custo real desta
                // operação (gpt-4.1) já é registrado no evento
                // "gerar_post_unico" (generate-caption.ts, clique final
                // "Gerar Post Único"); logar custo aqui de novo duplicaria o
                // gasto real reportado na aba Custos.
                await debitUsage(userId, 0, 0, {
                  evento: "gerar_pu_copy",
                  modulo: "pu",
                  primeiraGeracao: 1,
                  impersonatedBy: effective.impersonatedBy,
                  preferredSlot,
                  // Registro do piloto de intenção declarada. Cobertura parcial
                  // de propósito: este debitUsage inteiro só roda para NÃO-admin.
                  // O registro que cobre toda peça finalizada (inclusive as do
                  // Ari, que é admin) é o evento "gerar_post_unico" em
                  // generate-caption.ts, disparado no clique final.
                  ...(intencaoPayload ? { payload: intencaoPayload } : {}),
                });
              }
            } catch (e) {
              console.warn("[generate-pu-copy] debit failed", (e as Error).message);
            }
          }

          return Response.json({
            titulo,
            ...(topicos ? { topicos } : { texto }),
            ...(flags.length > 0 ? { flags } : {}),
          });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
