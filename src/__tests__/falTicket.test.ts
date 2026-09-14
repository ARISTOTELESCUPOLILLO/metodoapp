import { beforeAll, describe, expect, it } from "vitest";
import { isFalQueueUrl, signFalTicket, verifyFalTicket } from "@/lib/falTicket.server";

// Auditoria de segurança 14/09/2026 — o ticket é o que impede o navegador de
// escolher a URL (SSRF da FAL_KEY), o custo e o slot do próprio débito.

beforeAll(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste-nao-e-real";
});

const base = {
  uid: "11111111-1111-1111-1111-111111111111",
  requestId: "req-abc",
  modelPath: "fal:openai/gpt-image-2/edit",
  statusUrl: "https://queue.fal.run/openai/gpt-image-2/requests/req-abc/status",
  responseUrl: "https://queue.fal.run/openai/gpt-image-2/requests/req-abc",
  slot: "plano1" as const,
  modulo: "pu",
};

describe("isFalQueueUrl", () => {
  it("aceita a fila oficial", () => {
    expect(isFalQueueUrl(base.statusUrl)).toBe(true);
  });
  it("recusa domínio que só COMEÇA igual (o furo do startsWith)", () => {
    expect(isFalQueueUrl("https://queue.fal.run.atacante.com/x")).toBe(false);
  });
  it("recusa http, porta, credencial embutida e lixo", () => {
    expect(isFalQueueUrl("http://queue.fal.run/x")).toBe(false);
    expect(isFalQueueUrl("https://queue.fal.run:8443/x")).toBe(false);
    expect(isFalQueueUrl("https://user@queue.fal.run/x")).toBe(false);
    expect(isFalQueueUrl("nada")).toBe(false);
    expect(isFalQueueUrl(undefined)).toBe(false);
  });
});

describe("ticket assinado", () => {
  it("volta íntegro para o mesmo usuário", async () => {
    const t = await signFalTicket(base);
    const v = await verifyFalTicket(t, base.uid);
    expect(v?.requestId).toBe("req-abc");
    expect(v?.modelPath).toBe(base.modelPath);
    expect(v?.slot).toBe("plano1");
  });

  it("recusa outro usuário", async () => {
    const t = await signFalTicket(base);
    expect(await verifyFalTicket(t, "22222222-2222-2222-2222-222222222222")).toBeNull();
  });

  it("recusa ticket adulterado (trocar o modelo para baratear o débito)", async () => {
    const t = await signFalTicket(base);
    const [body, sig] = t.split(".");
    const json = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    json.modelPath = "fal:openai/gpt-image-2";
    const forjado = `${Buffer.from(JSON.stringify(json)).toString("base64url")}.${sig}`;
    expect(await verifyFalTicket(forjado, base.uid)).toBeNull();
  });

  it("recusa ticket com URL fora da fila, mesmo bem assinado", async () => {
    const t = await signFalTicket({ ...base, statusUrl: "https://queue.fal.run.atacante.com/x" });
    expect(await verifyFalTicket(t, base.uid)).toBeNull();
  });

  it("recusa formatos inválidos", async () => {
    expect(await verifyFalTicket(undefined, base.uid)).toBeNull();
    expect(await verifyFalTicket("sem-ponto", base.uid)).toBeNull();
    expect(await verifyFalTicket("a.b", base.uid)).toBeNull();
  });
});
