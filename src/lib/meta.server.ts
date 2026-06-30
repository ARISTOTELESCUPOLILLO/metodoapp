import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const META_VERSION = "v25.0";
export const META_BUCKET = "meta-publish";
// Emails autorizados a publicar via Meta — separados por vírgula na env var META_PUBLISH_ALLOWED_EMAILS
// Fallback para o email do admin principal caso a env não esteja definida
export const META_PUBLISH_ALLOWED_EMAILS: string[] = (
  process.env.META_PUBLISH_ALLOWED_EMAILS || "acupolillo@uol.com.br"
)
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export function getEmailFromJwt(request: Request): string | null {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth) return null;
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return (payload?.email as string) || null;
  } catch {
    return null;
  }
}

export async function ensureMetaBucket(): Promise<void> {
  const { error } = await supabaseAdmin.storage.createBucket(META_BUCKET, { public: true });
  if (error && !error.message.toLowerCase().includes("already exist")) {
    console.warn("[meta] createBucket warning:", error.message);
  }
}

export async function uploadImageToMetaBucket(userId: string, dataUrl: string): Promise<string> {
  if (dataUrl.startsWith("https://")) return dataUrl;
  await ensureMetaBucket();
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
  const buf = Buffer.from(base64, "base64");
  const ext = dataUrl.startsWith("data:image/png") ? "png" : "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(META_BUCKET)
    .upload(path, buf, { contentType: `image/${ext}`, upsert: true });
  if (error) throw new Error(`Upload falhou: ${error.message}`);
  const supabaseUrl = process.env.SUPABASE_URL!.replace(/\/$/, "");
  return `${supabaseUrl}/storage/v1/object/public/${META_BUCKET}/${path}`;
}

export interface MetaConnectionUpsert {
  userId: string;
  igUserId: string | null;
  igUsername: string | null;
  fbPageId: string | null;
  fbPageName: string | null;
  fbPageToken: string | null;
  longToken: string;
  expiresAt: string | null;
}

// Salva/atualiza a conexão Meta (Instagram/Facebook) do usuário após o OAuth
// callback — consumido por routes/auth/meta/callback.tsx.
export async function upsertMetaConnection(conn: MetaConnectionUpsert): Promise<void> {
  const { error } = await supabaseAdmin.from("meta_connections").upsert(
    {
      user_id: conn.userId,
      ig_user_id: conn.igUserId,
      ig_username: conn.igUsername,
      fb_page_id: conn.fbPageId,
      fb_page_name: conn.fbPageName,
      fb_page_access_token: conn.fbPageToken,
      user_access_token: conn.longToken,
      long_lived_token: conn.longToken,
      token_expires_at: conn.expiresAt,
      scopes: "pages_show_list,pages_manage_posts,instagram_basic,instagram_content_publish",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
}

export async function pollContainerStatus(containerId: string, token: string): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const r = await fetch(
      `https://graph.facebook.com/${META_VERSION}/${containerId}?fields=status_code&access_token=${token}`,
    );
    const d = (await r.json()) as { status_code?: string };
    if (d.status_code === "FINISHED") return;
    if (d.status_code === "ERROR") throw new Error("Meta rejeitou o container de mídia.");
  }
  throw new Error("Timeout aguardando container de mídia (24 s).");
}
