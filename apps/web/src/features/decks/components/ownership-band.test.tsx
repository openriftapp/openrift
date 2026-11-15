import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/cards/components/owned-card-breakdown", () => ({
  OwnedCardBreakdown: ({ cardId }: { cardId: string }) => <span>breakdown of {cardId}</span>,
}));

import { LabeledOwnershipBand, OwnershipBandPopover } from "./ownership-band";

describe("LabeledOwnershipBand", () => {
  it("labels each present segment and sizes it by copy count", () => {
    render(
      <LabeledOwnershipBand
        quantity={3}
        band={{ exact: 2, other: 0, borrowed: 0, locked: 0, missing: 1 }}
      />,
    );
    expect(screen.getByText("Owned").style.flexGrow).toBe("2");
    expect(screen.getByText("Missing").style.flexGrow).toBe("1");
    expect(screen.queryByText("Borrowed")).toBeNull();
  });
});

describe("OwnershipBandPopover", () => {
  it("opens the card's collections from a locked band and explains the lock", async () => {
    render(
      <OwnershipBandPopover
        cardId="card-1"
        cardName="Discipline"
        quantity={3}
        band={{ exact: 0, other: 0, borrowed: 0, locked: 3, missing: 0 }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Where your copies of Discipline are" }),
    );
    expect(await screen.findByText("breakdown of card-1")).toBeTruthy();
    expect(screen.getByText(/excluded from deck building/u)).toBeTruthy();
  });

  it("omits the lock note when no copy is locked", async () => {
    render(
      <OwnershipBandPopover
        cardId="card-1"
        cardName="Discipline"
        quantity={2}
        band={{ exact: 2, other: 0, borrowed: 0, locked: 0, missing: 0 }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Where your copies of Discipline are" }),
    );
    expect(await screen.findByText("breakdown of card-1")).toBeTruthy();
    expect(screen.queryByText(/excluded from deck building/u)).toBeNull();
  });

  it("is not a button when the viewer owns no copy", () => {
    render(
      <OwnershipBandPopover
        cardId="card-1"
        cardName="Discipline"
        quantity={2}
        band={{ exact: 0, other: 0, borrowed: 1, locked: 0, missing: 1 }}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Missing")).toBeTruthy();
  });
});
