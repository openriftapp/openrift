// @vitest-environment jsdom
import { labelMapOf } from "@openrift/shared/enum-label";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { stubDeckBuilderCard } from "@/test/factories";

import { CardControls, DeckCardRow } from "./deck-card-row";

vi.mock("@/hooks/use-domain-colors", () => ({
  useDomainColors: () => ({ fury: "#cb212d", calm: "#16aa71", colorless: "#737373" }),
}));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ labels: { domains: labelMapOf({ fury: "Fury", calm: "Calm" }) } }),
}));
const pointer = vi.hoisted(() => ({ coarse: false }));
vi.mock("@/hooks/use-coarse-pointer", () => ({ useCoarsePointer: () => pointer.coarse }));

describe("CardControls", () => {
  it("names the quantity buttons after the card", () => {
    render(
      <CardControls
        controlMode="quantity"
        cardName="Iron Ballista"
        quantity={2}
        countWidthClass="w-4"
        onIncrement={() => {}}
        onDecrement={() => {}}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Remove one copy of Iron Ballista" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add one copy of Iron Ballista" }),
    ).toBeInTheDocument();
  });

  function renderControls(controlMode: "quantity" | "remove-only", coarse: boolean) {
    pointer.coarse = coarse;
    const { container } = render(
      <CardControls
        controlMode={controlMode}
        cardName="Iron Ballista"
        quantity={2}
        countWidthClass="w-4"
        onIncrement={() => {}}
        onDecrement={() => {}}
        onRemove={() => {}}
      />,
    );
    pointer.coarse = false;
    return container;
  }

  it("always shows the compact stepper for a mouse", () => {
    const stepper = renderControls("quantity", false).querySelector(
      '[data-slot="inline-count-stepper"]',
    );
    expect(stepper?.className).not.toMatch(/(?:^|\s)(?:\S+:)?\[&>button\]:hidden/u);
    expect(stepper?.querySelector("button")?.className).not.toContain("size-8");
  });

  it("keeps an enlarged stepper visible on touch at any width", () => {
    const stepper = renderControls("quantity", true).querySelector(
      '[data-slot="inline-count-stepper"]',
    );
    expect(stepper?.querySelector("button")?.className).toContain("size-8");
    expect(stepper?.className).not.toMatch(/(?:^|\s)(?:\w+:)?\[&>button\]:hidden/u);
  });

  it("keeps the remove button's space but shows it only on hover for a mouse", () => {
    renderControls("remove-only", false);
    const remove = screen.getByRole("button", { name: "Remove from deck" });
    expect(remove.className).toContain("invisible");
    expect(remove.className).toContain("group-hover/card:visible");
    expect(remove).toHaveClass("hover:bg-foreground/20", "dark:hover:bg-foreground/20");
    expect(remove.className).toContain("size-5");
  });

  it("keeps an enlarged remove button visible on touch", () => {
    renderControls("remove-only", true);
    const remove = screen.getByRole("button", { name: "Remove from deck" });
    expect(remove.className).not.toContain("invisible");
    expect(remove.className).toContain("size-8");
  });
});

describe("DeckCardRow", () => {
  function renderRow(overrides: Parameters<typeof stubDeckBuilderCard>[0] = {}) {
    return render(
      <DeckCardRow
        card={stubDeckBuilderCard({
          cardName: "Iron Ballista",
          quantity: 2,
          energy: 3,
          power: 1,
          domains: ["fury"],
          ...overrides,
        })}
        shortfall={1}
        onIncrement={() => {}}
        onDecrement={() => {}}
      />,
    );
  }

  function rowStyle(container: HTMLElement): string {
    return container.querySelector(String.raw`.group\/card`)?.getAttribute("style") ?? "";
  }

  it("names a clickable row for its details, leaving the copy count to the plus and minus buttons", () => {
    render(
      <DeckCardRow
        card={stubDeckBuilderCard({ cardName: "Iron Ballista", quantity: 2 })}
        onClick={() => {}}
        onIncrement={() => {}}
        onDecrement={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "View details for Iron Ballista" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add one copy of Iron Ballista" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove one copy of Iron Ballista" })).toBeTruthy();
  });

  it("tints the row in its domain colour", () => {
    expect(rowStyle(renderRow().container)).toContain("background-color");
  });

  it("blends both domains across a two-domain card's row", () => {
    expect(rowStyle(renderRow({ domains: ["fury", "calm"] }).container)).toContain(
      "linear-gradient(90deg",
    );
  });

  it("orders the quantity controls, name, power, energy, then shortfall", () => {
    renderRow();
    const energy = screen.getByRole("img", { name: "Energy 3" });
    const name = screen.getByText("Iron Ballista");
    const power = screen.getByRole("img", { name: "Power 1 (Fury)" });
    const shortfall = screen.getByText("1/2");
    const decrement = screen.getByRole("button", { name: "Remove one copy of Iron Ballista" });
    const increment = screen.getByRole("button", { name: "Add one copy of Iron Ballista" });
    const sequence = [decrement, increment, name, power, energy, shortfall];
    for (const [earlier, later] of sequence
      .slice(0, -1)
      .map((node, index): [HTMLElement, HTMLElement] => [node, sequence[index + 1] ?? node])) {
      expect(
        earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });
});
