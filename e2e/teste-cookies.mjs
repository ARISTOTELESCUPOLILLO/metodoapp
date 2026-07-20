// Teste ao vivo da extração do CookiesContent + rota /cookies (item 6.2.6 do PLANO_V2).
// Sessão real, interação real: clicar, navegar, verificar o texto renderizado.
// Fluxo sem custo — não dispara geração de IA.
//
// Uso: node e2e/teste-cookies.mjs   (com `npm run dev` rodando em :8080)

import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:8080";
const CHAVE = "mop.cookie-consent";

let falhas = 0;
const ok = (nome, cond, extra = "") => {
  console.log((cond ? "  ok   " : "FALHA  ") + nome + (cond ? "" : "  <<< " + extra));
  if (!cond) falhas++;
};

const navegador = await chromium.launch();
const contexto = await navegador.newContext();
const pagina = await contexto.newPage();

try {
  // ── 1. Landing page: o banner aparece para quem nunca decidiu ──────────────
  await pagina.goto(BASE, { waitUntil: "networkidle" });
  const banner = pagina.getByRole("region", { name: "Consentimento de cookies" });
  ok("landing: banner aparece na primeira visita", await banner.isVisible());

  // ── 2. O modal da landing continua funcionando (regressão da extração) ─────
  await pagina.getByRole("button", { name: "Saber mais na Política de Cookies" }).click();
  const modal = pagina.getByRole("dialog");
  await modal.waitFor({ state: "visible", timeout: 5000 });
  const textoModal = await modal.innerText();
  ok(
    "modal: renderiza o texto extraído",
    textoModal.includes("Esta Política explica como o Método OP usa cookies"),
  );
  ok("modal: mantém as 5 seções", (textoModal.match(/^\d\.\s/gm) || []).length === 5);
  ok("modal: botão de preferências presente", textoModal.includes("Revisar minhas preferências"));

  // ── 3. Modal e rota mostram exatamente o mesmo texto ───────────────────────
  const soConteudo = (t) =>
    t
      .replace(/^[\s\S]*?Esta Política explica/, "Esta Política explica")
      .replace(/Fechar[\s\S]*$/, "")
      .replace(/\s+/g, " ")
      .trim();
  const conteudoModal = soConteudo(textoModal);

  await pagina.keyboard.press("Escape");
  await pagina.goto(`${BASE}/cookies`, { waitUntil: "networkidle" });

  ok("rota: /cookies responde", pagina.url().endsWith("/cookies"));
  ok(
    "rota: título correto",
    (await pagina.title()) === "Política de Cookies — Método OP",
    await pagina.title(),
  );
  const h1 = await pagina.getByRole("heading", { level: 1 }).innerText();
  ok("rota: h1 é a Política de Cookies", h1 === "Política de Cookies", h1);

  const textoRota = soConteudo(await pagina.locator("main").innerText());
  ok(
    "rota e modal mostram o MESMO texto",
    textoRota.startsWith(conteudoModal.slice(0, 300)),
    "divergiram nos primeiros 300 chars",
  );

  // ── 4. "Revisar minhas preferências" limpa a decisão e volta para a home ───
  await pagina.evaluate(
    ([k]) => localStorage.setItem(k, JSON.stringify({ status: "all", ts: "x" })),
    [CHAVE],
  );
  await pagina.reload({ waitUntil: "networkidle" });
  await pagina.getByRole("button", { name: "Revisar minhas preferências" }).click();
  await pagina.waitForURL(`${BASE}/`, { timeout: 5000 });

  const restou = await pagina.evaluate(([k]) => localStorage.getItem(k), [CHAVE]);
  ok("preferências: decisão foi apagada", restou === null, String(restou));
  ok("preferências: volta para a home", pagina.url().replace(/\/$/, "") === BASE);
  await banner.waitFor({ state: "visible", timeout: 5000 });
  ok("preferências: banner reaparece", await banner.isVisible());

  // ── 5. Quem já decidiu não vê o banner de novo ─────────────────────────────
  await pagina.getByRole("button", { name: "Apenas necessários" }).click();
  await pagina.goto(BASE, { waitUntil: "networkidle" });
  ok("decisão salva: banner não reaparece", !(await banner.isVisible()));

  await pagina.screenshot({ path: "e2e/screenshots/cookies-rota.png", fullPage: false });
} catch (erro) {
  console.log("ERRO NO TESTE: " + erro.message);
  falhas++;
} finally {
  await navegador.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
