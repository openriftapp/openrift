import { describe, expect, it } from "vitest";

import {
  tradeSheetQueryOptions,
  userTradesQueryOptions,
} from "@/features/groups/lib/card-trades-queries";
import { loansQueryOptions } from "@/features/groups/lib/loans-queries";

describe("trade and loan queries other members change", () => {
  it("opt out of the client's default staleTime", () => {
    expect(userTradesQueryOptions("user-1").staleTime).toBe(0);
    expect(tradeSheetQueryOptions("user-1", "member-1").staleTime).toBe(0);
    expect(loansQueryOptions("user-1").staleTime).toBe(0);
  });
});
