import { ERROR_CODES } from "@openrift/shared/error-codes";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError } from "../../../errors.js";
import { asFieldWriteError, validateFieldValue } from "./field-values.js";

describe("validateFieldValue", () => {
  it("returns the value unchanged when the field has no validator", () => {
    expect(validateFieldValue(undefined, "comment", "anything")).toBe("anything");
  });

  it("returns the parsed value when it validates", () => {
    expect(validateFieldValue(z.string().trim(), "artist", "  Kudos  ")).toBe("Kudos");
  });

  it("throws a VALIDATION_ERROR naming the field and the first issue", () => {
    let thrown: unknown;
    try {
      validateFieldValue(z.number(), "might", "three");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(AppError);
    expect(thrown).toMatchObject({ status: 400, code: ERROR_CODES.VALIDATION_ERROR });
    expect((thrown as AppError).message).toMatch(/^Invalid value for might: /u);
  });
});

describe("asFieldWriteError", () => {
  it("maps a foreign-key violation to a VALIDATION_ERROR", () => {
    const fk = Object.assign(new Error("fk"), { code: "23503" });
    const mapped = asFieldWriteError(fk, "rarity", "mythic");
    expect(mapped).toBeInstanceOf(AppError);
    expect(mapped).toMatchObject({
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      message: "Invalid value for rarity: mythic",
    });
  });

  it("passes any other error through", () => {
    const other = Object.assign(new Error("unique"), { code: "23505" });
    expect(asFieldWriteError(other, "rarity", "mythic")).toBe(other);
  });
});
