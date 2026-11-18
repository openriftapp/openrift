import { CARD_ASPECT } from "@openrift/shared/card-orientation";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FilterSearchProvider } from "@/features/cards/hooks/use-filter-search";
import type { FilterSearch } from "@/features/cards/lib/search-schemas";
import { useGridFocusStore } from "@/features/cards/stores/grid-focus-store";
import type { GroupInfo } from "@/lib/card-group-types";
import type { CardViewerItem } from "@/lib/card-viewer-types";
import { useDisplayStore } from "@/stores/display-store";
import { stubCardViewerItem } from "@/test/factories";
import { createStoreResetter } from "@/test/store-helpers";

const COLUMNS = 3;
const CONTAINER_WIDTH = 400;
const layout = vi.hoisted(() => ({ width: 400 }));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ orders: {}, labels: {} }),
}));
vi.mock("@/features/admin/hooks/use-admin-settings", () => ({
  useAdminSettings: () => null,
}));
// Fixed layout so row-height estimates are deterministic in jsdom (where
// offsetWidth is always 0 and ResizeObserver is a no-op stub).
vi.mock("@/features/cards/hooks/use-responsive-columns", () => ({
  useResponsiveColumns: () => ({
    containerRef: () => {},
    containerEl: null,
    columns: COLUMNS,
    autoColumns: COLUMNS,
    containerWidth: layout.width,
    measured: true,
  }),
  SSR_RESPONSIVE_GRID_COLS: "",
}));

import {
  BUTTON_PAD,
  HEADER_CONTENT_HEIGHT,
  HEADER_PB,
  HEADER_PT,
  LABEL_HEIGHT,
  STICKY_GROUP_LABEL_BAND,
} from "@/features/cards/lib/card-grid-constants";
import { computeGridMetrics } from "@/features/cards/lib/card-grid-metrics";

import { CardGrid } from "./card-grid";

// Mirrors CardGrid's estimateRowHeight for the mocked layout above.
const { gap: GAP, cardWidth: THUMB_WIDTH } = computeGridMetrics(CONTAINER_WIDTH, COLUMNS);
const CARDS_ROW_HEIGHT = Math.round(
  (THUMB_WIDTH - BUTTON_PAD * 2) / CARD_ASPECT + LABEL_HEIGHT + BUTTON_PAD * 2,
);
const HEADER_ROW_HEIGHT = HEADER_PT + HEADER_CONTENT_HEIGHT + HEADER_PB;

const resetDisplayStore = createStoreResetter(useDisplayStore);
const resetGridFocusStore = createStoreResetter(useGridFocusStore);

afterEach(() => {
  layout.width = CONTAINER_WIDTH;
  resetDisplayStore();
  resetGridFocusStore();
  vi.restoreAllMocks();
  setWindowScrollY(0);
});

function setWindowScrollY(y: number) {
  Object.defineProperty(globalThis, "scrollY", { value: y, writable: true, configurable: true });
  Object.defineProperty(globalThis, "pageYOffset", {
    value: y,
    writable: true,
    configurable: true,
  });
}

function scrollWindowTo(y: number) {
  act(() => {
    setWindowScrollY(y);
    globalThis.dispatchEvent(new Event("scroll"));
  });
}

function spyOnWindowScroll() {
  return vi.spyOn(globalThis, "scrollTo").mockImplementation(() => {});
}

function makeSet(index: number): GroupInfo {
  return { id: `set-${index}`, slug: `SET${index}`, name: `Set ${index}`, setType: "main" };
}

function makeItems(setId: string, count: number): CardViewerItem[] {
  return Array.from({ length: count }, (_, index) =>
    stubCardViewerItem({ printingId: `${setId}-printing-${index}`, setId }),
  );
}

function gridElement(
  items: CardViewerItem[],
  setOrder: GroupInfo[],
  selectedItemId?: string,
  search: FilterSearch = {},
) {
  return (
    <FilterSearchProvider value={search}>
      <CardGrid
        items={items}
        totalItems={items.length}
        renderCard={(item) => <div>{item.id}</div>}
        setOrder={setOrder}
        groupBy="set"
        stickyOffset={0}
        selectedItemId={selectedItemId}
      />
    </FilterSearchProvider>
  );
}

function returnGridElement(
  items: CardViewerItem[],
  setOrder: GroupInfo[],
  itemId?: string,
  onReturned?: (found: boolean) => void,
) {
  return (
    <FilterSearchProvider value={{}}>
      <CardGrid
        items={items}
        totalItems={items.length}
        renderCard={(item) => <div>{item.id}</div>}
        setOrder={setOrder}
        groupBy="set"
        stickyOffset={0}
        returnToItemId={itemId}
        onReturned={onReturned}
      />
    </FilterSearchProvider>
  );
}

