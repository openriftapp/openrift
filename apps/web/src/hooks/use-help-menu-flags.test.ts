import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMilestoneBannerStore } from "@/stores/milestone-banner-store";
import { createStoreResetter } from "@/test/store-helpers";

const state = vi.hoisted(() => ({ standalone: false }));

vi.mock("virtual:latest-milestone", () => ({
  default: {
    date: new Date().toISOString().slice(0, 10),
    title: "Deck plans",
    message: "Write a game plan for each matchup.",
  },
}));

vi.mock("@/lib/install-platform", () => ({
  isStandaloneDisplay: () => state.standalone,
}));

import { useHelpMenuFlags } from "./use-help-menu-flags";

const reset = createStoreResetter(useMilestoneBannerStore);

beforeEach(() => {
  reset();
  state.standalone = false;
});
afterEach(reset);

describe("useHelpMenuFlags", () => {
  it("flags a milestone newer than the one last dismissed", () => {
    useMilestoneBannerStore.setState({ dismissedDate: "2000-01-01" });
    const { result } = renderHook(() => useHelpMenuFlags());
    expect(result.current.hasNewMilestone).toBe(true);
  });

  it("clears the flag once the milestone is dismissed", () => {
    useMilestoneBannerStore.setState({ dismissedDate: new Date().toISOString().slice(0, 10) });
    const { result } = renderHook(() => useHelpMenuFlags());
    expect(result.current.hasNewMilestone).toBe(false);
  });

  it("shows no dot before the first visit has seeded a dismissed date", () => {
    const { result } = renderHook(() => useHelpMenuFlags());
    expect(result.current.hasNewMilestone).toBe(false);
  });

  it("offers the install link in a browser tab and hides it in the installed app", () => {
    expect(renderHook(() => useHelpMenuFlags()).result.current.showInstall).toBe(true);
    state.standalone = true;
    expect(renderHook(() => useHelpMenuFlags()).result.current.showInstall).toBe(false);
  });
});
