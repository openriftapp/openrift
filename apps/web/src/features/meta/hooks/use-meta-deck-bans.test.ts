import type { MetaDeckCardIndexResponse } from "@openrift/shared/types/api/meta";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let cardIndex: MetaDeckCardIndexResponse | undefined;
let catalogLoaded = true;
const banned = vi.hoisted(() => new Map([["deck-1", []]]));

vi.mock("@/features/meta/lib/meta-queries", () => ({
  metaDeckCardsQueryOptions: () => ({ queryKey: ["deck-cards"] }),
}));
// Answers whatever the cache would hold, enabled or not, as a disabled query still reads cached data.
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: cardIndex }),
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCatalogOnDemand: () => ({ catalog: catalogLoaded ? { cardsById: {} } : undefined }),
}));
vi.mock("@/features/meta/lib/meta-deck-bans", () => ({ metaDeckBans: () => banned }));

import { useMetaDeckBans } from "./use-meta-deck-bans";

vi.mock("@/hooks/use-viewer-legality", () => ({
  useViewerLegality: () => ({ windows: [] }),
  useGlobalLegality: () => ({ windows: [] }),
}));

describe("useMetaDeckBans", () => {
  beforeEach(() => {
    cardIndex = {
      cards: ["card-a"],
      decks: [{ deckId: "deck-1", entries: [0, 1], sideboard: [] }],
    };
    catalogLoaded = true;
  });

  it("resolves the bans once the deck cards and the catalogue are in", () => {
    const { result } = renderHook(() => useMetaDeckBans({ event: "summoner-skirmish" }, true));
    expect(result.current).toBe(banned);
  });

  it("stays undefined while the deck cards are loading", () => {
    cardIndex = undefined;
    const { result } = renderHook(() => useMetaDeckBans({ event: "summoner-skirmish" }, true));
    expect(result.current).toBeUndefined();
  });

  it("stays undefined while the catalogue is loading", () => {
    catalogLoaded = false;
    const { result } = renderHook(() => useMetaDeckBans({ event: "summoner-skirmish" }, true));
    expect(result.current).toBeUndefined();
  });

  it("stays undefined while disabled, even with cached data", () => {
    const { result } = renderHook(() => useMetaDeckBans({ event: "summoner-skirmish" }, false));
    expect(result.current).toBeUndefined();
  });
});
