import type { AvailableFilters } from "@openrift/shared/filters-available";
import type { CustomTag } from "@openrift/shared/types/catalog";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  mockUseFilterValues,
  mockUseFilterActions,
  mockUseEnumOrders,
  mockUseCustomTagList,
  mockUseDisplayStore,
} = vi.hoisted(() => ({
  mockUseFilterValues: vi.fn(),
  mockUseFilterActions: vi.fn(),
  mockUseEnumOrders: vi.fn(),
  mockUseCustomTagList: vi.fn(),
  mockUseDisplayStore: vi.fn(),
}));

vi.mock("@/features/cards/hooks/use-card-filters", () => ({
  useFilterValues: mockUseFilterValues,
  useFilterActions: mockUseFilterActions,
}));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: mockUseEnumOrders,
  useCustomTagList: mockUseCustomTagList,
  useTagCategories: () => ({ categories: [], categoryByTag: new Map() }),
}));

vi.mock("@/stores/display-store", () => ({
  useDisplayStore: mockUseDisplayStore,
}));

import { FILTER_DIMENSIONS } from "@/features/cards/lib/filter-dimensions";

import { ActiveFilters } from "./active-filters";

const NULL_RANGES = {
  energy: { min: null, max: null },
  might: { min: null, max: null },
  power: { min: null, max: null },
  price: { min: null, max: null },
};

const EMPTY_FILTER_STATE = {
  search: "",
  sets: [],
  languages: [],
  rarities: [],
  types: [],
  superTypes: [],
  domains: [],
  artVariants: [],
  finishes: [],
  cardSizes: [],
  markers: [],
  channels: [],
  customTags: [],
  keywords: [],
  tags: [],
  owned: [],
  ownedCountMin: null,
  ownedCountMax: null,
  signed: null,
  overnumbered: null,
  markersPresence: null,
  superTypesPresence: null,
  customTagsPresence: null,
  channelsPresence: null,
  keywordsPresence: null,
  tagsPresence: null,
  banned: null,
  errata: null,
  noImage: null,
  standard: null,
  setsEx: [],
  languagesEx: [],
  raritiesEx: [],
  typesEx: [],
  superTypesEx: [],
  domainsEx: [],
  artVariantsEx: [],
  finishesEx: [],
  markersEx: [],
  channelsEx: [],
  customTagsEx: [],
  keywordsEx: [],
  tagsEx: [],
};

function makeAvailable(overrides: Partial<AvailableFilters> = {}): AvailableFilters {
  return {
    sets: [],
    supplementalSets: new Set(),
    domains: [],
    types: [],
    superTypes: [],
    rarities: [],
    artVariants: [],
    finishes: [],
    cardSizes: [],
    hasSigned: false,
    hasOvernumbered: false,
    keywords: [],
    tags: [],
    hasNonStandard: false,
    hasBanned: false,
    hasErrata: false,
    hasNoImage: false,
    hasNullEnergy: false,
    hasNullMight: false,
    hasNullPower: false,
    markers: [],
    distributionChannels: [],
    energy: { min: 1, max: 7 },
    might: { min: 1, max: 7 },
    power: { min: 1, max: 7 },
    price: { min: 0, max: 1000 },
    ...overrides,
  };
}

function makeCustomTag(overrides: Partial<CustomTag>): CustomTag {
  return {
    id: "tag-id",
    slug: "tag-slug",
    label: "Tag Label",
    category: "region",
    categoryLabel: "Region",
    description: null,
    sortOrder: 0,
    ...overrides,
  };
}

