import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/tournaments/hooks/use-organizations", () => ({
  useMyOrganizations: () => ({ data: { items: [{ id: "org-1", name: "Piltover Open" }] } }),
}));

const { HostField } = await import("./host-field");

describe("HostField", () => {
  it("offers the viewer and their organizations, and reports the pick", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HostField value="user" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Host" }));
    await user.click(await screen.findByRole("option", { name: "Piltover Open" }));

    expect(onChange).toHaveBeenCalledWith("org-1");
  });

  it("does not report re-picking the current host", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HostField value="user" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Host" }));
    await user.click(await screen.findByRole("option", { name: "You (personal)" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables the select", () => {
    render(<HostField value="user" disabled onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Host" })).toBeDisabled();
  });
});
