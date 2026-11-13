import type { AdminSetResponse } from "@openrift/shared/types/api/admin";
import { describe, expect, it } from "vitest";

import { parseSetDraft, requireSetDraft, setReleasesUpdate } from "./set-draft";

describe("parseSetDraft", () => {
  it("maps a blank printed total to null", () => {
    expect(parseSetDraft({ name: "Origins", printedTotal: "" })).toEqual({
      name: "Origins",
      printedTotal: null,
    });
    expect(parseSetDraft({ name: "Origins", printedTotal: "  " })).toEqual({
      name: "Origins",
      printedTotal: null,
    });
  });

  it("trims the name and parses the total", () => {
    expect(parseSetDraft({ name: "  Origins ", printedTotal: " 298 " })).toEqual({
      name: "Origins",
      printedTotal: 298,
    });
  });

  it("accepts zero", () => {
    expect(parseSetDraft({ name: "Origins", printedTotal: "0" })).toEqual({
      name: "Origins",
      printedTotal: 0,
    });
  });

  it.each(["-1", "1.5", "12abc", "abc"])("rejects printed total %s", (printedTotal) => {
    expect(parseSetDraft({ name: "Origins", printedTotal })).toHaveProperty("error");
  });

  it("rejects a blank name", () => {
    expect(parseSetDraft({ name: "   ", printedTotal: "5" })).toEqual({
      error: "Name is required",
    });
  });
});

describe("setReleasesUpdate", () => {
  it("keeps a missing printed total missing", () => {
    const set = {
      id: "s1",
      name: "Origins",
      printedTotal: null,
      releases: {},
      setType: "main",
    } as unknown as AdminSetResponse;
    expect(setReleasesUpdate(set, { EN: { releasedAt: null, precision: null } })).toEqual({
      id: "s1",
      name: "Origins",
      printedTotal: null,
      releases: { EN: { releasedAt: null, precision: null } },
      setType: "main",
    });
  });
});

describe("requireSetDraft", () => {
  it("returns the parsed draft and throws the validation message", () => {
    expect(requireSetDraft({ name: "Origins", printedTotal: "298" })).toEqual({
      name: "Origins",
      printedTotal: 298,
    });
    expect(() => requireSetDraft({ name: "", printedTotal: "" })).toThrow("Name is required");
  });
});
