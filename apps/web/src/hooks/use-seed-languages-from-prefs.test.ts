import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDisplayStore } from "@/stores/display-store";
import { createStoreResetter } from "@/test/store-helpers";

import { useSeedLanguagesFromPrefs } from "./use-seed-languages-from-prefs";

const navigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));

const resetDisplayStore = createStoreResetter(useDisplayStore);

beforeEach(() => {
  navigate.mockClear();
  useDisplayStore.setState({ languages: ["EN"], prefsHydrated: false });
});

afterEach(() => {
  resetDisplayStore();
});

function hydratePrefs() {
  act(() => {
    useDisplayStore.setState({ prefsHydrated: true });
  });
}

describe("useSeedLanguagesFromPrefs", () => {
  it("seeds the preferred languages into a URL that had none", () => {
    renderHook(() => useSeedLanguagesFromPrefs([]));
    hydratePrefs();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("leaves the URL alone when the visitor cleared its languages before prefs loaded", () => {
    const { rerender } = renderHook(({ languages }) => useSeedLanguagesFromPrefs(languages), {
      initialProps: { languages: ["ZH"] as readonly string[] },
    });
    rerender({ languages: [] });
    hydratePrefs();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("leaves a URL with languages alone", () => {
    renderHook(() => useSeedLanguagesFromPrefs(["ZH"]));
    hydratePrefs();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not seed while prefs are still loading", () => {
    renderHook(() => useSeedLanguagesFromPrefs([]));
    expect(navigate).not.toHaveBeenCalled();
  });
});
