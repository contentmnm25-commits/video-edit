import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // "server-only" throws outside a React Server environment; tests are server code.
      "server-only": path.resolve(import.meta.dirname, "tests/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    env: { PGLITE_DATA_DIR: "memory://", APP_SECRET: "test-secret-test-secret-test-secret" },
    testTimeout: 30_000,
  },
});
