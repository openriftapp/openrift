import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MultiSelectCell, SuggestionCombobox } from "./candidate-cell-editors";

vi.mock("@/features/contribute/components/form-fields", () => ({ ChipInput: () => null }));

const SUGGESTIONS = ["Piltover", "Zaun", "Ionia"];

function renderSuggestions(defaultValue = "") {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  render(
    <SuggestionCombobox
      suggestions={SUGGESTIONS}
      defaultValue={defaultValue}
      onCommit={onCommit}
      onCancel={onCancel}
    />,
  );
  return { onCommit, onCancel };
}

describe("SuggestionCombobox", () => {
  it("lists every suggestion right away", () => {
    renderSuggestions();
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(SUGGESTIONS);
  });

  it("commits the typed text on Enter once", async () => {
    const user = userEvent.setup();
    const { onCommit } = renderSuggestions();

    await user.type(screen.getByRole("combobox"), "Shurima{Enter}");

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("Shurima");
  });

  it("commits a highlighted suggestion on Enter once", async () => {
    const user = userEvent.setup();
    const { onCommit } = renderSuggestions();

    await user.type(screen.getByRole("combobox"), "zau");
    await user.keyboard("{ArrowDown}{Enter}");

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("Zaun");
  });

  it("commits a clicked suggestion", async () => {
    const user = userEvent.setup();
    const { onCommit } = renderSuggestions();

    await user.click(screen.getByRole("option", { name: "Ionia" }));

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("Ionia");
  });

  it("cancels on Escape", async () => {
    const user = userEvent.setup();
    const { onCancel, onCommit } = renderSuggestions("Zaun");

    await user.type(screen.getByRole("combobox"), "{Escape}");

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("shows the empty text when nothing matches", async () => {
    const user = userEvent.setup();
    renderSuggestions();

    await user.type(screen.getByRole("combobox"), "zzz");

    expect(screen.getByText("No matches")).toBeInTheDocument();
  });
});

const OPTIONS = [
  { value: "ogn", label: "Origins" },
  { value: "sfd", label: "Spiritforged" },
];

describe("MultiSelectCell", () => {
  it("opens at once and summarises the draft on the trigger", async () => {
    render(
      <MultiSelectCell
        label="Sets"
        options={OPTIONS}
        value={["sfd"]}
        onCommit={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Edit Sets" })).toHaveTextContent("Spiritforged");
    expect(await screen.findByRole("option", { name: "Origins" })).toBeInTheDocument();
  });

  it("commits the changed draft when it closes", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const onClose = vi.fn();
    render(
      <MultiSelectCell
        label="Sets"
        options={OPTIONS}
        value={["sfd"]}
        onCommit={onCommit}
        onClose={onClose}
      />,
    );

    await user.click(await screen.findByRole("option", { name: "Origins" }));
    expect(onCommit).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(["sfd", "ogn"]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes without a commit when nothing changed", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const onClose = vi.fn();
    render(
      <MultiSelectCell
        label="Sets"
        options={OPTIONS}
        value={["sfd"]}
        onCommit={onCommit}
        onClose={onClose}
      />,
    );

    await screen.findByRole("option", { name: "Origins" });
    await user.keyboard("{Escape}");

    expect(onCommit).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("commits null when the draft is emptied", async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <MultiSelectCell
        label="Sets"
        options={OPTIONS}
        value={["sfd"]}
        onCommit={onCommit}
        onClose={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("option", { name: "Spiritforged" }));
    await user.keyboard("{Escape}");

    expect(onCommit).toHaveBeenCalledExactlyOnceWith(null);
  });
});
