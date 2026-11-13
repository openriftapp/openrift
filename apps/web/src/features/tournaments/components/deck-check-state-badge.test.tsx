import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeckCheckStateBadge } from "./deck-check-state-badge";

describe("DeckCheckStateBadge", () => {
  it("tells a player their submitted deck has an issue", () => {
    render(<DeckCheckStateBadge state="submitted" reviewOutcome="issue" audience="player" />);
    expect(screen.getByText("Submitted · issue")).toBeInTheDocument();
  });

  it("words an editable deck per viewer", () => {
    const { unmount } = render(
      <DeckCheckStateBadge state="editable" reviewOutcome={null} audience="staff" />,
    );
    expect(screen.getByText("Editing")).toBeInTheDocument();
    unmount();

    render(<DeckCheckStateBadge state="editable" reviewOutcome={null} audience="player" />);
    expect(screen.getByText("Not submitted")).toBeInTheDocument();
  });

  it("marks a returned deck as changes requested for staff and players alike", () => {
    const { unmount } = render(
      <DeckCheckStateBadge state="editable" reviewOutcome="issue" audience="staff" />,
    );
    expect(screen.getByText("Changes requested")).toBeInTheDocument();
    expect(screen.getByText("Editing")).toBeInTheDocument();
    unmount();

    render(<DeckCheckStateBadge state="editable" reviewOutcome="issue" audience="player" />);
    expect(screen.getByText("Changes requested")).toBeInTheDocument();
    expect(screen.getByText("Not submitted")).toBeInTheDocument();
  });

  it("shows the same checked wording to staff and players", () => {
    render(<DeckCheckStateBadge state="checked" reviewOutcome="issue" audience="player" />);
    expect(screen.getByText("Checked · issue")).toBeInTheDocument();
  });
});
