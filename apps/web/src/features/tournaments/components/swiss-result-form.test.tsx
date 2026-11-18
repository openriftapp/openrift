import type { PodResponse } from "@openrift/shared/types/api/pod-tournament";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SwissResultForm } from "./swiss-result-form";

function match(gamePoints: [number | null, number | null], drawnGames = 0): PodResponse {
  return {
    id: "pod-1",
    podNumber: 1,
    size: 2,
    resultStatus: gamePoints[0] === null ? "pending" : "reported",
    drawnGames,
    penalty: null,
    members: (["Ashe", "Braum"] as const).map((name, index) => ({
      playerId: name.toLowerCase(),
      displayName: name,
      image: null,
      gravatarHash: null,
      teamId: null,
      gamePoints: gamePoints[index] ?? null,
      placement: null,
      points: null,
    })),
  };
}

function renderForm(
  pod: PodResponse,
  overrides: { allowDraws?: boolean; showPoints?: boolean } = {},
) {
  const onSubmit = vi.fn();
  render(
    <SwissResultForm
      pod={pod}
      matchFormat="bo3"
      winPoints={3}
      drawPoints={1}
      onSubmit={onSubmit}
      submitting={false}
      {...overrides}
    />,
  );
  return onSubmit;
}

describe("SwissResultForm", () => {
  it("submits wins and drawn games entered game by game", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm(match([null, null]));

    await user.click(screen.getByRole("button", { name: "Game 1: Draw" }));
    await user.click(screen.getByRole("button", { name: "Game 2: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Game 3: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Save result" }));

    expect(onSubmit).toHaveBeenCalledWith({
      results: [
        { playerId: "ashe", gamePoints: 2 },
        { playerId: "braum", gamePoints: 0 },
      ],
      drawnGames: 1,
    });
  });

  it("sums up the winner, score and points under the sheet", async () => {
    const user = userEvent.setup();
    renderForm(match([null, null]));

    await user.click(screen.getByRole("button", { name: "Game 1: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Game 2: Braum" }));
    await user.click(screen.getByRole("button", { name: "Game 3: Ashe" }));

    expect(screen.getByText("Ashe wins 2–1 · +3 / +0")).toBeInTheDocument();
  });

  it("shows no points preview when points are off", async () => {
    const user = userEvent.setup();
    renderForm(match([null, null]), { allowDraws: false, showPoints: false });

    await user.click(screen.getByRole("button", { name: "Game 1: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Game 2: Ashe" }));

    expect(screen.getByText("Ashe wins 2–0")).toBeInTheDocument();
  });

  it("keeps a cut-short match open when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm(match([null, null]));

    await user.click(screen.getByRole("button", { name: "Game 1: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Save result" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Game 2: Ashe" })).toBeInTheDocument();
  });

  it("reopens a game and the ones after it when its cell is tapped again", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm(match([2, 1]));

    await user.click(screen.getByRole("button", { name: "Game 2: Ashe" }));
    expect(screen.getByRole("button", { name: "Game 2: Ashe" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Game 3: Ashe" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save result" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Save result" }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      results: [
        { playerId: "ashe", gamePoints: 0 },
        { playerId: "braum", gamePoints: 1 },
      ],
      drawnGames: 0,
    });
  });

  it("saves an unchanged match that ended early without asking again", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm(match([1, 0]));

    await user.click(screen.getByRole("button", { name: "Save result" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("disables game 3 once a 2–0 decides the match", async () => {
    const user = userEvent.setup();
    renderForm(match([null, null]));

    await user.click(screen.getByRole("button", { name: "Game 1: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Game 2: Ashe" }));

    expect(screen.getByRole("button", { name: "Game 3: Ashe" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save result" })).toBeEnabled();
  });

  it("keeps Save disabled until game 1 is in", () => {
    renderForm(match([null, null]));

    expect(screen.getByRole("button", { name: "Save result" })).toBeDisabled();
  });

  it("saves a match cut short with the games entered so far", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm(match([null, null]));

    await user.click(screen.getByRole("button", { name: "Game 1: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Save result" }));
    expect(onSubmit).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    expect(
      within(dialog).getByText(
        "Game 2 has no result, so it counts as not played and the match is saved as Ashe 1–0 Braum.",
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Save result" }));

    expect(onSubmit).toHaveBeenCalledWith({
      results: [
        { playerId: "ashe", gamePoints: 1 },
        { playerId: "braum", gamePoints: 0 },
      ],
      drawnGames: 0,
    });
  });

  it("reopens a match cut short with the next game open", () => {
    renderForm(match([1, 0]));

    expect(screen.getByRole("button", { name: "Game 1: Ashe" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Game 2: Ashe" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Save result" })).toBeEnabled();
  });

  it("submits an intentional draw as 0–0 with three drawn games", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm(match([null, null]));

    await user.click(screen.getByRole("button", { name: "Intentional draw" }));
    expect(screen.getByRole("button", { name: "Game 1: Ashe" })).toBeDisabled();
    expect(screen.getByText("Intentional draw · +1 / +1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save result" }));

    expect(onSubmit).toHaveBeenCalledWith({
      results: [
        { playerId: "ashe", gamePoints: 0 },
        { playerId: "braum", gamePoints: 0 },
      ],
      drawnGames: 3,
    });
  });

  it("reopens a stored result with its games filled in", () => {
    renderForm(match([1, 1], 1));

    expect(screen.getByRole("button", { name: "Game 1: Draw" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Game 3: Braum" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Save result" })).toBeEnabled();
  });

  it("reopens a stored intentional draw with the toggle on", () => {
    renderForm(match([0, 0], 3));

    expect(screen.getByRole("button", { name: "Intentional draw" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("leaves a stored result the games cannot express unselected", () => {
    renderForm(match([77, 0]));

    expect(screen.getByRole("button", { name: "Game 1: Ashe" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Save result" })).toBeDisabled();
  });

  it("gives both teammates their side's wins and sends the drawn games once", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const base = match([null, null]);
    const member = base.members[0]!;
    const teamPod: PodResponse = {
      ...base,
      size: 4,
      members: [
        { ...member, playerId: "ashe", displayName: "Ashe", teamId: "a" },
        { ...member, playerId: "braum", displayName: "Braum", teamId: "a" },
        { ...member, playerId: "caitlyn", displayName: "Caitlyn", teamId: "b" },
        { ...member, playerId: "darius", displayName: "Darius", teamId: "b" },
      ],
    };
    render(
      <SwissResultForm
        pod={teamPod}
        teamMatch
        matchFormat="bo3"
        winPoints={3}
        drawPoints={1}
        onSubmit={onSubmit}
        submitting={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Game 1: Caitlyn & Darius" }));
    await user.click(screen.getByRole("button", { name: "Game 2: Draw" }));
    await user.click(screen.getByRole("button", { name: "Save result" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Save result" }),
    );

    expect(onSubmit).toHaveBeenCalledWith({
      results: [
        { playerId: "ashe", gamePoints: 0 },
        { playerId: "braum", gamePoints: 0 },
        { playerId: "caitlyn", gamePoints: 1 },
        { playerId: "darius", gamePoints: 1 },
      ],
      drawnGames: 1,
    });
  });

  it("says a top cut match needs a winner when the games are level", async () => {
    const user = userEvent.setup();
    renderForm(match([null, null]), { allowDraws: false });

    await user.click(screen.getByRole("button", { name: "Game 1: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Game 2: Braum" }));

    expect(screen.getByText("A top cut match needs a winner.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save result" })).toBeDisabled();
  });

  it("offers neither drawn games nor an intentional draw without draws", () => {
    renderForm(match([null, null]), { allowDraws: false });

    expect(screen.queryByRole("button", { name: "Game 1: Draw" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Intentional draw" })).not.toBeInTheDocument();
  });

  it("offers one game and no unplayed row in a best of one", () => {
    render(
      <SwissResultForm
        pod={match([null, null])}
        matchFormat="bo1"
        winPoints={3}
        drawPoints={1}
        onSubmit={vi.fn()}
        submitting={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Game 1: Ashe" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Game 2:/u })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Intentional draw" })).not.toBeInTheDocument();
  });

  it("shows every game from the start and opens each in turn", async () => {
    const user = userEvent.setup();
    renderForm(match([null, null]));

    expect(screen.getByText("G3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Game 2: Ashe" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Game 1: Ashe" }));
    expect(screen.getByRole("button", { name: "Game 2: Ashe" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Game 3: Ashe" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Game 2: Braum" }));
    expect(screen.getByRole("button", { name: "Game 3: Ashe" })).toBeEnabled();
  });

  it("calls a level match a draw", async () => {
    const user = userEvent.setup();
    renderForm(match([null, null]));

    await user.click(screen.getByRole("button", { name: "Game 1: Draw" }));

    expect(screen.getByText("Draw 0–0 · +1 / +1")).toBeInTheDocument();
  });
});
