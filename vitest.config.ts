import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    // Garantir que snapshots de prompt são salvas junto dos testes
    snapshotOptions: {
      snapshotFormat: {
        escapeString: false,
        printBasicPrototype: false,
      },
    },
  },
});
