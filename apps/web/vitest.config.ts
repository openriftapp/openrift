// oxlint-disable-next-line import/no-nodejs-modules -- Vitest config runs in Node.js
import path from "node:path";

import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // src/paraglide is generated and gitignored, so tests compile it themselves
  // instead of depending on a prior build.
  plugins: [paraglideVitePlugin({ project: "./project.inlang" })],
  define: {
    __COMMIT_HASH__: JSON.stringify("test"),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/vitest.setup.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      exclude: ["src/components/ui/**"],
    },
  },
});
