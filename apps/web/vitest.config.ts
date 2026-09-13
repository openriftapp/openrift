// oxlint-disable-next-line import/no-nodejs-modules -- Vitest config runs in Node.js
import path from "node:path";

import { paraglideVitePlugin } from "@inlang/paraglide-js";
import type { Plugin } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

import { latestMilestonePlugin } from "./vite-plugins/latest-milestone";

const paraglideDir = path.resolve(import.meta.dirname, "./src/paraglide");

const domTests = [
  "src/**/*.test.tsx",
  "src/**/use-*.test.ts",
  "src/**/hooks/**/*.test.ts",
  "src/**/stores/**/*.test.ts",
];

// Every test file re-evaluates the 20 MB of generated messages, and half of
// those bytes are JSDoc that only tsgo reads.
const stripParaglideJsdoc: Plugin = {
  name: "strip-paraglide-jsdoc",
  transform(code, id) {
    return id.startsWith(paraglideDir) ? code.replaceAll(/\/\*\*[\s\S]*?\*\//gu, "") : null;
  },
};

export default defineConfig({
  // src/paraglide is generated and gitignored, so tests compile it themselves
  // instead of depending on a prior build.
  plugins: [
    paraglideVitePlugin({ project: "./project.inlang" }),
    stripParaglideJsdoc,
    latestMilestonePlugin(),
  ],
  define: {
    __COMMIT_HASH__: JSON.stringify("test"),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    setupFiles: ["src/vitest.setup.ts"],
    // Any other `.test.ts` that needs the DOM opts in with a
    // `// @vitest-environment jsdom` docblock.
    projects: [
      {
        extends: true,
        test: { name: "dom", environment: "jsdom", include: domTests },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...domTests],
          setupFiles: [],
        },
      },
    ],
    coverage: {
      reporter: ["text", "lcov"],
      exclude: ["src/components/ui/**"],
    },
  },
});
