import type { PublicDeckCardResponse } from "@openrift/shared/types/api/deck";
import type { MetaDeckDetailResponse } from "@openrift/shared/types/api/meta";
import { WellKnown } from "@openrift/shared/well-known";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  deck: null as MetaDeckDetailResponse | null,
  userId: null as string | null,
  openCardDetail: null as ReturnType<typeof vi.fn> | null,
  owned: undefined as
    | {
        ownedByPrinting: Record<string, number>;
        printingsByCardId: Map<string, { printingId: string }[]>;
      }
    | undefined,
}));

vi.mock("@/features/meta/hooks/use-meta", () => ({ useMetaDeck: () => ({ data: state.deck }) }));
vi.mock("@/hooks/use-session", () => ({ useUserId: () => state.userId }));
vi.mock("@/features/cards/components/card-detail-opener", () => ({
  useOpenCardDetail: () => state.openCardDetail,
}));
vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({
    orders: { domains: ["fury", "calm"] },
    labels: { domains: { fury: "Fury", calm: "Calm" } },
  }),
}));
vi.mock("@/features/meta/hooks/use-meta-owned-cards", () => ({
  useMetaOwnedCards: (enabled: boolean) => (enabled ? state.owned : undefined),
}));
vi.mock("@tanstack/react-router", async () => {
  const fixtures = await import("@/test/meta-event-fixtures");
  return {
    Link: fixtures.StubLink,
    useNavigate: () => vi.fn(),
    useLocation: ({ select }: { select: (location: { href: string }) => string }) =>
      select({ href: "/meta/summoner-skirmish" }),
  };
});

const { MetaEventDeckPreview } = await import("./meta-event-deck-preview");

const TOKEN = "aB3dE5gH7jK9";

function card(overrides: Partial<PublicDeckCardResponse>): PublicDeckCardResponse {
  return {
    cardId: "card-a",
    zone: "main",
    quantity: 1,
    preferredPrintingId: null,
    cardName: "Punch First",
    cardSlug: "punch-first",
    cardType: "spell",
    cardTypes: ["spell"],
    superTypes: [],
    domains: ["fury"],
    tags: [],
    keywords: [],
    maxCopiesOverride: null,
    banned: false,
    energy: null,
    might: null,
    power: null,
    resolvedPrintingId: null,
    shortCode: null,
    imageId: "img-a",
    ...overrides,
  } as PublicDeckCardResponse;
}

const CARDS: PublicDeckCardResponse[] = [
  card({
    cardId: "card-legend",
    zone: "legend",
    cardName: "Emperor of the Sands",
    cardType: "legend",
    cardTypes: ["legend"],
    tags: ["Azir"],
  }),
  card({
    cardId: "card-champion",
    zone: "champion",
    cardName: "Sivir, Battle Mistress",
    cardType: "unit",
    cardTypes: ["unit"],
    resolvedPrintingId: "p-champion",
  }),
  card({
    cardId: "card-battlefield",
    zone: "battlefield",
    cardName: "Howling Abyss",
    cardType: "battlefield",
    cardTypes: ["battlefield"],
    resolvedPrintingId: "p-battlefield",
  }),
  card({
    cardId: "card-ruin",
    zone: "main",
    cardName: "Ruin Runner",
    cardType: "unit",
    cardTypes: ["unit"],
    quantity: 3,
    energy: 5,
    resolvedPrintingId: "p-ruin",
  }),
  card({
    cardId: "card-punch",
    zone: "main",
    quantity: 8,
    energy: 1,
    resolvedPrintingId: "p-punch",
  }),
  card({
    cardId: "card-squire",
    zone: "main",
    cardName: "Blade Squire",
    cardType: "unit",
    cardTypes: ["unit"],
    quantity: 9,
    energy: 2,
  }),
  card({
    cardId: "card-gadget",
    zone: "main",
    cardName: "Yordle Gadget",
    cardType: "gear",
    cardTypes: ["gear"],
    quantity: 3,
    energy: null,
    preferredPrintingId: "p-gadget",
  }),
  card({
    cardId: "card-side",
    zone: "sideboard",
    cardName: "Sideboard Sage",
    quantity: 5,
    energy: 3,
    resolvedPrintingId: "p-side",
  }),
  card({
    cardId: "card-rune-fury",
    zone: "runes",
    cardType: "rune",
    cardTypes: ["rune"],
    quantity: 8,
    domains: ["fury"],
  }),
  card({
    cardId: "card-rune-calm",
    zone: "runes",
    cardType: "rune",
    cardTypes: ["rune"],
    quantity: 4,
    domains: ["calm"],
  }),
];

