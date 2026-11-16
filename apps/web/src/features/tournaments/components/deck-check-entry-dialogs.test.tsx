import type { DeckCheckEntryDetailResponse } from "@openrift/shared/types/api/deck-check";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMutateAsync = vi.fn<(variables: unknown) => Promise<unknown>>();
const updateReset = vi.fn();

function idle() {
  return { mutateAsync: vi.fn(), isPending: false, error: null, reset: vi.fn() };
}

vi.mock("@/features/tournaments/hooks/use-tournament-deck-check", async () => {
  const { useState } = await import("react");
  return {
    useUpdateTournamentDeckCheckEntry: () => {
      const [error, setError] = useState<unknown>(null);
      return {
        mutateAsync: (variables: unknown) =>
          updateMutateAsync(variables).catch((error_: unknown) => {
            setError(error_);
            throw error_;
          }),
        isPending: false,
        error,
        reset: () => {
          updateReset();
          setError(null);
        },
      };
    },
    useAddTournamentDeckCheckCard: idle,
    useFixTournamentDeckCheckCard: idle,
  };
});

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ allPrintings: [] }),
}));

vi.mock("@/features/cards/hooks/use-search-index", () => ({
  useCardSearchIndex: () => null,
}));

vi.mock("@/features/cards/hooks/use-card-search", () => ({
  useCardSearch: () => [],
}));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ labels: { cardTypes: {} } }),
  useZoneOrder: () => ({ zoneOrder: ["main", "sideboard"], zoneLabels: {} }),
}));

const { AddCardDialog, EditPlayerDialog } = await import("./deck-check-entry-dialogs");

const entry = {
  playerName: "Ahri",
  riotId: null,
  allowDeckPublishing: true,
  allowNameSharing: true,
  allowRiotIdSharing: false,
} as unknown as DeckCheckEntryDetailResponse["entry"];

beforeEach(() => {
  updateMutateAsync.mockReset();
  updateReset.mockReset();
});

describe("EditPlayerDialog", () => {
  it("keeps the dialog open and shows the error when saving fails", async () => {
    updateMutateAsync.mockRejectedValueOnce(new Error("That Riot ID is already entered."));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <EditPlayerDialog
        tournamentId="t-1"
        entryId="e-1"
        entry={entry}
        open
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateMutateAsync).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByText("That Riot ID is already entered.")).toBeInTheDocument();
  });

  it("clears the old error when the dialog is cancelled", async () => {
    updateMutateAsync.mockRejectedValueOnce(new Error("That Riot ID is already entered."));
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(
      <EditPlayerDialog
        tournamentId="t-1"
        entryId="e-1"
        entry={entry}
        open
        onOpenChange={onOpenChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("That Riot ID is already entered.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(updateReset).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables the name and Riot ID consent while publishing is off", async () => {
    const user = userEvent.setup();
    render(
      <EditPlayerDialog
        tournamentId="t-1"
        entryId="e-1"
        entry={entry}
        open
        onOpenChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: /may be published/u }));

    expect(screen.getByRole("checkbox", { name: /including the name/u })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("checkbox", { name: /including the Riot ID/u })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});

describe("EditPlayerDialog for a deleted account", () => {
  const closedEntry = { ...entry, playerName: null, riotId: null };

  it("shows Former member and saves only the sharing choices", async () => {
    updateMutateAsync.mockResolvedValueOnce({});
    const user = userEvent.setup();
    render(
      <EditPlayerDialog
        tournamentId="t-1"
        entryId="e-1"
        entry={closedEntry}
        open
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Former member")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateMutateAsync).toHaveBeenCalledWith({
      tournamentId: "t-1",
      entryId: "e-1",
      allowDeckPublishing: true,
      allowNameSharing: true,
      allowRiotIdSharing: false,
    });
  });
});

describe("AddCardDialog", () => {
  it("disables Add while the copy count is out of range", async () => {
    const user = userEvent.setup();
    render(<AddCardDialog tournamentId="t-1" entryId="e-1" open onOpenChange={vi.fn()} />);

    await user.type(screen.getByRole("combobox", { name: /card name/iu }), "Mystic Poro");
    const copies = screen.getByLabelText("Copies");
    await user.clear(copies);
    await user.type(copies, "100");

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });
});
