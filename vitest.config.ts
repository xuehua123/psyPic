import path from "node:path";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    exclude: [
      ...configDefaults.exclude,
      "tests/e2e/**",
      ".claude/**",
      "**/.claude/**",
      "output/**",
      ".next/**"
    ],
    fileParallelism: false,
    globals: true,
    pool: "forks",
    setupFiles: ["./vitest.setup.ts"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