const STRIP_ORDER = [
  "Emperor of the Sands",
  "Sivir, Battle Mistress",
  "Howling Abyss",
  "Punch First",
  "Blade Squire",
  "Ruin Runner",
  "Yordle Gadget",
  "Sideboard Sage",
];

const SEQUENCE = ["p-champion", "p-battlefield", "p-punch", "p-ruin", "p-gadget", "p-side"];

function metaDeck(
  meta: Partial<MetaDeckDetailResponse["meta"]> = {},
  cards = CARDS,
  catalogPrintings: { printingId: string; side: 1 | 2; cardId: string }[] = [],
): MetaDeckDetailResponse {
  return {
    deck: { name: "Azir Control", format: "constructed", formatConfig: null, links: [] },
    cards,
    catalog: { sets: [], cards: {}, printings: catalogPrintings },
    owner: { displayName: "Nova", gravatarHash: null },
    plan: null,
    planCardMeta: [],
    customTagAssignments: {},
    meta: {
      event: { slug: "summoner-skirmish", name: "Summoner Skirmish", eventDate: "2026-08-01" },
      listStatus: "full",
      playerName: "Nova",
      rank: 1,
      rankIsTier: false,
      wins: 6,
      losses: 1,
      draws: null,
      contributors: [],
      ...meta,
    },
    inferred: null,
  } as unknown as MetaDeckDetailResponse;
}

function renderPreview(): HTMLElement {
  const { container } = render(<MetaEventDeckPreview token={TOKEN} />);
  return container;
}

function stripNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll("[data-group] > [aria-label]")].map((el) =>
    (el.getAttribute("aria-label") ?? "").replace(/^\d+× /u, ""),
  );
}

function groupKeys(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>("[data-group]")].map(
    (el) => el.dataset.group ?? "",
  );
}

