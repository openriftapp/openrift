import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SwitchField } from "./switch-field";

describe("SwitchField", () => {
  it("names the switch by its label and reports the toggled state", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <SwitchField
        id="t-test"
        label="Track player regions"
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );

    await user.click(screen.getByRole("switch", { name: "Track player regions" }));

    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything());
  });

  it("shows the hint under the switch when one is given", () => {
    render(
      <SwitchField
        id="t-test"
        label="Open self-registration"
        hint="Players request a spot through a link."
        checked
        onCheckedChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Players request a spot through a link.")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Open self-registration" })).toBeChecked();
  });

  it("ignores clicks while disabled", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(
      <SwitchField
        id="t-test"
        label="Enable pairings"
        checked={false}
        disabled
        onCheckedChange={onCheckedChange}
      />,
    );

    await user.click(screen.getByRole("switch", { name: "Enable pairings" }));

    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
