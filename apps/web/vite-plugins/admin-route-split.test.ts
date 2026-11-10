import { describe, expect, it } from "vitest";

import { adminRouteSplitBehavior } from "./admin-route-split";

describe("adminRouteSplitBehavior", () => {
  it("splits the loader off every admin route, including the layout", () => {
    for (const routeId of [
      "/_app/_authenticated/admin",
      "/_app/_authenticated/admin/",
      "/_app/_authenticated/admin/cards",
      "/_app/_authenticated/admin/workspace/printings/$printingId",
    ]) {
      expect(adminRouteSplitBehavior({ routeId })).toEqual([["loader"], ["component"]]);
    }
  });

  it("leaves other routes on the default behavior", () => {
    for (const routeId of [
      "/_app/cards",
      "/_app/_authenticated/profile",
      "/_app/_authenticated/administrators",
    ]) {
      expect(adminRouteSplitBehavior({ routeId })).toBeUndefined();
    }
  });
});
