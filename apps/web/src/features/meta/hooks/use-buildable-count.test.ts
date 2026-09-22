import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as UseOwnedCount from "@/features/collections/hooks/use-owned-count";
import type { DeckBuildingCounts } from "@/features/collections/hooks/use-owned-count";
import { useDisplayStore } from "@/stores/display-store";
import { createStoreResetter } from "@/test/store-helpers";

let counts: DeckBuildingCounts | undefined;
let borrowed: Record<string, number> | undefined;

vi.mock("@/features/collections/hooks/use-owned-count", async (importOriginal) => ({
  ...(await importOriginal<typeof UseOwnedCount>()),
  useDeckBuildingCounts: (enabled: boolean) => ({ data: enabled ? counts : undefined }),
}));
vi.mock("@/features/groups/hooks/use-loans", () => ({
  useBorrowedCounts: (enabled: boolean) => ({ data: enabled ? borrowed : undefined }),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { useBuildableCount } from "./use-buildable-count";

const resetDisplayStore = createStoreResetter(useDisplayStore);

describe("useBuildableCount", () => {
  beforeEach(() => {
    counts = {
      available: { garen: 1 },
      locked: { garen: 3 },
      lockedLoaned: { garen: 1 },
      lockedReserved: { garen: 1 },
      lockedExcluded: { garen: 1 },
    };
    borrowed = { jinx: 2 };
  });
  afterEach(resetDisplayStore);

  it("leaves excluded collections out by default and counts borrowed copies", () => {
    const { result } = renderHook(() => useBuildableCount(true));
    expect(result.current.data).toEqual({ garen: 1, jinx: 2 });
  });

  it("counts excluded collections when the setting is on", () => {
    useDisplayStore.getState().setCountExcludedCollections(true);
    const { result } = renderHook(() => useBuildableCount(true));
    expect(result.current.data).toEqual({ garen: 2, jinx: 2 });
  });

  it("stays undefined until the loans arrive", () => {
    borrowed = undefined;
    const { result } = renderHook(() => useBuildableCount(true));
    expect(result.current.data).toBeUndefined();
  });

  it("stays undefined when disabled", () => {
    const { result } = renderHook(() => useBuildableCount(false));
    expect(result.current.data).toBeUndefined();
  });
});
