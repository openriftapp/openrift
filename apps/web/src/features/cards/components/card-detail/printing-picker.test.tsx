import { render, screen } from "@testing-library/react";
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
  useLanguageList: () => [
    { code: "EN", name: "English", color: null },
    { code: "JA", name: "Japanese", color: null },
    { code: "DE", name: "German", color: null },
  ],
  useLanguageLabels: () => ({ EN: "English", JA: "Japanese", DE: "German" }),
  useLanguageColors: () => ({}),
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

  it("lists a printing with the same card on both sides once, active from either side", () => {
    const front = stubPrinting({
      printingId: "p-buff",
      cardId: "buff",
      side: 1,
      otherSide: {
        faceId: "face-2",
        cardId: "buff",
        cardName: "Buff",
        cardSlug: "buff",
        shortCode: "OGN",
      },
    });
    const back = { ...front, side: 2 as const };
    const { container } = render(
      <PrintingPicker current={back} printings={[front, back]} onSelect={() => {}} />,
    );
    const rows = container.querySelectorAll('[role="button"]');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute("aria-pressed", "true");
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
    const printing = stubPrinting({ printingId: "p-x" });

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
    const printing = stubPrinting({ printingId: "p-x" });

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
    const printing = stubPrinting({ printingId: "p-x" });

    render(<PrintingPicker current={printing} printings={[printing]} onSelect={() => {}} />);

    expect(ownedMock).toHaveBeenCalledWith(["p-x"], true, undefined);
  });

  describe("language pills", () => {
    function design(language: string, overrides: Parameters<typeof stubPrinting>[0] = {}) {
      return stubPrinting({ setId: "set-1", shortCode: "OGN-001", language, ...overrides });
    }

    it("puts every language of a design on one row, in language order", () => {
      const printings = [
        design("DE", { canonicalRank: 3 }),
        design("EN", { canonicalRank: 1 }),
        design("JA", { canonicalRank: 2 }),
      ];

      render(<PrintingPicker current={printings[1]!} printings={printings} onSelect={() => {}} />);

      expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(2);
      expect(
        screen
          .getAllByRole("button", { name: /^(?:English|Japanese|German)$/u })
          .map((pill) => pill.getAttribute("aria-label")),
      ).toEqual(["English", "Japanese", "German"]);
    });

    it("marks the shown card's language", () => {
      const printings = [design("EN"), design("DE")];

      render(<PrintingPicker current={printings[1]!} printings={printings} onSelect={() => {}} />);

      expect(screen.getByRole("button", { name: "German" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: "English" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("selects the printing of the clicked language", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const english = design("EN");
      const german = design("DE");

      render(
        <PrintingPicker current={english} printings={[english, german]} onSelect={onSelect} />,
      );
      await user.click(screen.getByRole("button", { name: "German" }));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(german);
    });

    it("keeps a language not present in the taxonomy reachable", () => {
      const printings = [design("EN"), design("XX")];

      render(<PrintingPicker current={printings[0]!} printings={printings} onSelect={() => {}} />);

      expect(screen.getByRole("button", { name: "XX" })).toBeInTheDocument();
    });

    it("orders the rows by canonical rank, not by input order", () => {
      const later = stubPrinting({ printingId: "p-later", canonicalRank: 2 });
      const earlier = stubPrinting({
        printingId: "p-earlier",
        canonicalRank: 1,
        setId: later.setId,
        shortCode: later.shortCode,
        finish: "foil",
      });

      const { container } = render(
        <PrintingPicker current={later} printings={[later, earlier]} onSelect={() => {}} />,
      );

      expect(
        [...container.querySelectorAll<HTMLElement>("[data-printing-id]")].map(
          (row) => row.dataset.printingId,
        ),
      ).toEqual(["p-earlier", "p-later"]);
    });
  });
});
