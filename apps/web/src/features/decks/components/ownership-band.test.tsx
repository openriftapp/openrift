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
  it.each([
    { name: "a locked band", exact: 0, locked: 3, lockNote: true },
    { name: "a band with no locked copy", exact: 2, locked: 0, lockNote: false },
  ])(
    "opens the card's collections from $name, explaining the lock: $lockNote",
    async ({ exact, locked, lockNote }) => {
      render(
        <OwnershipBandPopover
          cardId="card-1"
          cardName="Discipline"
          quantity={exact + locked}
          band={{ exact, other: 0, borrowed: 0, locked, missing: 0 }}
        />,
      );
      await userEvent.click(
        screen.getByRole("button", { name: "Where your copies of Discipline are" }),
      );
      expect(await screen.findByText("breakdown of card-1")).toBeTruthy();
      expect(screen.queryByText(/excluded from deck building/u) !== null).toBe(lockNote);
    },
  );

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
