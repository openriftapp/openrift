import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SetPicker } from "./set-picker";

vi.mock("@/features/cards/hooks/use-sets", () => ({
  useSets: () => ({
    data: {
      sets: [
        { id: "set-ogn", slug: "OGN", name: "Origins" },
        { id: "set-sfd", slug: "SFD", name: "Spiritforged" },
      ],
    },
  }),
}));

describe("SetPicker", () => {
  it("shows the selected set's name", () => {
    render(<SetPicker value="set-sfd" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Set" })).toHaveTextContent("Spiritforged");
  });

  it("finds a set by its code", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SetPicker value="" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Set" }));
    await user.type(await screen.findByPlaceholderText("Search sets"), "sfd");
    expect(screen.queryByRole("option", { name: /Origins/u })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /Spiritforged/u }));

    expect(onChange).toHaveBeenCalledWith("set-sfd");
  });

  it("reports the none row as an empty id", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SetPicker value="set-ogn" onChange={onChange} noneLabel="No set" />);

    await user.click(screen.getByRole("combobox", { name: "Set" }));
    await user.click(await screen.findByRole("option", { name: "No set" }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("shows the none label in the trigger for an empty value", () => {
    render(<SetPicker value="" onChange={vi.fn()} noneLabel="No set" />);

    expect(screen.getByRole("combobox", { name: "Set" })).toHaveTextContent("No set");
  });
});
