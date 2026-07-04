// Catálogo central de chaves do localStorage/sessionStorage.
// Toda chave nova DEVE ser declarada aqui — nunca como literal espalhado no código.

// ── Preferências globais (não escopadas por userId) ───────────────────────────
export const DARK_MODE_KEY = "metodo-op-dark-mode";
export const COOKIE_CONSENT_KEY = "mop.cookie-consent";
export const IMPERSONATION_KEY = "impersonation-v1";

// ── Estado de navegação (global — mesmo dispositivo, qualquer usuário) ────────
export const MODO_KEY = "metodo-op-modo";
export const MOOD_KEY = "metodo-op-mood";

// ── Dados escopados por userId (base key sem `:userId`) ───────────────────────
// Armazenamento: `${BASE_KEY}:${userId}`

/** Brand Kit local (cache do servidor; fonte autoritativa é o Supabase). */
export const KIT_KEY = "metodo-op-kit-v1";
export const LOGO_KEY = "metodo-op-logo-v1";

/** Formulário de conteúdo MOP (ContentFormData). */
export const FORM_KEY = "metodo-op-form-v1";

/** Formulário do Post Único (PostUnicoFormData). */
export const POSTUNICO_FORM_KEY = "metodo-op-postunico-v2";

/** Resultado da última geração MOP (MethodOpResult). */
export const RESULT_KEY = "metodo-op-result-v1";

/** Imagem, legenda, estado e seleção visual do Post Único. */
export const PU_IMG_KEY = "metodo-op-postunico-img-v1";
export const PU_CAPTION_KEY = "metodo-op-postunico-caption-v1";
export const PU_STARTED_KEY = "metodo-op-postunico-started-v1";
export const PU_VISUAL_KEY = "metodo-op-postunico-visualselection-v1";

/** Kit Imagem local (cache do Supabase Storage; signed URLs). */
export const IMAGE_KIT_KEY = "metodo-op-image-kit-v1";

/** Edições de copy (título/texto/legenda) por card do MOP. */
export const COPY_EDITS_KEY = "metodo-op-copyedits-v1";

// ── Prefixos para caches de sessão ────────────────────────────────────────────
/** Prefixo de imagens geradas pelo MOP em sessão. Formato: `${PREFIX}:${userId}:${key}` */
export const SESSION_IMG_PREFIX = "metodo-op-img-v1";

/** Prefixo da seleção de referências do Kit Imagem por peça (MOP). Formato: `${PREFIX}:${userId}:${tipo}:...` */
export const USO_REF_PREFIX = "uso-ref";

// ── SessionStorage ────────────────────────────────────────────────────────────
/** Flag de auto-seleção de modo por plano (1 por login por aba). */
export const MODO_INIT_KEY = "metodo-op-modo-init-v1";
