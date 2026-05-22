import { Segment } from '../types';

export const brandVoiceCatalog: Record<Segment, string[]> = {
  'SERVIÇOS': ['Direta', 'Consultiva', 'Acolhedora', 'Técnica', 'Humor leve'],
  'VAREJO': ['Calorosa', 'Convidativa', 'Sensorial', 'Divertida', 'Irreverente'],
  'MARCA': ['Autoral', 'Inspiradora', 'Sofisticada', 'Afetiva', 'Provocativa'],
};

export function defaultVoice(segment: Segment): string {
  return brandVoiceCatalog[segment][0];
}

export interface VoiceProfile {
  label: string;
  ritmo: string;
  vocabulario: string;
  registro: string;
  evitar: string;
  exemploAbertura: string;
}

export const voiceProfiles: Record<string, VoiceProfile> = {
  // ── SERVIÇOS ──
  'Direta': {
    label: 'Direta',
    ritmo: 'Frases curtas, cadência seca, uma ideia por frase. Sem rodeios.',
    vocabulario: 'Palavras concretas e operacionais. Verbos no presente do indicativo.',
    registro: 'Afirmativo, sem hedging ("talvez", "quem sabe"). Tom de quem decidiu.',
    evitar: 'Adjetivos vagos, exclamações, emojis, perguntas retóricas longas.',
    exemploAbertura: 'O processo trava no mesmo ponto todo mês. Aqui muda.',
  },
  'Consultiva': {
    label: 'Consultiva',
    ritmo: 'Frases médias, cadência calma, raciocínio encadeado em 2 a 3 movimentos.',
    vocabulario: 'Termos técnicos do setor sempre acompanhados de tradução prática. Sem jargão de palco.',
    registro: 'Analítico, ponderado, sem dramatizar. Voz de especialista que escuta antes de opinar.',
    evitar: 'Promessas absolutas, superlativos, gatilhos de urgência, linguagem de venda direta.',
    exemploAbertura: 'Antes de mexer no processo, vale olhar onde a decisão realmente acontece.',
  },
  'Acolhedora': {
    label: 'Acolhedora',
    ritmo: 'Frases médias, respiração natural, pausa entre ideias. Tom de conversa.',
    vocabulario: 'Palavras simples, próximas do cotidiano do cliente. Pronomes em primeira pessoa do plural quando couber.',
    registro: 'Empático, validante, sem condescendência. Reconhece o esforço antes de propor.',
    evitar: 'Frases secas, ordens, jargão técnico, ironia.',
    exemploAbertura: 'Tem dia que parece que só você está lidando com isso. Não está.',
  },
  'Técnica': {
    label: 'Técnica',
    ritmo: 'Frases estruturadas, sequência lógica, dados ou critérios visíveis quando relevante.',
    vocabulario: 'Termos técnicos precisos, sem simplificação artificial. Números preferíveis a adjetivos.',
    registro: 'Objetivo, neutro, autoridade construída por consistência, não por ênfase.',
    evitar: 'Metáforas, exclamações, apelo emocional, gírias.',
    exemploAbertura: 'Três variáveis definem o resultado. Só uma costuma ser observada.',
  },
  'Humor leve': {
    label: 'Humor leve',
    ritmo: 'Frases curtas com viradas no fim. Setup curto, pausa, observação.',
    vocabulario: 'Cotidiano, leve, com referências reconhecíveis sem ser memes datados.',
    registro: 'Bem-humorado mas inteligente. Ri da situação, nunca do cliente.',
    evitar: 'Sarcasmo agressivo, piadas prontas, escárnio, deboche de cliente ou concorrente.',
    exemploAbertura: 'Planilha aberta há três horas. Decisão tomada: zero.',
  },

  // ── VAREJO ──
  'Calorosa': {
    label: 'Calorosa',
    ritmo: 'Frases médias com ritmo afetivo. Cadência convidativa, sem pressa.',
    vocabulario: 'Palavras sensoriais e afetivas. Verbos de aproximação ("chega", "cabe", "fica bem").',
    registro: 'Próximo, hospitaleiro, voz de quem recebe. Sem formalidade.',
    evitar: 'Frases secas, urgência artificial, gatilhos de escassez agressivos.',
    exemploAbertura: 'Cabe na sua semana de um jeito que parece que sempre coube.',
  },
  'Convidativa': {
    label: 'Convidativa',
    ritmo: 'Frases curtas e abertas, com convite implícito. Cadência leve.',
    vocabulario: 'Verbos no imperativo brando ("vem", "experimenta", "passa"). Pronomes pessoais.',
    registro: 'Aberto, animado, sem soar promocional barato.',
    evitar: 'Pressão, "última chance", caps lock, exclamações em série.',
    exemploAbertura: 'Hoje a vitrine está com aquele item que sempre acaba primeiro.',
  },
  'Sensorial': {
    label: 'Sensorial',
    ritmo: 'Frases que evocam sensação. Cadência mais lenta, descritiva.',
    vocabulario: 'Adjetivos de textura, cor, temperatura, som, cheiro. Verbos de percepção.',
    registro: 'Estético, contemplativo, voz que faz sentir antes de explicar.',
    evitar: 'Listas técnicas, números frios, CTAs duros.',
    exemploAbertura: 'O tecido aceita a luz da janela como se fosse parte da peça.',
  },
  'Divertida': {
    label: 'Divertida',
    ritmo: 'Frases curtas, energia alta, virada cômica leve.',
    vocabulario: 'Cotidiano, expressões coloquiais brasileiras, sem regionalismo excludente.',
    registro: 'Animado, brincalhão, sorriso na frase. Nunca infantilizado.',
    evitar: 'Sarcasmo, piada de duplo sentido, gíria datada.',
    exemploAbertura: 'A peça que você ia "deixar para depois" entrou em promoção. Vai dar nisso.',
  },
  'Irreverente': {
    label: 'Irreverente',
    ritmo: 'Frases curtas, ritmo provocador, cortes no lugar incomum.',
    vocabulario: 'Linguagem direta, sem polidez excessiva, com personalidade marcada.',
    registro: 'Ousado, opinativo, posicionado. Quebra expectativa de marca de varejo.',
    evitar: 'Ofensa, deboche de público, polêmica gratuita, política partidária.',
    exemploAbertura: 'Comprar igual a todo mundo é uma escolha. Só que é uma escolha chata.',
  },

  // ── MARCA ──
  'Autoral': {
    label: 'Autoral',
    ritmo: 'Frases com assinatura. Cadência própria, leve quebra de padrão esperado.',
    vocabulario: 'Vocabulário curado, escolhas lexicais próprias, sem clichê de mercado.',
    registro: 'Pessoal, opinativo, voz reconhecível como de uma marca, não de um setor.',
    evitar: 'Frases de manual, jargão de marketing, lugar-comum motivacional.',
    exemploAbertura: 'A gente desenhou esta linha pensando em quem cansou de coleção sem ponto de vista.',
  },
  'Inspiradora': {
    label: 'Inspiradora',
    ritmo: 'Frases que abrem horizonte. Cadência ascendente, sem dramatizar.',
    vocabulario: 'Palavras de visão, propósito e direção. Concretude no fim da frase.',
    registro: 'Elevado mas aterrado. Inspira sem prometer.',
    evitar: 'Frase de coach, motivacional vazio, exclamações, "acredite em você".',
    exemploAbertura: 'Existe um jeito de fazer isto que ainda não virou regra. É deste lado que a gente trabalha.',
  },
  'Sofisticada': {
    label: 'Sofisticada',
    ritmo: 'Frases enxutas, cadência elegante, espaços de respiro entre as ideias.',
    vocabulario: 'Preciso, contido, sem adjetivos em excesso. Sintaxe limpa.',
    registro: 'Discreto, seguro, voz que não precisa elevar o tom para ser ouvida.',
    evitar: 'Exclamações, emojis, gírias, superlativos, gatilhos promocionais.',
    exemploAbertura: 'Há um tipo de escolha que se nota pelo que foi deixado de fora.',
  },
  'Afetiva': {
    label: 'Afetiva',
    ritmo: 'Frases com pausa emocional. Cadência íntima, próxima.',
    vocabulario: 'Palavras de vínculo, memória, presença. Verbos de cuidado.',
    registro: 'Caloroso, sincero, voz de quem se importa de verdade.',
    evitar: 'Pieguice, drama, frases prontas de "família", apelo emocional manipulador.',
    exemploAbertura: 'Tem coisas que a gente faz não porque convém, mas porque significa.',
  },
  'Provocativa': {
    label: 'Provocativa',
    ritmo: 'Frases curtas, viradas afiadas, perguntas que cobram resposta interna.',
    vocabulario: 'Direto, posicionado, sem suavizadores.',
    registro: 'Confrontador no ponto certo. Provoca sem agredir.',
    evitar: 'Cancelamento, ataque pessoal, polêmica vazia, polarização política.',
    exemploAbertura: 'Você continua chamando de padrão o que já virou limitação.',
  },
};

export function getVoiceProfile(label: string | undefined): VoiceProfile | undefined {
  if (!label) return undefined;
  return voiceProfiles[label];
}
