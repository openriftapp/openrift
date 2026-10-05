import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterChip } from "./filter-chip";

describe("FilterChip", () => {
  it("removes the value through the labelled button", () => {
    const onRemove = vi.fn();
    render(<FilterChip label="Fury" onRemove={onRemove} removeLabel="Remove Domain: Fury" />);
    expect(screen.getByText("Fury")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove Domain: Fury" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("renders the icon before the label", () => {
    render(
      <FilterChip
        label="Fury"
        icon={<span data-testid="icon" />}
        onRemove={vi.fn()}
        removeLabel="Remove Fury"
      />,
    );
    expect(screen.getByTestId("icon").nextElementSibling).toHaveTextContent("Fury");
  });

  it("strikes through an excluded value and tints it destructive", () => {
    const { container } = render(
      <FilterChip label="Calm" excluded onRemove={vi.fn()} removeLabel="Remove Calm" />,
    );
    const chip = container.firstElementChild;
    expect(chip).toHaveAttribute("data-excluded");
    expect(chip).toHaveClass("text-destructive", "border-destructive/40");
    expect(screen.getByText("Calm")).toHaveClass("line-through");
  });

  it("leaves an included value unmarked", () => {
    const { container } = render(
      <FilterChip label="Calm" onRemove={vi.fn()} removeLabel="Remove Calm" />,
    );
    expect(container.firstElementChild).not.toHaveAttribute("data-excluded");
    expect(screen.getByText("Calm")).not.toHaveClass("line-through");
  });
});
