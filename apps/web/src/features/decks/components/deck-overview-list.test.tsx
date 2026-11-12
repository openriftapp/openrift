import { labelMapOf } from "@openrift/shared/enum-label";
import type { Domain } from "@openrift/shared/types/enums";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { stubCardOwnership, stubDeckBuilderCard } from "@/test/factories";

import { DeckListRow, listRowCopies, reservedListCells } from "./deck-overview-list";

const DOMAIN_COLORS = { fury: "#ff0000" };

function renderRow({
  locked = 0,
  borrowed = 0,
  price,
  reserved,
  borrowedLenders,
  copyIndex,
}: {
  locked?: number;
  borrowed?: number;
  price?: number;
  reserved: { lock: boolean; borrowed: boolean; price: boolean };
  borrowedLenders?: Record<string, string[]>;
  copyIndex?: number;
}) {
  const card = stubDeckBuilderCard({
    cardId: "c-1",
    cardName: "Jinx",
    quantity: 2,
    power: 2,
    domains: ["fury" as Domain],
  });
  const { container } = render(
    <DeckListRow
      card={card}
      copyIndex={copyIndex}
      entry={stubCardOwnership({
        cardId: "c-1",
        needed: 2,
        owned: 1,
        shortfall: 1,
        locked,
        borrowed,
      })}
      rarityLabels={labelMapOf({})}
      domainLabels={labelMapOf({ fury: "Fury" })}
      domainColors={DOMAIN_COLORS}
      showOwnership
      reserved={reserved}
      borrowedLenders={borrowedLenders}
      fmtPrice={(cents) => `$${cents / 100}`}
      resolveRowPrinting={() => ({ printing: undefined, price, hoverPrintingId: null })}
    />,
  );
  const row = container.firstElementChild;
  if (!row) {
    throw new Error("row did not render");
  }
  return row;
}

const BOTH = { lock: true, borrowed: false, price: true };
const NEITHER = { lock: false, borrowed: false, price: false };
const WITH_BORROWED = { lock: true, borrowed: true, price: true };

describe("DeckListRow", () => {
  it("gives locked and unlocked rows the same cells once the list reserves the lock", () => {
    expect(renderRow({ locked: 0, price: 420, reserved: BOTH }).children.length).toBe(
      renderRow({ locked: 2, price: 420, reserved: BOTH }).children.length,
    );
  });

  it("gives priced and unpriced rows the same cells once the list reserves the price", () => {
    expect(renderRow({ price: undefined, reserved: BOTH }).children.length).toBe(
      renderRow({ price: 420, reserved: BOTH }).children.length,
    );
  });

  it("reserves neither cell when the list needs neither", () => {
    expect(renderRow({ price: 420, reserved: NEITHER }).children.length).toBe(
      renderRow({ price: 420, reserved: BOTH }).children.length - 2,
    );
  });

  it("gives borrowed and unborrowed rows the same cells once the list reserves it", () => {
    expect(renderRow({ borrowed: 0, price: 420, reserved: WITH_BORROWED }).children.length).toBe(
      renderRow({ borrowed: 2, price: 420, reserved: WITH_BORROWED }).children.length,
    );
  });

  it("spends no width on the borrow cell when nothing in the deck is borrowed", () => {
    expect(renderRow({ price: 420, reserved: BOTH }).children.length).toBe(
      renderRow({ price: 420, reserved: WITH_BORROWED }).children.length - 1,
    );
  });

  it("names the lender even when the row has no shortfall left", () => {
    const row = renderRow({
      borrowed: 2,
      reserved: WITH_BORROWED,
      borrowedLenders: { "c-1": ["Alice"] },
    });
    expect(row.textContent).toContain("2");
    expect(row.querySelector('[data-slot="tooltip-trigger"]')).not.toBeNull();
  });

  it("shows the power pips on phones", () => {
    const pips = renderRow({ reserved: NEITHER }).querySelector('[aria-label="Power 2 (Fury)"]');
    expect(pips?.querySelectorAll("img").length).toBe(2);
    expect(pips?.className).not.toContain("hidden");
  });
});

describe("reservedListCells", () => {
  const card = stubDeckBuilderCard({ cardId: "c-1", quantity: 2 });
  const entry = stubCardOwnership({ cardId: "c-1", locked: 1, borrowed: 1 });
  const getEntry = () => entry;
  const getPrice = () => 420;

  it("reserves the lock, borrow and price cells when all are shown", () => {
    expect(
      reservedListCells([card], getEntry, { showOwnership: true, showPrices: true, getPrice }),
    ).toEqual({ lock: true, borrowed: true, price: true });
  });

  it("drops the lock and borrow cells with ownership hidden", () => {
    expect(
      reservedListCells([card], getEntry, { showOwnership: false, showPrices: true, getPrice }),
    ).toEqual({ lock: false, borrowed: false, price: true });
  });

  it("drops the price cell with prices hidden", () => {
    expect(
      reservedListCells([card], getEntry, { showOwnership: true, showPrices: false, getPrice }),
    ).toEqual({ lock: true, borrowed: true, price: false });
  });
});

describe("per-copy rows", () => {
  it("marks the owned copy owned and the rest missing", () => {
    const owned = renderRow({ reserved: NEITHER, copyIndex: 0 });
    const missing = renderRow({ reserved: NEITHER, copyIndex: 1 });
    expect(owned.querySelector('[aria-label="Owned"]')).not.toBeNull();
    expect(missing.querySelector('[aria-label="Missing"]')).not.toBeNull();
  });

  it("counts one copy per row instead of the card's total", () => {
    expect(renderRow({ reserved: NEITHER, copyIndex: 0 }).textContent).toContain("1×");
    expect(renderRow({ reserved: NEITHER }).textContent).toContain("2×");
  });

  it("keeps the same cells as a stacked row", () => {
    expect(renderRow({ locked: 1, reserved: WITH_BORROWED, copyIndex: 1 }).children.length).toBe(
      renderRow({ locked: 1, reserved: WITH_BORROWED }).children.length,
    );
  });
});

describe("listRowCopies", () => {
  const single = stubDeckBuilderCard({ cardId: "c-1", quantity: 1 });
  const triple = stubDeckBuilderCard({ cardId: "c-2", quantity: 3 });

  it("keeps one row per card while copies stay stacked", () => {
    expect(listRowCopies([single, triple], false)).toEqual([{ card: single }, { card: triple }]);
  });

  it("splits every card into one indexed row per copy, single copies included", () => {
    expect(listRowCopies([single, triple], true)).toEqual([
      { card: single, copyIndex: 0 },
      { card: triple, copyIndex: 0 },
      { card: triple, copyIndex: 1 },
      { card: triple, copyIndex: 2 },
    ]);
  });
});
