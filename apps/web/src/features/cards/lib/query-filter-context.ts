import { createContext } from "react";

import type { QueryFilterOptions } from "@/features/cards/lib/query-filters";

/** Null outside a card-browser surface: the query then stays separate from the buttons. */
export const QueryFilterContext = createContext<QueryFilterOptions | null>(null);
