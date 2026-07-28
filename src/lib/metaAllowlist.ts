// Fonte única dos emails autorizados a usar a publicação Meta (Instagram/Facebook).
//
// A publicação hoje sai pelo System User da BM, que sempre posta na mesma conta
// (IG e Página da OPropaganda). Liberar um email a mais NÃO muda o destino do
// post — muda apenas quem pode disparar a publicação de dentro do app.
//
// Importado tanto pelo cliente (MetaPublish, conta) quanto pelo servidor
// (meta.server), para não haver três listas duplicadas se divergindo.
export const META_ALLOWED_EMAILS: string[] = ["acupolillo@uol.com.br", "acupolillo1@gmail.com"];

export function isMetaAllowed(email?: string | null): boolean {
  if (!email) return false;
  return META_ALLOWED_EMAILS.includes(email.trim().toLowerCase());
}
