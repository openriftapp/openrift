import { z } from "zod/mini";

import { lenient } from "@/lib/lenient-param";

/** Filters only; density, sort and grouping live in the preference stores instead. */
export const deckListSearchSchema = z.object({
  search: lenient(z.string()),
  formats: lenient(z.array(z.string())),
  validity: lenient(z.enum(["valid", "invalid"])),
  domains: lenient(z.array(z.string())),
  folders: lenient(z.array(z.string())),
  formatsEx: lenient(z.array(z.string())),
  domainsEx: lenient(z.array(z.string())),
  foldersEx: lenient(z.array(z.string())),
  drafts: lenient(z.enum(["hide", "only"])),
  archived: lenient(z.boolean()),
});

export type DeckListSearch = z.infer<typeof deckListSearchSchema>;