describe("MetaEventDeckPreview", () => {
  beforeEach(() => {
    state.deck = metaDeck();
    state.userId = null;
    state.openCardDetail = vi.fn();
    state.owned = {
      ownedByPrinting: { "p-ruin": 1, "p-ruin-foil": 1, "p-punch": 8 },
      printingsByCardId: new Map([
        ["card-ruin", [{ printingId: "p-ruin" }, { printingId: "p-ruin-foil" }]],
        ["card-punch", [{ printingId: "p-punch" }]],
        ["card-squire", [{ printingId: "p-squire" }]],
      ]),
    };
  });

  it("leads the strip with the legend, the champion and its battlefields", () => {
    const container = renderPreview();

    expect(stripNames(container).slice(0, 3)).toEqual([
      "Emperor of the Sands",
      "Sivir, Battle Mistress",
      "Howling Abyss",
    ]);
  });

  it("orders the main deck by energy, the costless cards last", () => {
    const container = renderPreview();

    expect(stripNames(container).slice(3, 7)).toEqual([
      "Punch First",
      "Blade Squire",
      "Ruin Runner",
      "Yordle Gadget",
    ]);
  });

  it("badges a card only where several copies were played", () => {
    renderPreview();

    expect(screen.getByRole("button", { name: "3× Ruin Runner" })).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: "Sivir, Battle Mistress" }).textContent).toBe("");
  });

  it("flags a banned card and a soon-banned one, a ban in effect winning", () => {
    render(
      <MetaEventDeckPreview
        token={TOKEN}
        banGroups={[
          {
            formatId: WellKnown.banFormat.CONSTRUCTED,
            formatName: "Constructed",
            bannedAt: "2026-09-18",
            inEffect: true,
            cards: [{ cardId: "card-punch", displayName: "Punch First", main: 1, side: 0 }],
          },
          {
            formatId: WellKnown.banFormat.CONSTRUCTED,
            formatName: "Constructed",
            bannedAt: "2026-11-23",
            inEffect: false,
            cards: [
              { cardId: "card-ruin", displayName: "Ruin Runner", main: 3, side: 0 },
              { cardId: "card-punch", displayName: "Punch First", main: 1, side: 0 },
            ],
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "3× Ruin Runner, Ban incoming" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "8× Punch First, Banned" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sivir, Battle Mistress" })).toBeInTheDocument();
  });

  it("names the mode on a card banned only there", () => {
    render(
      <MetaEventDeckPreview
        token={TOKEN}
        banGroups={[
          {
            formatId: "2v2",
            formatName: "2v2",
            bannedAt: "2026-09-18",
            inEffect: true,
            cards: [{ cardId: "card-ruin", displayName: "Ruin Runner", main: 3, side: 0 }],
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "3× Ruin Runner, 2v2 Ban" })).toBeInTheDocument();
  });

  it("ends the strip with a dimmed sideboard", () => {
    const container = renderPreview();

    expect(stripNames(container).at(-1)).toBe("Sideboard Sage");
    expect(screen.getByRole("button", { name: "5× Sideboard Sage" })).toHaveClass("opacity-55");
    expect(groupKeys(container)).toEqual(["lead", "battlefields", "main", "sideboard"]);
  });

  it("drops the sideboard group from a list without one", () => {
    state.deck = metaDeck(
      {},
      CARDS.filter((entry) => entry.zone !== "sideboard"),
    );
    const container = renderPreview();

    expect(stripNames(container)).not.toContain("Sideboard Sage");
    expect(groupKeys(container)).toEqual(["lead", "battlefields", "main"]);
    expect(screen.queryByText(/Sideboard/u)).toBeNull();
  });

  it("says which zones a partial list is missing", () => {
    state.deck = metaDeck(
      { listStatus: "partial" },
      CARDS.filter((entry) => entry.zone !== "battlefield"),
    );
    renderPreview();

    expect(screen.getByText(/the battlefields are not/u)).toBeInTheDocument();
  });

  it("leads with the guessed cards of a partial list, marked and named as guesses", () => {
    const partial = CARDS.filter(
      (entry) => entry.zone !== "battlefield" && entry.zone !== "champion",
    );
    state.deck = {
      ...metaDeck({ listStatus: "partial" }, partial),
      inferred: {
        champions: [
          card({ cardId: "card-yi", zone: "champion", cardName: "Master Yi, Honed" }),
          card({ cardId: "card-yi-2", zone: "champion", cardName: "Master Yi, Tempered" }),
        ],
        championUnsure: true,
        battlefield: card({ cardId: "card-seat", zone: "battlefield", cardName: "Seat of Power" }),
        alsoSeenBattlefields: [],
        championNeighbours: [],
        battlefieldNeighbours: [],
      },
    };
    const container = renderPreview();

    expect(stripNames(container).slice(0, 4)).toEqual([
      "Emperor of the Sands",
      "Master Yi, Honed (inferred)",
      "Master Yi, Tempered (inferred)",
      "Seat of Power (inferred)",
    ]);
    expect(
      screen.getByText("Master Yi, Honed or Master Yi, Tempered and Seat of Power"),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("[data-unknown-slot]")).toHaveLength(2);
  });

  it("says nothing about missing zones on a full list", () => {
    renderPreview();

    expect(screen.queryByText(/are not/u)).toBeNull();
  });

  it("splits the main deck by type without ever printing its total", () => {
    renderPreview();

    expect(screen.getByText("12 units · 8 spells · 3 gear")).toBeInTheDocument();
    expect(screen.queryByText(/23/u)).toBeNull();
  });

  it("counts the runes per domain", () => {
    renderPreview();

    expect(screen.getByAltText("Fury").closest("span.items-center")?.textContent).toBe("8");
    expect(screen.getByAltText("Calm").closest("span.items-center")?.textContent).toBe("4");
  });

  it("credits the contributors who typed the list in", () => {
    state.deck = metaDeck({ contributors: ["Alice", "Bob"] });
    renderPreview();

    expect(screen.getByText("Contributed by Alice and Bob")).toBeInTheDocument();
  });

  it("opens a clicked card's detail on the whole strip's sequence", async () => {
    const user = userEvent.setup();
    renderPreview();

    await user.click(screen.getByRole("button", { name: "3× Ruin Runner" }));

    expect(state.openCardDetail).toHaveBeenCalledWith({
      printingId: "p-ruin",
      sequence: SEQUENCE,
    });
  });

  it("opens the side a double-sided printing shows the card on", async () => {
    const user = userEvent.setup();
    state.deck = metaDeck({}, CARDS, [
      { printingId: "p-ruin", side: 1, cardId: "card-other" },
      { printingId: "p-ruin", side: 2, cardId: "card-ruin" },
    ]);
    renderPreview();

    await user.click(screen.getByRole("button", { name: "3× Ruin Runner" }));

    expect(state.openCardDetail).toHaveBeenCalledWith({
      printingId: "p-ruin:2",
      sequence: SEQUENCE.map((id) => (id === "p-ruin" ? "p-ruin:2" : id)),
    });
  });

  it("falls back to the preferred printing where none resolved", async () => {
    const user = userEvent.setup();
    renderPreview();

    await user.click(screen.getByRole("button", { name: "3× Yordle Gadget" }));

    expect(state.openCardDetail).toHaveBeenCalledWith({
      printingId: "p-gadget",
      sequence: SEQUENCE,
    });
  });

  it("shows the hovered card as a large image and hides it on leave", () => {
    renderPreview();
    const thumb = screen.getByRole("button", { name: "3× Ruin Runner" });

    const over = createEvent.pointerOver(thumb, { bubbles: true });
    Object.defineProperty(over, "pointerType", { value: "mouse" });
    Object.defineProperty(over, "buttons", { value: 0 });
    fireEvent(thumb, over);
    expect(document.body.querySelector("img[src*='400w']")).not.toBeNull();

    fireEvent.pointerOut(thumb, { relatedTarget: document.body });
    expect(document.body.querySelector("img[src*='400w']")).toBeNull();
  });

  it("leaves a card the catalog cannot open as plain art", () => {
    renderPreview();

    expect(screen.queryByRole("button", { name: /Blade Squire/u })).toBeNull();
    expect(screen.getByRole("img", { name: /Blade Squire/u }).tagName).toBe("SPAN");
  });

  it("makes nothing clickable without a card detail overlay above it", () => {
    state.openCardDetail = null;
    const container = renderPreview();

    expect(stripNames(container)).toEqual(STRIP_ORDER);
    expect(screen.queryByRole("button", { name: /Ruin Runner/u })).toBeNull();
  });

  it("leaves the deck's actions to its own page", () => {
    renderPreview();

    expect(screen.queryByRole("button", { name: "Decklist actions" })).toBeNull();
  });

  it("links on to the deck's own page", () => {
    renderPreview();

    expect(screen.getByRole("link", { name: "Open deck" })).toHaveAttribute(
      "href",
      `/meta/decks/${TOKEN}`,
    );
  });

  it("offers a signed-out reader the sign-in that would compare it", () => {
    renderPreview();

    expect(
      screen.getByRole("link", { name: "Sign in to compare with your collection" }),
    ).toHaveAttribute("href", "/login?redirect=%2Fmeta%2Fsummoner-skirmish");
  });

  it("says nothing about signing in to a reader already signed in", () => {
    state.userId = "user-1";
    renderPreview();

    expect(screen.queryByText("Sign in to compare with your collection")).toBeNull();
  });

  it("bands each card by how many copies a signed-in reader owns", async () => {
    state.userId = "user-1";
    renderPreview();

    expect(await screen.findByTitle("You own all 8 in this printing")).toBeInTheDocument();
    expect(
      screen.getByTitle("You own 1 of 3 in this printing and 1 in another"),
    ).toBeInTheDocument();
  });

  it("bands nothing for a signed-out reader", () => {
    renderPreview();

    expect(screen.queryByTitle(/^You own/u)).toBeNull();
  });
});
