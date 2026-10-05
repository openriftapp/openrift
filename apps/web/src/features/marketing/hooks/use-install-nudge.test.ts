import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type * as InstallPlatform from "@/lib/install-platform";
import { useInstallStore } from "@/stores/install-store";
import { createStoreResetter } from "@/test/store-helpers";

import { useInstallNudge } from "./use-install-nudge";

let hydrated = true;

vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => hydrated }));
vi.mock("@tanstack/react-router", () => ({
  useLocation: ({ select }: { select: (location: { pathname: string }) => string }) =>
    select({ pathname: "/cards" }),
}));
vi.mock("@/lib/install-platform", async (importOriginal) => ({
  ...(await importOriginal<typeof InstallPlatform>()),
  detectInstallPlatform: () => ({ os: "ios" }),
  isStandaloneDisplay: () => false,
}));

const reset = createStoreResetter(useInstallStore);

beforeEach(() => {
  reset();
  hydrated = true;
});
afterEach(reset);

describe("useInstallNudge", () => {
  it("records today's visit", () => {
    renderHook(() => useInstallNudge());

    expect(useInstallStore.getState().visitDays).toBe(1);
  });

  it("shows the nudge on a phone after enough visit days", () => {
    useInstallStore.setState({ visitDays: 99, lastVisitDay: "2000-01-01" });

    const { result } = renderHook(() => useInstallNudge());

    expect(result.current).toBe(true);
  });

  it("stays hidden once dismissed", () => {
    useInstallStore.setState({ visitDays: 99, nudgeDismissed: true });

    const { result } = renderHook(() => useInstallNudge());

    expect(result.current).toBe(false);
  });

  it("stays hidden before hydration", () => {
    hydrated = false;
    useInstallStore.setState({ visitDays: 99 });

    const { result } = renderHook(() => useInstallNudge());

    expect(result.current).toBe(false);
  });
});
