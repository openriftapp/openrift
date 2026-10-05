import { createContext } from "react";

import type { UseCardsResult } from "@/features/cards/lib/catalog-queries";

/** Null outside a provider: `useCards` falls back to the catalogue query in that case. */
export const CatalogSubsetContext = createContext<UseCardsResult | null>(null);
