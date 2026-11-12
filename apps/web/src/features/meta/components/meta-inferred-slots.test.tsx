import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import type { MetaDeckInference } from "@openrift/shared/types/api/meta";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children?: React.ReactNode; params?: Record<string, string> }) => (
    <a href={`/${Object.values(params ?? {}).join("/")}`}>{children}</a>
  ),
}));

import { metaInferredZoneSlots } from "./meta-inferred-slots";

function card(cardId: string, zone: string, cardName: string): PublicDeckCardResponse {
  return {
    cardId,
    zone: zone as PublicDeckCardResponse["zone"],
    quantity: 1,
    preferredPrintingId: null,
    cardName,
    cardSlug: cardId,
    cardType: "unit",
    cardTypes: ["unit"],
    superTypes: [],
    domains: [],
    tags: [],
    keywords: [],
    maxCopiesOverride: null,
    additionalLegendCount: null,
    banned: false,
    energy: null,
    might: null,
    power: null,
    resolvedPrintingId: null,
    shortCode: null,
    imageId: null,
  };
}

const NEIGHBOUR = {
  shareToken: "tok-1",
  playerName: "Nova",
  eventName: "Summoner Skirmish",
  rank: 1,
  rankIsTier: false,
  wins: 5,
  losses: 0,
  draws: null,
  shared: 33,
  championCardId: "yi",
  championName: "Master Yi, Honed",
  battlefieldNames: [],
};

function inference(overrides: Partial<MetaDeckInference> = {}): MetaDeckInference {
  return {
    champions: [card("yi", "champion", "Master Yi, Honed")],
    championUnsure: false,
    battlefield: card("seat", "battlefield", "Seat of Power"),
    alsoSeenBattlefields: [{ cardId: "dais", name: "Emperor's Dais", slug: "emperors-dais" }],
    championNeighbours: [NEIGHBOUR],
    battlefieldNeighbours: [{ ...NEIGHBOUR, shareToken: "tok-2" }],
    ...overrides,
  };
}

describe("metaInferredZoneSlots", () => {
  it("fills one slot in each guessed zone", () => {
    const slots = metaInferredZoneSlots(inference(), 39);

    expect([...slots].map(([zone, slot]) => [zone, slot.count])).toEqual([
      ["champion", 1],
      ["battlefield", 1],
    ]);
  });

  it("fills nothing without a guess", () => {
    expect(metaInferredZoneSlots(null, 39).size).toBe(0);
  });

  it("names the lists behind a champion guess once opened", async () => {
    const slot = metaInferredZoneSlots(inference(), 39).get("champion");
    render(<div>{slot?.node}</div>);

    await userEvent.click(
      screen.getByRole("button", { name: "Master Yi, Honed, inferred. Show why" }),
    );

    expect(await screen.findByText("Nova · Summoner Skirmish")).toBeInTheDocument();
    expect(screen.getByText("33 of 39 cards shared")).toBeInTheDocument();
    expect(screen.getByText("Played Master Yi, Honed")).toBeInTheDocument();
  });

  it("names the champion a similar list played even when it is not the guess", async () => {
    const slot = metaInferredZoneSlots(
      inference({
        championNeighbours: [
          NEIGHBOUR,
          {
            ...NEIGHBOUR,
            shareToken: "tok-3",
            championCardId: "yi-2",
            championName: "Master Yi, Tempered",
          },
        ],
      }),
      39,
    ).get("champion");
    render(<div>{slot?.node}</div>);

    await userEvent.click(
      screen.getByRole("button", { name: "Master Yi, Honed, inferred. Show why" }),
    );

    expect(await screen.findByText("Played Master Yi, Tempered")).toBeInTheDocument();
  });

  it("offers both champions of an unsure guess in one slot", () => {
    const slot = metaInferredZoneSlots(
      inference({
        champions: [
          card("yi", "champion", "Master Yi, Honed"),
          card("yi-2", "champion", "Master Yi, Tempered"),
        ],
      }),
      39,
    ).get("champion");
    render(<div>{slot?.node}</div>);

    expect(
      screen.getByRole("button", {
        name: "Master Yi, Honed or Master Yi, Tempered, inferred. Show why",
      }),
    ).toBeInTheDocument();
  });

  it("lists the other battlefields similar lists played under the zone", () => {
    const slot = metaInferredZoneSlots(inference(), 39).get("battlefield");
    render(<div>{slot?.footer}</div>);

    expect(screen.getByRole("link", { name: "Emperor's Dais" })).toBeInTheDocument();
    expect(screen.getByText("Tap or hover to see the lists behind it.")).toBeInTheDocument();
  });

  it("names the battlefields each similar list played", async () => {
    const slot = metaInferredZoneSlots(
      inference({
        battlefieldNeighbours: [
          { ...NEIGHBOUR, shareToken: "tok-2", battlefieldNames: ["Seat of Power", "Star Spring"] },
        ],
      }),
      39,
    ).get("battlefield");
    render(<div>{slot?.node}</div>);

    await userEvent.click(
      screen.getByRole("button", { name: "Seat of Power, inferred. Show why" }),
    );

    expect(await screen.findByText("Played Seat of Power and Star Spring")).toBeInTheDocument();
  });

  it("says when similar lists disagree about the champion", () => {
    const sure = metaInferredZoneSlots(inference(), 39).get("champion");
    const unsure = metaInferredZoneSlots(inference({ championUnsure: true }), 39).get("champion");
    const { unmount } = render(<div>{sure?.footer}</div>);
    expect(screen.queryByText(/do not agree/u)).toBeNull();
    unmount();

    render(<div>{unsure?.footer}</div>);
    expect(
      screen.getByText("Similar complete lists do not agree on this one."),
    ).toBeInTheDocument();
  });
});
