import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { snapshotRound, StandingsRoundPicker } from "./standings-round-picker";

describe("snapshotRound", () => {
  it("clamps to the finalized rounds and treats the latest as live", () => {
    expect(snapshotRound(undefined, 5)).toBeNull();
    expect(snapshotRound(5, 5)).toBeNull();
    expect(snapshotRound(9, 5)).toBeNull();
    expect(snapshotRound(0, 5)).toBeNull();
    expect(snapshotRound(2, 5)).toBe(2);
  });
});

describe("StandingsRoundPicker", () => {
  it("renders nothing with fewer than two finalized rounds", () => {
    const { container } = render(
      <StandingsRoundPicker latestRound={1} selected={null} onSelect={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("names the snapshot and offers the way back to the latest table", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<StandingsRoundPicker latestRound={5} selected={2} onSelect={onSelect} />);

    expect(screen.getByText(/after round 2 of 5/u)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show latest standings" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("shows no notice on the latest table", () => {
    render(<StandingsRoundPicker latestRound={5} selected={null} onSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Show latest standings" })).not.toBeInTheDocument();
  });
});
