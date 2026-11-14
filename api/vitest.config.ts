import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Las pruebas de integración comparten una base MySQL: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
