import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocaleBannerStore } from "@/features/account/stores/locale-banner-store";
import type * as LocaleEntry from "@/lib/locale-entry";
import { createStoreResetter } from "@/test/store-helpers";

import { useLocaleBanner } from "./use-locale-banner";

let hydrated = true;

vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => hydrated }));
vi.mock("@/lib/locale-entry", async (importOriginal) => ({
  ...(await importOriginal<typeof LocaleEntry>()),
  hasLocaleCookie: () => false,
}));

const reset = createStoreResetter(useLocaleBannerStore);

beforeEach(() => {
  reset();
  hydrated = true;
  vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-US", "de-DE"]);
});
afterEach(() => {
  reset();
  vi.restoreAllMocks();
});

describe("useLocaleBanner", () => {
  it("suggests a supported language the browser lists after English", () => {
    const { result } = renderHook(() => useLocaleBanner());

    expect(result.current).toEqual({ kind: "suggest", locale: "de" });
  });

  it("hides once dismissed", () => {
    useLocaleBannerStore.setState({ dismissed: true });

    const { result } = renderHook(() => useLocaleBanner());

    expect(result.current).toEqual({ kind: "hide" });
  });

  it("hides before hydration", () => {
    hydrated = false;

    const { result } = renderHook(() => useLocaleBanner());

    expect(result.current).toEqual({ kind: "hide" });
  });
});
