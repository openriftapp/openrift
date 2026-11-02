import { beforeEach, describe, expect, it } from "vitest";

import { usePrintingLightboxStore } from "./printing-lightbox-store";

beforeEach(() => {
  usePrintingLightboxStore.setState({ requestedSideKey: null, pickedSideKey: null });
});

describe("usePrintingLightboxStore", () => {
  it("records the requested printing", () => {
    usePrintingLightboxStore.getState().request("printing-1");

    expect(usePrintingLightboxStore.getState().requestedSideKey).toBe("printing-1");
  });

  it("replaces an earlier request", () => {
    usePrintingLightboxStore.getState().request("printing-1");
    usePrintingLightboxStore.getState().request("printing-2");

    expect(usePrintingLightboxStore.getState().requestedSideKey).toBe("printing-2");
  });

  it("clears the request", () => {
    usePrintingLightboxStore.getState().request("printing-1");
    usePrintingLightboxStore.getState().clear();

    expect(usePrintingLightboxStore.getState().requestedSideKey).toBeNull();
  });

  it("records and clears the printing picked in the lightbox", () => {
    usePrintingLightboxStore.getState().pick("printing-1");
    expect(usePrintingLightboxStore.getState().pickedSideKey).toBe("printing-1");

    usePrintingLightboxStore.getState().clearPicked();
    expect(usePrintingLightboxStore.getState().pickedSideKey).toBeNull();
  });
});
