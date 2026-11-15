import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/tournaments/hooks/use-tournament-run", () => ({
  useSetTournamentReportToken: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSetTournamentFollowToken: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/features/tournaments/components/settings/token-link-control", () => ({
  TokenLinkControl: () => null,
}));

const { FollowAlongSection } = await import("./follow-along-section");

function detail(pairingStyle: string): TournamentDetailResponse {
  return {
    id: "tournament-1",
    pairingStyle,
    reportToken: null,
    followToken: null,
  } as unknown as TournamentDetailResponse;
}

describe("FollowAlongSection", () => {
  it("speaks of match results on a Swiss event", () => {
    render(<FollowAlongSection detail={detail("swiss")} locked={false} />);
    expect(screen.getByText(/enter match results/u)).toBeInTheDocument();
  });

  it("speaks of pod results on a pod event", () => {
    render(<FollowAlongSection detail={detail("pod")} locked={false} />);
    expect(screen.getByText(/enter pod results/u)).toBeInTheDocument();
  });
});
