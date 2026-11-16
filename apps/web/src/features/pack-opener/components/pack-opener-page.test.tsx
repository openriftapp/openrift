import type * as ReactQuery from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { PackPrinting, PackResult } from "@/features/pack-opener/lib/pack-types";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof ReactQuery>()),
  useSuspenseQuery: () => ({ data: { printings: [] } }),
}));

vi.mock("@/features/cards/hooks/use-cards", () => ({
  useCards: () => ({ printingsByCardId: new Map(), printingsById: {}, printingsBySideKey: {} }),
}));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    labels: { artVariants: {}, finishes: {}, cardSizes: {}, rarities: {} },
  }),
}));

vi.mock("@/features/cards/hooks/use-prices", () => ({ usePrices: () => ({ get: () => null }) }));

vi.mock("@/hooks/use-session", () => ({ useSession: () => ({ data: null }) }));

vi.mock("./pack-stats", () => ({ PackStats: () => <p>Pack value</p> }));

const { PackResults } = await import("./pack-opener-page");

function pack(cardName: string): PackResult {
  const printing: PackPrinting = {
    id: `${cardName}-id`,
    printingId: `${cardName}-id`,
    cardId: `${cardName}-card`,
    cardName,
    cardSlug: cardName.toLowerCase(),
    cardTypes: ["unit"],
    cardSuperTypes: [],
    tags: [],
    rarity: "common",
    finish: "normal",
    artVariant: "normal",
    isSigned: false,
    isOvernumbered: false,
    language: "EN",
    shortCode: "OGN-001",
    publicCode: "OGN-001",
    setSlug: "ogn",
  };
  return { pulls: [{ slot: "common", outcome: "common", printing }] };
}

function results(id: number, packs: PackResult[]) {
  return <PackResults opening={{ id, packs }} setSlug="ogn" shimmer={false} autoReveal={false} />;
}

describe("PackResults", () => {
  it("deals a new single pack face down after the last one was revealed", () => {
    const view = render(results(1, [pack("Jinx")]));
    fireEvent.click(screen.getByRole("button", { name: "Reveal all" }));
    expect(screen.queryByRole("button", { name: "Reveal card 1" })).toBeNull();

    view.rerender(results(2, [pack("Vi")]));

    expect(screen.getByRole("button", { name: "Reveal card 1" })).toBeInTheDocument();
    expect(screen.queryByText("Pack value")).toBeNull();
  });

  it("deals new bulk packs face down after the last ones were revealed", () => {
    const view = render(results(1, [pack("Jinx"), pack("Vi")]));
    for (const button of screen.getAllByRole("button", { name: "Reveal all" })) {
      fireEvent.click(button);
    }
    expect(screen.getByText("Pack value")).toBeInTheDocument();

    view.rerender(results(2, [pack("Ekko"), pack("Caitlyn")]));

    expect(screen.getAllByRole("button", { name: "Reveal card 1" })).toHaveLength(2);
    expect(screen.queryByText("Pack value")).toBeNull();
  });
});
