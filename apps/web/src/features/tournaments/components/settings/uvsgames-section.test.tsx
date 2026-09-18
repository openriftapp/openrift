import type {
  TournamentDetailResponse,
  UvsgamesEventSuggestion,
} from "@openrift/shared/types/api/tournament";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateMutateAsync = vi.fn();
let suggestions: UvsgamesEventSuggestion[] = [];

vi.mock("@/features/tournaments/hooks/use-tournament-mutations", () => ({
  useUpdateTournament: () => ({ mutateAsync: updateMutateAsync, isPending: false }),
}));

vi.mock("@/features/tournaments/hooks/use-tournament-archive-lists", () => ({
  useUvsgamesSuggestions: () => ({ data: suggestions }),
}));

const { UvsgamesSection } = await import("./uvsgames-section");

function makeDetail(overrides: Partial<TournamentDetailResponse> = {}): TournamentDetailResponse {
  return {
    id: "tournament-1",
    groupId: "group-1",
    uvsgamesEventId: null,
    ...overrides,
  } as unknown as TournamentDetailResponse;
}

beforeEach(() => {
  updateMutateAsync.mockReset();
  updateMutateAsync.mockResolvedValue(undefined);
  suggestions = [];
});

describe("UvsgamesSection", () => {
  it("saves the id out of a pasted locator link", async () => {
    const user = userEvent.setup();
    render(<UvsgamesSection detail={makeDetail()} locked={false} />);

    await user.type(
      screen.getByLabelText("Event link or number"),
      "https://locator.riftbound.uvsgames.com/events/667904",
    );
    await user.click(screen.getByRole("button", { name: "Save link" }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: "tournament-1",
        uvsgamesEventId: "667904",
      }),
    );
  });

  it("refuses text that is no event and keeps Save disabled", async () => {
    const user = userEvent.setup();
    render(<UvsgamesSection detail={makeDetail()} locked={false} />);

    await user.type(screen.getByLabelText("Event link or number"), "Summoner Skirmish");

    expect(
      screen.getByText("Paste the link to a UVS Games event, or its number."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save link" })).toBeDisabled();
  });

  it("removes an existing link", async () => {
    const user = userEvent.setup();
    render(<UvsgamesSection detail={makeDetail({ uvsgamesEventId: "667904" })} locked={false} />);

    expect(screen.getByRole("link", { name: /Open on UVS Games/u })).toHaveAttribute(
      "href",
      "https://locator.riftbound.uvsgames.com/events/667904",
    );
    await user.click(screen.getByRole("button", { name: "Remove link" }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: "tournament-1",
        uvsgamesEventId: null,
      }),
    );
  });

  it("links a suggested shop event in one click", async () => {
    suggestions = [
      {
        externalId: "700001",
        name: "Summoner Skirmish",
        startAt: "2026-09-12T16:00:00.000Z",
        storeName: "Piltover Games",
      },
    ];
    const user = userEvent.setup();
    render(<UvsgamesSection detail={makeDetail()} locked={false} />);

    await user.click(screen.getByRole("button", { name: "Link" }));

    await waitFor(() =>
      expect(updateMutateAsync).toHaveBeenCalledWith({
        id: "tournament-1",
        uvsgamesEventId: "700001",
      }),
    );
  });

  it("does not suggest the event that is already linked", () => {
    suggestions = [
      {
        externalId: "667904",
        name: "Summoner Skirmish",
        startAt: "2026-09-12T16:00:00.000Z",
        storeName: "Piltover Games",
      },
    ];
    render(<UvsgamesSection detail={makeDetail({ uvsgamesEventId: "667904" })} locked={false} />);

    expect(screen.queryByRole("button", { name: "Link" })).not.toBeInTheDocument();
  });
});
