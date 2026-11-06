import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { SourceNameField } from "./source-upload-dialog";

const NAMES = ["Piltover Archive", "Zaun Ledger"];

function Harness({ initial = "", onChange }: { initial?: string; onChange?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <SourceNameField
        names={NAMES}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <output aria-label="Current name">{value}</output>
    </>
  );
}

describe("SourceNameField", () => {
  it("labels the input", () => {
    render(<Harness />);

    expect(screen.getByRole("combobox", { name: /Source name/u })).toBeInTheDocument();
  });

  it("takes typed text as the name without picking anything", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole("combobox"), "Vendetta");

    expect(screen.getByLabelText("Current name")).toHaveTextContent("Vendetta");
  });

  it("keeps typed text after the popup closes", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole("combobox"), "Vendetta");
    await user.keyboard("{Escape}");
    await user.tab();

    expect(screen.getByLabelText("Current name")).toHaveTextContent("Vendetta");
    expect(screen.getByRole("combobox")).toHaveValue("Vendetta");
  });

  it("picks an existing source", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole("combobox"), "zaun");
    await user.click(await screen.findByRole("option", { name: "Zaun Ledger" }));

    expect(screen.getByLabelText("Current name")).toHaveTextContent("Zaun Ledger");
    expect(screen.getByRole("combobox")).toHaveValue("Zaun Ledger");
  });

  it("offers the typed text as a new source and keeps it when picked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(screen.getByRole("combobox"), "Vendetta");
    await user.click(await screen.findByRole("option", { name: "Create “Vendetta”" }));

    expect(onChange).toHaveBeenLastCalledWith("Vendetta");
    expect(screen.getByRole("combobox")).toHaveValue("Vendetta");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("offers no create row for a name that already exists", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole("combobox"), "zaun ledger");

    expect(await screen.findByRole("option", { name: "Zaun Ledger" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Create/u })).not.toBeInTheDocument();
  });

  it("shows no check mark on the create row or a picked source", async () => {
    const user = userEvent.setup();
    render(<Harness initial="Zaun Ledger" />);

    await user.clear(screen.getByRole("combobox"));
    await user.type(screen.getByRole("combobox"), "Zaun");

    const existing = await screen.findByRole("option", { name: "Zaun Ledger" });
    const create = screen.getByRole("option", { name: "Create “Zaun”" });
    expect(existing).not.toHaveAttribute("aria-selected", "true");
    expect(create).not.toHaveAttribute("aria-selected", "true");
  });

  it("selects the whole name on focus", async () => {
    const user = userEvent.setup();
    render(<Harness initial="Zaun Ledger" />);

    await user.click(screen.getByRole("combobox"));

    const input = screen.getByRole<HTMLInputElement>("combobox");
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Zaun Ledger".length);
  });
});
