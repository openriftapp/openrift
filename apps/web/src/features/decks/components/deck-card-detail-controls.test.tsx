import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stubPrinting } from "@/test/factories";

const violations = vi.hoisted(() => ({
  current: [] as { zone: string; code: string; message: string; cardId?: string }[],
}));
const variants = vi.hoisted(() => ({ current: undefined as unknown }));
const collections = vi.hoisted(() => ({
  current: [] as { id: string; availableForDeckbuilding: boolean }[],
}));

vi.mock("@/features/decks/hooks/use-deck-builder", () => ({
  useDeckViolations: () => violations.current,
}));
vi.mock("@/features/collections/hooks/use-owned-count", () => ({
  useOwnedCollectionsByVariants: () => ({ data: variants.current }),
}));
vi.mock("@/features/collections/hooks/use-collections", () => ({
  useCollectionsList: () => collections.current,
}));
vi.mock("@/hooks/use-session", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
}));
vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => true }));
vi.mock("@/features/cards/components/printing-row", () => ({
  PrintingVariantLine: ({ printing }: { printing: { finish: string } }) => (
    <span>{printing.finish}</span>
  ),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/collections">{children}</a>,
}));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { DeckCardCopies, DeckCardDetailHeader } from "./deck-card-detail-controls";

afterEach(() => {
  cleanup();
  violations.current = [];
  variants.current = undefined;
  collections.current = [];
});

function renderHeader(overrides: Partial<Parameters<typeof DeckCardDetailHeader>[0]> = {}) {
  const onZoneChange = vi.fn();
  render(
    <DeckCardDetailHeader
      deckId="deck-1"
      format="standard"
      formatConfig={null}
      cardId="card-1"
      zone="main"
      onZoneChange={onZoneChange}
      missing={0}
      {...overrides}
    />,
  );
  return onZoneChange;
}

describe("DeckCardDetailHeader", () => {
  it("switches the zone the steppers edit", () => {
    const onZoneChange = renderHeader({
      zones: [
        { zone: "main", count: 3 },
        { zone: "sideboard", count: 0 },
      ],
    });
    fireEvent.click(screen.getByRole("button", { name: /Sideboard/u }));
    expect(onZoneChange).toHaveBeenCalledWith("sideboard");
  });

  it("shows how many copies are missing", () => {
    renderHeader({ missing: 1 });
    expect(screen.getByText("1 missing")).toBeDefined();
  });

  it("shows this card's rule problems and nobody else's", () => {
    violations.current = [
      { zone: "main", code: "domain", message: "Fury is outside your legend", cardId: "card-1" },
      { zone: "main", code: "domain", message: "Someone else's problem", cardId: "card-2" },
    ];
    renderHeader();
    expect(screen.getByText("Fury is outside your legend")).toBeDefined();
    expect(screen.queryByText("Someone else's problem")).toBeNull();
  });
});

describe("DeckCardCopies", () => {
  it("totals the copies per collection across printings", () => {
    const standard = stubPrinting({ printingId: "standard" });
    const foil = stubPrinting({ printingId: "foil", finish: "foil" });
    variants.current = [
      {
        printingId: "standard",
        printing: standard,
        collections: [
          { collectionId: "binder", collectionName: "Binder", count: 4 },
          { collectionId: "box", collectionName: "Yi Tempo", count: 2 },
        ],
      },
      {
        printingId: "foil",
        printing: foil,
        collections: [{ collectionId: "box", collectionName: "Yi Tempo", count: 1 }],
      },
    ];
    render(<DeckCardCopies printings={[standard, foil]} />);
    const box = screen.getByText("Yi Tempo").closest("li");
    expect(box?.textContent).toContain("3");
    expect(screen.getByText("Binder")).toBeDefined();
  });

  it("marks collections excluded from deck building", () => {
    const printing = stubPrinting({ printingId: "standard" });
    variants.current = [
      {
        printingId: "standard",
        printing,
        collections: [
          { collectionId: "binder", collectionName: "Binder", count: 2 },
          { collectionId: "trade", collectionName: "Trade stack", count: 1 },
        ],
      },
    ];
    collections.current = [
      { id: "binder", availableForDeckbuilding: true },
      { id: "trade", availableForDeckbuilding: false },
    ];
    render(<DeckCardCopies printings={[printing]} />);
    expect(screen.getByText("Trade stack").closest("li")?.textContent).toContain(
      "Not used for decks",
    );
    expect(screen.getByText("Binder").closest("li")?.textContent).not.toContain(
      "Not used for decks",
    );
  });

  it("renders nothing without owned copies", () => {
    variants.current = [];
    const { container } = render(<DeckCardCopies printings={[stubPrinting()]} />);
    expect(container.textContent).toBe("");
  });
});
