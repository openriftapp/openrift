import type { MetaDeckFacetsResponse } from "@openrift/shared/types/api/meta";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MetaDeckCostFilterData } from "@/features/meta/components/meta-deck-cost-filter";
import type { MetaDeckFilterState } from "@/features/meta/hooks/use-meta-deck-filters";

const filterState = vi.hoisted(() => ({
  value: {} as MetaDeckFilterState & Record<string, unknown>,
}));
const setLegends = vi.hoisted(() => vi.fn());

vi.mock("@/features/meta/hooks/use-meta-deck-filters", () => ({
  useMetaDeckFilters: () => filterState.value,
}));

vi.mock("@/hooks/use-enums", () => ({
  useDeckFormatList: () => ({
    formats: [{ slug: "constructed", label: "Constructed" }],
    labels: { constructed: "Constructed" },
  }),
}));

vi.mock("@/hooks/use-sm-up", () => ({ useSmUp: () => true }));

vi.mock("@/features/meta/components/meta-deck-cost-filter", () => ({
  MetaDeckCostFilter: () => null,
}));

const { MetaDeckFilterControls } = await import("./meta-deck-filter-controls");

const ERAS = [{ id: "proving", label: "Proving Grounds", from: "2026-03-06", to: null }];

const COST: MetaDeckCostFilterData = {
  ready: false,
  withCollection: false,
  countUnderCost: () => 0,
  maxToComplete: undefined,
  maxValue: undefined,
};

function facets(overrides: Partial<MetaDeckFacetsResponse> = {}): MetaDeckFacetsResponse {
  return { events: [], legends: [], finishes: [], countries: [], ...overrides };
}

function renderControls(
  facetData: MetaDeckFacetsResponse,
  filters: Partial<MetaDeckFilterState> = {},
) {
  setLegends.mockReset();
  filterState.value = {
    scope: {},
    events: [],
    legends: [],
    maxRank: null,
    showAll: false,
    maxCost: null,
    includeSideboard: false,
    valueRange: { min: null, max: null },
    sort: "date",
    direction: "desc",
    page: 1,
    perPage: 24,
    setLegends,
    setEvents: vi.fn(),
    setMaxRank: vi.fn(),
    setScope: vi.fn(),
    clearAllFilters: vi.fn(),
    clearCostFilters: vi.fn(),
    setMaxCost: vi.fn(),
    setValueRange: vi.fn(),
    setIncludeSideboard: vi.fn(),
    ...filters,
  } as MetaDeckFilterState & Record<string, unknown>;
  return render(<MetaDeckFilterControls facets={facetData} eras={ERAS} cost={COST} />);
}

describe("MetaDeckFilterControls", () => {
  it("offers no legend picker for a scope holding one legend and no pick", () => {
    renderControls(facets({ legends: [{ value: "card-a", label: "Ahri", count: 4 }] }));

    expect(screen.queryByRole("combobox", { name: /Legend/u })).toBeNull();
    expect(screen.queryByText("Ahri")).toBeNull();
  });

  it("keeps the legend picker up for a pick the narrowed scope has no decks for", async () => {
    renderControls(facets({ legends: [] }), { legends: ["card-ahri"] });

    const trigger = screen
      .getAllByRole("combobox")
      .find((element) => element.textContent?.includes("card-ahri"));
    expect(trigger).toBeDefined();

    await userEvent.click(trigger!);
    await userEvent.click(await screen.findByRole("option", { name: "card-ahri" }));
    expect(setLegends).toHaveBeenCalledWith([]);
  });

  it("keeps the event picker up for a pick the narrowed scope has no decks for", () => {
    renderControls(facets({ events: [] }), { events: ["event-1"] });

    expect(
      screen.getAllByRole("combobox").some((element) => element.textContent?.includes("event-1")),
    ).toBe(true);
  });
});
