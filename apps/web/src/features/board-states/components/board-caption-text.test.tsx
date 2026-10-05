import type { BoardPiece } from "@openrift/shared/board-state";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  createLink: (component: unknown) => component,
}));

const { BoardCaptionText } = await import("./board-caption-text");

const pins = { coreRulesVersion: "1.0", tournamentRulesVersion: null };

function piece(overrides: Partial<BoardPiece> & { id: string }): BoardPiece {
  return {
    owner: "A",
    zone: { kind: "battlefield", index: 0 },
    kind: "unit",
    card: { cardId: "11111111-1111-1111-1111-111111111111", name: "Ashe" },
    exhausted: false,
    facedown: false,
    keywords: [],
    damage: 0,
    might: 0,
    buffs: 0,
    highlight: false,
    ...overrides,
  };
}

describe("BoardCaptionText", () => {
  it("links a pinned core rule", () => {
    render(<BoardCaptionText text="See [[103.2]]." pins={pins} pieces={[]} />);
    expect(screen.getByRole("link", { name: "§ 103.2" })).toHaveAttribute(
      "href",
      "/rules/$kind/$version",
    );
  });

  it("links a lettered sub-rule", () => {
    render(<BoardCaptionText text="See [[466.1.a.2]]." pins={pins} pieces={[]} />);
    expect(screen.getByRole("link", { name: "§ 466.1.a.2" })).toBeInTheDocument();
  });

  it("mutes a rule the pinned version does not have and keeps known rules linked", () => {
    render(
      <BoardCaptionText
        text="[[103.2]] and [[999.9]]"
        pins={pins}
        pieces={[]}
        knownRules={{ core: new Set(["103.2"]) }}
      />,
    );
    expect(screen.getByRole("link", { name: "§ 103.2" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "§ 999.9" })).toBeNull();
    expect(screen.getByText("§ 999.9")).toHaveAttribute("title", "Not in rules 1.0");
  });

  it("keeps rules linked while the pinned rule numbers are still loading", () => {
    render(<BoardCaptionText text="[[999.9]]" pins={pins} pieces={[]} knownRules={{}} />);
    expect(screen.getByRole("link", { name: "§ 999.9" })).toBeInTheDocument();
  });

  it("renders a chain chip with the entry's position and reports hover", () => {
    const onHoverChain = vi.fn();
    render(
      <BoardCaptionText
        text="[[chain:c2]] resolves first"
        pins={pins}
        pieces={[
          piece({
            id: "p1",
            card: { cardId: "11111111-1111-1111-1111-111111111111", name: "Yasuo" },
          }),
        ]}
        chain={[
          { id: "c1", owner: "A", type: "spell", label: "Hypothetical spell" },
          { id: "c2", owner: "B", type: "triggered", source: "p1" },
        ]}
        onHoverChain={onHoverChain}
      />,
    );
    const chip = screen.getByRole("button", { name: "Highlight Yasuo on the board" });
    expect(chip).toHaveTextContent("Yasuo2");
    fireEvent.mouseEnter(chip);
    expect(onHoverChain).toHaveBeenLastCalledWith("c2");
    fireEvent.mouseLeave(chip);
    expect(onHoverChain).toHaveBeenLastCalledWith(null);
  });

  it("marks a reference to a missing chain entry as removed", () => {
    render(<BoardCaptionText text="[[chain:c9]]" pins={pins} pieces={[]} chain={[]} />);
    expect(screen.getByText("removed chain entry")).toBeInTheDocument();
  });

  it("renders an unpinned rule as plain text", () => {
    render(<BoardCaptionText text="See [[t:4.1]]." pins={pins} pieces={[]} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("§ T 4.1")).toBeInTheDocument();
  });

  it("renders a card chip with the numeral of a duplicated name", () => {
    render(
      <BoardCaptionText
        text="Exhaust [[card:p2]]."
        pins={pins}
        pieces={[piece({ id: "p1" }), piece({ id: "p2" })]}
      />,
    );
    const chip = screen.getByRole("button", { name: "Highlight Ashe on the board" });
    expect(chip).toHaveTextContent("Ashe");
    expect(chip).toHaveTextContent("2");
  });

  it("omits the numeral when the name is unique", () => {
    render(<BoardCaptionText text="[[card:p1]]" pins={pins} pieces={[piece({ id: "p1" })]} />);
    expect(screen.getByRole("button", { name: "Highlight Ashe on the board" })).toHaveTextContent(
      /^Ashe$/u,
    );
  });

  it("marks a reference to a missing piece as removed", () => {
    render(<BoardCaptionText text="Gone: [[card:zz]]" pins={pins} pieces={[]} />);
    expect(screen.getByText("removed card")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("reports hover and leave through onHoverPiece", () => {
    const onHoverPiece = vi.fn();
    render(
      <BoardCaptionText
        text="[[card:p1]]"
        pins={pins}
        pieces={[piece({ id: "p1" })]}
        onHoverPiece={onHoverPiece}
      />,
    );
    const chip = screen.getByRole("button", { name: "Highlight Ashe on the board" });
    fireEvent.mouseEnter(chip);
    expect(onHoverPiece).toHaveBeenLastCalledWith("p1");
    fireEvent.mouseLeave(chip);
    expect(onHoverPiece).toHaveBeenLastCalledWith(null);
  });

  it("keeps the highlight after a tap and clears it on the next tap", () => {
    const onHoverPiece = vi.fn();
    render(
      <BoardCaptionText
        text="[[card:p1]]"
        pins={pins}
        pieces={[piece({ id: "p1" })]}
        onHoverPiece={onHoverPiece}
      />,
    );
    const chip = screen.getByRole("button", { name: "Highlight Ashe on the board" });
    fireEvent.click(chip);
    fireEvent.mouseLeave(chip);
    expect(onHoverPiece).toHaveBeenLastCalledWith("p1");
    fireEvent.click(chip);
    expect(onHoverPiece).toHaveBeenLastCalledWith(null);
  });
});
