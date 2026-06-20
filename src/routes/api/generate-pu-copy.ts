import { createFileRoute } from "@tanstack/react-router";
import {
  truncateWords,
  validatePieceFields,
  correctPortugueseSpelling,
} from "@/core/textValidation";
import { getVoiceProfile } from "@/data/brandVoice";
import { resolveEffectiveUser, checkBalance, debitUsage } from "@/lib/usage.server";
import { COST_USD } from "@/lib/costs";
import { fetchOpenAIChat } from "@/lib/openaiClient.server";

const OBJETIVO_TOM: Record<string, string> = {
  promocao: "comercial, desejo, chamada para ação clara",
  homenagem: "afetivo, respeitoso, contemplativo",
  aviso: "institucional, claro, objetivo",
  oportunidade: "urgência elegante, momento decisivo",
  institucional: "institucional de marca, posicionamento, propósito, sóbrio e confiante",
  fatos: "documental, registro fiel, objetivo",
  nenhum: "neutro, livre — foco no contexto real da empresa",
};

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
          const preferredSlot = ["plano1", "plano2", "bonus"].includes(body.preferredSlot)
            ? (body.preferredSlot as "plano1" | "plano2" | "bonus")
            : undefined;

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
          const impersonatedBy = effective.impersonatedBy;
          const bal = await checkBalance(userId, 0, 0, 1);
          if (!bal.ok) {
            return Response.json({ error: "Limite de gerações atingido." }, { status: 402 });
          }

          const tom = OBJETIVO_TOM[objetivo] || OBJETIVO_TOM.promocao;
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

          const userPrompt = `Você cria o título e o texto de apoio que aparecerão TIPOGRAFADOS dentro de uma peça publicitária para Instagram.

EMPRESA: ${companyName}
ATIVIDADE: ${mainActivity}
${segmentBlock}${voiceBlock}OBJETIVO: ${objetivo} (tom: ${tom})
${OBJETIVO_INTENCAO[objetivo] ? `INTENÇÃO: ${OBJETIVO_INTENCAO[objetivo]}\n` : ""}INFORMAÇÃO-CHAVE: "${keyInfo.trim()}"

Retorne JSON com EXATAMENTE este formato:
{
  "titulo": "título curto, no MÁXIMO 5 palavras, cada palavra com no máximo 3 sílabas (exceto o substantivo concreto central da informação-chave, se houver — limitado a 4 sílabas, nunca mais), impactante, em português brasileiro",
  "texto": "texto de apoio curto, no MÁXIMO 14 palavras (CONTE antes de retornar), complementa o título sem repetir, em português brasileiro"
}

Regras:
- "titulo" no máximo 5 palavras, cada palavra com no máximo 3 sílabas (ex.: "negócio" 3 sílabas ✓, "resultado" 4 sílabas ✗ — use "ganho", "retorno"), sem ponto final, sem aspas, sem emoji, sem hashtag. EXCEÇÃO AO LIMITE DE SÍLABAS (restrita): se a informação-chave contém um substantivo concreto central (produto, peça, serviço, objeto ou procedimento — ex.: "equipamento", "manutenção", "orçamento", "diagnóstico", "estratégia"), esse termo pode ter NO MÁXIMO 4 sílabas — nunca mais — quando for essencial para a clareza do título; não o troque por uma palavra genérica só para encurtar, mas termos com 5+ sílabas (ex.: "lubrificante") devem ser trocados por sinônimo mais curto (ex.: "óleo"). EXCEÇÃO OBRIGATÓRIA: se o título for uma pergunta (direta ou retórica), terminar com "?" — NUNCA omitir. Ex.: "Por que é assim?" ✓, "O que está faltando?" ✓
- "texto" no máximo 14 palavras (CONTE antes de retornar — 15ª palavra em diante é cortada), frase completa terminando com PONTO FINAL obrigatório, sem hashtag, sem emoji
- Português brasileiro, sem inglês, sem markdown
- Substituir tecnicismos, estrangeirismos e jargões por palavras populares e de fácil entendimento — ex.: "expertise" → "experiência", "briefing" → "orientação", "otimização" → "melhoria", "engajamento" → "envolvimento", "performance" → "desempenho".
- Linguagem simples, natural e profissional. Ensino médio deve entender sem esforço. Evite "maximizar", "estratégias eficazes", "impacto real", "soluções digitais", "transformar seu negócio". Prefira: "melhorar", "vender", "organizar", "atender", "crescer", "mostrar".
- O título deve soar natural — evite sintaxe artificial, metáfora confusa ou promessa exagerada.
- SUJEITO DO TÍTULO — LIBERDADE GRAMATICAL: qualquer classe gramatical pode exercer função de sujeito quando substantivada — substantivo (concreto ou abstrato), adjetivo, verbo no infinitivo, advérbio, pronome ou locução (ex.: "Cuidar bem...", "Quem decide...", "Pronto para..."). O título NÃO precisa repetir a estrutura "[item] + [complemento]" da informação-chave — pode assumir outra construção, desde que a ANCORAGEM CONCRETA — PRESERVAÇÃO DO ELEMENTO abaixo seja respeitada. PROIBIDA construção passiva sem agente (ex.: "Entrega sem atraso garantida"). ATENÇÃO — sujeito abstrato + predicado abstrato vira frase vazia: se o sujeito escolhido for abstrato ou um verbo no infinitivo substantivado (ex.: "Responder...", "Cuidar..."), o predicado NÃO pode ser "faz/traz/gera/vira/se torna/transforma [outro abstrato]" (ex.: "Responder faz diferença de verdade" ✗ — nada para fotografar). Troque por ação, agente ou elemento concreto observável (ex.: "Responder rápido resolve o dia do cliente" ✓). PROIBIDO TAMBÉM terminar o título em fechamento abstrato/intercambiável entre qualquer empresa — "decisão certa", "escolha certa", "caminho certo", "confiança", "tranquilidade", "paz de espírito", "rotina resolvida" (e variações). Troque por um ganho de negócio ESPECÍFICO da atividade descrita (ex.: em vez de "...a escolha certa", "...mais clientes voltando").
- ANCORAGEM CONCRETA — ANTI-SÍMBOLO: o título deve poder virar uma FOTO de pessoa(s) real(is) em ação observável (decidir, atender, revisar, fechar, apresentar, entregar). Teste: "dá para fotografar isso sem recorrer a objeto-metáfora ou cenário espacial genérico?" Se a única imagem possível for engrenagem, peão, seta, xadrez, escada, degraus, horizonte vazio, mosquetão ou aperto de mãos → título conceitual demais; reescreva com verbo de ação + agente. Prefira "Time alinhado fecha mais" a "Equipe forte traz bom ganho". PADRÕES PROIBIDOS DE ESTRUTURA: "[abstrato] traz/gera/faz/vira/se torna/transforma [resultado]", "[abstrato] é [abstrato]". Metáforas de jornada ("longe", "avançar", "crescer", "subir") e adjetivos de qualidade ("rápido", "forte", "claro", "sólido") SÃO PERMITIDOS nos títulos — a cena os traduzirá pelo ofício real, não por cenário físico nem propriedade literal.
- ANCORAGEM CONCRETA — PRESERVAÇÃO DO ELEMENTO: se a informação-chave contém um produto, serviço, canal, objeto, procedimento ou situação concreta nomeada, o título OU o texto deve preservar pelo menos um desses elementos — literal ou sinônimo direto —, salvo se isso prejudicar gravemente a naturalidade da frase.
- VIRADA OBRIGATÓRIA: o título NÃO pode ser a informação-chave reescrita com 2-3 palavras trocadas. Encontre um ÂNGULO que a informação-chave não expressa diretamente — um benefício, convite, contraste, pergunta ou observação sobre o elemento concreto preservado acima — em vez de apenas anunciá-lo.
- CICLO DA PALAVRA — O TÍTULO GERA A CENA: este título será a base da imagem da peça; a cena vai responder ao núcleo do título (sujeito + ação ou promessa central). Escreva pensando na AÇÃO ou MOMENTO que o título evoca (alguém fazendo algo), não numa descrição estática do produto/serviço — isso dá à imagem algo concreto para mostrar.
- PROIBIDO ABSOLUTO usar as palavras: "clareza", "impacto", "instante", "fragmento", "desvio", "silêncio", "OP-01", "OP-02", "OP-03", "OP-04", "OP-05", "OP-06", "mood". Use sinônimos.
- PROIBIDO repetir a mesma palavra OU qualquer derivação morfológica da mesma raiz (ex.: ligar / ligando / ligado / ligue — todas proibidas juntas no mesmo texto) em frases próximas ou consecutivas. Use sinônimos ou reformule completamente. Ex. a evitar: "O digital traz mais alcance. Quer mais? Venha saber mais." — correto: "O digital amplia seu alcance. Quer crescer? Conheça nossa solução."
- Respeitar rigorosamente as normas gramaticais e ortográficas do português brasileiro: concordância nominal e verbal, pontuação correta, acentuação gráfica conforme o Acordo Ortográfico vigente. Nenhum erro de gramática, ortografia ou regência será tolerado.
${objetivo === "institucional" ? `- REGRA INSTITUCIONAL — ATEMPORALIDADE OBRIGATÓRIA: a informação-chave pode conter datas ou marcos de lançamento ("a partir de", "disponível em", "começa em" etc.). IGNORE esses elementos completamente — NÃO os mencione no título nem no texto de apoio. Extraia apenas a ESSÊNCIA do serviço, da capacidade ou do posicionamento da empresa. PROIBIDO: datas, urgência, "a partir de", "em breve", "lançamento", "novo serviço". OBRIGATÓRIO: atemporalidade, autoridade de marca, posicionamento sóbrio.` : ""}
${objetivo === "homenagem" ? `- REGRA HOMENAGEM — DATAS SÃO CONTEXTO, NÃO URGÊNCIA: se a informação-chave contiver datas, use-as apenas para situar a conquista ou o evento celebrado — NUNCA como gatilho de urgência, chamada para ação temporal ou linguagem de lançamento. PROIBIDO: "não perca", "somente até", "a partir de", "já disponível", urgência qualquer. O copy celebra com emoção e respeito — não pressiona.` : ""}
- REGRA DE URGÊNCIA NO TÍTULO (vale só para "titulo" — NÃO se aplica ao "texto"): PROIBIDO usar no "titulo" advérbios e chamadas de urgência temporal — "hoje", "agora", "já", "ainda hoje", "neste momento", "aproveite agora", "garanta já", "corra", "última chance", "só hoje" (e variações morfológicas dessas palavras). Essas chamadas deixam o título artificial e repetitivo, em qualquer objetivo (promoção, oportunidade, aviso, institucional etc.). A promoção/oportunidade pode continuar existindo — mas o título expressa valor, produto, condição ou contexto favorável, sem depender de urgência clichê. Ex. proibidos: "aproveite agora esta condição", "garanta já sua oferta", "hoje é dia de renovar", "oportunidade só hoje", "compre agora sem perder". Ex. preferidos: "condição especial para renovar", "oportunidade para escolher melhor", "oferta pensada para sua rotina", "produto certo para sua escolha", "escolha melhor com condição especial".`;

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

          let parsed: { titulo?: string; texto?: string };
          try {
            parsed = JSON.parse(content);
          } catch {
            return Response.json({ error: "JSON inválido" }, { status: 502 });
          }

          if (userId) {
            await debitUsage(userId, 0, 0, {
              evento: "gerar_copia_pu",
              modulo: "pu",
              payload: { objetivo },
              geracoes: 1,
              custoUsd: COST_USD.content_pu,
              impersonatedBy,
              preferredSlot,
            });
          }

          // Título NÃO é truncado aqui — cortar geraria fragmento; fora da
          // faixa de 4-6 palavras é flagado por validateTitulo (D1) abaixo e
          // regenerado pelo cliente (E3/E4), igual ao fluxo MOP.
          const titulo = correctPortugueseSpelling(String(parsed.titulo || "").trim());
          let texto = correctPortugueseSpelling(truncateWords(String(parsed.texto || ""), 14));

          if (!titulo)
            return Response.json({ error: "Título vazio na resposta da IA" }, { status: 502 });
          if (!texto)
            return Response.json({ error: "Texto vazio na resposta da IA" }, { status: 502 });

          // Garante ponto final no texto quando a IA esquece.
          if (!/[.!?]$/.test(texto)) texto = texto + ".";

          // D1 — heurísticas pós-geração: não bloqueiam a resposta, mas
          // sinalizam para a orquestração de regeneração no cliente (E3).
          const flags = validatePieceFields("copy", { titulo, texto }, keyInfo);

          return Response.json({ titulo, texto, ...(flags.length > 0 ? { flags } : {}) });
        } catch (e) {
          return Response.json({ error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
