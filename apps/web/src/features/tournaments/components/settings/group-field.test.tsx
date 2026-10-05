import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/groups/hooks/use-friend-groups", () => ({
  useFriendGroups: () => ({ data: { items: [{ id: "group-1", name: "Zaun Thursdays" }] } }),
}));

const { GroupField } = await import("./group-field");

describe("GroupField", () => {
  it("reports a picked group", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GroupField value="none" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Group" }));
    await user.click(await screen.findByRole("option", { name: "Zaun Thursdays" }));

    expect(onChange).toHaveBeenCalledWith("group-1");
  });

  it("keeps a linked group the viewer is not in, under its name", () => {
    render(<GroupField value="group-2" linkedGroupName="Ionia Weekly" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Group" })).toHaveTextContent("Ionia Weekly");
  });

  it("falls back to a generic label for an unnamed linked group", () => {
    render(<GroupField value="group-2" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Group" })).toHaveTextContent("Linked group");
  });
});