function rowTop(container: HTMLElement, index: number): number {
  const row = container.querySelector(`[data-index="${index}"]`);
  if (!(row instanceof HTMLElement)) {
    throw new TypeError(`virtual row ${index} not rendered`);
  }
  const match = /translateY\((?<offset>-?[\d.]+)px\)/u.exec(row.style.transform);
  if (!match?.groups?.offset) {
    throw new Error(`virtual row ${index} has no translateY transform`);
  }
  return Number(match.groups.offset);
}

describe("CardGrid virtual row positioning", () => {
  it("positions grouped rows using header and cards estimates", () => {
    // 3 sets × 2 items at 3 columns → [header, cards, header, cards, header, cards].
    const sets = [makeSet(1), makeSet(2), makeSet(3)];
    const items = sets.flatMap((set) => makeItems(set.id, 2));
    const { container } = render(gridElement(items, sets));

    expect(rowTop(container, 0)).toBe(0);
    expect(rowTop(container, 1)).toBe(HEADER_ROW_HEIGHT + GAP);
    expect(rowTop(container, 2)).toBe(HEADER_ROW_HEIGHT + CARDS_ROW_HEIGHT + GAP * 2);
  });

  it("re-measures rows when new items change row kinds at the same row count", () => {
    // react-virtual's measurements memo doesn't track estimateSize, so without an
    // explicit measure() new all-cards rows keep the old header-sized slots.
    const groupedSets = [makeSet(1), makeSet(2), makeSet(3)];
    const groupedItems = groupedSets.flatMap((set) => makeItems(set.id, 2));

    const { container, rerender } = render(gridElement(groupedItems, groupedSets));
    expect(rowTop(container, 1)).toBe(HEADER_ROW_HEIGHT + GAP);

    const flatSet = makeSet(9);
    const flatItems = makeItems(flatSet.id, 16);
    rerender(gridElement(flatItems, [flatSet]));

    expect(rowTop(container, 0)).toBe(0);
    expect(rowTop(container, 1)).toBe(CARDS_ROW_HEIGHT + GAP);
    expect(rowTop(container, 2)).toBe((CARDS_ROW_HEIGHT + GAP) * 2);
    expect(rowTop(container, 3)).toBe((CARDS_ROW_HEIGHT + GAP) * 3);
  });
});