function setupHooks({
  customTags,
  selectedCustomTagSlugs,
  toggleArrayFilter,
}: {
  customTags: CustomTag[];
  selectedCustomTagSlugs: string[];
  toggleArrayFilter?: ReturnType<typeof vi.fn>;
}) {
  mockUseFilterValues.mockReturnValue({
    filterState: { ...EMPTY_FILTER_STATE, customTags: selectedCustomTagSlugs },
    ranges: NULL_RANGES,
  });
  mockUseFilterActions.mockReturnValue({
    toggleArrayFilter: toggleArrayFilter ?? vi.fn(),
    setRange: vi.fn(),
    setOwnedCountRange: vi.fn(),
    clearSigned: vi.fn(),
    clearPresence: vi.fn(),
    clearBanned: vi.fn(),
    clearErrata: vi.fn(),
    clearStandard: vi.fn(),
    clearAllFilters: vi.fn(),
    setSearch: vi.fn(),
  });
  mockUseEnumOrders.mockReturnValue({
    labels: {
      finishes: {},
      rarities: {},
      domains: {},
      cardTypes: {},
      superTypes: {},
      artVariants: {},
    },
  });
  mockUseCustomTagList.mockReturnValue({
    all: customTags,
    byCategory: new Map(),
  });
  mockUseDisplayStore.mockImplementation(
    (selector: (state: { marketplaceOrder: string[] }) => unknown) =>
      selector({ marketplaceOrder: ["cardtrader"] }),
  );
}

