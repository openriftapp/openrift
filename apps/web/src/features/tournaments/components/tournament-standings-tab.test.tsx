import type {
  TournamentDetailResponse,
  TournamentViewerRole,
} from "@openrift/shared/types/api/tournament";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { bodyProps } = vi.hoisted(() => ({ bodyProps: [] as Record<string, unknown>[] }));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/features/tournaments/components/standings-body", () => ({
  StandingsBody: (props: Record<string, unknown>) => {
    bodyProps.push(props);
    return null;
  },
}));
vi.mock("@/features/tournaments/components/standings-round-picker", () => ({
  StandingsRoundPicker: () => null,
  snapshotRound: () => null,
}));
vi.mock("@/features/tournaments/hooks/use-tournament-run", () => ({
  useStandingsSnapshot: vi.fn(),
  useTournamentRunState: () => ({
    data: {
      tournament: { format: "swiss", status: "in_progress" },
      players: [],
      rounds: [],
      standings: [],
      groupStage: null,
      legendMetaShares: [],
    },
  }),
}));

const { TournamentStandingsTab } = await import("./tournament-standings-tab");

function renderAs(roles: TournamentViewerRole[]) {
  const detail = { myRoles: roles } as unknown as TournamentDetailResponse;
  render(<TournamentStandingsTab id="t-1" detail={detail} />);
  return bodyProps.at(-1);
}

describe("TournamentStandingsTab", () => {
  beforeEach(() => {
    bodyProps.length = 0;
  });

  it("gives an organizer the legend meta-share controls", () => {
    expect(renderAs(["organizer"])?.metaShares).toEqual({ id: "t-1", shares: [] });
  });

  it("keeps the legend meta-share controls from a judge, whose save the API refuses", () => {
    expect(renderAs(["judge"])?.metaShares).toBeUndefined();
  });
});
