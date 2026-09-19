// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createStoreResetter } from "@/test/store-helpers";

import { useLocaleBannerStore } from "./locale-banner-store";

describe("locale-banner-store", () => {
  let resetStore: () => void;

  beforeEach(() => {
    resetStore = createStoreResetter(useLocaleBannerStore);
  });

  afterEach(() => {
    resetStore();
  });

  it("starts undismissed", () => {
    expect(useLocaleBannerStore.getState().dismissed).toBe(false);
  });

  it("dismiss records the dismissal", () => {
    useLocaleBannerStore.getState().dismiss();
    expect(useLocaleBannerStore.getState().dismissed).toBe(true);
  });

  it("merge ignores a non-boolean persisted value", () => {
    const merge = useLocaleBannerStore.persist.getOptions().merge!;
    const current = useLocaleBannerStore.getState();
    expect(merge({ dismissed: "yes" }, current).dismissed).toBe(false);
    expect(merge({ dismissed: true }, current).dismissed).toBe(true);
  });
});
