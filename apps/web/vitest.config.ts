// oxlint-disable-next-line import/no-nodejs-modules -- Vitest config runs in Node.js
import path from "node:path";

import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { tanstackRouterGenerator } from "@tanstack/router-plugin/vite";
import type { Plugin } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

import { latestMilestonePlugin } from "./vite-plugins/latest-milestone";

const paraglideDir = path.resolve(import.meta.dirname, "./src/paraglide");

const domTests = ["src/**/*.test.tsx", "src/**/use-*.test.ts", "src/**/hooks/**/*.test.ts"];

// The only tests that assert translated output; everything else reads
// English straight out of `messages/en.js`.
const localeTests = ["src/features/meta/lib/meta-format.test.ts", "src/lib/date-words.test.ts"];

const englishMessages = path.resolve(import.meta.dirname, "./src/test/paraglide-en.js");
const allMessages = path.resolve(import.meta.dirname, "./src/paraglide/messages.js");

// Every test file re-evaluates the 20 MB of generated messages, and half of
// those bytes are JSDoc that only tsgo reads.
const stripParaglideJsdoc: Plugin = {
  name: "strip-paraglide-jsdoc",
  transform(code, id) {
    return id.startsWith(paraglideDir) ? code.replaceAll(/\/\*\*[\s\S]*?\*\//gu, "") : null;
  },
};

export default defineConfig({
  // src/paraglide and routeTree.gen.ts are generated and gitignored, so tests
  // generate them themselves instead of depending on a prior build.
  plugins: [
    paraglideVitePlugin({ project: "./project.inlang" }),
    tanstackRouterGenerator(),
    stripParaglideJsdoc,
    latestMilestonePlugin(),
  ],
  define: {
    __COMMIT_HASH__: JSON.stringify("test"),
  },
  resolve: {
    alias: {
      "@/paraglide/messages.js": englishMessages,
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    setupFiles: ["src/vitest.setup.ts"],
    // Other `.test.ts` files opt into a DOM, and dom files that depend on
    // jsdom's CSS/img fidelity opt out of happy-dom, via a
    // `// @vitest-environment jsdom` docblock.
    projects: [
      {
        extends: true,
        test: { name: "dom", environment: "happy-dom", include: domTests },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...domTests, ...localeTests],
          setupFiles: [],
        },
      },
      {
        extends: true,
        resolve: { alias: { "@/paraglide/messages.js": allMessages } },
        test: { name: "i18n", environment: "node", include: localeTests, setupFiles: [] },
      },
    ],
    coverage: {
      reporter: ["text", "lcov"],
      exclude: ["src/components/ui/**"],
    },
  },
});
