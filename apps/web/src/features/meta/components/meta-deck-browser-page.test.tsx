import type { MetaDeckSummary } from "@openrift/shared/types/api/meta";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { META_DECKS_DESCRIPTION } from "@/features/meta/components/meta-copy";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import { useDisplayStore } from "@/stores/display-store";

const captured = vi.hoisted(() => ({
  decks: [] as MetaDeckSummary[],
  total: undefined as number | undefined,
  eventCount: undefined as number | undefined,
  archiveTotal: undefined as number | undefined,
  search: {} as Record<string, unknown>,
  signedIn: false,
  costs: undefined as Map<string, MetaDeckCost> | undefined,
  hydrated: true,
  query: {} as Record<string, unknown>,
}));

const navigate = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({
    useSearch: () => captured.search,
    useNavigate: () => navigate,
  }),
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children?: React.ReactNode;
    to?: string;
    params?: { token?: string; cardSlug?: string; slug?: string };
  }) => (
    <a
      {...rest}
      href={(to ?? "/")
        .replace("$cardSlug", params?.cardSlug ?? "")
        .replace("$token", params?.token ?? "")
        .replace("$slug", params?.slug ?? "")}
    >
      {children}
    </a>
  ),
}));

const EVENT_SUMMARY = vi.hoisted(() => ({
  id: "event-1",
  slug: "regional-qualifier-barcelona",
  name: "Regional Qualifier Barcelona",
  eventDate: "2026-08-23",
  format: "constructed",
  tier: "premier",
  country: "ES",
  location: "Barcelona",
  organizer: "Rift Open Series",
  playerCount: 86,
  playerRowCount: 41,
  deckCount: 41,
  topFinishes: [],
}));

vi.mock("@/features/meta/hooks/use-meta", () => ({
  useMetaDecks: (query: Record<string, unknown>) => {
    captured.query = query;
    return {
      data: {
        decks: captured.decks,
        events: [EVENT_SUMMARY],
        total: captured.total ?? captured.decks.length,
        eventCount:
          captured.eventCount ?? new Set(captured.decks.map((entry) => entry.event.slug)).size,
        archiveTotal: captured.archiveTotal ?? captured.total ?? captured.decks.length,
      },
    };
  },
  useMetaDeckFacets: () => ({
    data: { events: [], legends: [], finishes: [], countries: [] },
  }),
}));
vi.mock("@/hooks/use-enums", () => ({
  useDeckFormatList: () => ({
    formats: [{ slug: "standard", label: "Standard" }],
    labels: { standard: "Standard" },
  }),
}));
vi.mock("@/features/meta/hooks/use-meta-eras", () => ({
  useMetaEras: () => [{ id: "vendetta", label: "Vendetta", from: "2026-08-01", to: null }],
}));
vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => captured.hydrated }));
vi.mock("@/features/meta/hooks/use-meta-deck-costs", () => ({
  useMetaDeckCosts: () => captured.costs,
}));
vi.mock("@/lib/auth-session", () => ({
  useSession: () => ({ data: captured.signedIn ? { user: { id: "u1" } } : null }),
}));

vi.mock("@/components/layout/page-top-bar", () => ({
  PageDescription: ({ children }: { children?: React.ReactNode }) => <p>{children}</p>,
  PageTopBar: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PageTopBarBack: () => null,
  PageTopBarSticky: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  PageTopBarTitle: ({ children }: { children?: React.ReactNode }) => <h1>{children}</h1>,
}));

vi.mock("@/features/meta/components/meta-scope-bar", () => ({ MetaScopeBar: () => null }));
vi.mock("@/features/decks/components/deck-tile", () => ({ FannedPreview: () => null }));

// oxlint-disable-next-line import/first -- must import after vi.mock
import { MetaDeckBrowserPage } from "./meta-deck-browser-page";

function deck(overrides: Partial<MetaDeckSummary> = {}): MetaDeckSummary {
  return {
    playerId: "player-1",
    deckId: "deck-1",
    shareToken: "aB3dE5gH7jK9",
    listStatus: "full",
    name: "Kennen Tempo",
    format: "constructed",
    legendCardId: "card-kennen",
    legendName: "Kennen, Heart of the Tempest",
    legendSlug: "kennen",
    legendArchiveSlug: null,
    legendImageId: null,
    championCardId: null,
    championName: null,
    championImageId: null,
    playerName: "Nova",
    playerKey: "u2001",
    rank: 1,
    rankIsTier: false,
    wins: 6,
    losses: 1,
    draws: 0,
    event: {
      slug: "regional-qualifier-barcelona",
      name: "Regional Qualifier Barcelona",
      eventDate: "2026-08-23",
      format: "constructed",
      tier: "premier",
      country: "ES",
      ...overrides.event,
    },
    ...overrides,
  };
}

