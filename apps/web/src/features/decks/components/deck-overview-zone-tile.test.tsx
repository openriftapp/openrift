import type { DeckZone } from "@openrift/shared/types/enums";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { stubDeckBuilderCard } from "@/test/factories";

vi.mock("@/features/decks/hooks/use-deck-zone-drop", () => ({
  useDeckZoneDrop: () => ({ dropRef: vi.fn(), isOver: false, dropDisabled: false }),
}));
vi.mock("@/features/decks/components/deck-zone-thumbs", () => ({
  ZoneThumb: ({ card }: { card: { cardName: string } }) => <div>{card.cardName}</div>,
}));
vi.mock("@/features/decks/components/deck-grouped-thumbs", () => ({
  GroupedThumbs: () => <div>grouped</div>,
}));

afterEach(cleanup);

import { ZoneTile } from "./deck-overview-zone-tile";

function renderZone({
  zone = "battlefield" as DeckZone,
  cards = [],
  expected,
  unknownCount,
  label = "Battlefields",
  emptyHint = "Choose 3 unique Battlefield cards",
  readOnly = true,
  onClick,
}: {
  zone?: DeckZone;
  cards?: ReturnType<typeof stubDeckBuilderCard>[];
  expected?: number;
  unknownCount?: number;
  label?: string;
  emptyHint?: string;
  readOnly?: boolean;
  onClick?: () => void;
}) {
  render(
    <ZoneTile
      deckId="deck-1"
      bandByCardKey={new Map()}
      priceTextByCardKey={new Map()}
      addRoomByCardKey={new Map()}
      resolveHoverPrintingId={() => null}
      showAllCopies={false}
      statsFocus={null}
      groupCards={(zoneCards) => [{ key: "none", label: "", cards: zoneCards }]}
      sortCards={(zoneCards) => zoneCards}
      groupBy="none"
      groupDir="asc"
      getOwnershipEntry={() => undefined}
      zone={zone}
      label={label}
      cards={cards}
      allCards={cards}
      expected={expected}
      emptyHint={emptyHint}
      unknownCount={unknownCount}
      zoneViolations={[]}
      format="constructed"
      getThumbnail={() => undefined}
      collapsedZones={new Set()}
      onToggleCollapsed={vi.fn()}
      readOnly={readOnly}
      onClick={onClick}
    />,
  );
}

describe("ZoneTile unknown slots", () => {
  it("says what an archived list never published, one blank per missing card", () => {
    renderZone({ expected: 3, unknownCount: 3 });
    expect(screen.getAllByText("Unknown")).toHaveLength(3);
  });

  it("counts them in one tile once there are too many to draw", () => {
    renderZone({ zone: "runes", expected: 12, unknownCount: 12 });
    expect(screen.getByText("12 unknown")).toBeDefined();
    expect(screen.queryByText("Unknown")).toBeNull();
  });

  it("appends the blanks after the cards a partly-known zone does hold", () => {
    renderZone({
      cards: [stubDeckBuilderCard({ zone: "battlefield", cardName: "Ionian Cliffside" })],
      expected: 3,
      unknownCount: 2,
    });
    expect(screen.getByText("Ionian Cliffside")).toBeDefined();
    expect(screen.getAllByText("Unknown")).toHaveLength(2);
  });

  it("counts what the record got in the header rather than what is still to add", () => {
    renderZone({
      cards: [stubDeckBuilderCard({ zone: "battlefield", cardName: "Ionian Cliffside" })],
      expected: 3,
      unknownCount: 2,
    });
    expect(screen.getByText("1 of 3 known")).toBeDefined();
    expect(screen.queryByText(/more/u)).toBeNull();
  });

  it("leaves a genuinely empty zone reading as empty", () => {
    renderZone({ expected: 3 });
    expect(screen.getByText("No Battlefields")).toBeDefined();
    expect(screen.queryByText("Unknown")).toBeNull();
  });
});

describe("ZoneTile add strips", () => {
  it("gives an empty legend the same slim add strip as any other zone", () => {
    const onClick = vi.fn();
    renderZone({
      zone: "legend",
      label: "Legend",
      emptyHint: "Choose a Legend",
      expected: 1,
      readOnly: false,
      onClick,
    });
    screen.getByRole("button", { name: "Choose a Legend" }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("offers to add runes when the editor wires a click", () => {
    renderZone({
      zone: "runes",
      label: "Runes",
      emptyHint: "Auto-fills from your Legend",
      expected: 12,
      readOnly: false,
      onClick: vi.fn(),
    });
    expect(screen.getByRole("button", { name: "Auto-fills from your Legend" })).toBeDefined();
  });

  it("shows an empty read-only legend as a label without an add action", () => {
    renderZone({ zone: "legend", label: "Legend", emptyHint: "Choose a Legend", expected: 1 });
    expect(screen.queryByRole("button", { name: "Choose a Legend" })).toBeNull();
    expect(screen.getByText("No Legend picked")).toBeDefined();
  });

  it("puts an add strip below the cards of a zone that is not full", () => {
    const onClick = vi.fn();
    renderZone({
      cards: [stubDeckBuilderCard({ zone: "battlefield", cardName: "Ionian Cliffside" })],
      expected: 3,
      readOnly: false,
      onClick,
    });
    screen.getByRole("button", { name: "Add cards to Battlefields" }).click();
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByText("Add cards")).toBeDefined();
  });

  it("drops the add strip once the zone is full", () => {
    renderZone({
      cards: [
        stubDeckBuilderCard({ zone: "battlefield", cardName: "Ionian Cliffside", quantity: 3 }),
      ],
      expected: 3,
      readOnly: false,
      onClick: vi.fn(),
    });
    expect(screen.queryByRole("button", { name: "Add cards to Battlefields" })).toBeNull();
  });
});
