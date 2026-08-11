// Fonte única de QUEM publica pela Meta e, principalmente, PARA ONDE.
//
// A publicação sai pelo System User da BM da OPropaganda, e esse token alcança
// todo ativo compartilhado com a BM — inclusive os de clientes. Logo, quem
// decide o destino do post é o par de IDs desta tabela, não quem está logado.
//
// A regra que sustenta tudo: email sem destino aqui NÃO publica em lugar
// nenhum. Não existe destino padrão. É isso que impede a peça de um cliente de
// sair no perfil da agência por engano — antes, liberar um email a mais não
// mudava o destino, e o post do cliente cairia no Instagram da OPropaganda.
//
// Para liberar um cliente novo:
//   1. o cliente compartilha a Página do Facebook e a conta Instagram Business
//      com a BM da OPropaganda (Configurações do Negócio → Contas → Parceiros);
//   2. abra /api/meta/debug-accounts logado como admin para ler os dois IDs;
//   3. acrescente a entrada abaixo e faça o deploy.
//
// IDs de Página e de IG Business são públicos — não são segredo. Por isso este
// arquivo pode ser importado tanto pelo cliente (MetaPublish, conta) quanto
// pelo servidor, sem duas listas divergindo.

export interface MetaDestino {
  /** Nome da conta, mostrado na interface para o usuário conferir onde vai publicar. */
  nome: string;
  /** ID da conta Instagram Business. */
  igUserId: string;
  /** ID da Página do Facebook à qual essa conta Instagram está vinculada. */
  pageId: string;
}

const OPROPAGANDA: MetaDestino = {
  nome: "OPropaganda",
  igUserId: "17841403020053112",
  pageId: "144773495865295",
};

export const META_DESTINOS: Record<string, MetaDestino> = {
  // Contas da própria agência — o Ari publica no perfil da OPropaganda.
  "acupolillo@uol.com.br": OPROPAGANDA,
  "acupolillo1@gmail.com": OPROPAGANDA,

  // Clientes. Cada um publica no ativo dele, compartilhado com a BM.
  "aristotelescupolillo@gmail.com": {
    nome: "Um Novo Você",
    igUserId: "17841448917130203", // @umnovovocebr
    pageId: "107497044933123",
  },
};

/** Destino de publicação do email, ou null se ele não pode publicar. */
export function getMetaDestino(email?: string | null): MetaDestino | null {
  if (!email) return null;
  return META_DESTINOS[email.trim().toLowerCase()] ?? null;
}

/** Só pode publicar quem tem destino próprio — ter destino É a autorização. */
export function isMetaAllowed(email?: string | null): boolean {
  return getMetaDestino(email) !== null;
}

export const META_ALLOWED_EMAILS: string[] = Object.keys(META_DESTINOS);
