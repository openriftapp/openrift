import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { listRulesConflict } from "./list-rules-conflict";

const stored = { rules: [], ruleCombine: "max", rulesVersion: 7 };

describe("listRulesConflict", () => {
  it("reads the stored rules from a version refusal", () => {
    const error = new ORPCError("PRECONDITION_FAILED", {
      defined: true,
      status: 412,
      data: stored,
    });

    expect(listRulesConflict(error)).toEqual(stored);
  });

  it("ignores a trade-cancel refusal", () => {
    const error = new ORPCError("CONFLICT", { defined: true, status: 409, data: { trades: [] } });

    expect(listRulesConflict(error)).toBeUndefined();
  });

  it("ignores an undeclared error and a refusal without the stored rules", () => {
    expect(listRulesConflict(new Error("offline"))).toBeUndefined();
    expect(
      listRulesConflict(
        new ORPCError("PRECONDITION_FAILED", { defined: true, status: 412, data: {} }),
      ),
    ).toBeUndefined();
  });
});
