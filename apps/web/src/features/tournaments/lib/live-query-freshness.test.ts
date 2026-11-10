import { describe, expect, it } from "vitest";

import {
  tournamentReportQueryOptions,
  tournamentRunStateQueryOptions,
} from "@/features/tournaments/lib/tournament-run-queries";
import { tournamentParticipantsQueryOptions } from "@/features/tournaments/lib/tournaments-queries";

describe("tournament queries players and staff change", () => {
  it("opt out of the client's default staleTime", () => {
    expect(tournamentRunStateQueryOptions("user-1", "t-1").staleTime).toBe(0);
    expect(tournamentReportQueryOptions("token").staleTime).toBe(0);
    expect(tournamentParticipantsQueryOptions("user-1", "t-1").staleTime).toBe(0);
  });
});
