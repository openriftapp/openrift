import { PREFERENCE_DEFAULTS } from "@openrift/shared/types/api/preferences";
import { createContext, use } from "react";

import { useHydrated } from "@/hooks/use-hydrated";
import { useStableByValue } from "@/hooks/use-stable-by-value";
import { useDisplayStore } from "@/stores/display-store";

const ServerDisplayLanguagesContext = createContext<readonly string[] | null>(null);

export const ServerDisplayLanguagesProvider = ServerDisplayLanguagesContext;

/**
 * Until hydration this is the value the server rendered with (root context), because the
 * store has already read localStorage on the client and the server never sees it.
 */
export function useDisplayLanguages(): readonly string[] {
  const hydrated = useHydrated();
  const stored = useDisplayStore((state) => state.languages);
  const server = use(ServerDisplayLanguagesContext);
  return useStableByValue(hydrated ? stored : (server ?? PREFERENCE_DEFAULTS.languages));
}
