// Ticket assinado de um job de imagem na fila do fal.ai.
//
// Por que existe (auditoria de segurança, 14/09/2026): o /api/generate-image
// recebia do navegador, nas ações STATUS e RESULT, a URL da fila, o modelo
// (que decide o custo), o slot e o módulo — e confiava em tudo. Isso permitia
// (1) mandar a FAL_KEY para um servidor qualquer (a URL era do cliente),
// (2) escolher o preço do próprio débito e (3) buscar o mesmo resultado
// várias vezes. Agora o START devolve este ticket, assinado com HMAC no
// servidor, e STATUS/RESULT só usam o que está DENTRO dele.
//
// A chave HMAC é derivada da SUPABASE_SERVICE_ROLE_KEY (que só existe no
// servidor) — evita criar mais um secret para configurar no Cloudflare.

export const FAL_QUEUE_HOST = "queue.fal.run";

/** true só para https://queue.fal.run/... — `startsWith` aceitava
 *  "https://queue.fal.run.dominio-qualquer.com". */
export function isFalQueueUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || !raw) return false;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname === FAL_QUEUE_HOST && !u.username && !u.port;
  } catch {
    return false;
  }
}

export type FalImageTicket = {
  /** Usuário efetivo que iniciou o job (o que será debitado). */
  uid: string;
  requestId: string;
  modelPath: string;
  statusUrl: string;
  responseUrl: string;
  slot?: "plano1" | "plano2" | "bonus";
  modulo: string;
  /** Emitido em (ms) — tickets expiram. */
  iat: number;
};

const TICKET_TTL_MS = 2 * 60 * 60 * 1000; // 2 h — o cliente desiste em 6 min

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente — não dá para assinar o ticket.");
  const material = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`metodo-op:fal-image-ticket:v1:${secret}`),
  );
  return crypto.subtle.importKey("raw", material, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signFalTicket(data: Omit<FalImageTicket, "iat">): Promise<string> {
  const body = b64urlEncode(
    new TextEncoder().encode(JSON.stringify({ ...data, iat: Date.now() } satisfies FalImageTicket)),
  );
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(body));
  return `${body}.${b64urlEncode(new Uint8Array(sig))}`;
}

/** Devolve o ticket só se a assinatura confere, não expirou, pertence a
 *  `expectedUid` e as URLs são da fila oficial. Qualquer outro caso: null. */
export async function verifyFalTicket(
  ticket: unknown,
  expectedUid: string,
): Promise<FalImageTicket | null> {
  if (typeof ticket !== "string" || ticket.length > 4000) return null;
  const [body, sig] = ticket.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      b64urlDecode(sig),
      new TextEncoder().encode(body),
    );
    if (!ok) return null;
    const t = JSON.parse(new TextDecoder().decode(b64urlDecode(body))) as FalImageTicket;
    if (t.uid !== expectedUid) return null;
    if (typeof t.iat !== "number" || Date.now() - t.iat > TICKET_TTL_MS) return null;
    if (!isFalQueueUrl(t.statusUrl) || !isFalQueueUrl(t.responseUrl)) return null;
    return t;
  } catch {
    return null;
  }
}
