import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FilterSearchProvider } from "@/features/cards/hooks/use-filter-search";
import { STICKY_GROUP_LABEL_BAND } from "@/features/cards/lib/card-grid-constants";
import type { FilterSearch } from "@/features/cards/lib/search-schemas";
import type { GroupInfo } from "@/lib/card-group-types";
import type { CardViewerItem } from "@/lib/card-viewer-types";
import { stubCardViewerItem } from "@/test/factories";

import type * as CardTableRowModule from "./card-table-row";

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    orders: {},
    labels: { cardTypes: {}, superTypes: {}, rarities: {}, domains: {} },
  }),
}));

const page = vi.hoisted(() => ({ tableTop: 0 }));
vi.mock("@/hooks/use-window-scroll-margin", () => ({
  useWindowScrollMargin: (_el: unknown, extra = 0) => page.tableTop + extra,
}));

vi.mock("./card-table-row", async (importOriginal) => ({
  ...(await importOriginal<typeof CardTableRowModule>()),
  CardTableRow: () => <div />,
}));

import { CardTable } from "./card-table";
import { CARD_TABLE_HEADER_HEIGHT, CARD_TABLE_ROW_HEIGHT } from "./card-table-row";

const set: GroupInfo = { id: "set-1", slug: "SET1", name: "Set 1", setType: "main" };

function makeItems(prefix: string, count: number): CardViewerItem[] {
  return Array.from({ length: count }, (_, index) =>
    stubCardViewerItem({ printingId: `${prefix}-${index}`, setId: set.id }),
  );
}

function tableElement(items: CardViewerItem[], selectedItemId: string, search: FilterSearch = {}) {
  return (
    <FilterSearchProvider value={search}>
      <CardTable
        items={items}
        totalItems={items.length}
        setOrder={[set]}
        groupBy="set"
        stickyOffset={0}
        selectedItemId={selectedItemId}
        actionsColumn="none"
      />
    </FilterSearchProvider>
  );
}

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

afterEach(() => {
  page.tableTop = 0;
  vi.restoreAllMocks();
});

describe("CardTable scroll on list changes", () => {
  const items = makeItems("card", 30);
  const selected = items[1]?.id ?? "";

  it("brings the selected card back into view when a filter moves it off screen", () => {
    const { rerender } = render(tableElement(items, selected), { wrapper });
    const scrollTo = vi.spyOn(globalThis, "scrollTo").mockImplementation(() => {});

    rerender(tableElement([...makeItems("aa-added", 200), ...items], selected, { q: "jinx" }));

    expect(scrollTo).toHaveBeenCalled();
  });

  it("stays put when the list moves the selected card without a filter change", () => {
    const { rerender } = render(tableElement(items, selected), { wrapper });
    const scrollTo = vi.spyOn(globalThis, "scrollTo").mockImplementation(() => {});

    rerender(tableElement([...makeItems("aa-added", 200), ...items], selected));

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("leaves the page alone when the selected card keeps its row", () => {
    const { rerender } = render(tableElement(items, selected), { wrapper });
    const scrollTo = vi.spyOn(globalThis, "scrollTo").mockImplementation(() => {});

    rerender(tableElement(items.slice(0, 10), selected, { q: "jinx" }));

    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe("CardTable scroll below the sticky group label", () => {
  const second: GroupInfo = { id: "set-2", slug: "SET2", name: "Set 2", setType: "main" };
  const first = makeItems("first", 30);
  const items = [
    ...first,
    ...Array.from({ length: 30 }, (_, index) =>
      stubCardViewerItem({ printingId: `second-${index}`, setId: second.id }),
    ),
  ];

  beforeEach(() => {
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(100_000);
  });

  function groupedTable(selectedItemId?: string) {
    return (
      <FilterSearchProvider value={{}}>
        <CardTable
          items={items}
          totalItems={items.length}
          setOrder={[set, second]}
          groupBy="set"
          stickyOffset={0}
          selectedItemId={selectedItemId}
          actionsColumn="none"
        />
      </FilterSearchProvider>
    );
  }

  it("lands the selected row one label band below the toolbar", () => {
    const { rerender } = render(groupedTable(), { wrapper });
    const scrollTo = vi.spyOn(globalThis, "scrollTo").mockImplementation(() => {});

    rerender(groupedTable(first[20]?.id));

    const rowStart = CARD_TABLE_HEADER_HEIGHT * 2 + CARD_TABLE_ROW_HEIGHT * 20;
    expect(scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: rowStart - STICKY_GROUP_LABEL_BAND }),
    );
  });
});

describe("CardTable return to an item", () => {
  const items = makeItems("card", 60);
  const target = items[40]?.id;

  function returnTable(itemId = target, onReturned?: (found: boolean) => void) {
    return (
      <FilterSearchProvider value={{}}>
        <CardTable
          items={items}
          totalItems={items.length}
          setOrder={[set]}
          groupBy="set"
          stickyOffset={0}
          returnToItemId={itemId}
          onReturned={onReturned}
          actionsColumn="none"
        />
      </FilterSearchProvider>
    );
  }

  it("waits while the table is hidden, then scrolls to the item once it is laid out", () => {
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(100_000);
    const scrollTo = vi.spyOn(globalThis, "scrollTo").mockImplementation(() => {});
    const scrolledDown = () =>
      scrollTo.mock.calls.some(
        ([options]) => ((options as ScrollToOptions | undefined)?.top ?? 0) > 0,
      );
    const { rerender } = render(returnTable(), { wrapper });
    expect(scrolledDown()).toBe(false);

    page.tableTop = 200;
    rerender(returnTable());

    expect(scrolledDown()).toBe(true);
  });

  it("reports the return once laid out, with whether the item is in the table", () => {
    vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(100_000);
    vi.spyOn(globalThis, "scrollTo").mockImplementation(() => {});
    const onReturned = vi.fn();
    const { rerender } = render(returnTable(target, onReturned), { wrapper });
    expect(onReturned).not.toHaveBeenCalled();

    page.tableTop = 200;
    rerender(returnTable(target, onReturned));
    expect(onReturned).toHaveBeenCalledExactlyOnceWith(true);

    rerender(returnTable("filtered-out", onReturned));
    expect(onReturned).toHaveBeenLastCalledWith(false);
  });
});
