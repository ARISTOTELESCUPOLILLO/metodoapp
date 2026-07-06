import { defineConfig } from "vitest/config";
import { resolve } from "path";

// Config separado do vitest.config.ts principal — roda só o harness de
// teste A/B da Sugestão (scripts/ab-sugestao), que faz chamadas REAIS à
// OpenAI (custa dinheiro real por execução). Isolado do `npx vitest run`
// normal (que usa vitest.config.ts e nunca inclui este arquivo) para nunca
// rodar sem querer no CI/dev.
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["scripts/ab-sugestao/**/*.harness.ts"],
    testTimeout: 120_000,
  },
});
