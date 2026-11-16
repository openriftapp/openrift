import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMutateAsync = vi.fn();

vi.mock("@/features/tournaments/hooks/use-tournament-mutations", () => ({
  useUpdateTournament: () => ({ mutateAsync: updateMutateAsync, isPending: false, error: null }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const { FormatSection } = await import("./format-section");

function makeDetail(overrides: Partial<TournamentDetailResponse> = {}): TournamentDetailResponse {
  return {
    id: "tournament-1",
    name: "Summoner Skirmish",
    hasRounds: false,
    playMode: "1v1",
    pairingStyle: "swiss",
    matchFormat: "bo1",
    format: "group_cut",
    regionsEnabled: false,
    cutSize: 8,
    groupsSelfPaced: false,
    cutRematchAvoidance: true,
    legendTiebreak: false,
    ...overrides,
  } as unknown as TournamentDetailResponse;
}

beforeEach(() => {
  updateMutateAsync.mockReset();
  updateMutateAsync.mockResolvedValue(undefined);
});

describe("FormatSection pairings switch", () => {
  it("asks before turning pairings off on a group stage + top cut event", async () => {
    const user = userEvent.setup();
    render(<FormatSection detail={makeDetail()} locked={false} />);

    await user.click(screen.getByRole("switch", { name: "Pairings" }));

    expect(updateMutateAsync).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Turn off pairings?" })).toBeInTheDocument();
  });

  it("saves nothing when the question is cancelled", async () => {
    const user = userEvent.setup();
    render(<FormatSection detail={makeDetail()} locked={false} />);

    await user.click(screen.getByRole("switch", { name: "Pairings" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(updateMutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Pairings" })).toBeChecked();
  });

  it("resets the format to rounds once confirmed", async () => {
    const user = userEvent.setup();
    render(<FormatSection detail={makeDetail()} locked={false} />);

    await user.click(screen.getByRole("switch", { name: "Pairings" }));
    await user.click(screen.getByRole("button", { name: "Turn off pairings" }));

    expect(updateMutateAsync).toHaveBeenCalledWith({
      id: "tournament-1",
      pairingStyle: "none",
      format: "rounds",
    });
  });

  it("turns pairings off at once on a rounds event", async () => {
    const user = userEvent.setup();
    render(<FormatSection detail={makeDetail({ format: "rounds" })} locked={false} />);

    await user.click(screen.getByRole("switch", { name: "Pairings" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(updateMutateAsync).toHaveBeenCalledWith({ id: "tournament-1", pairingStyle: "none" });
  });
});
