import { Segment } from "../types";

export interface IdeiaCategoria {
  titulo: string;
  subtitulo: string;
  itens: string[];
}

export const IDEIAS_ASSUNTOS: Record<Segment, IdeiaCategoria[]> = {
  SERVIÇOS: [
    {
      titulo: "Cliente",
      subtitulo: "quem precisa, sente dúvida, insegurança ou busca ajuda",
      itens: [
        "Uma dúvida comum do cliente antes de contratar.",
        "Uma situação em que o cliente precisa de orientação.",
        "Uma insegurança que impede o cliente de decidir.",
        "Um tipo de pessoa que costuma procurar esse serviço.",
      ],
    },
    {
      titulo: "Produto ou Serviço",
      subtitulo: "o atendimento, procedimento, serviço ou solução oferecida",
      itens: [
        "Um serviço que a empresa realiza.",
        "Um tipo de atendimento disponível.",
        "Um procedimento que pode ser contratado.",
        "Uma entrega que o cliente precisa entender melhor.",
      ],
    },
    {
      titulo: "Problema",
      subtitulo: "dor, dificuldade, dúvida ou risco que o cliente enfrenta",
      itens: [
        "Um problema frequente do cliente.",
        "Uma dificuldade que atrapalha o dia a dia.",
        "Um erro comum antes de procurar ajuda.",
        "Uma situação que pode piorar se for ignorada.",
      ],
    },
    {
      titulo: "Solução",
      subtitulo: "como sua empresa ajuda, orienta, resolve ou facilita",
      itens: [
        "Uma forma de resolver o problema do cliente.",
        "Um cuidado que melhora o atendimento.",
        "Uma orientação que evita erro ou prejuízo.",
        "Uma facilidade oferecida pela empresa.",
      ],
    },
    {
      titulo: "Novidade ou Oportunidade",
      subtitulo: "agenda, condição especial, campanha, evento ou abertura para atendimento",
      itens: [
        "Uma agenda disponível.",
        "Uma condição especial.",
        "Um novo serviço.",
        "Uma campanha, ação ou oportunidade da semana.",
      ],
    },
  ],

  VAREJO: [
    {
      titulo: "Cliente",
      subtitulo: "quem compra, usa, deseja, compara ou precisa do produto",
      itens: [
        "Uma necessidade comum do cliente.",
        "Uma situação de uso do produto.",
        "Uma dúvida antes da compra.",
        "Um desejo ligado à rotina, casa, trabalho ou família.",
      ],
    },
    {
      titulo: "Produto ou Serviço",
      subtitulo: "produto, mercadoria, categoria, linha ou item da loja",
      itens: [
        "Um produto que quer divulgar.",
        "Uma categoria importante da loja.",
        "Uma linha de produtos disponível.",
        "Um item que merece destaque.",
      ],
    },
    {
      titulo: "Problema",
      subtitulo: "dúvida de compra, necessidade urgente, erro de escolha ou falta de produto",
      itens: [
        "Uma dúvida na hora da compra.",
        "Um erro comum na escolha do produto.",
        "Uma necessidade que precisa ser resolvida.",
        "Uma situação em que o cliente não sabe o que comprar.",
      ],
    },
    {
      titulo: "Solução",
      subtitulo: "produto certo, orientação, variedade, facilidade ou atendimento da loja",
      itens: [
        "Uma orientação para escolher melhor.",
        "Uma facilidade oferecida pela loja.",
        "Uma variedade disponível.",
        "Uma forma de ajudar o cliente a comprar com mais segurança.",
      ],
    },
    {
      titulo: "Novidade ou Oportunidade",
      subtitulo: "promoção, chegada, reposição, data comemorativa ou condição especial",
      itens: [
        "Um produto novo.",
        "Uma promoção ou condição especial.",
        "Uma reposição de mercadoria.",
        "Uma data comemorativa ou campanha de venda.",
      ],
    },
  ],

  MARCA: [
    {
      titulo: "Cliente",
      subtitulo: "público, comunidade, perfil de cliente ou pessoas que a marca quer atrair",
      itens: [
        "O público que a marca atende.",
        "Um perfil de cliente importante.",
        "Uma comunidade ou grupo que se identifica com a marca.",
        "Uma necessidade coletiva que a marca ajuda a resolver.",
      ],
    },
    {
      titulo: "Produto ou Serviço",
      subtitulo: "o que a marca entrega, representa ou oferece ao mercado",
      itens: [
        "A principal entrega da marca.",
        "Um serviço ou produto representativo.",
        "Uma área de atuação da empresa.",
        "Algo que o público precisa conhecer melhor sobre a marca.",
      ],
    },
    {
      titulo: "Problema",
      subtitulo: "percepção fraca, falta de confiança, pouca clareza ou distância do público",
      itens: [
        "Uma dificuldade que o público enfrenta.",
        "Uma falta de clareza sobre o que a marca faz.",
        "Uma barreira que impede o público de confiar.",
        "Uma situação que mostra por que a marca precisa ser lembrada.",
      ],
    },
    {
      titulo: "Solução",
      subtitulo: "jeito próprio da marca fazer, atender, orientar ou entregar valor",
      itens: [
        "O jeito próprio da marca resolver.",
        "Um cuidado no atendimento.",
        "Um método, processo ou diferencial.",
        "Uma forma de gerar valor para o público.",
      ],
    },
    {
      titulo: "Novidade ou Oportunidade",
      subtitulo: "campanha, ação, lançamento, evento, fase nova ou presença da marca",
      itens: [
        "Uma nova fase da empresa.",
        "Uma campanha institucional.",
        "Uma ação com o público.",
        "Um lançamento, evento ou novidade da marca.",
      ],
    },
  ],
};
