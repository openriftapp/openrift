/* oxlint-disable unicorn/no-useless-undefined, promise/prefer-await-to-then, unicorn/prefer-top-level-await -- zod's `.catch(undefined)` is a sync fallback, not a Promise#catch */
/* oxlint-disable unicorn/no-useless-undefined, promise/prefer-await-to-then -- zod's `.catch(undefined)` is a sync fallback, not a Promise#catch */
import { z } from "zod";

import { filterSearchSchema } from "@/features/cards/lib/search-schemas";

const WORKBENCH_MODES = ["build", "deck"] as const;

export type WorkbenchMode = (typeof WORKBENCH_MODES)[number];

const WORKBENCH_KEYS = new Set(["editor", "target"]);

export function isWorkbenchModeNavigation(
  current: { pathname: string; search: object },
  next: { pathname: string; search: object },
): boolean {
  if (current.pathname !== next.pathname) {
    return false;
  }
  const before = new Map(Object.entries(current.search));
  const after = new Map(Object.entries(next.search));
  return [...new Set([...before.keys(), ...after.keys()])].every(
    (key) =>
      WORKBENCH_KEYS.has(key) || JSON.stringify(before.get(key)) === JSON.stringify(after.get(key)),
  );
}

export const deckEditorSearchSchema = filterSearchSchema.extend({
  editor: z.enum(WORKBENCH_MODES).optional().catch(undefined),
  target: z.string().optional().catch(undefined),
});
