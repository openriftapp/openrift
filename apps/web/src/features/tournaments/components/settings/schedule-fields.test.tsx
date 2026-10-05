import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ScheduleInput } from "./schedule-fields";
import { ScheduleFields } from "./schedule-fields";

const BLANK: ScheduleInput = { startDate: "", startTime: "", endDate: "", endTime: "" };

describe("ScheduleFields", () => {
  it("reports each part as a patch", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ScheduleFields value={BLANK} onChange={onChange} />);

    await user.type(screen.getByLabelText("Start time (24h)"), "9");
    await user.type(screen.getByLabelText("End time (24h)"), "1");

    expect(onChange).toHaveBeenCalledWith({ startTime: "9" });
    expect(onChange).toHaveBeenCalledWith({ endTime: "1" });
  });

  it("shows no error for an untouched start", () => {
    render(<ScheduleFields value={BLANK} onChange={vi.fn()} />);

    expect(screen.queryByText(/Enter a date \(YYYY-MM-DD\)/u)).not.toBeInTheDocument();
  });

  it("flags a malformed start time", () => {
    render(
      <ScheduleFields
        value={{ ...BLANK, startDate: "2026-06-10", startTime: "25:00" }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Enter a date \(YYYY-MM-DD\) and a 24-hour time/u)).toBeInTheDocument();
  });

  it("flags an end with only one part filled", () => {
    render(
      <ScheduleFields
        value={{ startDate: "2026-06-10", startTime: "10:00", endDate: "2026-06-11", endTime: "" }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/or leave both blank/u)).toBeInTheDocument();
  });

  it("flags an end before the start", () => {
    render(
      <ScheduleFields
        value={{
          startDate: "2026-06-10",
          startTime: "10:00",
          endDate: "2026-06-10",
          endTime: "09:00",
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/end must be at or after the start/u)).toBeInTheDocument();
  });

  it("disables both time inputs", () => {
    render(<ScheduleFields value={BLANK} disabled onChange={vi.fn()} />);

    expect(screen.getByLabelText("Start time (24h)")).toBeDisabled();
    expect(screen.getByLabelText("End time (24h)")).toBeDisabled();
  });
});
