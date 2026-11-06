import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/** Integration tests against a real Postgres database (`aurum_test`, rebuilt every run). */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "server-only": resolve(__dirname, "./tests/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],
    env: { DATABASE_URL: "postgresql://aurum:aurum@127.0.0.1:54335/aurum_test", UPLOADS_DIR: ".uploads-test" },
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
