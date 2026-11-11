import { summarizeVariantSiblings } from "@openrift/shared/printing-label";
import type { Printing } from "@openrift/shared/types/catalog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildCardsResult } from "@/features/cards/lib/catalog-queries";
import { CatalogSubsetContext } from "@/features/cards/lib/catalog-subset-context";
import { VariantSiblingsContext } from "@/features/cards/lib/variant-siblings-context";
import { stubPrinting } from "@/test/factories";

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    orders: {
      finishes: ["normal"],
      rarities: ["common", "rare"],
      domains: [],
      cardTypes: [],
      superTypes: [],
      artVariants: ["normal"],
    },
    labels: {
      finishes: { normal: "Normal" },
      rarities: { common: "Common", rare: "Rare" },
      cardSizes: { standard: "Standard" },
      domains: {},
      cardTypes: {},
      superTypes: {},
      artVariants: { normal: "Normal" },
    },
    domainColors: {},
    rarityColors: {},
  }),
  useLanguageLabels: () => ({ EN: "English", DE: "German" }),
  useLanguageColors: () => ({}),
}));

import {
  CatalogPrintingVariantLine,
  PrintingRowContent,
  PrintingVariantLine,
} from "./printing-row";

describe("PrintingVariantLine", () => {
  it("omits the rarity icon when every sibling shares a rarity", () => {
    const printings = [stubPrinting({ rarity: "common" }), stubPrinting({ rarity: "common" })];

    render(<PrintingVariantLine printing={printings[0]!} siblings={printings} />);

    expect(screen.queryByAltText("Common")).not.toBeInTheDocument();
  });

  it("shows each row's rarity icon when the siblings mix rarities", () => {
    const printings = [stubPrinting({ rarity: "common" }), stubPrinting({ rarity: "rare" })];

    render(<PrintingVariantLine printing={printings[1]!} siblings={printings} />);

    expect(screen.getByAltText("Rare")).toBeInTheDocument();
  });

  it("omits the rarity icon when there is no sibling set to compare against", () => {
    render(<PrintingVariantLine printing={stubPrinting({ rarity: "rare" })} />);

    expect(screen.queryByAltText("Rare")).not.toBeInTheDocument();
  });

  it("renders the code as plain text, never a link", () => {
    const printing = stubPrinting({ setSlug: "OGN" });

    render(<PrintingVariantLine printing={printing} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(printing.shortCode)).toBeInTheDocument();
  });
});

describe("PrintingRowContent", () => {
  it("shows no name line and a one-line thumbnail by default", () => {
    const printing = stubPrinting({ card: { name: "Lux" } });

    const { container } = render(<PrintingRowContent printing={printing} />);

    expect(screen.queryByText("Lux")).not.toBeInTheDocument();
    expect(container.querySelector(".h-8")).toBeInTheDocument();
    expect(container.querySelector(".h-10")).not.toBeInTheDocument();
  });

  it("adds the name line and the taller thumbnail when given a name", () => {
    const printing = stubPrinting();

    const { container } = render(<PrintingRowContent printing={printing} name="Lux" />);

    expect(screen.getByText("Lux")).toBeInTheDocument();
    expect(container.querySelector(".h-10")).toBeInTheDocument();
    expect(container.querySelector(".h-8")).not.toBeInTheDocument();
  });

  it("lets the caller override the thumbnail size", () => {
    const { container } = render(
      <PrintingRowContent printing={stubPrinting()} thumbClassName="h-12" />,
    );

    expect(container.querySelector(".h-12")).toBeInTheDocument();
    expect(container.querySelector(".h-8")).not.toBeInTheDocument();
  });

  it("renders the trailing slot", () => {
    render(<PrintingRowContent printing={stubPrinting()} right={<span>€1.23</span>} />);

    expect(screen.getByText("€1.23")).toBeInTheDocument();
  });
});

describe("CatalogPrintingVariantLine", () => {
  const PROMO = { id: "m-promo", slug: "promo", label: "Promo", description: null };
  const JUDGE = { id: "m-judge", slug: "judge", label: "Judge", description: null };
  const JINX = [
    stubPrinting({ cardId: "jinx", shortCode: "OGN-001", rarity: "common" }),
    stubPrinting({ cardId: "jinx", shortCode: "OGN-001", finish: "foil" }),
    stubPrinting({ cardId: "jinx", shortCode: "OGN-001", language: "FR" }),
    stubPrinting({ cardId: "jinx", shortCode: "OGN-301", artVariant: "altart" }),
    stubPrinting({ cardId: "jinx", shortCode: "OGN-302", isOvernumbered: true, rarity: "rare" }),
    stubPrinting({ cardId: "jinx", shortCode: "OGN-302", isSigned: true, finish: "foil" }),
    stubPrinting({ cardId: "jinx", shortCode: "OGN-001", markers: [PROMO], finish: "foil" }),
    stubPrinting({ cardId: "jinx", shortCode: "OGN-001", markers: [PROMO, JUDGE] }),
  ];
  function otherSide(faceId: string, cardId: string, cardName: string, shortCode: string) {
    return { faceId, cardId, cardName, cardSlug: cardId, shortCode };
  }
  const RECRUIT = [
    stubPrinting({
      cardId: "recruit",
      shortCode: "OGN-271",
      otherSide: otherSide("f1", "recruit", "Recruit", "OGN-271"),
    }),
    stubPrinting({
      cardId: "recruit",
      shortCode: "OGN-271",
      otherSide: otherSide("f2", "sprite", "Sprite", "OGN-272"),
    }),
    stubPrinting({
      cardId: "recruit",
      shortCode: "OGN-271",
      otherSide: otherSide("f3", "sprite", "Sprite", "OGN-273"),
    }),
  ];
  const ALL = [...JINX, ...RECRUIT];

  function renderFromCatalog(printing: Printing) {
    const { container, unmount } = render(
      <QueryClientProvider client={new QueryClient()}>
        <CatalogSubsetContext value={buildCardsResult({}, ALL, [])}>
          <CatalogPrintingVariantLine printing={printing} publicCode />
        </CatalogSubsetContext>
      </QueryClientProvider>,
    );
    const html = container.innerHTML;
    unmount();
    return html;
  }

  function renderFromSummary(printing: Printing) {
    const summaries = {
      jinx: summarizeVariantSiblings(JINX),
      recruit: summarizeVariantSiblings(RECRUIT),
    };
    const { container, unmount } = render(
      <VariantSiblingsContext value={summaries}>
        <CatalogPrintingVariantLine printing={printing} publicCode />
      </VariantSiblingsContext>,
    );
    const html = container.innerHTML;
    unmount();
    return html;
  }

  it("renders the same label from the card's sibling summary as from the catalogue", () => {
    for (const printing of ALL) {
      expect(renderFromSummary(printing)).toBe(renderFromCatalog(printing));
    }
    expect(renderFromSummary(RECRUIT[1]!)).toContain("Sprite (OGN-272)");
    expect(renderFromSummary(JINX[4]!)).toContain('alt="Rare"');
  });

  it("reads no catalogue when the card has a summary", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <VariantSiblingsContext value={{ jinx: summarizeVariantSiblings(JINX) }}>
          <CatalogPrintingVariantLine printing={JINX[0]!} />
        </VariantSiblingsContext>
      </QueryClientProvider>,
    );
    expect(client.getQueryCache().getAll()).toEqual([]);
  });
});
