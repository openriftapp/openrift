import type { ReactNode } from "react";

import {
  CatalogLanguageOrderContext,
  catalogLanguageOrder,
} from "@/features/cards/lib/catalog-language-order";
import { useDisplayLanguages } from "@/hooks/use-display-languages";

/** Mounted once at the root so `useCards` sorts the catalogue once per language list. */
export function CatalogLanguageOrderProvider({ children }: { children: ReactNode }) {
  const order = catalogLanguageOrder(useDisplayLanguages());
  return <CatalogLanguageOrderContext value={order}>{children}</CatalogLanguageOrderContext>;
}
