import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMilestoneBannerStore } from "@/stores/milestone-banner-store";
import { createStoreResetter } from "@/test/store-helpers";

import { useMilestoneBanner } from "./use-milestone-banner";

const MILESTONE = vi.hoisted(() => ({
  date: new Date().toISOString().slice(0, 10),
  title: "Deck plans",
  message: "Write a game plan for each matchup.",
}));

vi.mock("virtual:latest-milestone", () => ({ default: MILESTONE }));

const reset = createStoreResetter(useMilestoneBannerStore);

beforeEach(reset);
afterEach(reset);

describe("useMilestoneBanner", () => {
  it("seeds the dismissed date on a first visit and shows nothing", () => {
    const { result } = renderHook(() => useMilestoneBanner());

    expect(result.current).toBeNull();
    expect(useMilestoneBannerStore.getState().dismissedDate).toBe(MILESTONE.date);
  });

  it("returns a milestone newer than the one last dismissed", () => {
    useMilestoneBannerStore.setState({ dismissedDate: "2000-01-01" });

    const { result } = renderHook(() => useMilestoneBanner());

    expect(result.current).toEqual(MILESTONE);
  });

  it("returns null once the milestone is dismissed", () => {
    useMilestoneBannerStore.setState({ dismissedDate: MILESTONE.date });

    const { result } = renderHook(() => useMilestoneBanner());

    expect(result.current).toBeNull();
  });
});
