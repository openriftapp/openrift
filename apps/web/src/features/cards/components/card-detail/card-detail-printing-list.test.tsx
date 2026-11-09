import { sideKey } from "@openrift/shared/printing-side";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePrintingLightboxStore } from "@/features/cards/stores/printing-lightbox-store";
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

const { lightboxPrintingsMock, catalogMock } = vi.hoisted(() => ({
  lightboxPrintingsMock: vi.fn(),
  catalogMock: { printingsByCardId: new Map<string, unknown[]>() },
}));

vi.mock("./printings-lightbox", () => ({
  PrintingsLightbox: ({ printings }: { printings: unknown[] }) => {
    lightboxPrintingsMock(printings);
    return <span data-testid="printings-lightbox" />;
  },
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => catalogMock,
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { CardDetailPrintingList } from "./card-detail-printing-list";

describe("CardDetailPrintingList", () => {
  beforeEach(() => {
    priceGetMock.mockReset();
    priceGetMock.mockReturnValue(undefined);
    ownedMock.mockClear();
    ownedMock.mockReturnValue({ data: undefined });
    usePrintingLightboxStore.setState({ pickedSideKey: null });
    catalogMock.printingsByCardId = new Map();
  });

  it("does not nest a <button> inside another <button>", () => {
    const printing = stubPrinting();
    const { container } = render(
      <CardDetailPrintingList current={printing} printings={[printing]} onSelect={() => {}} />,
    );
    const nested = container.querySelectorAll("button button");
    expect(nested).toHaveLength(0);
  });

  it("selects a row through a button named by its printing, beside the row's controls", async () => {
    const printing = stubPrinting();
    const onSelect = vi.fn();
    render(
      <CardDetailPrintingList
        current={printing}
        printings={[printing]}
        onSelect={onSelect}
        rowEnd={() => <button type="button">Add</button>}
      />,
    );
    const select = screen.getByRole("button", { pressed: true });
    expect(select).toHaveAccessibleName();
    expect(select).not.toContainElement(screen.getByRole("button", { name: "Add" }));
    await userEvent.click(select);
    expect(onSelect).toHaveBeenCalledWith(printing);
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
      <CardDetailPrintingList current={back} printings={[front, back]} onSelect={() => {}} />,
    );
    const rows = container.querySelectorAll("[data-printing-id] > button[aria-pressed]");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("prices a row from the favourite marketplace, unlabelled", () => {
    priceGetMock.mockImplementation((_id, marketplace) =>
      marketplace === "cardtrader" ? 4.2 : 9.9,
    );
    const printing = stubPrinting();

    render(
      <CardDetailPrintingList current={printing} printings={[printing]} onSelect={() => {}} />,
    );

    expect(screen.getByText(/4[.,]20/u)).toBeInTheDocument();
    expect(screen.queryByText("CardTrader")).not.toBeInTheDocument();
  });

  it("falls back to the next marketplace in order and names it", () => {
    priceGetMock.mockImplementation((_id, marketplace) =>
      marketplace === "tcgplayer" ? 4.2 : undefined,
    );
    const printing = stubPrinting();

    render(
      <CardDetailPrintingList current={printing} printings={[printing]} onSelect={() => {}} />,
    );

    expect(screen.getByText("TCGplayer")).toBeInTheDocument();
    expect(screen.getByText(/4[.,]20/u)).toBeInTheDocument();
  });

  it("shows no price when no marketplace has one", () => {
    const printing = stubPrinting();

    const { container } = render(
      <CardDetailPrintingList current={printing} printings={[printing]} onSelect={() => {}} />,
    );

    expect(container.textContent).not.toMatch(/\d[.,]\d\d/u);
  });

  it("counts what the given collection holds, with the wider total beside it", () => {
    ownedMock.mockReturnValue({ data: { totals: { "p-x": 1 }, allTotals: { "p-x": 3 } } });
    const printing = stubPrinting({ printingId: "p-x" });

    const { container } = render(
      <CardDetailPrintingList
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
      <CardDetailPrintingList
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

    render(
      <CardDetailPrintingList current={printing} printings={[printing]} onSelect={() => {}} />,
    );

    expect(ownedMock).toHaveBeenCalledWith(["p-x"], true, undefined);
  });

  it("puts the All printings button in the Printings header", () => {
    const printing = stubPrinting();
    render(
      <CardDetailPrintingList current={printing} printings={[printing]} onSelect={() => {}} />,
    );

    const header = screen.getByRole("heading", { name: "Printings" }).parentElement;
    expect(header?.querySelector('[data-testid="printings-lightbox"]')).not.toBeNull();
  });

  it("hands the lightbox every language of the card, beyond the listed ones", () => {
    const english = stubPrinting({ printingId: "p-en", cardId: "card-1", language: "EN" });
    const korean = stubPrinting({ printingId: "p-kr", cardId: "card-1", language: "KR" });
    catalogMock.printingsByCardId = new Map([["card-1", [english, korean]]]);

    render(<CardDetailPrintingList current={english} printings={[english]} onSelect={() => {}} />);

    expect(lightboxPrintingsMock).toHaveBeenLastCalledWith([english, korean]);
    expect(screen.queryByText("KR")).toBeNull();
  });

  it("lists every printing when the shown one is outside the filters", () => {
    const english = stubPrinting({ printingId: "p-en", cardId: "card-1", language: "EN" });
    const japanese = stubPrinting({ printingId: "p-ja", cardId: "card-1", language: "JA" });
    catalogMock.printingsByCardId = new Map([["card-1", [english, japanese]]]);

    render(<CardDetailPrintingList current={japanese} printings={[english]} onSelect={() => {}} />);

    expect(ownedMock).toHaveBeenLastCalledWith(["p-en", "p-ja"], true, undefined);
    expect(screen.queryByRole("button", { name: /outside your filters/u })).toBeNull();
  });

  it("reveals the printings outside the filters on request and hides them again", async () => {
    const english = stubPrinting({ printingId: "p-en", cardId: "card-1", language: "EN" });
    const japanese = stubPrinting({ printingId: "p-ja", cardId: "card-1", language: "JA" });
    catalogMock.printingsByCardId = new Map([["card-1", [english, japanese]]]);

    render(<CardDetailPrintingList current={english} printings={[english]} onSelect={() => {}} />);
    expect(ownedMock).toHaveBeenLastCalledWith(["p-en"], true, undefined);

    await userEvent.click(screen.getByRole("button", { name: "Show 1 outside your filters" }));
    expect(ownedMock).toHaveBeenLastCalledWith(["p-en", "p-ja"], true, undefined);

    await userEvent.click(
      screen.getByRole("button", { name: "Hide printings outside your filters" }),
    );
    expect(ownedMock).toHaveBeenLastCalledWith(["p-en"], true, undefined);
  });

  it("names the hidden printings as other languages when asked to", async () => {
    const english = stubPrinting({ printingId: "p-en", cardId: "card-1", language: "EN" });
    const japanese = stubPrinting({ printingId: "p-ja", cardId: "card-1", language: "JA" });
    catalogMock.printingsByCardId = new Map([["card-1", [english, japanese]]]);

    render(
      <CardDetailPrintingList
        current={english}
        printings={[english]}
        onSelect={() => {}}
        hiddenAreOtherLanguages
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show 1 in other languages" }));
    expect(screen.getByRole("button", { name: "Hide other languages" })).toBeInTheDocument();
  });

  it("hides the revealed printings again on the next card", async () => {
    const english = stubPrinting({ printingId: "p-en", cardId: "card-1", language: "EN" });
    const japanese = stubPrinting({ printingId: "p-ja", cardId: "card-1", language: "JA" });
    const nextEnglish = stubPrinting({ printingId: "p2-en", cardId: "card-2", language: "EN" });
    const nextJapanese = stubPrinting({ printingId: "p2-ja", cardId: "card-2", language: "JA" });
    catalogMock.printingsByCardId = new Map([
      ["card-1", [english, japanese]],
      ["card-2", [nextEnglish, nextJapanese]],
    ]);

    const { rerender } = render(
      <CardDetailPrintingList current={english} printings={[english]} onSelect={() => {}} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show 1 outside your filters" }));
    rerender(
      <CardDetailPrintingList
        current={nextEnglish}
        printings={[nextEnglish]}
        onSelect={() => {}}
      />,
    );

    expect(ownedMock).toHaveBeenLastCalledWith(["p2-en"], true, undefined);
    expect(screen.getByRole("button", { name: "Show 1 outside your filters" })).toBeTruthy();
  });

  it("keeps a filtered-out printing listed when the caller asks for it", () => {
    const standard = stubPrinting({ printingId: "p-std", cardId: "card-1" });
    const foil = stubPrinting({ printingId: "p-foil", cardId: "card-1", finish: "foil" });
    catalogMock.printingsByCardId = new Map([["card-1", [standard, foil]]]);

    render(
      <CardDetailPrintingList
        current={standard}
        printings={[standard]}
        onSelect={() => {}}
        keepListed={(printing) => printing.printingId === "p-foil"}
      />,
    );

    expect(ownedMock).toHaveBeenLastCalledWith(["p-std", "p-foil"], true, undefined);
    expect(screen.queryByRole("button", { name: /outside your filters/u })).toBeNull();
  });

  it("offers no reveal when the filters hide nothing", () => {
    const english = stubPrinting({ printingId: "p-en", cardId: "card-1", language: "EN" });
    catalogMock.printingsByCardId = new Map([["card-1", [english]]]);

    render(<CardDetailPrintingList current={english} printings={[english]} onSelect={() => {}} />);

    expect(screen.queryByRole("button", { name: /outside your filters/u })).toBeNull();
  });

  it("highlights the row picked in the lightbox until its animation ends", () => {
    const picked = stubPrinting({ printingId: "p-picked", shortCode: "OGN-001" });
    const other = stubPrinting({ printingId: "p-other", shortCode: "OGN-002" });
    usePrintingLightboxStore.setState({ pickedSideKey: sideKey(picked) });
    const { container } = render(
      <CardDetailPrintingList current={picked} printings={[picked, other]} onSelect={() => {}} />,
    );

    const highlighted = container.querySelectorAll("[data-highlighted]");
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]).toHaveAttribute("data-printing-id", "p-picked");

    fireEvent.animationEnd(highlighted[0] as Element);

    expect(usePrintingLightboxStore.getState().pickedSideKey).toBeNull();
    expect(container.querySelector("[data-highlighted]")).toBeNull();
  });

  it("leaves the rows alone when the picked printing is not the shown one", () => {
    const shown = stubPrinting({ printingId: "p-shown", shortCode: "OGN-001" });
    const other = stubPrinting({ printingId: "p-other", shortCode: "OGN-002" });
    usePrintingLightboxStore.setState({ pickedSideKey: sideKey(other) });
    const { container } = render(
      <CardDetailPrintingList current={shown} printings={[shown, other]} onSelect={() => {}} />,
    );

    expect(container.querySelector("[data-highlighted]")).toBeNull();
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

      render(
        <CardDetailPrintingList
          current={printings[1]!}
          printings={printings}
          onSelect={() => {}}
        />,
      );

      expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(2);
      expect(
        screen
          .getAllByRole("button", { name: /^(?:English|Japanese|German)$/u })
          .map((pill) => pill.getAttribute("aria-label")),
      ).toEqual(["English", "Japanese", "German"]);
    });

    it("marks the shown card's language", () => {
      const printings = [design("EN"), design("DE")];

      render(
        <CardDetailPrintingList
          current={printings[1]!}
          printings={printings}
          onSelect={() => {}}
        />,
      );

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
        <CardDetailPrintingList
          current={english}
          printings={[english, german]}
          onSelect={onSelect}
        />,
      );
      await user.click(screen.getByRole("button", { name: "German" }));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(german);
    });

    it("shows no pills when every printing is in one language", () => {
      const printings = [
        design("EN"),
        design("EN", { shortCode: "OGN-002" }),
        design("EN", { shortCode: "OGN-003" }),
      ];

      render(
        <CardDetailPrintingList
          current={printings[0]!}
          printings={printings}
          onSelect={() => {}}
        />,
      );

      expect(screen.queryByRole("button", { name: "English" })).not.toBeInTheDocument();
    });

    it("keeps a language not present in the taxonomy reachable", () => {
      const printings = [design("EN"), design("XX")];

      render(
        <CardDetailPrintingList
          current={printings[0]!}
          printings={printings}
          onSelect={() => {}}
        />,
      );

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
        <CardDetailPrintingList current={later} printings={[later, earlier]} onSelect={() => {}} />,
      );

      expect(
        [...container.querySelectorAll<HTMLElement>("[data-printing-id]")].map(
          (row) => row.dataset.printingId,
        ),
      ).toEqual(["p-earlier", "p-later"]);
    });
  });
});
