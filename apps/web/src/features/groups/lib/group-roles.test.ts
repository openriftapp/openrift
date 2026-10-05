import { describe, expect, it } from "vitest";

import { roleLabel } from "@/features/groups/lib/group-roles";

describe("roleLabel", () => {
  it("returns a distinct label per role", () => {
    const labels = new Set([roleLabel("owner"), roleLabel("admin"), roleLabel("member")]);
    expect(labels.size).toBe(3);
  });
});