const SAME_LEGEND_TWICE = [
  deck({ deckId: "winner", playerName: "Nova", rank: 1 }),
  deck({ deckId: "eighth", playerName: "Ekko", rank: 8 }),
];

describe("MetaDeckBrowserPage", () => {
  beforeEach(() => {
    navigate.mockReset();
    captured.decks = SAME_LEGEND_TWICE;
    captured.total = undefined;
    captured.eventCount = undefined;
    captured.archiveTotal = undefined;
    captured.query = {};
    captured.search = {};
    captured.signedIn = false;
    captured.costs = undefined;
    captured.hydrated = true;
    useDisplayStore.setState({ metaDeckView: "list" });
  });

  const seen = (text: string) => screen.queryAllByText(text).length > 0;

  const lastSearch = () =>
    navigate.mock.calls.at(-1)?.[0].search as (
      prev: Record<string, unknown>,
    ) => Record<string, unknown>;

  it("serves the page chrome without the archive before hydration", () => {
    captured.hydrated = false;
    render(<MetaDeckBrowserPage />);
    expect(screen.getByRole("heading", { name: "Archived decks" })).toBeInTheDocument();
    expect(seen(META_DECKS_DESCRIPTION)).toBe(true);
    expect(seen("Nova")).toBe(false);
    expect(screen.queryByRole("button", { name: "Every list" })).not.toBeInTheDocument();
  });

  it("renders the page the API served, as rows", () => {
    render(<MetaDeckBrowserPage />);
    expect(seen("Nova")).toBe(true);
    expect(seen("Ekko")).toBe(true);
    expect(seen("2 decks · 1 event")).toBe(true);
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true");
  });

  it("asks the API to curate until the reader opens the whole archive", () => {
    render(<MetaDeckBrowserPage />);
    expect(captured.query.curated).toBe(true);
    expect(captured.query.limit).toBe(50);
    expect(captured.query.offset).toBe(0);
  });

  it("asks for the page the URL names", () => {
    captured.search = { page: 3, per: 100 };
    render(<MetaDeckBrowserPage />);
    expect(captured.query.limit).toBe(100);
    expect(captured.query.offset).toBe(200);
  });

  it("asks for the order the URL names", () => {
    captured.search = { by: "finish", dir: "asc" };
    render(<MetaDeckBrowserPage />);
    expect(captured.query).toMatchObject({ by: "finish", dir: "asc" });
  });

  it("asks for the newest page under a priced sort, which it orders itself", () => {
    captured.search = { by: "cost", dir: "asc" };
    render(<MetaDeckBrowserPage />);
    expect(captured.query).toMatchObject({ by: "date", dir: "desc" });
    expect(seen("Prices are worked out in your browser, so this orders the page you are on.")).toBe(
      true,
    );
  });

  it("leaves the page-local note off a sort the API applies", () => {
    render(<MetaDeckBrowserPage />);
    expect(seen("Prices are worked out in your browser, so this orders the page you are on.")).toBe(
      false,
    );
  });

  it("scrolls a page change to the list, not to the filter chrome above it", () => {
    captured.total = 412;
    render(<MetaDeckBrowserPage />);

    const target = document.querySelector("#meta-deck-list") as HTMLElement;
    expect(target).not.toBeNull();
    expect(target.contains(screen.getByLabelText("Sort"))).toBe(false);
    expect(target.contains(screen.getByRole("navigation", { name: "Deck pages" }))).toBe(true);
  });

  it("keeps the size picker when a large page size left the page empty", () => {
    captured.decks = [];
    captured.total = 0;
    captured.search = { per: 500 };
    render(<MetaDeckBrowserPage />);

    expect(screen.getByLabelText("Decks per page")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Deck pages" })).toBeNull();
  });

  it("counts what the filter matched against the whole archive in the top bar", () => {
    captured.total = 60;
    captured.archiveTotal = 6266;
    render(<MetaDeckBrowserPage />);
    expect(seen("60 of 6,266 archived decks")).toBe(true);
  });

  it("counts the filtered set in the toolbar line, not the page on screen", () => {
    captured.total = 60;
    captured.eventCount = 7;
    captured.archiveTotal = 6266;
    render(<MetaDeckBrowserPage />);
    expect(seen("60 decks · 7 events")).toBe(true);
  });

  it("reads as none of the archive when the filter matched no deck", () => {
    captured.decks = [];
    captured.total = 0;
    captured.eventCount = 0;
    captured.archiveTotal = 6266;
    render(<MetaDeckBrowserPage />);
    expect(seen("0 of 6,266 archived decks")).toBe(true);
    expect(seen("0 decks · 0 events")).toBe(true);
  });

  it("counts the decks left on screen once a cost bound narrows the page", () => {
    captured.signedIn = true;
    captured.search = { all: true, cost: 0 };
    captured.total = 60;
    captured.eventCount = 7;
    captured.archiveTotal = 6266;
    captured.costs = new Map([
      ["winner", { owned: 40, needed: 40, value: 120, toComplete: 0 }],
      ["eighth", { owned: 4, needed: 40, value: 120, toComplete: 95 }],
    ]);
    render(<MetaDeckBrowserPage />);
    expect(screen.getAllByText("1 deck on this page").length).toBe(2);
    expect(seen("60 of 6,266 archived decks")).toBe(false);
    expect(seen("60 decks · 7 events")).toBe(false);
  });

  it("counts the page the same way under a value bound alone", () => {
    captured.search = { all: true, valueMin: 100 };
    captured.total = 60;
    captured.eventCount = 7;
    captured.archiveTotal = 6266;
    captured.costs = new Map([
      ["winner", { owned: undefined, needed: 40, value: 120, toComplete: undefined }],
      ["eighth", { owned: undefined, needed: 40, value: 60, toComplete: undefined }],
    ]);
    render(<MetaDeckBrowserPage />);
    expect(screen.getAllByText("1 deck on this page").length).toBe(2);
    expect(seen("60 decks · 7 events")).toBe(false);
  });

  it("counts none on the page when a cost bound leaves nothing to show", () => {
    captured.signedIn = true;
    captured.search = { all: true, cost: 0 };
    captured.total = 60;
    captured.eventCount = 7;
    captured.archiveTotal = 6266;
    captured.costs = new Map([
      ["winner", { owned: 4, needed: 40, value: 120, toComplete: 95 }],
      ["eighth", { owned: 4, needed: 40, value: 120, toComplete: 95 }],
    ]);
    render(<MetaDeckBrowserPage />);
    expect(screen.getAllByText("0 decks on this page").length).toBe(2);
    expect(seen("No decks match these filters.")).toBe(true);
    expect(seen("60 decks · 7 events")).toBe(false);
  });

  it("keeps the archive counts when the sideboard toggle is the only priced option on", () => {
    captured.signedIn = true;
    captured.search = { all: true, side: true };
    captured.total = 60;
    captured.eventCount = 7;
    captured.archiveTotal = 6266;
    captured.costs = new Map([["winner", { owned: 40, needed: 40, value: 120, toComplete: 0 }]]);
    render(<MetaDeckBrowserPage />);
    expect(seen("60 of 6,266 archived decks")).toBe(true);
    expect(seen("60 decks · 7 events")).toBe(true);
  });

  it("pages through the archive from the numbered pager", async () => {
    captured.total = 412;
    render(<MetaDeckBrowserPage />);
    await userEvent.click(screen.getByRole("button", { name: "2" }));
    expect(lastSearch()({})).toEqual({ page: 2 });
  });

  it("heads each event's lists with the event and its tier, and leaves the field off the rows", () => {
    render(<MetaDeckBrowserPage />);
    expect(screen.getByRole("link", { name: /Regional Qualifier Barcelona/u })).toHaveAttribute(
      "href",
      "/meta/regional-qualifier-barcelona",
    );
    expect(seen("Premier")).toBe(true);
    expect(seen("of 86")).toBe(false);
  });

  it("starts a new header for each event, newest first", () => {
    captured.search = { all: true };
    captured.decks = [
      deck({ deckId: "barcelona", playerName: "Nova" }),
      deck({
        deckId: "lyon",
        playerName: "Ekko",
        legendCardId: "card-lux",
        event: {
          slug: "regional-lyon",
          name: "Regional Lyon",
          eventDate: "2026-08-30",
          format: "constructed",
          tier: "premier",
          country: "FR",
        },
      }),
    ];
    render(<MetaDeckBrowserPage />);

    const headers = screen.getAllByRole("link", { name: /Regional (?:Lyon|Qualifier Barcelona)/u });
    expect(headers.map((header) => header.getAttribute("href"))).toEqual([
      "/meta/regional-lyon",
      "/meta/regional-qualifier-barcelona",
    ]);
  });

  it("keeps the event and the field on every row once sorted by anything but date", () => {
    captured.search = { by: "value", dir: "asc" };
    render(<MetaDeckBrowserPage />);
    expect(screen.queryByRole("link", { name: /Regional Qualifier Barcelona/u })).toBeNull();
    expect(seen("Regional Qualifier Barcelona")).toBe(true);
    expect(seen("of 86")).toBe(true);
  });

  it("offers every archived list one click away", async () => {
    render(<MetaDeckBrowserPage />);
    await userEvent.click(screen.getByRole("button", { name: "Every list" }));
    expect(lastSearch()({})).toEqual({ all: true });
  });

  it("sorts by a column from its header and flips it on the second click", async () => {
    captured.search = { all: true };
    render(<MetaDeckBrowserPage />);
    await userEvent.click(screen.getByRole("button", { name: "Sort by value" }));
    expect(lastSearch()({})).toEqual({ by: "value", dir: "asc" });
    captured.search = { all: true, by: "value", dir: "asc" };
    render(<MetaDeckBrowserPage />);
    await userEvent.click(screen.getByRole("button", { name: "Value, sorted ascending" }));
    expect(lastSearch()(captured.search)).toEqual({ all: true, by: "value", dir: "desc" });
  });

  it("puts the cheapest list first when sorted by cost to complete", () => {
    captured.signedIn = true;
    captured.search = { all: true, by: "cost", dir: "asc" };
    captured.costs = new Map([
      ["winner", { owned: 10, needed: 40, value: 120, toComplete: 90 }],
      ["eighth", { owned: 38, needed: 40, value: 60, toComplete: 5 }],
    ]);
    render(<MetaDeckBrowserPage />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Ekko");
    expect(rows[1]).toHaveTextContent("Nova");
  });

  it("switches to tiles with a sort menu on the grid layout", async () => {
    useDisplayStore.setState({ metaDeckView: "grid" });
    render(<MetaDeckBrowserPage />);
    expect(screen.getByRole("button", { name: "Grid" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("combobox", { name: "Sort" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sort by value" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "List" }));
    expect(useDisplayStore.getState().metaDeckView).toBe("list");
  });

  it("counts the reader's own cards on each row once the collection is in", () => {
    captured.signedIn = true;
    captured.costs = new Map([["winner", { owned: 34, needed: 40, value: 120, toComplete: 30 }]]);
    render(<MetaDeckBrowserPage />);
    expect(seen("34/40 owned")).toBe(true);
    expect(screen.getAllByText("€120").length).toBeGreaterThan(0);
  });

  it("narrows to the lists the reader can complete within their budget", () => {
    captured.signedIn = true;
    captured.search = { all: true, cost: 0 };
    captured.costs = new Map([
      ["winner", { owned: 40, needed: 40, value: 120, toComplete: 0 }],
      ["eighth", { owned: 4, needed: 40, value: 120, toComplete: 95 }],
    ]);
    render(<MetaDeckBrowserPage />);
    expect(seen("Nova")).toBe(true);
    expect(seen("Ekko")).toBe(false);
  });

  it("shows the whole archive on a shared cost link before any collection loads", () => {
    captured.search = { all: true, cost: 0 };
    render(<MetaDeckBrowserPage />);
    expect(seen("Nova")).toBe(true);
    expect(seen("Ekko")).toBe(true);
  });

  it("never narrows a signed-out reader by a cost they cannot be measured against", () => {
    captured.search = { all: true, cost: 0 };
    captured.costs = new Map([
      ["winner", { owned: undefined, needed: 40, value: 120, toComplete: undefined }],
      ["eighth", { owned: undefined, needed: 40, value: 120, toComplete: undefined }],
    ]);
    render(<MetaDeckBrowserPage />);
    expect(seen("Nova")).toBe(true);
    expect(seen("Ekko")).toBe(true);
  });

  it("sends the row's legend to its archive page and the rest of the row to the list", () => {
    captured.decks = [deck({ legendArchiveSlug: "kennen-heart-of-the-tempest" })];
    render(<MetaDeckBrowserPage />);
    expect(screen.getAllByRole("link", { name: "Kennen" })[0]).toHaveAttribute(
      "href",
      "/meta/legends/kennen-heart-of-the-tempest",
    );
    expect(
      screen.getByRole("link", { name: "Nova's Kennen, Heart of the Tempest decklist" }),
    ).toHaveAttribute("href", "/meta/decks/aB3dE5gH7jK9");
  });

  it("leaves the legend unlinked when the archive holds no page for it", () => {
    render(<MetaDeckBrowserPage />);
    expect(screen.queryByRole("link", { name: "Kennen" })).not.toBeInTheDocument();
  });

  it("says so when nothing matches", () => {
    captured.decks = [];
    render(<MetaDeckBrowserPage />);
    expect(seen("No decks match these filters.")).toBe(true);
  });
});
