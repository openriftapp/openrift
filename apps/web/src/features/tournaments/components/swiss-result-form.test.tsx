import type { PodResponse } from "@openrift/shared/types/api/pod-tournament";
import { render, screen } from "@testing-library/react";
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

  it("shows the match score without points when points are off", async () => {
    const user = userEvent.setup();
    renderForm(match([null, null]), { allowDraws: false, showPoints: false });

    await user.click(screen.getByRole("button", { name: "Game 1: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Game 2: Ashe" }));

    expect(screen.getByText("2–0–0")).toBeInTheDocument();
    expect(screen.queryByText(/points/u)).not.toBeInTheDocument();
  });

  it("hides game 3 once a 2–0 decides the match", async () => {
    const user = userEvent.setup();
    renderForm(match([null, null]));

    await user.click(screen.getByRole("button", { name: "Game 1: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Game 2: Ashe" }));

    expect(screen.queryByText("Game 3")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save result" })).toBeEnabled();
  });

  it("keeps Save disabled until every shown game is filled in", async () => {
    const user = userEvent.setup();
    renderForm(match([null, null]));

    await user.click(screen.getByRole("button", { name: "Game 1: Ashe" }));

    expect(screen.getByRole("button", { name: "Save result" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Game 2: Not played" }));
    expect(screen.getByRole("button", { name: "Save result" })).toBeEnabled();
  });

  it("submits an intentional draw as 0–0 with three drawn games", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm(match([null, null]));

    await user.click(screen.getByRole("button", { name: "Intentional draw" }));
    expect(screen.queryByText("Game 1")).not.toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: "Game 3: Not played" }));
    await user.click(screen.getByRole("button", { name: "Save result" }));

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
    await user.click(screen.getByRole("button", { name: "Game 3: Not played" }));

    expect(screen.getByText("A top cut match needs a winner.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save result" })).toBeDisabled();
  });

  it("offers neither drawn games nor an intentional draw without draws", () => {
    renderForm(match([null, null]), { allowDraws: false });

    expect(screen.queryByRole("button", { name: "Game 1: Draw" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Intentional draw" })).not.toBeInTheDocument();
  });
});
