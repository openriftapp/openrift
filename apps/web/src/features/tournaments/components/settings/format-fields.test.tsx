import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PlayModeField, RoundsField } from "./format-fields";

describe("PlayModeField", () => {
  it("reports a switch to 2v2", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PlayModeField value="1v1" groupCut={false} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Play mode" }));
    await user.click(await screen.findByRole("option", { name: "2v2" }));

    expect(onChange).toHaveBeenCalledWith("2v2");
  });

  it("offers only 1v1 for a group cut", async () => {
    const user = userEvent.setup();
    render(<PlayModeField value="1v1" groupCut onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox", { name: "Play mode" }));

    expect(await screen.findByRole("option", { name: "1v1" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "2v2" })).not.toBeInTheDocument();
  });

  it("disables the select", () => {
    render(<PlayModeField value="1v1" groupCut={false} disabled onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Play mode" })).toBeDisabled();
  });
});

describe("RoundsField", () => {
  it("reports a picked rounds choice", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RoundsField value="pod" teams={false} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Rounds" }));
    await user.click(await screen.findByRole("option", { name: "Swiss - BO3" }));

    expect(onChange).toHaveBeenCalledWith("swiss-bo3");
  });

  it("hides pods and the group cut for teams", async () => {
    const user = userEvent.setup();
    render(<RoundsField value="swiss-bo1" teams onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox", { name: "Rounds" }));

    expect(await screen.findByRole("option", { name: "Swiss - BO3" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "FFA" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Group stage + top cut - BO1" }),
    ).not.toBeInTheDocument();
  });

  it("does not report re-picking the current choice", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RoundsField value="pod" teams={false} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Rounds" }));
    await user.click(await screen.findByRole("option", { name: "FFA" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
