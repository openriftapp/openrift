import type { PodResponse } from "@openrift/shared/types/api/pod-tournament";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { PodCard } from "./pod-card";

function match(gamePoints: [number | null, number | null]): PodResponse {
  return {
    id: "pod-1",
    podNumber: 1,
    size: 2,
    resultStatus: "pending",
    drawnGames: 0,
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

function threePlayerPod(gamePoints: [number | null, number | null, number | null]): PodResponse {
  const pod = match([gamePoints[0], gamePoints[1]]);
  return {
    ...pod,
    size: 3,
    members: [
      ...pod.members,
      {
        ...pod.members[0]!,
        playerId: "caitlyn",
        displayName: "Caitlyn",
        gamePoints: gamePoints[2],
      },
    ],
  };
}

function props(pod: PodResponse, onSubmit: ComponentProps<typeof PodCard>["onSubmit"]) {
  return {
    pod,
    teamMode: false,
    scheme: "standard" as const,
    matchFormat: "bo1" as const,
    winPoints: 3,
    drawPoints: 1,
    showPenalty: false,
    warnings: [],
    warningsExpanded: false,
    nameById: new Map<string, string>(),
    canEnter: true,
    onSubmit,
  };
}

describe("PodCard", () => {
  it("keeps the form open and says why when saving a match result fails", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("The round is already finalized."));
    render(<PodCard {...props(match([null, null]), onSubmit)} />);

    await user.click(screen.getByRole("button", { name: "Enter result" }));
    await user.click(screen.getByRole("button", { name: "Game 1: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Save result" }));

    expect(await screen.findByText("The round is already finalized.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save result" })).toBeInTheDocument();
  });

  it("closes the result form from the header without saving", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PodCard {...props(match([null, null]), onSubmit)} />);

    await user.click(screen.getByRole("button", { name: "Enter result" }));
    await user.click(screen.getByRole("button", { name: "Game 1: Ashe" }));
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Save result" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter result" })).toBeInTheDocument();
  });

  it("only accepts whole game point counts in a pod result", async () => {
    const user = userEvent.setup();
    const pod = match([null, null]);
    const threePod: PodResponse = {
      ...pod,
      size: 3,
      members: [
        ...pod.members,
        { ...pod.members[0]!, playerId: "caitlyn", displayName: "Caitlyn" },
      ],
    };
    render(<PodCard {...props(threePod, vi.fn())} />);

    await user.click(screen.getByRole("button", { name: "Enter result" }));
    const [first, second, third] = screen.getAllByRole("spinbutton");
    fireEvent.change(first!, { target: { value: "1e1" } });
    fireEvent.change(second!, { target: { value: "2" } });
    fireEvent.change(third!, { target: { value: "0" } });

    expect(screen.getByRole("button", { name: "Save result" })).toBeDisabled();
  });

  it("offers no per-player score entry on a walkover pod", () => {
    const pod = match([null, null]);
    const walkover: PodResponse = {
      ...pod,
      resultStatus: "reported",
      drawnGames: 0,
      members: pod.members.map((member, index) => ({ ...member, placement: index + 1 })),
    };
    render(<PodCard {...props(walkover, vi.fn())} onSubmitPlayerResult={vi.fn()} />);

    expect(screen.getByText("Walkover")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add score" })).not.toBeInTheDocument();
  });

  it("offers only the whole-match result form on a 1v1 match, even with per-player entry", () => {
    render(<PodCard {...props(match([null, null]), vi.fn())} onSubmitPlayerResult={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Add score" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enter all scores" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter result" })).toBeInTheDocument();
  });

  it("offers only the whole-match result form on a 2v2 team match", () => {
    const pod = threePlayerPod([null, null, null]);
    const teamPod: PodResponse = {
      ...pod,
      size: 4,
      members: [
        { ...pod.members[0]!, teamId: "team-a" },
        { ...pod.members[1]!, teamId: "team-a" },
        { ...pod.members[2]!, teamId: "team-b" },
        { ...pod.members[2]!, playerId: "draven", displayName: "Draven", teamId: "team-b" },
      ],
    };
    render(<PodCard {...props(teamPod, vi.fn())} teamMode onSubmitPlayerResult={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Add score" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter result" })).toBeInTheDocument();
  });

  it("keeps the table label on one line and lets long badges wrap", () => {
    render(<PodCard {...props(match([null, null]), vi.fn())} crossGroup />);

    const label = screen.getByText("Table 1");
    expect(label).toHaveClass("whitespace-nowrap");
    expect(label.parentElement).toHaveClass("flex-wrap");
    expect(screen.getByText("Cross-group").parentElement).toHaveClass("flex-wrap");
  });

  it("leaves a player's score draft alone when another player saves theirs", async () => {
    const user = userEvent.setup();
    const onSubmitPlayerResult = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <PodCard
        {...props(threePlayerPod([null, null, null]), vi.fn())}
        onSubmitPlayerResult={onSubmitPlayerResult}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: "Add score" })[0]!);
    rerender(
      <PodCard
        {...props(threePlayerPod([null, 2, null]), vi.fn())}
        onSubmitPlayerResult={onSubmitPlayerResult}
      />,
    );

    expect(screen.queryByText(/Someone else saved scores/u)).not.toBeInTheDocument();
  });

  it("warns when someone else saves a match result while the form is open", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<PodCard {...props(match([null, null]), onSubmit)} />);

    await user.click(screen.getByRole("button", { name: "Enter result" }));
    rerender(<PodCard {...props(match([1, 0]), onSubmit)} />);

    expect(
      screen.getByText("Someone else saved scores for this match while you were editing."),
    ).toBeInTheDocument();
  });
});
