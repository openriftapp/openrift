import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

import { TierPicker } from "./tier-picker";

const mdUp = vi.hoisted(() => ({ value: true }));

vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => !mdUp.value }));

const ROWS = [{ label: "S" }, { label: "A" }, { label: "Pool", unranked: true }];

function Harness({
  currentRowIndex,
  onPick = vi.fn(),
  onUnrank = vi.fn(),
}: {
  currentRowIndex: number | null;
  onPick?: (rowIndex: number) => void;
  onUnrank?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TierPicker
      rows={ROWS}
      cardName="Jinx"
      currentRowIndex={currentRowIndex}
      onPick={onPick}
      onUnrank={onUnrank}
      open={open}
      onOpenChange={setOpen}
      trigger={<Button>Rank Jinx</Button>}
    />
  );
}

describe("TierPicker", () => {
  beforeEach(() => {
    mdUp.value = true;
  });

  it.each([true, false])("picks a tier and closes (md up: %s)", async (up) => {
    mdUp.value = up;
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Harness currentRowIndex={null} onPick={onPick} />);

    await user.click(screen.getByRole("button", { name: "Rank Jinx" }));
    await user.click(screen.getByRole("option", { name: /A/u }));

    expect(onPick).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("titles the phone drawer with the card and its prompt", async () => {
    mdUp.value = false;
    const user = userEvent.setup();
    render(<Harness currentRowIndex={null} />);

    await user.click(screen.getByRole("button", { name: "Rank Jinx" }));

    expect(screen.getByText("Jinx").dataset.slot).toBe("drawer-title");
    expect(screen.getByText("Pick a tier for this card.")).toBeInTheDocument();
  });

  it("offers the pool only for a ranked card", async () => {
    const user = userEvent.setup();
    render(<Harness currentRowIndex={null} />);
    await user.click(screen.getByRole("button", { name: "Rank Jinx" }));

    expect(screen.queryByText("Move back to the pool")).not.toBeInTheDocument();
  });

  it("marks the current tier, highlights it on open, and moves the card back to the pool", async () => {
    const user = userEvent.setup();
    const onUnrank = vi.fn();
    render(<Harness currentRowIndex={0} onUnrank={onUnrank} />);
    await user.click(screen.getByRole("button", { name: "Rank Jinx" }));

    const current = screen.getByRole("option", { name: /Current/u });
    expect(current).toHaveTextContent("S");
    expect(current).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("option", { name: /Move back to the pool/u }));
    expect(onUnrank).toHaveBeenCalledOnce();
  });

  it("picks the highlighted tier from the keyboard", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<Harness currentRowIndex={0} onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: "Rank Jinx" }));

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onPick).toHaveBeenCalledWith(1);
  });
});
