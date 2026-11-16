import { DndContext } from "@dnd-kit/core";
import { labelMapOf } from "@openrift/shared/enum-label";
import { EMPTY_PRICE_LOOKUP } from "@openrift/shared/price-lookup";
import type * as ReactRouter from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import { stubPrinting } from "@/test/factories";

const printing = stubPrinting({ card: { name: "Ekko" } });
const display: CardThumbnailDisplay = {
  fancyFan: false,
  gridFoil: false,
  coarsePointer: false,
  domainColors: {},
  finishLabels: labelMapOf({}),
  sizeLabels: labelMapOf({}),
  rarityLabels: labelMapOf({}),
  prices: EMPTY_PRICE_LOOKUP,
  favoriteMarketplace: "tcgplayer",
  compactFmt: String,
  getFallbackArt: () => null,
};

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouter>()),
  useRouter: () => ({ buildLocation: () => ({ href: "/cards/stub" }) }),
  Link: ({ children }: { children?: ReactNode }) => <a href="/cards/stub">{children}</a>,
}));

vi.mock("@/features/cards/components/picker-card-browser", () => ({
  PickerCardBrowser: ({ cell: Cell }: { cell: ComponentType<Record<string, unknown>> }) => (
    <Cell
      item={{ printing }}
      ctx={{ cardWidth: 200, priority: false }}
      display={display}
      showImages={false}
      view="cards"
      onClick={() => {}}
    />
  ),
}));

vi.mock("@/hooks/use-domain-colors", () => ({ useDomainColors: () => ({}) }));

vi.mock("@/hooks/use-is-mobile", () => ({ useIsMobile: () => false }));

const { PresentCardBrowser } = await import("./present-card-browser");
const { TierListPool } = await import("./tier-list-pool");

async function tabStops(user: ReturnType<typeof userEvent.setup>): Promise<Element[]> {
  const stops: Element[] = [];
  for (;;) {
    await user.tab();
    const active = document.activeElement;
    if (active === null || active === document.body || stops.includes(active)) {
      return stops;
    }
    stops.push(active);
  }
}

describe.each([
  ["the stage queue browser", PresentCardBrowser, "Add Ekko to the queue"],
  ["the tier list pool", TierListPool, "Rank Ekko"],
])("a tile in %s", (_label, Browser, stripControlName) => {
  function renderTile() {
    return render(
      <DndContext>
        <Browser />
      </DndContext>,
    );
  }

  it("keeps the drag wrapper out of the tab order and the accessibility tree", () => {
    const { container } = renderTile();
    const wrapper = container.querySelector(".touch-none");

    expect(wrapper).not.toBeNull();
    expect(wrapper).not.toHaveAttribute("role");
    expect(wrapper).not.toHaveAttribute("tabindex");
    expect(wrapper).not.toHaveAttribute("aria-roledescription");
    expect(wrapper).not.toHaveAttribute("aria-describedby");
  });

  it("nests no button inside another", () => {
    renderTile();

    for (const button of screen.getAllByRole("button")) {
      expect(button.querySelector("button, [role='button']")).toBeNull();
    }
  });

  it("has one tab stop for the details and names both controls", async () => {
    const user = userEvent.setup();
    renderTile();

    const stops = await tabStops(user);
    const details = stops.filter(
      (stop) => stop instanceof HTMLElement && stop.dataset.slot === "pressable",
    );

    expect(details).toHaveLength(1);
    expect(details[0]).toHaveAccessibleName(/Ekko/u);
    expect(stops.filter((stop) => stop.matches(".touch-none"))).toHaveLength(0);
    expect(screen.getByRole("button", { name: stripControlName })).toBeInTheDocument();
  });
});
