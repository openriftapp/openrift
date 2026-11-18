import type { PodResponse } from "@openrift/shared/types/api/pod-tournament";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PodResultForm } from "./pod-result-form";

function pod(gamePoints: (number | null)[]): PodResponse {
  return {
    id: "pod-1",
    podNumber: 1,
    size: 3,
    resultStatus: "pending",
    drawnGames: 0,
    penalty: null,
    members: (["Ashe", "Braum", "Caitlyn"] as const).map((name, index) => ({
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

function renderForm(gamePoints: (number | null)[]) {
  const onSubmit = vi.fn();
  render(
    <PodResultForm
      pod={pod(gamePoints)}
      scheme="standard"
      onSubmit={onSubmit}
      submitting={false}
    />,
  );
  return onSubmit;
}

describe("PodResultForm", () => {
  it("steps an empty score up from zero", async () => {
    const user = userEvent.setup();
    renderForm([null, null, null]);

    expect(screen.getByRole("button", { name: "One point less for Ashe" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "One point more for Ashe" }));
    await user.click(screen.getByRole("button", { name: "One point more for Ashe" }));

    expect(screen.getByLabelText("Game points for Ashe")).toHaveValue(2);
  });

  it("steps down and stops at zero", async () => {
    const user = userEvent.setup();
    renderForm([1, null, null]);

    await user.click(screen.getByRole("button", { name: "One point less for Ashe" }));

    expect(screen.getByLabelText("Game points for Ashe")).toHaveValue(0);
    expect(screen.getByRole("button", { name: "One point less for Ashe" })).toBeDisabled();
  });

  it("shows each place once every score is in and saves them", async () => {
    const user = userEvent.setup();
    const onSubmit = renderForm([8, 5, null]);

    expect(screen.queryByText("1st")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save result" })).toBeDisabled();
    await user.type(screen.getByLabelText("Game points for Caitlyn"), "6");

    expect(screen.getByText("1st")).toBeInTheDocument();
    expect(screen.getByText("2nd")).toBeInTheDocument();
    expect(screen.getByText("3rd")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save result" }));
    expect(onSubmit).toHaveBeenCalledWith([
      { playerId: "ashe", gamePoints: 8 },
      { playerId: "braum", gamePoints: 5 },
      { playerId: "caitlyn", gamePoints: 6 },
    ]);
  });
});
