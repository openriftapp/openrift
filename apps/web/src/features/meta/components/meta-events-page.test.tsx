import type { MetaEventSummary } from "@openrift/shared/types/api/meta";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  events: [] as MetaEventSummary[],
  matched: 0,
  totalEvents: 0,
  queries: [] as Record<string, unknown>[],
  facetQueries: [] as unknown[],
  navigated: [] as Record<string, unknown>[],
}));

/** The URL the route would carry, so paging re-renders the way navigation does. */
const searchStore = vi.hoisted(() => {
  let search: Record<string, unknown> = {};
  const listeners = new Set<() => void>();
  return {
    read: () => search,
    write: (next: Record<string, unknown>) => {
      search = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock("@tanstack/react-router", async () => {
  const react = await import("react");
  function Anchor({ children, ...rest }: { children?: React.ReactNode }) {
    return <a {...rest}>{children ?? "link"}</a>;
  }
  return {
    getRouteApi: () => ({
      useSearch: () =>
        react.useSyncExternalStore(searchStore.subscribe, searchStore.read, searchStore.read),
      useNavigate:
        () =>
        ({ search }: { search: (prev: Record<string, unknown>) => Record<string, unknown> }) => {
          const next = search(searchStore.read());
          captured.navigated.push(next);
          searchStore.write(next);
        },
    }),
    Link: Anchor,
    createLink: () => Anchor,
  };
});

vi.mock("@/features/meta/hooks/use-meta", () => ({
  useMetaEventPage: (query: Record<string, unknown>) => {
    captured.queries.push(query);
    const offset = (query.offset as number | undefined) ?? 0;
    const limit = (query.limit as number | undefined) ?? 50;
    return {
      data: {
        events: captured.events.slice(offset, offset + limit),
        total: captured.matched,
      },
    };
  },
  useMetaEventFacets: (query: unknown) => {
    captured.facetQueries.push(query);
    return {
      data: {
        formats: [],
        tiers: [],
        countries: [],
        holdings: { all: captured.matched, decks: 0, standings: 0, upcoming: 0, resultless: 0 },
        totals: { events: captured.matched, playerRows: 0, decks: 0 },
      },
    };
  },
  useMetaEventDayCounts: () => ({ data: { days: {} } }),
  useMetaCounts: () => ({
    data: {
      totalPlayers: 0,
      decksWithMainDeck: 0,
      totalEvents: captured.totalEvents,
      eventsByTier: { premier: 0, competitive: 0, local: 0 },
    },
  }),
}));
vi.mock("@/features/meta/hooks/use-meta-eras", () => ({ useMetaEras: () => [] }));
vi.mock("@/features/meta/components/meta-scope-bar", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "@/features/meta/components/meta-scope-bar",
  );
  return {
    ...actual,
    MetaScopeBar: ({ search, extras }: { search?: React.ReactNode; extras?: React.ReactNode }) => (
      <div>
        {search}
        {extras}
      </div>
    ),
  };
});

// oxlint-disable-next-line import/first -- must import after vi.mock
import { MetaEventsPage } from "./meta-events-page";

function event(overrides: Partial<MetaEventSummary> = {}): MetaEventSummary {
  return {
    id: "e1",
    slug: "summoner-skirmish-vienna",
    name: "Summoner Skirmish at Cardhouse Vienna",
    eventDate: "2026-08-29",
    format: "constructed",
    tier: "local",
    status: "complete",
    country: "AT",
    location: "Vienna",
    playerCount: 18,
    organizer: "Cardhouse",
    playerRowCount: 18,
    deckCount: 4,
    topFinishes: [],
    ...overrides,
  };
}

/**
 * The API pages and filters the index, so a render is told what the whole
 * filter matches and hands back the slice the URL asks for.
 */
function renderPages(
  events: MetaEventSummary[],
  {
    search = {},
    matched = events.length,
    totalEvents = matched,
  }: { search?: Record<string, unknown>; matched?: number; totalEvents?: number } = {},
) {
  captured.events = events;
  captured.matched = matched;
  captured.totalEvents = totalEvents;
  searchStore.write(search);
  render(<MetaEventsPage />);
  return {
    navigateTo(next: Record<string, unknown>) {
      searchStore.write(next);
    },
  };
}

function renderPage(
  events: MetaEventSummary[],
  search: Record<string, unknown> = {},
  totalEvents = events.length,
) {
  return renderPages(events, { search, matched: events.length, totalEvents });
}

function winner(playerName: string): MetaEventSummary["topFinishes"][number] {
  return {
    rank: 1,
    rankIsTier: false,
    playerName,
    playerKey: `pn${playerName}`,
    wins: 5,
    losses: 1,
    draws: 0,
    legend: {
      cardId: "c1",
      name: "Lee Sin, the Blind Monk",
      slug: "lee-sin",
      imageId: "i1",
      domains: ["body"],
      archiveSlug: "lee-sin-lee-sin",
    },
  };
}

// 52 events: one more than a page and a half.
function manyEvents(): MetaEventSummary[] {
  return Array.from({ length: 52 }, (_, index) =>
    event({
      id: `e${index}`,
      name: `Event ${String(index).padStart(2, "0")}`,
      eventDate: `2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
    }),
  );
}

/** Both the column and card layouts are in the DOM at once (CSS picks between them); reads the first title. */
function rowNames(): string[] {
  return screen.getAllByRole("listitem").map((row) => row.querySelector("p")?.textContent ?? "");
}

beforeEach(() => {
  captured.events = [];
  captured.matched = 0;
  captured.totalEvents = 0;
  captured.queries = [];
  captured.facetQueries = [];
  captured.navigated = [];
  searchStore.write({});
});

describe("MetaEventsPage", () => {
  it("lists the page in the order the API sent it", () => {
    renderPage([
      event({ id: "new", name: "Regional Qualifier Milan", eventDate: "2026-08-16" }),
      event({ id: "old", name: "City Challenge Lyon", eventDate: "2026-08-09" }),
    ]);
    expect(rowNames()).toEqual(["Regional Qualifier Milan", "City Challenge Lyon"]);
  });

  it("asks for the newest first until the reader picks another column", () => {
    renderPage([event()]);
    expect(captured.queries.at(-1)).toMatchObject({ by: "date", dir: "desc" });
  });

  it("counts what the archive holds in the top bar", () => {
    renderPage([event({ id: "a" }), event({ id: "b", name: "Nexus Night" })]);
    expect(screen.getByText("2 archived events")).toBeDefined();
  });

  it("says how many of the archive a narrowed view is showing", () => {
    renderPages([event({ id: "b", name: "Nexus Night" })], {
      search: { q: "nexus" },
      matched: 1,
      totalEvents: 2,
    });
    expect(screen.getByText("1 of 2 archived events")).toBeDefined();
    expect(rowNames()).toEqual(["Nexus Night"]);
  });

  it("hands the whole narrowing to the API, the sort included", () => {
    renderPage([event()], { q: "nexus", holds: "decks", playersMin: 8, by: "players", dir: "asc" });

    expect(captured.queries.at(-1)).toMatchObject({
      q: "nexus",
      holds: "decks",
      playersMin: 8,
      by: "players",
      dir: "asc",
    });
  });

  it("asks for the facet counts under the same filter, minus the sort", () => {
    renderPage([event()], { q: "nexus", by: "players" });

    expect(captured.facetQueries.at(-1)).toMatchObject({ q: "nexus" });
    expect(captured.facetQueries.at(-1)).not.toHaveProperty("by");
  });

  it("dates a row by month, day and year, so a multi-year archive reads unambiguously", () => {
    renderPage([event({ eventDate: "2026-08-29" })]);
    // One tile per layout: the column row and the phone card are both in the DOM.
    expect(screen.getAllByText("AUG")).toHaveLength(2);
    expect(screen.getAllByText("2026")).toHaveLength(2);
  });

  it("announces the date once, with the tile itself hidden from assistive tech", () => {
    renderPage([event({ eventDate: "2026-08-29" })]);
    expect(screen.getAllByText("2026-08-29")).toHaveLength(1);
    expect(screen.getAllByText("2026")[0]!.closest("[aria-hidden]")).not.toBeNull();
  });

  it("names the winner of each event inline", () => {
    renderPage([event({ topFinishes: [winner("A. Gruber")] })]);
    expect(screen.getAllByText("A. Gruber").length).toBeGreaterThan(0);
  });

  it("names both players an event recorded two first places for", () => {
    renderPage([event({ topFinishes: [winner("A. Gruber"), winner("M. Álvarez")] })]);
    expect(screen.getAllByText("A. Gruber and M. Álvarez").length).toBeGreaterThan(0);
  });

  it("says a played event holds no results rather than counting a field of zero", () => {
    renderPage([event({ eventDate: "2026-01-10", playerRowCount: 0, deckCount: 0 })]);
    expect(screen.getByText("18 players · No results on file")).toBeDefined();
  });

  it("collapses the zero columns into one status line", () => {
    renderPage([event({ eventDate: "2026-01-10", playerRowCount: 0, deckCount: 0 })]);
    expect(screen.getByText("No results on file")).toBeDefined();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("keeps its columns aligned when no source named a country", () => {
    renderPage([event({ country: null })]);
    const grid = document.querySelector("a > div");
    expect(grid?.childElementCount).toBe(7);
  });

  it("says an event still to come has not been played yet", () => {
    renderPage([event({ eventDate: "2099-01-10", playerRowCount: 0, deckCount: 0 })]);
    expect(screen.getByText("18 players · Not played yet")).toBeDefined();
  });

  it("writes the chosen column and direction to the URL", async () => {
    renderPage([event()]);
    await userEvent.click(screen.getByRole("button", { name: /sort by players/iu }));
    expect(captured.navigated.at(-1)).toMatchObject({ by: "players", dir: "desc" });
  });

  it("flips the direction when the same column is clicked again", async () => {
    renderPage([event()], { by: "players", dir: "desc" });
    await userEvent.click(screen.getByRole("button", { name: /players, sorted/iu }));
    expect(captured.navigated.at(-1)).toMatchObject({ by: "players", dir: "asc" });
  });

  it("pages a long archive and reads the page from the URL", async () => {
    renderPages(manyEvents(), { matched: 52 });

    expect(rowNames()).toHaveLength(50);
    await userEvent.click(screen.getByRole("button", { name: "2" }));

    expect(captured.navigated.at(-1)).toMatchObject({ page: 2 });
    expect(rowNames()).toHaveLength(2);
  });

  it("asks the API for the page the URL names", () => {
    renderPages(manyEvents(), { search: { page: 2 }, matched: 52 });

    expect(captured.queries.at(-1)).toMatchObject({ limit: 50, offset: 50 });
  });

  it("takes the page size from the URL and reopens at the first page", async () => {
    const page = renderPages(manyEvents(), { search: { page: 2 }, matched: 52 });
    page.navigateTo({ page: 2 });

    await userEvent.click(screen.getByLabelText("Events per page"));
    await userEvent.click(await screen.findByRole("option", { name: "Show 100" }));

    expect(captured.navigated.at(-1)).toMatchObject({ per: 100 });
    expect(captured.navigated.at(-1)?.page).toBeUndefined();
  });

  it("keeps the size picker when a large page size narrowed the archive to nothing", () => {
    renderPages([], { search: { per: 500 }, matched: 0, totalEvents: 412 });

    expect(screen.getByLabelText("Events per page")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Event pages" })).toBeNull();
  });

  it("offers no pager for an archive that fits on one page", () => {
    renderPages([event()], { matched: 1 });

    expect(screen.queryByRole("navigation", { name: "Event pages" })).toBeNull();
  });

  it("opens at the first page again once the filters change", async () => {
    renderPages(manyEvents(), { search: { page: 2 }, matched: 52 });

    await userEvent.click(screen.getByRole("button", { name: /sort by players/iu }));

    expect(captured.navigated.at(-1)?.page).toBeUndefined();
  });

  it("tells a reader whose filters match nothing, without emptying the page", () => {
    renderPages([], { search: { q: "piltover" }, matched: 0, totalEvents: 12 });
    expect(screen.getByText("No events match these filters.")).toBeDefined();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("measures the era it fetched against the whole archive, not against itself", () => {
    renderPages([event({ id: "a" }), event({ id: "b", name: "Nexus Night" })], {
      matched: 2,
      totalEvents: 6266,
    });
    expect(screen.getByText("2 of 6,266 archived events")).toBeDefined();
  });

  it("asks for the era the scope names rather than the whole archive", () => {
    renderPage([event()], { era: "custom", from: "2026-03-01", to: "2026-09-30" });
    expect(captured.queries.at(-1)).toMatchObject({ from: "2026-03-01", to: "2026-09-30" });
  });

  it("invites the first event when the archive is empty", () => {
    renderPage([]);
    expect(screen.getByText("No events archived yet")).toBeDefined();
    expect(screen.queryByRole("button", { name: /sort by players/iu })).toBeNull();
  });

  it("lists only the events holding what the reader asked for", () => {
    renderPages([event({ id: "listed", name: "With lists", deckCount: 4 })], {
      search: { holds: "decks" },
      matched: 1,
      totalEvents: 2,
    });

    expect(captured.queries.at(-1)).toMatchObject({ holds: "decks" });
    expect(screen.getAllByText("With lists").length).toBeGreaterThan(0);
    expect(screen.getByText("1 of 2 archived events")).toBeDefined();
  });

  it("writes the picked holdings to the URL", async () => {
    renderPage([event()]);
    await userEvent.click(screen.getByLabelText("Archive holdings"));
    await userEvent.click(await screen.findByRole("option", { name: /^With decklists/u }));
    expect(captured.navigated.at(-1)).toMatchObject({ holds: "decks" });
  });

  it("clears the picked holdings back out of the URL", async () => {
    renderPage([event()], { holds: "decks" });
    await userEvent.click(screen.getByLabelText("Archive holdings"));
    await userEvent.click(await screen.findByRole("option", { name: /^Any events/u }));
    expect(captured.navigated.at(-1)).toEqual({});
  });

  it("writes a player bound to the URL", async () => {
    renderPage([event()]);
    await userEvent.click(screen.getByRole("button", { name: "Players" }));
    await userEvent.type(await screen.findByLabelText("Minimum players"), "8");
    expect(captured.navigated.at(-1)).toMatchObject({ playersMin: 8 });
  });

  it("drops a cleared player bound from the URL", async () => {
    renderPage([event()], { playersMax: 64 });
    await userEvent.click(screen.getByRole("button", { name: "Players ≤ 64" }));
    const field = await screen.findByLabelText("Maximum players");
    expect(field).toHaveValue(64);
    await userEvent.clear(field);
    expect(captured.navigated.at(-1)).toEqual({});
  });
});
