import { describe, expect, it } from "vitest";

import {
  detectedFormatLabels,
  importModeLabels,
  IMPORT_MODE_ORDER,
  importPlaceholders,
} from "./deck-import-modes";

describe("IMPORT_MODE_ORDER", () => {
  it("lists every labelled mode exactly once", () => {
    expect(IMPORT_MODE_ORDER.toSorted()).toEqual(Object.keys(importModeLabels()).toSorted());
  });

  it("offers automatic detection first", () => {
    expect(IMPORT_MODE_ORDER[0]).toBe("auto");
  });
});

describe("importPlaceholders", () => {
  it("gives every offered mode a placeholder", () => {
    for (const mode of IMPORT_MODE_ORDER) {
      expect(importPlaceholders()[mode]).not.toBe("");
    }
  });
});

describe("detectedFormatLabels", () => {
  it("names every mode except automatic detection", () => {
    expect(Object.keys(detectedFormatLabels()).toSorted()).toEqual(
      IMPORT_MODE_ORDER.filter((mode) => mode !== "auto").toSorted(),
    );
  });
});
