// Type-only import on purpose: the pre-commit hook compiles messages before
// linting, and the squash merge that first adds this dependency runs that hook
// before the checkout has it installed. A runtime import fails there.
import type { ParaglideConfig } from "@inlang/paraglide-js";

export default {
  outdir: "./src/paraglide",
  // tsconfig.app.json has no allowJs, so the generated JSDoc types only reach
  // tsgo through emitted declarations.
  emitTsDeclarations: true,
  // Locale is a per-user display preference, not part of the URL: the cookie
  // mirrors the account preference so SSR can read it before render.
  strategy: ["cookie", "baseLocale"],
} satisfies ParaglideConfig;
