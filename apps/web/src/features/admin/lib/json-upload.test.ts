import { describe, expect, it } from "vitest";

import { INVALID_JSON_ERROR, parseJsonEntries } from "./json-upload";

const EMPTY = "Need entries";

describe("parseJsonEntries", () => {
  it("accepts a bare array", () => {
    expect(parseJsonEntries('[{"a":1}]', "entries", EMPTY)).toStrictEqual({
      ok: true,
      value: [{ a: 1 }],
    });
  });

  it("accepts an array wrapped under the field", () => {
    expect(parseJsonEntries('{"entries":[1,2]}', "entries", EMPTY)).toStrictEqual({
      ok: true,
      value: [1, 2],
    });
  });

  it("rejects text that is not JSON", () => {
    expect(parseJsonEntries("{nope", "entries", EMPTY)).toStrictEqual({
      ok: false,
      error: INVALID_JSON_ERROR,
    });
  });

  it("rejects an empty array", () => {
    expect(parseJsonEntries("[]", "entries", EMPTY)).toStrictEqual({ ok: false, error: EMPTY });
  });

  it("rejects an object without the field", () => {
    expect(parseJsonEntries('{"other":[1]}', "entries", EMPTY)).toStrictEqual({
      ok: false,
      error: EMPTY,
    });
  });

  it("rejects a JSON primitive", () => {
    expect(parseJsonEntries("42", "entries", EMPTY)).toStrictEqual({ ok: false, error: EMPTY });
    expect(parseJsonEntries("null", "entries", EMPTY)).toStrictEqual({ ok: false, error: EMPTY });
  });
});
