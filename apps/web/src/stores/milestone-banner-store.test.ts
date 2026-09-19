// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { useMilestoneBannerStore } from "./milestone-banner-store";

describe("milestone-banner-store", () => {
  let resetStore: () => void;

  beforeEach(() => {
    resetStore = createStoreResetter(useMilestoneBannerStore);
  });

  afterEach(() => {
    resetStore();
  });

  it("starts with nothing dismissed", () => {
    expect(useMilestoneBannerStore.getState().dismissedDate).toBeNull();
  });

  it("dismiss records the date", () => {
    useMilestoneBannerStore.getState().dismiss("2026-09-12");
    expect(useMilestoneBannerStore.getState().dismissedDate).toBe("2026-09-12");
  });

  it("merge ignores a non-string persisted value", () => {
    const merge = useMilestoneBannerStore.persist.getOptions().merge!;
    const current = useMilestoneBannerStore.getState();
    expect(merge({ dismissedDate: 42 }, current).dismissedDate).toBeNull();
    expect(merge({ dismissedDate: "2026-08-01" }, current).dismissedDate).toBe("2026-08-01");
  });
});
