// Verifica que /cookies é alcançável por navegação real a partir das outras páginas
// legais — não só que a rota responde quando a URL é digitada.
//
// Uso: node e2e/teste-links-cookies.mjs   (com `npm run dev` rodando em :8080)

import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:8080";
const ORIGENS = ["/privacidade", "/termos", "/exclusao-de-dados"];

let falhas = 0;
const ok = (nome, cond, extra = "") => {
  console.log((cond ? "  ok   " : "FALHA  ") + nome + (cond ? "" : "  <<< " + extra));
  if (!cond) falhas++;
};

const navegador = await chromium.launch();
const pagina = await navegador.newPage();

try {
  for (const origem of ORIGENS) {
    await pagina.goto(BASE + origem, { waitUntil: "networkidle" });

    const link = pagina.getByRole("contentinfo").getByRole("link", { name: "Cookies" });
    ok(`${origem}: link "Cookies" existe no rodapé`, (await link.count()) === 1);

    await link.click();
    await pagina.waitForURL(`${BASE}/cookies`, { timeout: 5000 });

    // Esperar pelo h1 certo, e não só pela URL: a rota é carregada sob demanda, então
    // o endereço muda antes de o componente renderizar. Ler o h1 logo após o
    // waitForURL ainda pega o título da página anterior.
    const titulo = pagina.getByRole("heading", { level: 1, name: "Política de Cookies" });
    let chegou = true;
    try {
      await titulo.waitFor({ timeout: 5000 });
    } catch {
      chegou = false;
    }
    ok(
      `${origem}: navega e chega na Política de Cookies`,
      chegou,
      await pagina.getByRole("heading", { level: 1 }).innerText(),
    );
  }
} catch (erro) {
  console.log("ERRO NO TESTE: " + erro.message);
  falhas++;
} finally {
  await navegador.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
