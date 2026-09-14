import { useSuspenseQuery } from "@tanstack/react-query";

import { adminDistinctArtistsQueryOptions } from "@/features/cards/lib/distinct-artists-queries";

export function useDistinctArtists() {
  return useSuspenseQuery(adminDistinctArtistsQueryOptions);
}
