import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NameField } from "./name-field";

describe("NameField", () => {
  it("reports every keystroke", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NameField id="t-name" value="" onChange={onChange} />);

    await user.type(screen.getByLabelText("Tournament name"), "S");

    expect(onChange).toHaveBeenCalledWith("S");
  });

  it("caps the name at 120 characters", () => {
    render(<NameField id="t-name" value="" onChange={vi.fn()} />);

    expect(screen.getByLabelText("Tournament name")).toHaveAttribute("maxlength", "120");
  });

  it("is read-only while disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NameField id="t-name" value="Summoner Skirmish" disabled onChange={onChange} />);

    await user.type(screen.getByLabelText("Tournament name"), "x");

    expect(screen.getByLabelText("Tournament name")).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
