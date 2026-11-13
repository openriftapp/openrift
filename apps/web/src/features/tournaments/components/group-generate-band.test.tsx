import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { GenerateGroupsBand } from "./group-generate-band";

const { updateState } = vi.hoisted(() => ({
  updateState: { error: null as unknown, reset: vi.fn() },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/participants">{children}</a>,
}));
vi.mock("@/features/tournaments/hooks/use-tournaments", () => ({
  useTournamentParticipants: () => ({
    data: {
      items: Array.from({ length: 8 }, (_, index) => ({
        id: `p${index}`,
        displayName: `Player ${index}`,
        status: "active",
        legendCardId: null,
      })),
    },
  }),
}));
vi.mock("@/features/tournaments/hooks/use-tournament-run", () => ({
  useGenerateTournamentRound: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/features/tournaments/hooks/use-tournament-mutations", () => ({
  useUpdateTournament: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    get error() {
      return updateState.error;
    },
    reset: () => {
      updateState.reset();
      updateState.error = null;
    },
  }),
}));

describe("GenerateGroupsBand", () => {
  it("clears an earlier skip failure when the missing-Legend dialog opens again", async () => {
    const user = userEvent.setup();
    updateState.error = new Error("Could not turn off the Legend tiebreak.");
    render(<GenerateGroupsBand id="t-1" legendTiebreak />);

    await user.click(screen.getByRole("button", { name: "Generate groups" }));

    expect(updateState.reset).toHaveBeenCalled();
    expect(screen.queryByText("Could not turn off the Legend tiebreak.")).not.toBeInTheDocument();
  });
});