describe("CardGrid scroll on selection changes", () => {
  const set = makeSet(1);
  const items = makeItems(set.id, 30);
  const itemAt = (index: number) => items[index]?.id ?? "";

  it("does not scroll the page when the selection clears with the top row cut off", () => {
    const { rerender } = render(gridElement(items, [set], itemAt(COLUMNS)));
    scrollWindowTo(Math.round(CARDS_ROW_HEIGHT / 2));
    const scrollTo = spyOnWindowScroll();

    rerender(gridElement(items, [set]));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("keeps the grid still while the modal steps out of view", () => {
    const { rerender } = render(gridElement(items, [set], itemAt(COLUMNS)));
    const scrollTo = spyOnWindowScroll();

    rerender(gridElement(items, [set], itemAt(COLUMNS * 6)));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls to a card opened out of view", () => {
    const { rerender } = render(gridElement(items, [set]));
    const scrollTo = spyOnWindowScroll();

    rerender(gridElement(items, [set], itemAt(COLUMNS * 6)));

    expect(scrollTo).toHaveBeenCalled();
  });

  it("follows the docked pane out of view, then stays put when the selection clears", () => {
    useDisplayStore.setState({ paneDocked: true });
    const { rerender } = render(gridElement(items, [set], itemAt(COLUMNS)));
    const scrollTo = spyOnWindowScroll();

    rerender(gridElement(items, [set], itemAt(COLUMNS * 6)));
    expect(scrollTo).toHaveBeenCalled();

    scrollWindowTo((CARDS_ROW_HEIGHT + GAP) * 6);
    scrollTo.mockClear();
    rerender(gridElement(items, [set]));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  const added = Array.from({ length: COLUMNS * 8 }, (_, index) =>
    stubCardViewerItem({ printingId: `added-${index}`, setId: set.id }),
  );

  it("brings the selected card back into view when a filter moves it off screen", () => {
    const { rerender } = render(gridElement(items, [set], itemAt(COLUMNS)));
    const scrollTo = spyOnWindowScroll();

    rerender(gridElement([...added, ...items], [set], itemAt(COLUMNS), { q: "jinx" }));

    expect(scrollTo).toHaveBeenCalled();
  });

  it("follows a filtered list that arrives a render after the filter", () => {
    const { rerender } = render(gridElement(items, [set], itemAt(COLUMNS)));
    const scrollTo = spyOnWindowScroll();

    rerender(gridElement(items, [set], itemAt(COLUMNS), { q: "jinx" }));
    expect(scrollTo).not.toHaveBeenCalled();
    rerender(gridElement([...added, ...items], [set], itemAt(COLUMNS), { q: "jinx" }));

    expect(scrollTo).toHaveBeenCalled();
  });

  it("stays put when the list moves the selected card without a filter change", () => {
    const { rerender } = render(gridElement(items, [set], itemAt(COLUMNS)));
    const scrollTo = spyOnWindowScroll();

    rerender(gridElement([...added, ...items], [set], itemAt(COLUMNS)));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("stays put when the list drops the selected card for a moment and settles back", () => {
    const { rerender } = render(gridElement(items, [set], itemAt(COLUMNS)));
    scrollWindowTo((CARDS_ROW_HEIGHT + GAP) * 6);
    const scrollTo = spyOnWindowScroll();

    rerender(gridElement(items.slice(COLUMNS + 1), [set], itemAt(COLUMNS)));
    rerender(gridElement(items, [set], itemAt(COLUMNS)));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("leaves the page alone when the list change keeps the selected card in view", () => {
    const { rerender } = render(gridElement(items, [set], itemAt(COLUMNS)));
    const scrollTo = spyOnWindowScroll();

    rerender(gridElement(items.slice(COLUMNS), [set], itemAt(COLUMNS), { q: "jinx" }));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("does not pull the page back when the selected card keeps its place in a new list", () => {
    const { rerender } = render(gridElement(items, [set], itemAt(COLUMNS)));
    scrollWindowTo((CARDS_ROW_HEIGHT + GAP) * 6);
    const scrollTo = spyOnWindowScroll();

    rerender(gridElement(items.slice(0, COLUMNS * 4), [set], itemAt(COLUMNS), { q: "jinx" }));

    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe("CardGrid scroll below the sticky group label", () => {
  const sets = [makeSet(1), makeSet(2)];
  const first = makeItems("set-1", 30);
  const second = makeItems("set-2", 30);
  const items = [...first, ...second];

  beforeEach(() => {
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(100_000);
  });

  it("lands a card row one label band below the toolbar", () => {
    const { rerender } = render(gridElement(items, sets));
    const scrollTo = spyOnWindowScroll();

    rerender(gridElement(items, sets, first[COLUMNS * 6]?.id));

    const rowStart = HEADER_ROW_HEIGHT + GAP + (CARDS_ROW_HEIGHT + GAP) * 6;
    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: rowStart - STICKY_GROUP_LABEL_BAND }),
    );
  });

  it("brings a group's header to the top for a card in its first row", () => {
    const { rerender } = render(gridElement(items, sets));
    const scrollTo = spyOnWindowScroll();

    rerender(gridElement(items, sets, second[0]?.id));

    const firstGroupRows = Math.ceil(first.length / COLUMNS);
    const headerStart = HEADER_ROW_HEIGHT + GAP + (CARDS_ROW_HEIGHT + GAP) * firstGroupRows;
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: headerStart }));
  });
});

describe("CardGrid return to an item", () => {
  const set = makeSet(1);
  const items = makeItems(set.id, 30);
  const target = items[COLUMNS * 6]?.id;

  it("waits while the grid is hidden, then scrolls to the item once it has a width", () => {
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(100_000);
    layout.width = 0;
    const { rerender } = render(returnGridElement(items, [set], target));
    const scrollTo = spyOnWindowScroll();

    rerender(returnGridElement(items, [set], target));
    expect(scrollTo).not.toHaveBeenCalled();

    layout.width = CONTAINER_WIDTH;
    rerender(returnGridElement(items, [set], target));

    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: (CARDS_ROW_HEIGHT + GAP) * 6 }),
    );
  });

  it("scrolls once per return, not on later renders", () => {
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(100_000);
    const scrollTo = spyOnWindowScroll();
    const { rerender } = render(returnGridElement(items, [set], target));
    const calls = scrollTo.mock.calls.length;
    expect(calls).toBeGreaterThan(0);

    rerender(returnGridElement(items, [set], target));

    expect(scrollTo).toHaveBeenCalledTimes(calls);
  });

  it("reports the return once it has a width, with whether the item is in the grid", () => {
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(100_000);
    spyOnWindowScroll();
    const onReturned = vi.fn();
    layout.width = 0;
    const { rerender } = render(returnGridElement(items, [set], target, onReturned));
    expect(onReturned).not.toHaveBeenCalled();

    layout.width = CONTAINER_WIDTH;
    rerender(returnGridElement(items, [set], target, onReturned));
    expect(onReturned).toHaveBeenCalledExactlyOnceWith(true);

    rerender(returnGridElement(items, [set], "filtered-out", onReturned));
    expect(onReturned).toHaveBeenLastCalledWith(false);
  });
});
