import { describe, expect, it } from "vitest";

import {
  HIERARCHY_REJECTED_SQLSTATE,
  isCheckViolation,
  isForeignKeyViolation,
  isForeignKeyViolationOn,
  isUniqueViolation,
  isRaisedWith,
  isUniqueViolationOn,
} from "./pg-errors.js";

describe("isForeignKeyViolation", () => {
  it("is true for a Postgres 23503 error", () => {
    expect(isForeignKeyViolation({ code: "23503" })).toBe(true);
  });

  it("is false for other SQLSTATEs and non-objects", () => {
    expect(isForeignKeyViolation({ code: "23505" })).toBe(false);
    expect(isForeignKeyViolation(null)).toBe(false);
  });
});

describe("isUniqueViolation", () => {
  it("is true for a Postgres 23505 error", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("is true for a driver error object carrying extra fields", () => {
    const error = Object.assign(new Error("duplicate key"), { code: "23505", constraint: "uq_x" });
    expect(isUniqueViolation(error)).toBe(true);
  });

  it("is false for a different SQLSTATE (foreign-key violation)", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
  });

  it("is false for errors without a code", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation({ message: "no code here" })).toBe(false);
  });

  it("is false for null and non-object values", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});

describe("isForeignKeyViolationOn", () => {
  it("is true only when the 23503 names the given constraint", () => {
    const error = { code: "23503", constraint_name: "fk_copies_grader" };
    expect(isForeignKeyViolationOn(error, "fk_copies_grader")).toBe(true);
    expect(isForeignKeyViolationOn(error, "fk_copies_printing_id")).toBe(false);
  });

  it("is false for another SQLSTATE on the same constraint name", () => {
    expect(
      isForeignKeyViolationOn(
        { code: "23505", constraint_name: "fk_copies_grader" },
        "fk_copies_grader",
      ),
    ).toBe(false);
  });
});

describe("isUniqueViolationOn", () => {
  it("matches any of several named constraints", () => {
    const error = { code: "23505", constraint_name: "uq_list_entries_copy" };
    expect(isUniqueViolationOn(error, "uq_list_entries_card", "uq_list_entries_copy")).toBe(true);
    expect(isUniqueViolationOn(error, "uq_list_entries_card", "uq_list_entries_printing")).toBe(
      false,
    );
  });

  it("is true only when the 23505 names the given constraint", () => {
    const error = Object.assign(new Error("duplicate key"), {
      code: "23505",
      constraint_name: "uq_pod_rounds_number",
    });
    expect(isUniqueViolationOn(error, "uq_pod_rounds_number")).toBe(true);
  });

  it("is false for a 23505 from a different constraint", () => {
    const error = { code: "23505", constraint_name: "some_other_unique" };
    expect(isUniqueViolationOn(error, "uq_pod_rounds_number")).toBe(false);
  });

  it("is false for a 23505 with no constraint name", () => {
    expect(isUniqueViolationOn({ code: "23505" }, "uq_pod_rounds_number")).toBe(false);
  });

  it("is false for a non-unique error", () => {
    expect(isUniqueViolationOn({ code: "23503", constraint_name: "x" }, "x")).toBe(false);
  });
});

describe("isRaisedWith", () => {
  it("is true for a raise carrying the given SQLSTATE", () => {
    const error = Object.assign(new Error("Cycle detected in distribution channel hierarchy"), {
      code: HIERARCHY_REJECTED_SQLSTATE,
    });
    expect(isRaisedWith(error, HIERARCHY_REJECTED_SQLSTATE)).toBe(true);
  });

  it("is false for a plain RAISE EXCEPTION (P0001)", () => {
    expect(isRaisedWith({ code: "P0001", message: "boom" }, HIERARCHY_REJECTED_SQLSTATE)).toBe(
      false,
    );
  });

  it("is false for errors without a code and non-objects", () => {
    expect(isRaisedWith(new Error("boom"), HIERARCHY_REJECTED_SQLSTATE)).toBe(false);
    expect(isRaisedWith(null, HIERARCHY_REJECTED_SQLSTATE)).toBe(false);
    expect(isRaisedWith(HIERARCHY_REJECTED_SQLSTATE, HIERARCHY_REJECTED_SQLSTATE)).toBe(false);
  });
});

describe("isCheckViolation", () => {
  it("is true for a Postgres 23514 error", () => {
    expect(isCheckViolation({ code: "23514" })).toBe(true);
  });

  it("is false for other SQLSTATEs and non-objects", () => {
    expect(isCheckViolation({ code: "23505" })).toBe(false);
    expect(isCheckViolation("23514")).toBe(false);
    expect(isCheckViolation(null)).toBe(false);
  });
});
