// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { stubDeckBuilderCard } from "@/test/factories";

import { CardControls, DeckCardRow, PowerDomainIcon, PowerPips } from "./deck-card-row";

vi.mock("@/hooks/use-domain-colors", () => ({
  useDomainColors: () => ({ fury: "#cb212d", calm: "#16aa71", colorless: "#737373" }),
}));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ labels: { domains: { fury: "Fury", calm: "Calm" } } }),
}));
const pointer = vi.hoisted(() => ({ coarse: false }));
vi.mock("@/hooks/use-coarse-pointer", () => ({ useCoarsePointer: () => pointer.coarse }));

const COLORS = { fury: "#cb212d", calm: "#16aa71", colorless: "#737373" };

function renderPip(domains: string[]) {
  const { container } = render(<PowerDomainIcon domains={domains} colors={COLORS} />);
  const pip = container.firstElementChild;
  if (!pip) {
    throw new Error("pip did not render");
  }
  return pip;
}

describe("PowerDomainIcon", () => {
  it("shows the domain's own badge for a single-domain card", () => {
    const pip = renderPip(["fury"]);
    expect(pip.tagName).toBe("IMG");
    expect(pip.getAttribute("src")).toBe("/images/domains/fury.webp");
  });

  it("shows the wild rune for a dual-domain card, tinted with both domains", () => {
    const pip = renderPip(["fury", "calm"]);
    const style = pip.getAttribute("style") ?? "";
    expect(style).toContain("/images/glyphs/rune-rainbow.svg");
    expect(style).not.toContain("/images/domains/colorless.svg");
    expect(style).toContain("rgb(203, 33, 45)");
    expect(style).toContain("rgb(22, 170, 113)");
  });

  it("masks the colorless rune instead of rendering it as an image", () => {
    const pip = renderPip(["colorless"]);
    expect(pip.tagName).not.toBe("IMG");
    const style = pip.getAttribute("style") ?? "";
    expect(style).toContain("/images/domains/colorless.svg");
    expect(style).toContain("rgb(115, 115, 115)");
  });

  it("falls back to the colorless grey when a card carries no domain at all", () => {
    const style = renderPip([]).getAttribute("style") ?? "";
    expect(style).toContain("/images/domains/colorless.svg");
    expect(style).toContain("rgb(115, 115, 115)");
  });
});

const DOMAIN_LABELS = { fury: "Fury", calm: "Calm", colorless: "Colorless" };

function renderPips(power: number | null, domains: string[]) {
  const { container } = render(
    <PowerPips power={power} domains={domains} colors={COLORS} domainLabels={DOMAIN_LABELS} />,
  );
  return container;
}

describe("PowerPips", () => {
  it("names the stack once and leaves the pips decorative", () => {
    const stack = renderPips(3, ["fury"]).querySelector('[role="img"]');
    expect(stack?.getAttribute("aria-label")).toBe("Power 3 (Fury)");
    const pips = stack?.querySelectorAll("img") ?? [];
    expect(pips.length).toBe(3);
    for (const pip of pips) {
      expect(pip.getAttribute("alt")).toBe("");
    }
  });

  it("names a dual-domain stack the masked pips can't name themselves", () => {
    const stack = renderPips(2, ["fury", "calm"]).querySelector('[role="img"]');
    expect(stack?.getAttribute("aria-label")).toBe("Power 2 (Fury, Calm)");
  });

  it("drops the domains from the name when a card carries none", () => {
    const stack = renderPips(1, []).querySelector('[role="img"]');
    expect(stack?.getAttribute("aria-label")).toBe("Power 1");
  });

  it("renders nothing for a card with no power cost", () => {
    expect(renderPips(0, ["fury"]).children.length).toBe(0);
    expect(renderPips(null, ["fury"]).children.length).toBe(0);
  });
});

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

  it("reveals the stepper on hover for a mouse", () => {
    const stepper = renderControls("quantity", false).querySelector(
      '[data-slot="inline-count-stepper"]',
    );
    expect(stepper?.className).toContain("[&>button]:hidden");
    expect(stepper?.className).not.toContain("[&>button]:size-8");
  });

  it("keeps an enlarged stepper visible on touch at any width", () => {
    const stepper = renderControls("quantity", true).querySelector(
      '[data-slot="inline-count-stepper"]',
    );
    expect(stepper?.className).toContain("[&>button]:size-8");
    expect(stepper?.className).not.toMatch(/(?:^|\s)(?:\w+:)?\[&>button\]:hidden/u);
  });

  it("hides the remove button until hover for a mouse", () => {
    renderControls("remove-only", false);
    const remove = screen.getByRole("button", { name: "Remove from deck" });
    expect(remove.parentElement?.className).toContain("hidden");
    expect(remove.className).toContain("size-5");
  });

  it("keeps an enlarged remove button visible on touch", () => {
    renderControls("remove-only", true);
    const remove = screen.getByRole("button", { name: "Remove from deck" });
    expect(remove.parentElement?.className).toBe("contents");
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

  it("tints the row in its domain colour", () => {
    expect(rowStyle(renderRow().container)).toContain("background-color");
  });

  it("blends both domains across a two-domain card's row", () => {
    expect(rowStyle(renderRow({ domains: ["fury", "calm"] }).container)).toContain(
      "linear-gradient(90deg",
    );
  });

  it("orders energy, name, power, shortfall, then the quantity controls", () => {
    renderRow();
    const energy = screen.getByRole("img", { name: "Energy 3" });
    const name = screen.getByText("Iron Ballista");
    const power = screen.getByRole("img", { name: "Power 1 (Fury)" });
    const shortfall = screen.getByText("1/2");
    const decrement = screen.getByRole("button", { name: "Remove one copy of Iron Ballista" });
    const increment = screen.getByRole("button", { name: "Add one copy of Iron Ballista" });
    const sequence = [energy, name, power, shortfall, decrement, increment];
    for (const [earlier, later] of sequence
      .slice(0, -1)
      .map((node, index): [HTMLElement, HTMLElement] => [node, sequence[index + 1] ?? node])) {
      expect(
        earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });
});
