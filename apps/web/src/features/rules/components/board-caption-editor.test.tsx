import type { BoardPiece } from "@openrift/shared/board-state";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({
    allPrintings: [],
    cardsById: {},
    printingsById: {},
    printingsByCardId: new Map(),
    sets: [],
  }),
}));

const { BoardCaptionEditor } = await import("./board-caption-editor");

function piece(overrides: Partial<BoardPiece> & { id: string; name?: string }): BoardPiece {
  const { name, ...rest } = overrides;
  return {
    owner: "A",
    zone: { kind: "battlefield", index: 0 },
    kind: "unit",
    card: { cardId: "11111111-1111-1111-1111-111111111111", name: name ?? "Ashe" },
    exhausted: false,
    keywords: [],
    damage: 0,
    might: 0,
    highlight: false,
    ...rest,
  };
}

const PIECES = [
  piece({ id: "p1", name: "Ashe" }),
  piece({ id: "p2", name: "Ashe", zone: { kind: "champion" } }),
  piece({ id: "p3", name: "Poro" }),
];

function renderEditor(pieces: readonly BoardPiece[] = PIECES) {
  const onChange = vi.fn();
  function Harness() {
    const [value, setValue] = useState("");
    return (
      <BoardCaptionEditor
        id="caption"
        value={value}
        onChange={(next) => {
          onChange(next);
          setValue(next);
        }}
        pieces={pieces}
      />
    );
  }
  render(<Harness />);
  return { onChange, textarea: screen.getByRole("textbox") };
}

function type(textarea: HTMLElement, value: string) {
  fireEvent.change(textarea, { target: { value, selectionStart: value.length } });
}

describe("BoardCaptionEditor", () => {
  it("lists the pieces matching the text after @", () => {
    const { textarea } = renderEditor();
    type(textarea, "Exhaust @as");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Ashe");
  });

  it("shows the zone of each piece so duplicates are distinguishable", () => {
    const { textarea } = renderEditor();
    type(textarea, "@ashe");
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("Battlefield 1");
    expect(options[1]).toHaveTextContent("Champion A");
  });

  it("inserts a card reference on Enter", () => {
    const { textarea, onChange } = renderEditor();
    type(textarea, "Exhaust @as");
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("Exhaust [[card:p1]]");
  });

  it("inserts the highlighted piece after ArrowDown", () => {
    const { textarea, onChange } = renderEditor();
    type(textarea, "@as");
    fireEvent.keyDown(textarea, { key: "ArrowDown" });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("[[card:p2]]");
  });

  it("inserts on a click without losing the surrounding text", () => {
    const { textarea, onChange } = renderEditor();
    type(textarea, "Move @poro");
    fireEvent.click(screen.getByRole("option", { name: /Poro/u }));
    expect(onChange).toHaveBeenLastCalledWith("Move [[card:p3]]");
  });

  it("closes the list on Escape", () => {
    const { textarea } = renderEditor();
    type(textarea, "@as");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("stays closed when nothing matches", () => {
    const { textarea } = renderEditor();
    type(textarea, "@zzzz");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("shows the rule-reference hint alongside the list", () => {
    const { textarea } = renderEditor();
    type(textarea, "@");
    expect(screen.getByText("Rules: [[103.2]] core, [[t:4.1]] tournament")).toBeInTheDocument();
  });
});
