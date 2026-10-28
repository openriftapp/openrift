import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PlaceholderField } from "@/features/cards/lib/card-placeholder-regions";
import {
  cardPlaceholderRegions,
  placeholderLabelFontSize,
} from "@/features/cards/lib/card-placeholder-regions";
import { ContributePreviewHotspots } from "@/features/contribute/components/contribute-preview-hotspots";

const ALL_FIELDS: Record<PlaceholderField, true> = {
  "card.name": true,
  "card.domains": true,
  "card.types": true,
  "card.tags": true,
  "card.energy": true,
  "card.might": true,
  "card.power": true,
  "card.mightBonus": true,
  "printing.printedRulesText": true,
  "printing.printedEffectText": true,
  "printing.flavorText": true,
  "printing.rarity": true,
  "printing.publicCode": true,
  "printing.artist": true,
};

const CARD_HEIGHT_CQW = 139.7;

function renderHotspots(
  overrides: {
    activeField?: PlaceholderField | null;
    filled?: ReadonlySet<PlaceholderField>;
    onSelect?: (field: PlaceholderField) => void;
    onHover?: (field: PlaceholderField | null) => void;
  } = {},
) {
  return render(
    <ContributePreviewHotspots
      activeField={overrides.activeField ?? null}
      filled={overrides.filled ?? new Set()}
      onSelect={overrides.onSelect ?? vi.fn()}
      onHover={overrides.onHover ?? vi.fn()}
    />,
  );
}

describe("cardPlaceholderRegions", () => {
  it("covers every placeholder field exactly once", () => {
    const fields = cardPlaceholderRegions().map((region) => region.field);

    expect(fields.toSorted()).toEqual(Object.keys(ALL_FIELDS).toSorted());
    expect(new Set(fields).size).toBe(fields.length);
  });

  it("keeps every rect inside the card box", () => {
    for (const region of cardPlaceholderRegions()) {
      expect(region.x).toBeGreaterThanOrEqual(0);
      expect(region.y).toBeGreaterThanOrEqual(0);
      expect(region.x + region.width).toBeLessThanOrEqual(100);
      expect(region.y + region.height).toBeLessThanOrEqual(CARD_HEIGHT_CQW);
    }
  });

  it("keeps the default label size when the label fits", () => {
    const rules = cardPlaceholderRegions().find(
      (region) => region.field === "printing.printedRulesText",
    );

    expect(rules && placeholderLabelFontSize(rules)).toBe(3.5);
  });

  it("shrinks a label that would overflow its rect", () => {
    const energy = cardPlaceholderRegions().find((region) => region.field === "card.energy");
    if (!energy) {
      throw new Error("energy region missing");
    }
    const size = placeholderLabelFontSize(energy);

    expect(size).toBeLessThan(3.5);
    expect(energy.label.length * size * 0.6).toBeLessThanOrEqual(energy.width);
  });
});

describe("ContributePreviewHotspots", () => {
  it("renders a control for every region", () => {
    renderHotspots();

    expect(screen.getAllByRole("button")).toHaveLength(cardPlaceholderRegions().length);
  });

  it("labels an empty region but not a filled one", () => {
    renderHotspots({ filled: new Set<PlaceholderField>(["card.name"]) });

    expect(screen.queryByText("Card name")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Jump to Card name" })).toBeInTheDocument();
    expect(screen.getByText("Energy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Energy" })).toBeInTheDocument();
  });

  it("shows an icon with a hover title in place of the label for stat regions", () => {
    renderHotspots();
    const power = screen.getByRole("button", { name: "Add Power" });

    expect(power).toHaveTextContent("");
    expect(power).toHaveAttribute("title", "Power");
    expect(screen.getByRole("button", { name: "Add Might bonus" })).toHaveTextContent("+");
  });

  it("reports the field behind a clicked region", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderHotspots({ onSelect });

    await user.click(screen.getByRole("button", { name: "Add Rules text" }));

    expect(onSelect).toHaveBeenCalledWith("printing.printedRulesText");
  });

  it("reports hover enter and leave", async () => {
    const user = userEvent.setup();
    const onHover = vi.fn();
    renderHotspots({ onHover });
    const region = screen.getByRole("button", { name: "Add Might" });

    await user.hover(region);
    expect(onHover).toHaveBeenLastCalledWith("card.might");

    await user.unhover(region);
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  it("marks only the active region", () => {
    renderHotspots({ activeField: "printing.artist" });

    expect(screen.getByRole("button", { name: "Add Artist" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByRole("button", { name: "Add Rarity" })).not.toHaveAttribute("data-active");
  });
});
