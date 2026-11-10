import { z } from "zod/mini";

import { filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { lenient } from "@/lib/lenient-param";

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

export const deckEditorSearchSchema = z.extend(filterSearchSchema, {
  editor: lenient(z.enum(WORKBENCH_MODES)),
  target: lenient(z.string()),
});
