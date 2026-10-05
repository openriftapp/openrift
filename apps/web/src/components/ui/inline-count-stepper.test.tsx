import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InlineCountStepper } from "./inline-count-stepper";

describe("InlineCountStepper", () => {
  it("fires each action and shows the count", () => {
    const onDecrement = vi.fn();
    const onIncrement = vi.fn();
    render(
      <InlineCountStepper
        count={3}
        decrementLabel="Remove a copy"
        incrementLabel="Add a copy"
        onDecrement={onDecrement}
        onIncrement={onIncrement}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove a copy" }));
    fireEvent.click(screen.getByRole("button", { name: "Add a copy" }));
    expect(onDecrement).toHaveBeenCalledOnce();
    expect(onIncrement).toHaveBeenCalledOnce();
  });

  it("keeps clicks from reaching the surrounding row", () => {
    const onRowClick = vi.fn();
    render(
      // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- test harness for propagation only
      <div onClick={onRowClick}>
        <InlineCountStepper
          count={1}
          decrementLabel="Remove a copy"
          incrementLabel="Add a copy"
          onIncrement={vi.fn()}
        />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add a copy" }));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("keeps the icon and the action on a button with a tooltip", () => {
    const onDecrement = vi.fn();
    render(
      <InlineCountStepper
        count={2}
        decrementLabel="Remove a copy"
        incrementLabel="Add a copy"
        onDecrement={onDecrement}
        decrementTooltip="Shift-click removes all"
      />,
    );
    const decrement = screen.getByRole("button", { name: "Remove a copy" });
    expect(decrement.querySelector("svg")).toBeInTheDocument();
    expect(decrement).toHaveAttribute("data-slot", "tooltip-trigger");
    fireEvent.click(decrement);
    expect(onDecrement).toHaveBeenCalledOnce();
  });

  it("disables a button whose action is omitted", () => {
    render(
      <InlineCountStepper
        count={0}
        decrementLabel="Remove a copy"
        incrementLabel="Add a copy"
        onIncrement={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Remove a copy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add a copy" })).toBeEnabled();
  });

  it("shows the bulk labels in bulk mode and marks the decrement destructive", () => {
    render(
      <InlineCountStepper
        count={4}
        decrementLabel="Remove a copy"
        incrementLabel="Add a copy"
        onDecrement={vi.fn()}
        onIncrement={vi.fn()}
        bulk
        bulkDecrementLabel="-4"
        bulkIncrementLabel="+2"
      />,
    );
    const decrement = screen.getByRole("button", { name: "Remove a copy" });
    expect(decrement).toHaveTextContent("-4");
    expect(decrement).toHaveClass("bg-destructive");
    expect(screen.getByRole("button", { name: "Add a copy" })).toHaveTextContent("+2");
  });

  it("keeps the icons in bulk mode when no bulk label is given", () => {
    render(
      <InlineCountStepper
        count={1}
        decrementLabel="Remove a copy"
        incrementLabel="Add a copy"
        onDecrement={vi.fn()}
        bulk
      />,
    );
    const decrement = screen.getByRole("button", { name: "Remove a copy" });
    expect(decrement).not.toHaveClass("bg-destructive");
    expect(decrement.querySelector("svg")).toBeInTheDocument();
  });

  it("ignores the bulk label on a disabled button", () => {
    render(
      <InlineCountStepper
        count={1}
        decrementLabel="Remove a copy"
        incrementLabel="Add a copy"
        bulk
        bulkIncrementLabel="+3"
      />,
    );
    expect(screen.getByRole("button", { name: "Add a copy" })).not.toHaveTextContent("+3");
  });
});
