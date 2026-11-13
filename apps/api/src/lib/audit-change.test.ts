import { describe, expect, it } from "vitest";

import { auditChange } from "./audit-change.js";

describe("auditChange", () => {
  it("keeps only the fields the patch changes, old beside new", () => {
    expect(
      auditChange({ name: "Origins", groupKind: "basic", setId: null }, { groupKind: "special" }),
    ).toEqual({ oldValues: { groupKind: "basic" }, newValues: { groupKind: "special" } });
  });

  it("drops fields the patch leaves undefined or sets to the same value", () => {
    expect(auditChange({ name: "Origins" }, { name: "Origins", setId: undefined })).toEqual({
      oldValues: {},
      newValues: {},
    });
  });

  it("records a missing previous value as null", () => {
    expect(auditChange(undefined, { isHidden: true })).toEqual({
      oldValues: { isHidden: null },
      newValues: { isHidden: true },
    });
  });
});
