import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let coarsePointer = false;

vi.mock("@/hooks/use-coarse-pointer", () => ({
  useCoarsePointer: () => coarsePointer,
}));

const { TouchTooltip } = await import("./touch-tooltip");

describe("TouchTooltip", () => {
  beforeEach(() => {
    coarsePointer = false;
  });

  it("wraps its children in a tooltip trigger on a fine pointer", () => {
    render(<TouchTooltip content="Seed 4">#4</TouchTooltip>);

    const trigger = screen.getByRole("button", { name: "#4" });
    expect(trigger).toHaveAttribute("data-slot", "tooltip-trigger");
    fireEvent.click(trigger);
    expect(screen.queryByText("Seed 4")).not.toBeInTheDocument();
  });

  it("opens the content on tap on a coarse pointer", () => {
    coarsePointer = true;
    render(<TouchTooltip content="Seed 4">#4</TouchTooltip>);

    const trigger = screen.getByRole("button", { name: "#4" });
    expect(trigger).toHaveAttribute("data-slot", "popover-trigger");
    fireEvent.click(trigger);
    expect(screen.getByText("Seed 4")).toBeInTheDocument();
  });

  it("takes an accessible name that overrides the visible text", () => {
    render(
      <TouchTooltip content="Seed 4" aria-label="Seed 4">
        #4
      </TouchTooltip>,
    );

    expect(screen.getByRole("button", { name: "Seed 4" })).toBeInTheDocument();
  });
});
