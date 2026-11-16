import { ERROR_CODES } from "@openrift/shared/error-codes";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError } from "../../../errors.js";
import { asFieldWriteError, isUnchangedValue, validateFieldValue } from "./field-values.js";

describe("validateFieldValue", () => {
  it("returns the value unchanged when the field has no validator", () => {
    expect(validateFieldValue(undefined, "comment", "anything")).toBe("anything");
  });

  it("returns the parsed value when it validates", () => {
    expect(validateFieldValue(z.string().trim(), "artist", "  Kudos  ")).toBe("Kudos");
  });

  it("throws a BAD_REQUEST naming the field and the first issue", () => {
    let thrown: unknown;
    try {
      validateFieldValue(z.number(), "might", "three");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AppError);
    expect(thrown).toMatchObject({ status: 400, code: ERROR_CODES.BAD_REQUEST });
    expect((thrown as AppError).message).toMatch(/^Invalid value for might: /u);
  });
});

describe("asFieldWriteError", () => {
  it("maps a foreign-key violation to a BAD_REQUEST", () => {
    const fk = Object.assign(new Error("fk"), { code: "23503" });
    const mapped = asFieldWriteError(fk, "rarity", "mythic");
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped).toMatchObject({
      status: 400,
      code: ERROR_CODES.BAD_REQUEST,
      message: "Invalid value for rarity: mythic",
    });
  });

  it("passes any other error through", () => {
    const other = Object.assign(new Error("unique"), { code: "23505" });
    expect(asFieldWriteError(other, "rarity", "mythic")).toBe(other);
  });
});

describe("isUnchangedValue", () => {
  it("is true for equal scalars, including null", () => {
    expect(isUnchangedValue(null, null)).toBe(true);
    expect(isUnchangedValue("a", "a")).toBe(true);
  });

  it("compares lists in order, and set-like slug lists as sets", () => {
    expect(isUnchangedValue(["a", "b"], ["a", "b"], "domains")).toBe(true);
    expect(isUnchangedValue(["a", "b"], ["b", "a"], "domains")).toBe(false);
    expect(isUnchangedValue(["a", "b"], ["b", "a"], "markerSlugs")).toBe(true);
    expect(isUnchangedValue(["a"], ["a", "b"], "markerSlugs")).toBe(false);
    expect(isUnchangedValue(undefined, ["a"], "domains")).toBe(false);
  });

  it("is false for different scalars, a missing column and structured values", () => {
    expect(isUnchangedValue("a", null)).toBe(false);
    expect(isUnchangedValue(undefined, null)).toBe(false);
    expect(isUnchangedValue(undefined, undefined)).toBe(false);
  });
});
