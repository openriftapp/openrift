import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SelectionMark, SelectionRowMark, SelectionStamp, SignetGlyph } from "./selection-mark";

describe("SignetGlyph", () => {
  it("draws the rim, its echo and the check once struck", () => {
    const { container } = render(<SignetGlyph checked />);
    expect(container.querySelectorAll("circle")).toHaveLength(3);
    const check = container.querySelector("path");
    expect(check?.getAttribute("class")).toContain("stroke-gilt");
  });

  it("drops the echo and the check when empty", () => {
    const { container } = render(<SignetGlyph />);
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(container.querySelector("path")).toBeNull();
  });

  it("takes the surface gold away from card art", () => {
    const { container } = render(<SignetGlyph checked tone="surface" />);
    expect(container.querySelector("path")?.getAttribute("class")).toContain(
      "stroke-border-accent",
    );
    expect(container.innerHTML).not.toContain("stroke-gilt");
  });
});

describe("SelectionStamp", () => {
  it("is decorative and always struck", () => {
    const { container } = render(<SelectionStamp tone="success" />);
    const stamp = container.firstElementChild!;
    expect(stamp.getAttribute("aria-hidden")).toBe("true");
    expect(stamp.className).toContain("pointer-events-none");
    expect(container.querySelectorAll("circle")).toHaveLength(3);
    expect(container.querySelector("path")?.getAttribute("class")).toContain("stroke-success");
  });
});

describe("SelectionMark", () => {
  it("is a labelled checkbox that reports its state", () => {
    render(<SelectionMark label="Select card" checked onCheckedChange={() => {}} />);
    expect(screen.getByRole("checkbox", { name: "Select card" })).toBeChecked();
  });

  it("grows when picked", () => {
    const { rerender } = render(
      <SelectionMark label="Select card" checked={false} onCheckedChange={() => {}} />,
    );
    const empty = screen.getByRole("checkbox").className;
    rerender(<SelectionMark label="Select card" checked onCheckedChange={() => {}} />);
    const struck = screen.getByRole("checkbox").className;
    expect(empty).toContain("w-[clamp(1.25rem,26%,3rem)]");
    expect(struck).toContain("w-[clamp(1.75rem,38%,4.5rem)]");
  });

  it("toggles without also activating the card behind it", async () => {
    const onCheckedChange = vi.fn();
    const onCardClick = vi.fn();
    render(
      // oxlint-disable-next-line eslint-plugin-jsx-a11y/no-static-element-interactions, eslint-plugin-jsx-a11y/click-events-have-key-events -- stands in for the card's own click target
      <div onClick={onCardClick}>
        <SelectionMark label="Select card" checked={false} onCheckedChange={onCheckedChange} />
      </div>,
    );
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
  });
});

describe("SelectionRowMark", () => {
  it("keeps the role and label at control size", () => {
    render(<SelectionRowMark label="Select card" checked onCheckedChange={() => {}} />);
    const mark = screen.getByRole("checkbox", { name: "Select card" });
    expect(mark).toBeChecked();
    expect(mark.className).toContain("size-5");
  });
});
