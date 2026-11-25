import type { LegalityContext } from "@openrift/shared/format-legality";
import { GLOBAL_CIRCUIT } from "@openrift/shared/types/api/preferences";
import { useQuery } from "@tanstack/react-query";

import { initQueryOptions } from "@/lib/init-queries";
import { legalityContextFor } from "@/lib/viewer-legality";
import { useDisplayStore } from "@/stores/display-store";

const NO_WINDOWS: LegalityContext = { windows: [] };

/**
 * The viewer's circuit (from the play-region preference) and the set windows.
 * Never suspends: before init lands it judges by the global list with no set windows.
 */
export function useViewerLegality(): LegalityContext {
  const { data } = useQuery(initQueryOptions);
  const playCircuit = useDisplayStore((state) => state.playCircuit);
  return data ? legalityContextFor(data, playCircuit) : NO_WINDOWS;
}

/** For reads the server repeats, such as list rules: the global list and set dates. */
export function useGlobalLegality(): LegalityContext {
  const { data } = useQuery(initQueryOptions);
  return data ? legalityContextFor(data, GLOBAL_CIRCUIT) : NO_WINDOWS;
}
