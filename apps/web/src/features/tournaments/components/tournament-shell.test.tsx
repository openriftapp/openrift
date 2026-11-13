import type { PodReportResponse } from "@openrift/shared/types/api/pod-tournament";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TournamentReportFrame } from "./tournament-shell";

const { report } = vi.hoisted(() => ({ report: { current: null as unknown } }));

vi.mock("@/features/tournaments/hooks/use-tournament-run", () => ({
  useTournamentReport: () => ({ data: report.current }),
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Link: ({ children }: { children?: ReactNode }) => <a href="/report">{children}</a>,
}));

function makeReport(overrides: Partial<PodReportResponse>): PodReportResponse {
  return {
    tournamentName: "Summoner Skirmish",
    status: "setup",
    startsAt: "2026-11-13T18:00:00Z",
    endsAt: null,
    currentRound: 0,
    pairingStyle: "swiss",
    playMode: "1v1",
    scoringScheme: "standard",
    byePoints: 3,
    matchFormat: "bo1",
    winPoints: 3,
    drawPoints: 1,
    regionsEnabled: false,
    format: "rounds",
    cutSize: 8,
    legendTiebreak: false,
    groupsSelfPaced: false,
    standings: [],
    rounds: [],
    groupStage: null,
    playerLegends: [],
    canSubmit: false,
    ...overrides,
  };
}

function renderFrame() {
  render(<TournamentReportFrame token="t" active="rounds" render={() => null} />);
}

describe("TournamentReportFrame", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-13T20:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says in progress once the start time has passed, as the event page does", () => {
    report.current = makeReport({ status: "setup" });
    renderFrame();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("says completed once the end time has passed, even while rounds are still open", () => {
    report.current = makeReport({ status: "running", endsAt: "2026-11-13T19:00:00Z" });
    renderFrame();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });
});
