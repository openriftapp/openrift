import { describe, expect, it } from "vitest";

import { ADMIN_FILTER_ANY, withAnyOption } from "./admin-filter-options";

describe("withAnyOption", () => {
  it("puts the any option first and keeps the choices in order", () => {
    expect(
      withAnyOption("Any format", [
        { value: "constructed", label: "Constructed" },
        { value: "sealed", label: "Sealed" },
      ]),
    ).toEqual([
      { value: ADMIN_FILTER_ANY, label: "Any format" },
      { value: "constructed", label: "Constructed" },
      { value: "sealed", label: "Sealed" },
    ]);
  });

  it("returns only the any option without choices", () => {
    expect(withAnyOption("Any tier", [])).toEqual([{ value: "any", label: "Any tier" }]);
  });
});
