import { PREFERENCE_DEFAULTS } from "@openrift/shared/types/api/preferences";
import { createContext, use } from "react";

import { useHydrated } from "@/hooks/use-hydrated";
import { useDisplayStore } from "@/stores/display-store";

const ServerDisplayLanguagesContext = createContext<readonly string[] | null>(null);

export const ServerDisplayLanguagesProvider = ServerDisplayLanguagesContext;

const sharedLists = new Map<string, readonly string[]>();

function sharedList(languages: readonly string[]): readonly string[] {
  const key = languages.join(",");
  const shared = sharedLists.get(key);
  if (shared) {
    return shared;
  }
  sharedLists.set(key, languages);
  return languages;
}

/**
 * Until hydration this is the value the server rendered with (root context), because the
 * store has already read localStorage on the client and the server never sees it.
 */
export function useDisplayLanguages(): readonly string[] {
  const hydrated = useHydrated();
  const stored = useDisplayStore((state) => state.languages);
  const server = use(ServerDisplayLanguagesContext);
  return sharedList(hydrated ? stored : (server ?? PREFERENCE_DEFAULTS.languages));
}
