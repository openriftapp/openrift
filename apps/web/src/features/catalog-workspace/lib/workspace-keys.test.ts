import { describe, expect, it } from "vitest";

import { SUGGESTION_KEYS, WORKSPACE_KEYS } from "./workspace-keys";

describe("WORKSPACE_KEYS", () => {
  it("binds every key once", () => {
    const keys = [...WORKSPACE_KEYS.map((binding) => binding.key), ...SUGGESTION_KEYS];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("stays clear of the command palette shortcuts", () => {
    const keys: string[] = WORKSPACE_KEYS.map((binding) => binding.key);
    expect(keys).not.toContain("/");
  });
});
