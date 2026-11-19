import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DatePicker } from "./date-picker";

function getInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector("input");
  if (!input) {
    throw new Error("input not found");
  }
  return input;
}

describe("DatePicker", () => {
  it("shows the initial value", () => {
    const { container } = render(<DatePicker aria-label="Day" value="2026-07-27" />);
    expect(getInput(container).value).toBe("2026-07-27");
  });

  it("shows a value set after mount (the wizard's client-only prefill)", () => {
    const { container, rerender } = render(<DatePicker aria-label="Day" value="" />);
    expect(getInput(container).value).toBe("");

    rerender(<DatePicker aria-label="Day" value="2026-07-27" />);
    expect(getInput(container).value).toBe("2026-07-27");
  });

  it("clears the text when the value is cleared externally", () => {
    const { container, rerender } = render(<DatePicker aria-label="Day" value="2026-07-27" />);
    rerender(<DatePicker aria-label="Day" value="" />);
    expect(getInput(container).value).toBe("");
  });

  it("keeps partial typing when the value prop is unchanged", () => {
    const { container, rerender } = render(<DatePicker aria-label="Day" value="2026-07-27" />);
    const input = getInput(container);
    fireEvent.change(input, { target: { value: "2026-08" } });
    expect(input.value).toBe("2026-08");

    // A parent re-render with the same value must not clobber the draft.
    rerender(<DatePicker aria-label="Day" value="2026-07-27" />);
    expect(input.value).toBe("2026-08");
  });

  it("emits onValueChange only for complete dates", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <DatePicker aria-label="Day" value="" onValueChange={onValueChange} />,
    );
    const input = getInput(container);

    fireEvent.change(input, { target: { value: "2026-08" } });
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "2026-08-01" } });
    expect(onValueChange).toHaveBeenCalledWith("2026-08-01");
  });

  it("never emits an impossible day and keeps the typed text", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <DatePicker aria-label="Day" value="" onValueChange={onValueChange} />,
    );
    const input = getInput(container);

    fireEvent.change(input, { target: { value: "2025-02-31" } });
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input.value).toBe("2025-02-31");

    fireEvent.change(input, { target: { value: "2024-02-29" } });
    expect(onValueChange).toHaveBeenCalledWith("2024-02-29");
  });

  it("calls onClear when the text is emptied", () => {
    const onClear = vi.fn();
    const { container } = render(
      <DatePicker aria-label="Day" value="2026-07-27" onClear={onClear} />,
    );
    fireEvent.change(getInput(container), { target: { value: "" } });
    expect(onClear).toHaveBeenCalled();
  });

  it("puts its id and error state on the text box", () => {
    const { container } = render(
      <DatePicker id="played-on" aria-invalid aria-describedby="played-on-error" />,
    );
    const input = getInput(container);
    expect(input).toHaveAttribute("id", "played-on");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "played-on-error");
  });

  it("names its text box with the aria-label it is given", () => {
    render(<DatePicker aria-label="Event day" value="" />);
    expect(screen.getByRole("textbox", { name: "Event day" })).toBeInTheDocument();
  });

  it("refuses at compile time a picker with neither an id nor an aria-label", () => {
    // @ts-expect-error -- an unnamed date picker is a text box no label points at
    const unnamed = <DatePicker value="" />;
    expect(unnamed).toBeTruthy();
  });
});
