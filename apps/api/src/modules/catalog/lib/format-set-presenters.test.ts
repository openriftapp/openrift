import { describe, expect, it } from "vitest";

import { toFormatSetWindow } from "./format-set-presenters.js";

describe("toFormatSetWindow", () => {
  it("omits a null circuit and a null end date", () => {
    expect(
      toFormatSetWindow({
        formatId: "standard",
        setSlug: "OGN",
        circuit: null,
        legalFrom: "2025-10-31",
        legalUntil: null,
      }),
    ).toEqual({ formatId: "standard", setSlug: "OGN", legalFrom: "2025-10-31" });
  });

  it("keeps a circuit, an undated start and an end date", () => {
    expect(
      toFormatSetWindow({
        formatId: "standard",
        setSlug: "SFD",
        circuit: "korea",
        legalFrom: null,
        legalUntil: "2028-01-28",
      }),
    ).toEqual({
      formatId: "standard",
      setSlug: "SFD",
      circuit: "korea",
      legalFrom: null,
      legalUntil: "2028-01-28",
    });
  });
});
