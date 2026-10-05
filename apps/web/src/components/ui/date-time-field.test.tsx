import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DateTimeField } from "./date-time-field";

function renderField(props: { time?: string; error?: string } = {}) {
  const onDateChange = vi.fn();
  const onTimeChange = vi.fn();
  render(
    <DateTimeField
      label="Starts"
      date="2026-06-14"
      time={props.time ?? "20:30"}
      onDateChange={onDateChange}
      onTimeChange={onTimeChange}
      timeLabel="Start time"
      error={props.error}
    />,
  );
  return { onDateChange, onTimeChange };
}

describe("DateTimeField", () => {
  it("labels the group and the time input", () => {
    renderField();
    expect(screen.getByRole("group", { name: "Starts" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Start time" })).toHaveProperty("value", "20:30");
  });

  it("marks a malformed time invalid", () => {
    renderField({ time: "25:00" });
    expect(screen.getByRole("textbox", { name: "Start time" }).getAttribute("aria-invalid")).toBe(
      "true",
    );
  });

  it("leaves an empty or valid time unmarked", () => {
    renderField({ time: "" });
    expect(
      screen.getByRole("textbox", { name: "Start time" }).getAttribute("aria-invalid"),
    ).toBeNull();
  });

  it("reports typed time and cleared date", () => {
    const { onDateChange, onTimeChange } = renderField();
    fireEvent.change(screen.getByRole("textbox", { name: "Start time" }), {
      target: { value: "21:00" },
    });
    expect(onTimeChange).toHaveBeenCalledWith("21:00");
    fireEvent.change(screen.getByPlaceholderText("YYYY-MM-DD"), { target: { value: "" } });
    expect(onDateChange).toHaveBeenCalledWith("");
  });

  it("renders the error slot", () => {
    renderField({ error: "Enter a start date and time." });
    expect(screen.getByRole("alert").textContent).toBe("Enter a start date and time.");
  });
});
