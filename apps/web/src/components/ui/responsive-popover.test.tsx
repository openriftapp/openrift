import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "./button";
import { PickerList, PickerRow } from "./picker-list";
import {
  ResponsivePopover,
  ResponsivePopoverContent,
  ResponsivePopoverTrigger,
} from "./responsive-popover";

const mdUp = vi.hoisted(() => ({ value: true }));

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => !mdUp.value,
}));

function Harness({
  onOpenChange = vi.fn(),
  onPick = vi.fn(),
  onContentClick,
  hideTitle,
}: {
  onOpenChange?: (open: boolean) => void;
  onPick?: () => void;
  onContentClick?: () => void;
  hideTitle?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState("");
  return (
    <ResponsivePopover
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        setOpen(next);
      }}
    >
      <ResponsivePopoverTrigger render={<Button>Pick a deck</Button>} />
      <ResponsivePopoverContent
        title="Your decks"
        description="Choose one."
        hideTitle={hideTitle}
        onClick={onContentClick}
      >
        <PickerList highlightedId={highlightedId} onHighlightChange={setHighlightedId}>
          <PickerRow
            value="jinx"
            onSelect={() => {
              onPick();
              setOpen(false);
            }}
          >
            Jinx aggro
          </PickerRow>
        </PickerList>
      </ResponsivePopoverContent>
    </ResponsivePopover>
  );
}

describe("ResponsivePopover", () => {
  beforeEach(() => {
    mdUp.value = true;
  });

  it("opens an anchored popover from md up", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Pick a deck" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    const popup = screen.getByRole("dialog", { name: "Your decks" });
    expect(popup.dataset.slot).toBe("popover-content");
    expect(document.querySelector("[data-slot=drawer-popup]")).toBeNull();
    expect(screen.queryByText("Choose one.")).not.toBeInTheDocument();
  });

  it("opens a bottom drawer with a title below md", async () => {
    mdUp.value = false;
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Pick a deck" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByText("Your decks").dataset.slot).toBe("drawer-title");
    expect(screen.getByText("Choose one.")).toBeInTheDocument();
    expect(document.querySelector("[data-slot=popover-content]")).toBeNull();
  });

  it("grows picker rows to the touch control height in the drawer", async () => {
    mdUp.value = false;
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Pick a deck" }));
    const body = document.querySelector("[data-slot=responsive-popover-body]");
    expect(body?.className).toContain("**:data-[slot=picker-row]:min-h-(--control-h)");
    expect(body?.contains(screen.getByText("Jinx aggro"))).toBe(true);
  });

  it("keeps a hidden drawer title in the accessibility tree", async () => {
    mdUp.value = false;
    const user = userEvent.setup();
    render(<Harness hideTitle />);
    await user.click(screen.getByRole("button", { name: "Pick a deck" }));
    expect(screen.getByText("Your decks").closest("[data-slot=drawer-header]")).toHaveClass(
      "sr-only",
    );
  });

  it.each([true, false])("picks a row and forwards content clicks (md up: %s)", async (up) => {
    mdUp.value = up;
    const user = userEvent.setup();
    const onPick = vi.fn();
    const onContentClick = vi.fn();
    render(<Harness onPick={onPick} onContentClick={onContentClick} />);
    await user.click(screen.getByRole("button", { name: "Pick a deck" }));
    await user.click(screen.getByText("Jinx aggro"));
    expect(onPick).toHaveBeenCalledOnce();
    expect(onContentClick).toHaveBeenCalled();
  });

  it("forwards clicks on the drawer's viewport outside the sheet", async () => {
    mdUp.value = false;
    const user = userEvent.setup();
    const onContentClick = vi.fn();
    render(<Harness onContentClick={onContentClick} />);
    await user.click(screen.getByRole("button", { name: "Pick a deck" }));
    document.querySelector<HTMLElement>("[data-slot=drawer-viewport]")?.click();
    expect(onContentClick).toHaveBeenCalled();
  });
});
