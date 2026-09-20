import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <span className={className}>{children}</span>
  ),
}));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    orders: {
      finishes: ["normal"],
      rarities: ["common"],
      domains: [],
      cardTypes: [],
      superTypes: [],
      artVariants: ["normal"],
    },
    labels: {
      finishes: { normal: "Normal" },
      rarities: { Common: "common" },
      domains: {},
      cardTypes: {},
      superTypes: {},
      artVariants: { normal: "Normal" },
    },
    domainColors: {},
    rarityColors: {},
  }),
  // Deliberately not alphabetical: the tab-order test proves the picker follows this order.
  useLanguageList: () => [
    { code: "EN", name: "English", color: null },
    { code: "JA", name: "Japanese", color: null },
    { code: "DE", name: "German", color: null },
  ],
  useLanguageLabels: () => ({ EN: "English", JA: "Japanese", DE: "German" }),
}));

const { priceGetMock } = vi.hoisted(() => ({
  priceGetMock: vi.fn((_printingId: string, _marketplace: string): number | undefined => undefined),
}));

vi.mock("@/features/cards/hooks/use-prices", () => ({
  usePrices: () => ({ get: priceGetMock }),
}));

const { ownedMock } = vi.hoisted(() => ({
  ownedMock: vi.fn(
    (): {
      data: { totals: Record<string, number>; allTotals: Record<string, number> } | undefined;
    } => ({ data: undefined }),
  ),
}));

vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useOwnedCountsForPrintings: ownedMock,
}));

// Render a button inside the mocked popover so the test exercises the worst case:
// if the outer row is also a <button>, the rendered DOM contains nested buttons.
vi.mock("./owned-collections-popover", () => ({
  OwnedCollectionsPopover: ({ count, totalCount }: { count?: number; totalCount?: number }) => (
    <button type="button" data-count={count} data-total={totalCount}>
      owned
    </button>
  ),
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { PrintingPicker } from "./printing-picker";

describe("PrintingPicker", () => {
  beforeEach(() => {
    priceGetMock.mockReset();
    priceGetMock.mockReturnValue(undefined);
    ownedMock.mockClear();
    ownedMock.mockReturnValue({ data: undefined });
  });

  it("does not nest a <button> inside another <button>", () => {
    const printing = stubPrinting();
    const { container } = render(
      <PrintingPicker current={printing} printings={[printing]} onSelect={() => {}} />,
    );
    const nested = container.querySelectorAll("button button");
    expect(nested).toHaveLength(0);
  });

  it("renders the row as a non-button element with role=button", () => {
    const printing = stubPrinting();
    const { container } = render(
      <PrintingPicker current={printing} printings={[printing]} onSelect={() => {}} />,
    );
    const row = container.querySelector('[role="button"]');
    expect(row).not.toBeNull();
    expect(row?.tagName).not.toBe("BUTTON");
  });

  it("prices a row from the favourite marketplace, unlabelled", () => {
    priceGetMock.mockImplementation((_id, marketplace) =>
      marketplace === "cardtrader" ? 4.2 : 9.9,
    );
    const printing = stubPrinting();

    render(<PrintingPicker current={printing} printings={[printing]} onSelect={() => {}} />);

    expect(screen.getByText(/4[.,]20/u)).toBeInTheDocument();
    expect(screen.queryByText("CardTrader")).not.toBeInTheDocument();
  });

  it("falls back to the next marketplace in order and names it", () => {
    priceGetMock.mockImplementation((_id, marketplace) =>
      marketplace === "tcgplayer" ? 4.2 : undefined,
    );
    const printing = stubPrinting();

    render(<PrintingPicker current={printing} printings={[printing]} onSelect={() => {}} />);

    expect(screen.getByText("TCGplayer")).toBeInTheDocument();
    expect(screen.getByText(/4[.,]20/u)).toBeInTheDocument();
  });

  it("shows no price when no marketplace has one", () => {
    const printing = stubPrinting();

    const { container } = render(
      <PrintingPicker current={printing} printings={[printing]} onSelect={() => {}} />,
    );

    expect(container.textContent).not.toMatch(/\d[.,]\d\d/u);
  });

  it("counts what the given collection holds, with the wider total beside it", () => {
    ownedMock.mockReturnValue({ data: { totals: { "p-x": 1 }, allTotals: { "p-x": 3 } } });
    const printing = stubPrinting({ id: "p-x" });

    const { container } = render(
      <PrintingPicker
        current={printing}
        printings={[printing]}
        onSelect={() => {}}
        collectionId="col-1"
      />,
    );

    const pill = container.querySelector("button[data-count]");
    expect(pill).toHaveAttribute("data-count", "1");
    expect(pill).toHaveAttribute("data-total", "3");
  });

  it("scopes the owned query to the given collection", () => {
    const printing = stubPrinting({ id: "p-x" });

    render(
      <PrintingPicker
        current={printing}
        printings={[printing]}
        onSelect={() => {}}
        collectionId="col-1"
      />,
    );

    expect(ownedMock).toHaveBeenCalledWith(["p-x"], true, "col-1");
  });

  it("counts across every collection when none is given", () => {
    const printing = stubPrinting({ id: "p-x" });

    render(<PrintingPicker current={printing} printings={[printing]} onSelect={() => {}} />);

    expect(ownedMock).toHaveBeenCalledWith(["p-x"], true, undefined);
  });

  describe("language tabs", () => {
    it("shows no tabs when every printing shares one language", () => {
      const printings = [stubPrinting(), stubPrinting()];

      render(<PrintingPicker current={printings[0]!} printings={printings} onSelect={() => {}} />);

      expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    });

    it("offers one tab per language, in taxonomy order", () => {
      const printings = [
        stubPrinting({ language: "DE" }),
        stubPrinting({ language: "EN" }),
        stubPrinting({ language: "JA" }),
      ];

      render(<PrintingPicker current={printings[1]!} printings={printings} onSelect={() => {}} />);

      expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
        "EN1",
        "JA1",
        "DE1",
      ]);
    });

    it("opens on the shown card's language", () => {
      const printings = [stubPrinting({ language: "EN" }), stubPrinting({ language: "DE" })];

      render(<PrintingPicker current={printings[1]!} printings={printings} onSelect={() => {}} />);

      expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("DE");
    });

    it("shows only the active language's printings", async () => {
      const user = userEvent.setup();
      const english = stubPrinting({ language: "EN" });
      const german = stubPrinting({ language: "DE" });

      render(
        <PrintingPicker current={english} printings={[english, german]} onSelect={() => {}} />,
      );

      expect(
        within(screen.getByRole("tabpanel")).getAllByRole("button", { name: "owned" }),
      ).toHaveLength(1);

      await user.click(screen.getByRole("tab", { name: /DE/u }));

      expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("DE");
      expect(
        within(screen.getByRole("tabpanel")).getAllByRole("button", { name: "owned" }),
      ).toHaveLength(1);
    });

    it("keeps a language not present in the taxonomy reachable", () => {
      const printings = [stubPrinting({ language: "EN" }), stubPrinting({ language: "XX" })];

      render(<PrintingPicker current={printings[0]!} printings={printings} onSelect={() => {}} />);

      expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["EN1", "XX1"]);
    });

    it("falls back to the first tab when the shown card's language has no rows", () => {
      const current = stubPrinting({ language: "JA" });
      const printings = [stubPrinting({ language: "EN" }), stubPrinting({ language: "DE" })];

      render(<PrintingPicker current={current} printings={printings} onSelect={() => {}} />);

      expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("EN");
    });
  });
});
