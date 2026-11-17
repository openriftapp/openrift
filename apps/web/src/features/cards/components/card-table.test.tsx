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
