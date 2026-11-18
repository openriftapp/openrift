import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StripActionButton, StripIconButton } from "./card-strip";

describe("strip buttons", () => {
  it.each([
    {
      kind: "StripIconButton",
      renderButton: (onAction: () => void) => (
        <StripIconButton aria-label="Add one copy" onClick={onAction} />
      ),
      name: "Add one copy",
    },
    {
      kind: "StripActionButton",
      renderButton: (onAction: () => void) => (
        <StripActionButton onClick={onAction}>Choose</StripActionButton>
      ),
      name: "Choose",
    },
  ])(
    "$kind fires its handler but stops propagation to the tile",
    async ({ renderButton, name }) => {
      const onTileClick = vi.fn();
      const onAction = vi.fn();
      render(
        // oxlint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- stands in for the card tile's Pressable
        <div onClick={onTileClick}>{renderButton(onAction)}</div>,
      );
      await userEvent.click(screen.getByRole("button", { name }));
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(onTileClick).not.toHaveBeenCalled();
    },
  );
});

describe("StripIconButton", () => {
  it("stays out of the tab order and respects disabled", async () => {
    const onAction = vi.fn();
    render(<StripIconButton aria-label="Add one copy" disabled onClick={onAction} />);
    const button = screen.getByLabelText("Add one copy") as HTMLButtonElement;
    expect(button.tabIndex).toBe(-1);
    expect(button.disabled).toBe(true);
    await userEvent.click(button);
    expect(onAction).not.toHaveBeenCalled();
  });
});
