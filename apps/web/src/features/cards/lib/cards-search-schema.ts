import { z } from "zod/mini";

import { filterSearchSchema } from "@/features/cards/lib/search-schemas";
import { lenient } from "@/lib/lenient-param";

// `customTags` can leak in from a deck → /cards navigation without
// `customTagAssignments` wired in, matching zero printings; omit it here so beforeLoad strips it.
export const cardsSearchSchema = z.extend(z.omit(filterSearchSchema, { customTags: true }), {
  printingId: lenient(z.string()),
});
