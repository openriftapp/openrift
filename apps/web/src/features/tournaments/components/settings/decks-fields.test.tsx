import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { combineLocalDateTimeToUtc } from "@/lib/date-time-input";

import {
  AllowDeckEditsField,
  DeckDeadlineField,
  DeckSubmissionField,
  parseDeadlineInput,
} from "./decks-fields";

describe("parseDeadlineInput", () => {
  it("treats both parts blank as no deadline", () => {
    expect(parseDeadlineInput("", "", null)).toEqual({
      closeAt: null,
      incomplete: false,
      afterEnd: false,
    });
  });

  it("combines a full date and time into a UTC instant", () => {
    expect(parseDeadlineInput("2026-06-10", "18:00", null).closeAt).toBe(
      combineLocalDateTimeToUtc("2026-06-10", "18:00"),
    );
  });

  it("flags a half-filled deadline", () => {
    expect(parseDeadlineInput("2026-06-10", "", null).incomplete).toBe(true);
  });

  it("flags a deadline after the end, and skips the check without one", () => {
    const endsAt = combineLocalDateTimeToUtc("2026-06-10", "12:00");
    expect(parseDeadlineInput("2026-06-10", "13:00", endsAt).afterEnd).toBe(true);
    expect(parseDeadlineInput("2026-06-10", "12:00", endsAt).afterEnd).toBe(false);
    expect(parseDeadlineInput("2026-06-10", "13:00", null).afterEnd).toBe(false);
  });
});

describe("DeckSubmissionField", () => {
  it("reports a picked policy", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DeckSubmissionField value="none" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Deck submission" }));
    await user.click(await screen.findByRole("option", { name: "Decklist required" }));

    expect(onChange).toHaveBeenCalledWith("required");
  });

  it("disables the select", () => {
    render(<DeckSubmissionField value="optional" disabled onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Deck submission" })).toBeDisabled();
  });
});

describe("DeckDeadlineField", () => {
  it("reports a typed time", async () => {
    const user = userEvent.setup();
    const onTimeChange = vi.fn();
    render(
      <DeckDeadlineField date="" time="" onDateChange={vi.fn()} onTimeChange={onTimeChange} />,
    );

    await user.type(screen.getByLabelText("Deadline time (24h)"), "1");

    expect(onTimeChange).toHaveBeenCalledWith("1");
  });

  it("shows the error in place of the hint", () => {
    render(
      <DeckDeadlineField
        date="2026-06-10"
        time=""
        error="Enter both parts"
        hint="Leave blank for no deadline"
        onDateChange={vi.fn()}
        onTimeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Enter both parts")).toBeInTheDocument();
    expect(screen.queryByText("Leave blank for no deadline")).not.toBeInTheDocument();
  });

  it("shows the hint and the action without an error", () => {
    render(
      <DeckDeadlineField
        date=""
        time=""
        hint="Leave blank for no deadline"
        action={<button type="button">Save</button>}
        onDateChange={vi.fn()}
        onTimeChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Leave blank for no deadline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });
});

describe("AllowDeckEditsField", () => {
  it("maps the switch onto the lock mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AllowDeckEditsField value="at_deadline" onChange={onChange} />);

    const toggle = screen.getByRole("switch", { name: /edit their decks after submitting/u });
    expect(toggle).toBeChecked();
    await user.click(toggle);

    expect(onChange).toHaveBeenCalledWith("on_submit");
  });

  it("reads on_submit as off", () => {
    render(<AllowDeckEditsField value="on_submit" onChange={vi.fn()} />);

    expect(
      screen.getByRole("switch", { name: /edit their decks after submitting/u }),
    ).not.toBeChecked();
  });
});