describe("ActiveFilters custom tags", () => {
  afterEach(() => {
    mockUseFilterValues.mockReset();
    mockUseFilterActions.mockReset();
    mockUseEnumOrders.mockReset();
    mockUseCustomTagList.mockReset();
    mockUseDisplayStore.mockReset();
  });

  it("renders a badge for each selected custom tag, grouped by category", () => {
    setupHooks({
      customTags: [
        makeCustomTag({
          slug: "bilgewater",
          label: "Bilgewater",
          category: "region",
          categoryLabel: "Region",
        }),
        makeCustomTag({
          slug: "demacia",
          label: "Demacia",
          category: "region",
          categoryLabel: "Region",
        }),
        makeCustomTag({
          slug: "tempo",
          label: "Tempo",
          category: "archetype",
          categoryLabel: "Archetype",
        }),
      ],
      selectedCustomTagSlugs: ["bilgewater", "tempo", "demacia"],
    });

    const { getByText } = render(<ActiveFilters availableFilters={makeAvailable()} />);

    expect(getByText("Region:")).toBeInTheDocument();
    expect(getByText("Archetype:")).toBeInTheDocument();
    expect(getByText("Bilgewater")).toBeInTheDocument();
    expect(getByText("Demacia")).toBeInTheDocument();
    expect(getByText("Tempo")).toBeInTheDocument();
  });

  it("calls toggleArrayFilter with the right slug when removing a tag", async () => {
    const toggleArrayFilter = vi.fn();
    setupHooks({
      customTags: [makeCustomTag({ slug: "bilgewater", label: "Bilgewater" })],
      selectedCustomTagSlugs: ["bilgewater"],
      toggleArrayFilter,
    });

    const user = userEvent.setup();
    const { getByText } = render(<ActiveFilters availableFilters={makeAvailable()} />);

    const badge = getByText("Bilgewater").closest("span") ?? getByText("Bilgewater");
    const removeButton = badge.parentElement?.querySelector("button");
    expect(removeButton).not.toBeNull();
    await user.click(removeButton!);

    expect(toggleArrayFilter).toHaveBeenCalledWith("customTags", "bilgewater");
  });

  it("skips the custom-tags section when customTags is in hiddenSections", () => {
    setupHooks({
      customTags: [makeCustomTag({ slug: "bilgewater", label: "Bilgewater" })],
      selectedCustomTagSlugs: ["bilgewater"],
    });

    const { container } = render(
      <ActiveFilters availableFilters={makeAvailable()} hiddenSections={new Set(["customTags"])} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows orphan slugs under a fallback 'Tag' label when the tag is unknown", () => {
    setupHooks({
      customTags: [],
      selectedCustomTagSlugs: ["was-deleted"],
    });

    const { getByText } = render(<ActiveFilters availableFilters={makeAvailable()} />);

    expect(getByText("Tag:")).toBeInTheDocument();
    expect(getByText("was-deleted")).toBeInTheDocument();
  });
});

describe("ActiveFilters search terms", () => {
  afterEach(() => {
    mockUseFilterValues.mockReset();
    mockUseFilterActions.mockReset();
    mockUseEnumOrders.mockReset();
    mockUseCustomTagList.mockReset();
    mockUseDisplayStore.mockReset();
  });

  function setupSearch(search: string) {
    setupHooks({ customTags: [], selectedCustomTagSlugs: [] });
    mockUseFilterValues.mockReturnValue({
      filterState: { ...EMPTY_FILTER_STATE, search },
      ranges: NULL_RANGES,
    });
    const setSearch = vi.fn();
    mockUseFilterActions.mockReturnValue({ ...mockUseFilterActions(), setSearch });
    return setSearch;
  }

  it("shows a chip per keyed term and removes that term from the query", async () => {
    const user = userEvent.setup();
    const setSearch = setupSearch("jinx t:unit -(d:fury or d:calm)");
    const { getByText, getByRole } = render(<ActiveFilters availableFilters={makeAvailable()} />);

    expect(getByText("type contains “unit”")).toBeInTheDocument();
    expect(getByText("not (domain: fury or domain: calm)")).toBeInTheDocument();
    await user.click(getByRole("button", { name: "Remove -(d:fury or d:calm) from the search" }));

    expect(setSearch).toHaveBeenCalledWith("jinx t:unit");
  });

  it("shows a term the filter buttons carry as its filter chip only", async () => {
    const user = userEvent.setup();
    setupSearch("d:fury t:unit");
    const toggleArrayFilter = vi.fn();
    mockUseFilterValues.mockReturnValue({
      filterState: { ...EMPTY_FILTER_STATE, search: "d:fury t:unit", domains: ["fury"] },
      ranges: NULL_RANGES,
      queryFilterSpans: [{ start: 0, end: 6 }],
    });
    mockUseFilterActions.mockReturnValue({ ...mockUseFilterActions(), toggleArrayFilter });
    const { getByText, queryByText, getByRole } = render(
      <ActiveFilters availableFilters={makeAvailable()} />,
    );

    expect(queryByText("domain: fury")).not.toBeInTheDocument();
    expect(getByText("type contains “unit”")).toBeInTheDocument();
    await user.click(getByRole("button", { name: /Remove .*fury/u }));

    expect(toggleArrayFilter).toHaveBeenCalledWith("domains", "fury");
  });

  it("removes a flagged term through its warning chip", async () => {
    const user = userEvent.setup();
    const setSearch = setupSearch("t:unit zz:x");
    const { getByText, getByRole } = render(<ActiveFilters availableFilters={makeAvailable()} />);

    expect(getByText("Unknown key “zz:”, ignored")).toBeInTheDocument();
    await user.click(getByRole("button", { name: "Remove zz:x from the search" }));

    expect(setSearch).toHaveBeenCalledWith("t:unit");
  });

  it("renders nothing for a plain-word search", () => {
    setupSearch("jinx");
    const { container } = render(<ActiveFilters availableFilters={makeAvailable()} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("ActiveFilters copies range", () => {
  afterEach(() => {
    mockUseFilterValues.mockReset();
    mockUseFilterActions.mockReset();
    mockUseEnumOrders.mockReset();
    mockUseCustomTagList.mockReset();
    mockUseDisplayStore.mockReset();
  });

  function setupCopiesHooks(
    ownedCount: { ownedCountMin: number | null; ownedCountMax: number | null },
    setOwnedCountRange = vi.fn(),
  ) {
    mockUseFilterValues.mockReturnValue({
      filterState: { ...EMPTY_FILTER_STATE, ...ownedCount },
      ranges: NULL_RANGES,
    });
    mockUseFilterActions.mockReturnValue({
      toggleArrayFilter: vi.fn(),
      setRange: vi.fn(),
      setOwnedCountRange,
      clearSigned: vi.fn(),
      clearPresence: vi.fn(),
      clearBanned: vi.fn(),
      clearErrata: vi.fn(),
      clearAllFilters: vi.fn(),
      setSearch: vi.fn(),
    });
    mockUseEnumOrders.mockReturnValue({
      labels: {
        finishes: {},
        rarities: {},
        domains: {},
        cardTypes: {},
        superTypes: {},
        artVariants: {},
      },
    });
    mockUseCustomTagList.mockReturnValue({ all: [], byCategory: new Map() });
    mockUseDisplayStore.mockImplementation(
      (selector: (state: { marketplaceOrder: string[] }) => unknown) =>
        selector({ marketplaceOrder: ["cardtrader"] }),
    );
    return setOwnedCountRange;
  }

  it("renders a Copies chip showing the selected range", () => {
    setupCopiesHooks({ ownedCountMin: 2, ownedCountMax: 5 });

    const { getByText } = render(
      <ActiveFilters availableFilters={makeAvailable()} ownedCountMax={9} />,
    );

    expect(getByText("Copies:")).toBeInTheDocument();
    expect(getByText("2–5")).toBeInTheDocument();
  });

  it("clears the copies range when the chip's remove button is clicked", async () => {
    const setOwnedCountRange = setupCopiesHooks({ ownedCountMin: 3, ownedCountMax: null });

    const user = userEvent.setup();
    const { getByText } = render(
      <ActiveFilters availableFilters={makeAvailable()} ownedCountMax={9} />,
    );

    const badge = getByText("≥3").closest("span") ?? getByText("≥3");
    const removeButton = badge.parentElement?.querySelector("button");
    await user.click(removeButton!);

    expect(setOwnedCountRange).toHaveBeenCalledWith(null, null);
  });

  it("hides the Copies chip when the owned section is hidden", () => {
    setupCopiesHooks({ ownedCountMin: 2, ownedCountMax: 5 });

    const { container } = render(
      <ActiveFilters
        availableFilters={makeAvailable()}
        ownedCountMax={9}
        hiddenSections={new Set(["owned"])}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("ActiveFilters standard flag + exclude chips (ADR-034)", () => {
  afterEach(() => {
    mockUseFilterValues.mockReset();
    mockUseFilterActions.mockReset();
    mockUseEnumOrders.mockReset();
    mockUseCustomTagList.mockReset();
    mockUseDisplayStore.mockReset();
  });

  function setupExcludeHooks(
    overrides: Record<string, unknown>,
    actions: {
      toggleArrayFilter?: ReturnType<typeof vi.fn>;
      clearStandard?: ReturnType<typeof vi.fn>;
      clearPresence?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    mockUseFilterValues.mockReturnValue({
      filterState: { ...EMPTY_FILTER_STATE, ...overrides },
      ranges: NULL_RANGES,
    });
    mockUseFilterActions.mockReturnValue({
      toggleArrayFilter: actions.toggleArrayFilter ?? vi.fn(),
      setRange: vi.fn(),
      setOwnedCountRange: vi.fn(),
      clearSigned: vi.fn(),
      clearPresence: actions.clearPresence ?? vi.fn(),
      clearBanned: vi.fn(),
      clearErrata: vi.fn(),
      clearStandard: actions.clearStandard ?? vi.fn(),
      clearAllFilters: vi.fn(),
      setSearch: vi.fn(),
    });
    mockUseEnumOrders.mockReturnValue({
      labels: {
        finishes: {},
        rarities: {},
        domains: {},
        cardTypes: {},
        superTypes: {},
        artVariants: {},
      },
    });
    mockUseCustomTagList.mockReturnValue({ all: [], byCategory: new Map() });
    mockUseDisplayStore.mockImplementation(
      (selector: (state: { marketplaceOrder: string[] }) => unknown) =>
        selector({ marketplaceOrder: ["cardtrader"] }),
    );
  }

  it("renders a Plain chip and clears it on the remove button", async () => {
    const clearStandard = vi.fn();
    setupExcludeHooks({ standard: true }, { clearStandard });

    const user = userEvent.setup();
    const { getByText } = render(<ActiveFilters availableFilters={makeAvailable()} />);

    const badge = getByText("Plain").closest("span") ?? getByText("Plain");
    const removeButton = badge.parentElement?.querySelector("button");
    await user.click(removeButton!);

    expect(clearStandard).toHaveBeenCalledOnce();
  });

  it("labels the marker presence chip Promo and clears it as marker presence", async () => {
    const clearPresence = vi.fn();
    setupExcludeHooks({ markersPresence: "any" }, { clearPresence });

    const user = userEvent.setup();
    const { getByText } = render(<ActiveFilters availableFilters={makeAvailable()} />);

    const badge = getByText("Promo").closest("span") ?? getByText("Promo");
    const removeButton = badge.parentElement?.querySelector("button");
    await user.click(removeButton!);

    expect(clearPresence).toHaveBeenCalledWith("markers");
  });

  it("renders the Plain chip in the include/exclude language when forbidden", () => {
    setupExcludeHooks({ standard: false });

    const { getByText } = render(<ActiveFilters availableFilters={makeAvailable()} />);

    const label = getByText("Plain");
    expect(label).toBeInTheDocument();
    expect(label).toHaveClass("line-through");
  });

  it("renders an exclude chip and removes via the exclude key", async () => {
    const toggleArrayFilter = vi.fn();
    setupExcludeHooks({ setsEx: ["RB1"] }, { toggleArrayFilter });

    const user = userEvent.setup();
    const { getByText } = render(
      <ActiveFilters
        availableFilters={makeAvailable({ sets: ["RB1"] })}
        setDisplayLabel={(code) => (code === "RB1" ? "Origins" : code)}
      />,
    );

    const badge = getByText("Origins").closest("span") ?? getByText("Origins");
    const removeButton = badge.parentElement?.querySelector("button");
    await user.click(removeButton!);

    expect(toggleArrayFilter).toHaveBeenCalledWith("setsEx", "RB1");
  });

  it("does not render the bar when an exclude section is hidden and nothing else is set", () => {
    setupExcludeHooks({ setsEx: ["RB1"] });

    const { container } = render(
      <ActiveFilters availableFilters={makeAvailable()} hiddenSections={new Set(["sets"])} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("ActiveFilters chip layout", () => {
  const ACTIVE_FILTER_STATE = {
    ...EMPTY_FILTER_STATE,
    sets: ["RB1"],
    languages: ["EN"],
    rarities: ["rare"],
    types: ["unit"],
    superTypes: ["champion"],
    domains: ["fury"],
    artVariants: ["altart"],
    finishes: ["foil"],
    cardSizes: ["oversized"],
    markers: ["nexus"],
    channels: ["store"],
    customTags: ["staple"],
    keywords: ["Unique"],
    tags: ["Poro"],
    owned: ["partial"],
    ownedCountMin: 1,
    ownedCountMax: 3,
    signed: true,
    overnumbered: false,
    markersPresence: "any",
    superTypesPresence: "none",
    customTagsPresence: "any",
    channelsPresence: "none",
    keywordsPresence: "any",
    tagsPresence: "none",
    banned: true,
    errata: false,
    noImage: true,
    standard: false,
    setsEx: ["RB2"],
    languagesEx: ["DE"],
    raritiesEx: ["common"],
    typesEx: ["spell"],
    superTypesEx: ["token"],
    domainsEx: ["mind"],
    artVariantsEx: ["normal"],
    finishesEx: ["normal"],
    markersEx: ["promo"],
    channelsEx: ["event"],
    customTagsEx: ["budget"],
    keywordsEx: ["Deflect"],
    tagsEx: ["Yordle"],
  };
  const ACTIVE_RANGES = {
    energy: { min: 2, max: null },
    might: { min: null, max: 4 },
    power: { min: 1, max: 5 },
    price: { min: 1, max: 20 },
  };
  const ACTION_NAMES = [
    "toggleArrayFilter",
    "setRange",
    "setOwnedCountRange",
    "clearSigned",
    "clearOvernumbered",
    "clearPresence",
    "clearBanned",
    "clearErrata",
    "clearNoImage",
    "clearStandard",
    "clearAllFilters",
    "setSearch",
  ] as const;
  function setupActive() {
    const calls: unknown[][] = [];
    const actions = Object.fromEntries(
      ACTION_NAMES.map((name) => [
        name,
        vi.fn((...args: unknown[]) => {
          calls.push([name, ...args]);
        }),
      ]),
    );
    mockUseFilterValues.mockReturnValue({
      filterState: ACTIVE_FILTER_STATE,
      ranges: ACTIVE_RANGES,
    });
    mockUseFilterActions.mockReturnValue(actions);
    mockUseEnumOrders.mockReturnValue({
      labels: {
        finishes: {},
        rarities: {},
        domains: {},
        cardTypes: {},
        superTypes: {},
        artVariants: {},
        cardSizes: {},
      },
    });
    mockUseCustomTagList.mockReturnValue({
      all: [
        makeCustomTag({ slug: "staple", label: "Staple" }),
        makeCustomTag({ slug: "budget", label: "Budget", category: "cost", categoryLabel: "Cost" }),
      ],
      byCategory: new Map(),
    });
    mockUseDisplayStore.mockImplementation(
      (selector: (state: { marketplaceOrder: string[] }) => unknown) =>
        selector({ marketplaceOrder: ["cardtrader"] }),
    );
    return calls;
  }

  afterEach(() => {
    mockUseFilterValues.mockReset();
    mockUseFilterActions.mockReset();
    mockUseEnumOrders.mockReset();
    mockUseCustomTagList.mockReset();
    mockUseDisplayStore.mockReset();
  });

  function removeLabels(container: HTMLElement): string[] {
    return [...container.querySelectorAll("button[aria-label]")].map(
      (button) => button.getAttribute("aria-label") ?? "",
    );
  }

  it("orders every active chip and keeps languages out of the chips", () => {
    setupActive();
    const { container } = render(<ActiveFilters availableFilters={makeAvailable()} />);

    expect(removeLabels(container)).toEqual([
      "Remove Set RB1",
      "Remove Rarity rare",
      "Remove Type unit",
      "Remove Supertype champion",
      "Remove Domain fury",
      "Remove Art Variant altart",
      "Remove Finish foil",
      "Remove Size oversized",
      "Remove Marker nexus",
      "Remove Distribution Channel store",
      "Remove Keyword Unique",
      "Remove Owned Partial Playset",
      "Remove tag Staple",
      "Remove tag Poro",
      "Remove excluded Set RB2",
      "Remove excluded Rarity common",
      "Remove excluded Type spell",
      "Remove excluded Supertype token",
      "Remove excluded Domain mind",
      "Remove excluded Art Variant normal",
      "Remove excluded Finish normal",
      "Remove excluded Marker promo",
      "Remove excluded Distribution Channel event",
      "Remove excluded Keyword Deflect",
      "Remove excluded tag Budget",
      "Remove excluded tag Yordle",
      "Clear Energy filter",
      "Clear Might filter",
      "Clear Power filter",
      "Clear Price filter",
      "Clear Copies filter",
      "Clear Overnumbered filter",
      "Clear Signed filter",
      "Clear Promo filter",
      "Clear Has any supertype filter",
      "Clear Has any custom tag filter",
      "Clear Has any distribution channel filter",
      "Clear Has any keyword filter",
      "Clear Has any tag filter",
      "Clear Banned filter",
      "Clear Errata filter",
      "Clear No image yet filter",
      "Clear Plain filter",
    ]);
  });

  it("removes each chip through its own action", async () => {
    const calls = setupActive();
    const user = userEvent.setup();
    const { container } = render(<ActiveFilters availableFilters={makeAvailable()} />);

    for (const button of container.querySelectorAll("button[aria-label]")) {
      await user.click(button);
    }

    expect(calls).toEqual([
      ["toggleArrayFilter", "sets", "RB1"],
      ["toggleArrayFilter", "rarities", "rare"],
      ["toggleArrayFilter", "types", "unit"],
      ["toggleArrayFilter", "superTypes", "champion"],
      ["toggleArrayFilter", "domains", "fury"],
      ["toggleArrayFilter", "artVariants", "altart"],
      ["toggleArrayFilter", "finishes", "foil"],
      ["toggleArrayFilter", "cardSizes", "oversized"],
      ["toggleArrayFilter", "markers", "nexus"],
      ["toggleArrayFilter", "channels", "store"],
      ["toggleArrayFilter", "keywords", "Unique"],
      ["toggleArrayFilter", "owned", "partial"],
      ["toggleArrayFilter", "customTags", "staple"],
      ["toggleArrayFilter", "tags", "Poro"],
      ["toggleArrayFilter", "setsEx", "RB2"],
      ["toggleArrayFilter", "raritiesEx", "common"],
      ["toggleArrayFilter", "typesEx", "spell"],
      ["toggleArrayFilter", "superTypesEx", "token"],
      ["toggleArrayFilter", "domainsEx", "mind"],
      ["toggleArrayFilter", "artVariantsEx", "normal"],
      ["toggleArrayFilter", "finishesEx", "normal"],
      ["toggleArrayFilter", "markersEx", "promo"],
      ["toggleArrayFilter", "channelsEx", "event"],
      ["toggleArrayFilter", "keywordsEx", "Deflect"],
      ["toggleArrayFilter", "customTagsEx", "budget"],
      ["toggleArrayFilter", "tagsEx", "Yordle"],
      ["setRange", "energy", null, null],
      ["setRange", "might", null, null],
      ["setRange", "power", null, null],
      ["setRange", "price", null, null],
      ["setOwnedCountRange", null, null],
      ["clearOvernumbered"],
      ["clearSigned"],
      ["clearPresence", "markers"],
      ["clearPresence", "superTypes"],
      ["clearPresence", "customTags"],
      ["clearPresence", "distributionChannels"],
      ["clearPresence", "keywords"],
      ["clearPresence", "tags"],
      ["clearBanned"],
      ["clearErrata"],
      ["clearNoImage"],
      ["clearStandard"],
    ]);
  });

  it("hides value, tag and copies chips of hidden sections but keeps ranges and flags", () => {
    setupActive();
    const allSections = new Set(FILTER_DIMENSIONS.map((dimension) => dimension.section));
    const { container } = render(
      <ActiveFilters availableFilters={makeAvailable()} hiddenSections={allSections} />,
    );

    expect(removeLabels(container)).toEqual([
      "Clear Energy filter",
      "Clear Might filter",
      "Clear Power filter",
      "Clear Price filter",
      "Clear Overnumbered filter",
      "Clear Signed filter",
      "Clear Promo filter",
      "Clear Has any supertype filter",
      "Clear Has any custom tag filter",
      "Clear Has any distribution channel filter",
      "Clear Has any keyword filter",
      "Clear Has any tag filter",
      "Clear Banned filter",
      "Clear Errata filter",
      "Clear No image yet filter",
      "Clear Plain filter",
    ]);
  });
});
