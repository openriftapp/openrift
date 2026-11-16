// @vitest-environment jsdom
import { hasShownRecord } from "@openrift/shared/meta-standings";
import type {
  MetaEventPhase,
  MetaEventStandingsQuery,
  MetaStandingsRow,
} from "@openrift/shared/types/api/meta";
import type { MetaEventStatus } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { act, configure, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MetaDeckCostFilterProps } from "@/features/meta/components/meta-deck-cost-filter";
import type { MetaBanGroup } from "@/features/meta/lib/meta-deck-bans";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import type { MetaStandingsSearch } from "@/features/meta/lib/meta-standings-search";
import { standingsPageQuery } from "@/features/meta/lib/meta-standings-search";
import { metaField, metaPhase, metaRow } from "@/test/meta-event-fixtures";

const session = vi.hoisted(() => ({ userId: null as string | null }));

/** The URL the route would carry, so a narrowing re-renders the way navigation does. */
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
type StandingsQuery = Omit<MetaEventStandingsQuery, "slug">;
interface StandingsPage {
  players: unknown[];
  total: number;
}

const archive = vi.hoisted(() => {
  const store = {
    costs: undefined as ReadonlyMap<string, MetaDeckCost> | undefined,
    bans: new Map() as ReadonlyMap<string, MetaBanGroup[]>,
    withCollection: [] as boolean[],
    includeSideboard: [] as boolean[],
    rows: [] as { id: string; playerName: string; shareToken: string | null; legend: unknown }[],
    cache: new Map<string, StandingsPage>(),
    fetched: [] as string[],
    groupFetches: [] as string[],
    failingGroups: new Set<string>(),
    kept: undefined as StandingsPage | undefined,
    // Keys the API rejects, and keys whose request never lands.
    failing: new Set<string>(),
    holding: new Set<string>(),
    keyOf: (slug: string, query: StandingsQuery) => JSON.stringify([slug, query]),
    pageFor: (query: StandingsQuery): StandingsPage => {
      const needle = query.q?.toLowerCase() ?? "";
      const matching = store.rows.filter(
        (row) =>
          (needle === "" || row.playerName.toLowerCase().includes(needle)) &&
          (query.list !== "with" || row.shareToken !== null) &&
          (query.legend === undefined ||
            (row.legend as { cardId?: string } | null)?.cardId === query.legend ||
            (query.legend === "none" && row.legend === null)),
      );
      const offset = query.offset ?? 0;
      return {
        players: matching.slice(offset, offset + (query.limit ?? 200)),
        total: matching.length,
      };
    },
  };
  return store;
});

// Stands in for the query cache: an unseeded key has to be fetched, and
// `keepPreviousData` holds the page before it on screen until that lands.
vi.mock("@/features/meta/hooks/use-meta", async () => {
  const react = await import("react");
  return {
    useMetaLegendGroupRows: (_slug: string, cardIds: readonly string[], limit: number) => {
      archive.groupFetches.push(...cardIds);
      const groups = cardIds.map((legend) =>
        archive.failingGroups.has(legend)
          ? {
              players: undefined,
              isError: true,
              refetch: () => {
                archive.failingGroups.delete(legend);
                searchStore.write({ ...searchStore.read() });
              },
            }
          : {
              players: archive.pageFor({ legend, limit, offset: 0 }).players,
              isError: false,
              refetch: () => {},
            },
      );
      return { groups, lists: groups.map((group) => group.players) };
    },
    useMetaStandings: (slug: string, query: StandingsQuery) => {
      const key = archive.keyOf(slug, query);
      const hit = archive.cache.get(key);
      const [, settle] = react.useState(0);
      const rejected = archive.failing.has(key);
      react.useEffect(() => {
        if (rejected || archive.holding.has(key)) {
          return;
        }
        if (hit === undefined) {
          archive.fetched.push(key);
          archive.cache.set(key, archive.pageFor(query));
          settle((round) => round + 1);
          return;
        }
        archive.kept = hit;
      });
      const refetch = () => {
        archive.failing.delete(key);
        settle((round) => round + 1);
      };
      if (rejected) {
        return { data: undefined, isError: true, isPlaceholderData: false, refetch };
      }
      if (hit !== undefined) {
        return { data: hit, isError: false, isPlaceholderData: false, refetch };
      }
      return {
        data: archive.kept,
        isError: false,
        isPlaceholderData: archive.kept !== undefined,
        refetch,
      };
    },
  };
});

vi.mock("@/hooks/use-session", () => ({ useUserId: () => session.userId }));
vi.mock("@/hooks/use-hydrated", () => ({ useHydrated: () => true }));
vi.mock("@/features/meta/hooks/use-meta-deck-costs", () => ({
  useMetaDeckCosts: (side: boolean, options: { withCollection: boolean }) => {
    archive.withCollection.push(options.withCollection);
    archive.includeSideboard.push(side);
    return archive.costs;
  },
}));

vi.mock("@/features/meta/hooks/use-meta-deck-bans", () => ({
  useMetaDeckBans: () => archive.bans,
}));

vi.mock("@/features/meta/components/meta-deck-cost-filter", () => ({
  EMPTY_META_COST_FILTER: {
    maxCost: null,
    valueRange: { min: null, max: null },
    includeSideboard: false,
  },
  MetaDeckCostFilter: (props: MetaDeckCostFilterProps) => (
    <div>
      <p>{`cost ready: ${props.ready}`}</p>
      <p>{`cost noun: ${props.noun}`}</p>
      <p>{`cost trigger: ${props.trigger}`}</p>
      <p>{`cost collection: ${props.withCollection}`}</p>
      <p>{`cost matches: ${props.countUnderCost(10)}`}</p>
      <p>{`cost ceiling: ${props.maxValue}`}</p>
      <p>{`completion ceiling: ${props.maxToComplete}`}</p>
      <p>{`cost sideboard: ${props.value.includeSideboard}`}</p>
      <p>{`cost max: ${props.value.maxCost}`}</p>
      <button type="button" onClick={() => props.onMaxCostChange(10)}>
        cost bound
      </button>
      <button type="button" onClick={() => props.onMaxCostChange(0)}>
        buildable
      </button>
      <button type="button" onClick={() => props.onValueRangeChange({ min: null, max: 100 })}>
        value bound
      </button>
      <button type="button" onClick={() => props.onIncludeSideboardChange(false)}>
        drop sideboard
      </button>
      <button type="button" onClick={props.onClear}>
        clear cost
      </button>
    </div>
  ),
}));

vi.mock("@/hooks/use-enums", () => ({
  useEnumOrders: () => ({ orders: { domains: ["fury"] }, labels: { domains: { fury: "Fury" } } }),
}));

vi.mock("@tanstack/react-router", async () => {
  const react = await import("react");
  const fixtures = await import("@/test/meta-event-fixtures");
  return {
    Link: fixtures.StubLink,
    getRouteApi: () => ({
      useSearch: () =>
        react.useSyncExternalStore(searchStore.subscribe, searchStore.read, searchStore.read),
      useNavigate:
        () =>
        ({ search }: { search: (prev: Record<string, unknown>) => Record<string, unknown> }) => {
          searchStore.write(search(searchStore.read()));
        },
    }),
  };
});

vi.mock("@/features/cards/components/card-detail-opener", () => ({
  CardDetailOverlayProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/features/meta/components/meta-event-deck-preview", () => ({
  MetaEventDeckPreview: ({ token }: { token: string }) => <p>Preview for {token}</p>,
  MetaEventDeckPreviewSkeleton: () => null,
}));

// jsdom has no window.scrollTo, and the window virtualizer calls it on mount.
globalThis.scrollTo = () => {};

const { MetaEventStandings } = await import("./meta-event-standings");

// The search box debounces for 200 ms and then fetches, which outlasts the
// 1 s default under suite load.
configure({ asyncUtilTimeout: 5000 });

function phoneRow(name: string): HTMLElement {
  const list = screen.getByRole("list");
  return within(list).getByText(name).closest("li") as HTMLElement;
}

/** What the API would state about a field of these rows. */
function fieldOf(
  players: MetaStandingsRow[],
  extra: { progress?: { phaseOrder: number; roundNumber: number } } = {},
) {
  const legends = new Map<string, { cardId: string; name: string; count: number }>();
  for (const player of players) {
    if (player.legend === null) {
      continue;
    }
    const seen = legends.get(player.legend.cardId);
    legends.set(player.legend.cardId, {
      cardId: player.legend.cardId,
      name: player.legend.name,
      count: (seen?.count ?? 0) + 1,
    });
  }
  return metaField({
    withLists: players.filter((player) => player.shareToken !== null).length,
    hasLegends: players.some((player) => player.legend !== null || player.champion !== null),
    hasRecords: players.some((player) => hasShownRecord(player.wins)),
    hasRuns: players.some((player) => player.rounds.length > 0),
    legends: [...legends.values()].toSorted((a, b) => a.name.localeCompare(b.name)),
    progress: extra.progress ?? null,
  });
}

function bestPerLegendOf(players: MetaStandingsRow[]): MetaStandingsRow[] {
  const best = new Map<string, MetaStandingsRow>();
  for (const player of players.toSorted((a, b) => a.rank - b.rank)) {
    if (player.legend !== null && !best.has(player.legend.cardId)) {
      best.set(player.legend.cardId, player);
    }
  }
  return [...best.values()];
}

const SLUG = "summoner-skirmish";

function seedFromLoader(search: MetaStandingsSearch, total: number) {
  const query = standingsPageQuery(search, total);
  archive.cache.set(archive.keyOf(SLUG, query), archive.pageFor(query));
}

function keyFor(search: MetaStandingsSearch, total: number) {
  return archive.keyOf(SLUG, standingsPageQuery(search, total));
}

/** Lets every held request land, then re-renders the way a navigation would. */
async function landHeldRequests() {
  archive.holding.clear();
  await act(async () => {
    searchStore.write({ ...searchStore.read() });
  });
}

function renderStandings(
  players: MetaStandingsRow[] = [metaRow()],
  eventDate = "2020-01-01",
  extra: {
    phases?: MetaEventPhase[];
    progress?: { phaseOrder: number; roundNumber: number };
    search?: Record<string, unknown>;
  } = {},
  status: MetaEventStatus = "complete",
  pending: ReadonlyMap<string, { mine: boolean }> = new Map(),
) {
  archive.rows = players as never;
  const search = (extra.search ?? {}) as MetaStandingsSearch;
  searchStore.write(search);
  seedFromLoader({}, players.length);
  seedFromLoader(search, players.length);
  render(
    <MetaEventStandings
      firstPage={{ players: players.slice(0, 200), total: players.length }}
      field={fieldOf(players, extra)}
      bestPerLegend={bestPerLegendOf(players)}
      phases={extra.phases ?? []}
      slug={SLUG}
      recordedStatus={status}
      eventDate={eventDate}
      pending={pending}
    />,
  );
}

const SWISS = metaPhase({ phaseOrder: 1, name: "Phase 1", roundType: "SWISS", rankRequired: null });

const ANA_ROUNDS = [
  { phaseOrder: 0, roundNumber: 1, isCut: false, outcome: "bye" as const },
  { phaseOrder: 0, roundNumber: 2, isCut: false, outcome: "win" as const },
  { phaseOrder: 0, roundNumber: 3, isCut: false, outcome: "loss" as const },
  { phaseOrder: 0, roundNumber: 4, isCut: false, outcome: "draw" as const },
  { phaseOrder: 1, roundNumber: 1, isCut: true, outcome: "win" as const },
  { phaseOrder: 1, roundNumber: 2, isCut: true, outcome: "win" as const },
];

const CUT_PHASES = { phases: [SWISS, metaPhase()] };

function field(
  count: number,
  overrides: (index: number) => Partial<MetaStandingsRow> = () => ({}),
) {
  return Array.from({ length: count }, (_, index) =>
    metaRow({
      id: `p-${index}`,
      playerName: `Player ${index}`,
      rank: index + 1,
      ...overrides(index),
    }),
  );
}

describe("MetaEventStandings", () => {
  beforeEach(() => {
    session.userId = null;
    archive.costs = undefined;
    archive.bans = new Map();
    archive.withCollection = [];
    archive.includeSideboard = [];
    archive.cache.clear();
    archive.fetched = [];
    archive.groupFetches = [];
    archive.failingGroups.clear();
    archive.kept = undefined;
    archive.failing.clear();
    archive.holding.clear();
    searchStore.write({});
  });

  it("charts each player's run once the source filed round-by-round results", () => {
    renderStandings(
      [metaRow({ id: "p-1", playerName: "Ana", rounds: ANA_ROUNDS })],
      "2020-01-01",
      CUT_PHASES,
    );

    expect(screen.getByRole("columnheader", { name: "Run" })).toBeInTheDocument();
    const strip = within(phoneRow("Ana")).getByRole("img", {
      name: "Round by round: bye, win, loss, draw, then the cut: win, win",
    });
    expect(strip.querySelectorAll("[title]")).toHaveLength(6);
    expect(strip.querySelectorAll("span.w-1")).toHaveLength(1);
  });

  it("keeps the run column out of an event that arrived as bare standings", () => {
    renderStandings([metaRow({ playerName: "Ana" })]);

    expect(screen.queryByRole("columnheader", { name: "Run" })).toBeNull();
    expect(within(phoneRow("Ana")).queryByRole("img", { name: /Round by round/u })).toBeNull();
  });

  it("leads a charted run to the player's page for the event", () => {
    renderStandings(
      [metaRow({ id: "p-1", playerName: "Ana", playerKey: "u1001", rounds: ANA_ROUNDS })],
      "2020-01-01",
      CUT_PHASES,
    );

    const links = screen.getAllByRole("link", { name: /Round by round/u });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/meta/summoner-skirmish/players/u1001");
    }
  });

  it("charts the run of a player the source filed under no identity without a link", () => {
    renderStandings(
      [metaRow({ id: "p-1", playerName: "Ana", playerKey: null, rounds: ANA_ROUNDS })],
      "2020-01-01",
      CUT_PHASES,
    );

    expect(
      within(phoneRow("Ana")).getByRole("img", { name: /Round by round/u }),
    ).toBeInTheDocument();
    expect(within(phoneRow("Ana")).queryByRole("link", { name: /Round by round/u })).toBeNull();
  });

  it("leaves the run blank for a player the source paired in no round", () => {
    renderStandings(
      [
        metaRow({ id: "p-1", playerName: "Ana", rounds: ANA_ROUNDS }),
        metaRow({ id: "p-9", playerName: "Zed", rank: 9 }),
      ],
      "2020-01-01",
      CUT_PHASES,
    );

    expect(within(phoneRow("Zed")).queryByRole("img", { name: /Round by round/u })).toBeNull();
  });

  it("leaves a row's run link out of the decklist disclosure", async () => {
    const user = userEvent.setup();
    renderStandings(
      [metaRow({ id: "p-1", playerName: "Ana", shareToken: "tok1", rounds: ANA_ROUNDS })],
      "2020-01-01",
      CUT_PHASES,
    );

    await user.click(within(phoneRow("Ana")).getByRole("link", { name: /Round by round/u }));
    expect(screen.queryByText("Preview for tok1")).toBeNull();
  });

  it("says nothing is on file rather than showing an empty field", () => {
    renderStandings([]);
    expect(screen.getByText("No results on file")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("says nothing is on file for a past event its source never closed", () => {
    renderStandings([], "2020-01-01", {}, "upcoming");
    expect(screen.getByText("No results on file")).toBeInTheDocument();
  });

  it("says a running event is under way rather than that results are missing", () => {
    renderStandings([], "2020-01-01", {}, "in_progress");
    expect(
      screen.getByText(
        "This event is under way. Standings appear here once the first round is in the books.",
      ),
    ).toBeInTheDocument();
  });

  it("marks a running event's standings provisional, with the round they stand after", () => {
    renderStandings(
      [metaRow()],
      "2020-01-01",
      { phases: [SWISS], progress: { phaseOrder: 1, roundNumber: 2 } },
      "in_progress",
    );
    expect(screen.getByText(/After round 2 of \d+ · provisional/u)).toBeInTheDocument();
  });

  it("marks nothing provisional for a future event the source already marks in progress", () => {
    renderStandings(
      [metaRow()],
      "2999-01-01",
      { phases: [SWISS], progress: { phaseOrder: 1, roundNumber: 2 } },
      "in_progress",
    );
    expect(screen.queryByText(/provisional/u)).toBeNull();
  });

  it("says an event still to come has not been played rather than that results are late", () => {
    renderStandings([], "2999-01-01");
    expect(
      screen.getByText(
        "This event has not been played yet. Standings will appear here once it has.",
      ),
    ).toBeInTheDocument();
  });

  it("counts the field and how much of it has a list", () => {
    renderStandings([
      metaRow({ id: "p-1", playerName: "Ana", rank: 1, shareToken: "tok1" }),
      metaRow({ id: "p-2", playerName: "Bo", rank: 2 }),
    ]);
    expect(screen.getByText("2 entries · 1 with a decklist")).toBeInTheDocument();
  });

  it("counts only the entries when the archive holds no list at all", () => {
    renderStandings([
      metaRow({ id: "p-1", playerName: "Ana", rank: 1 }),
      metaRow({ id: "p-2", playerName: "Bo", rank: 2 }),
    ]);
    expect(screen.getByText("2 entries")).toBeInTheDocument();
  });

  it("lists every player, the deckless ones included", () => {
    renderStandings([
      metaRow({ id: "p-1", playerName: "Ana", rank: 1 }),
      metaRow({ id: "p-2", playerName: "Bo", rank: 2 }),
    ]);
    expect(phoneRow("Ana")).toBeInTheDocument();
    expect(phoneRow("Bo")).toBeInTheDocument();
  });

  it("prints a podium place in the same ordinal form as the rest", () => {
    renderStandings([
      metaRow({ id: "p-1", playerName: "Ana", rank: 3 }),
      metaRow({ id: "p-2", playerName: "Bo", rank: 4 }),
    ]);
    expect(within(phoneRow("Ana")).getByText("3rd")).toBeInTheDocument();
    expect(within(phoneRow("Bo")).getByText("4th")).toBeInTheDocument();
  });

  it("offers a legend filter once the field played more than one", () => {
    const legend = metaRow().legend;
    renderStandings(
      field(9, (index) => ({
        legend:
          index % 2 === 0
            ? legend
            : { ...legend!, cardId: "other-legend", name: "Ahri, the Nine-Tailed Fox" },
      })),
    );

    expect(screen.getByLabelText("Filter by legend")).toBeInTheDocument();
  });

  it("keeps the legend filter out of a field that all played the same one", () => {
    renderStandings(field(9));

    expect(screen.queryByLabelText("Filter by legend")).toBeNull();
  });

  it("prints a cut bucket as a bracket rather than an ordinal", () => {
    renderStandings([metaRow({ playerName: "Bo", rank: 8, rankIsTier: true })]);
    expect(within(phoneRow("Bo")).getByText("T8")).toBeInTheDocument();
  });

  it("shows legend art on every row, cut or not", () => {
    const legend = metaRow().legend;
    renderStandings([
      metaRow({ id: "p-1", playerName: "Ana", rank: 4, legend: { ...legend!, imageId: "art" } }),
      metaRow({ id: "p-2", playerName: "Bo", rank: 40, legend: { ...legend!, imageId: "art" } }),
    ]);
    expect(phoneRow("Ana").querySelector('img[src*="art-120w"]')).not.toBeNull();
    expect(phoneRow("Bo").querySelector('img[src*="art-120w"]')).not.toBeNull();
  });

  it("drops every optional column when the source published bare placings", () => {
    renderStandings(field(2, () => ({ legend: null, champion: null })));

    expect(screen.queryByRole("columnheader", { name: "Legend" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Value" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Decklist" })).not.toBeInTheDocument();
    expect(phoneRow("Player 0").querySelector('[data-slot="card-art-thumb"]')).toBeNull();
  });

  it("marks a list whose cards are banned from a later date, and leaves clean lists alone", () => {
    archive.bans = new Map([
      [
        "d1",
        [
          {
            formatId: WellKnown.banFormat.CONSTRUCTED,
            formatName: "Constructed",
            bannedAt: "2026-11-23",
            inEffect: false,
            cards: [{ cardId: "c1", displayName: "Zhonya's Hourglass", main: 3, side: 0 }],
          },
        ],
      ],
    ]);
    renderStandings(
      [
        metaRow({ id: "p-1", playerName: "Ana", deckId: "d1", shareToken: "tok1" }),
        metaRow({ id: "p-2", playerName: "Bo", rank: 2, deckId: "d2", shareToken: "tok2" }),
      ],
      "2026-11-06",
    );

    expect(within(phoneRow("Ana")).getByRole("button", { name: "Ban Nov 23" })).toBeInTheDocument();
    expect(within(phoneRow("Bo")).queryByRole("button", { name: /Ban/u })).toBeNull();
    expect(
      within(screen.getByRole("table")).getAllByRole("button", { name: "Ban Nov 23" }),
    ).toHaveLength(1);
  });

  it("keeps a click inside the ban card from toggling the row's decklist", async () => {
    archive.bans = new Map([
      [
        "d1",
        [
          {
            formatId: WellKnown.banFormat.CONSTRUCTED,
            formatName: "Constructed",
            bannedAt: "2026-11-23",
            inEffect: false,
            cards: [{ cardId: "c1", displayName: "Zhonya's Hourglass", main: 3, side: 0 }],
          },
        ],
      ],
    ]);
    renderStandings(
      [metaRow({ id: "p-1", playerName: "Ana", deckId: "d1", shareToken: "tok1" })],
      "2026-11-06",
    );

    await userEvent.click(within(phoneRow("Ana")).getByRole("button", { name: "Ban Nov 23" }));
    await userEvent.click(await screen.findByText("Zhonya's Hourglass"));

    expect(screen.queryByText("Preview for tok1")).toBeNull();
  });

  it("prices each archived list once the archive's prices are in", () => {
    archive.costs = new Map([
      [
        "d1",
        {
          needed: 40,
          owned: undefined,
          value: 123.4,
          toComplete: undefined,
          unpriced: 0,
          unpricedMissing: 0,
        },
      ],
    ]);
    renderStandings([
      metaRow({ id: "p-1", playerName: "Ana", deckId: "d1", shareToken: "tok1" }),
      metaRow({ id: "p-2", playerName: "Bo", rank: 2 }),
    ]);

    expect(screen.getByRole("columnheader", { name: "Value" })).toBeInTheDocument();
    expect(within(phoneRow("Ana")).getByText("€123")).toBeInTheDocument();
    expect(within(phoneRow("Bo")).queryByText(/€/u)).toBeNull();
  });

  it("leaves the value blank for a list some card of which has no price", () => {
    archive.costs = new Map([
      [
        "d1",
        {
          needed: 40,
          owned: undefined,
          value: undefined,
          toComplete: undefined,
          unpriced: 0,
          unpricedMissing: 0,
        },
      ],
    ]);
    renderStandings([metaRow({ playerName: "Ana", deckId: "d1", shareToken: "tok1" })]);

    expect(within(phoneRow("Ana")).queryByText(/€|--/u)).toBeNull();
  });

  it("prices what a signed-in reader is missing under the value", () => {
    session.userId = "u-1";
    archive.costs = new Map([
      [
        "d1",
        { needed: 40, owned: 28, value: 123.4, toComplete: 12.5, unpriced: 0, unpricedMissing: 0 },
      ],
      ["d2", { needed: 40, owned: 40, value: 80, toComplete: 0, unpriced: 0, unpricedMissing: 0 }],
    ]);
    renderStandings([
      metaRow({ id: "p-1", playerName: "Ana", deckId: "d1", shareToken: "tok1" }),
      metaRow({ id: "p-2", playerName: "Bo", rank: 2, deckId: "d2", shareToken: "tok2" }),
    ]);

    expect(archive.withCollection).toContain(true);
    expect(within(phoneRow("Ana")).getByText("€13 missing")).toBeInTheDocument();
    expect(within(phoneRow("Bo")).getByText("Buildable")).toBeInTheDocument();
  });

  it("names locked copies beside the missing price, and alone when nothing is missing", () => {
    session.userId = "u-1";
    archive.costs = new Map([
      [
        "d1",
        {
          needed: 40,
          owned: 30,
          value: 123.4,
          toComplete: 12.5,
          unpriced: 0,
          unpricedMissing: 0,
          locked: 4,
        },
      ],
      [
        "d2",
        {
          needed: 40,
          owned: 37,
          value: 80,
          toComplete: 0,
          unpriced: 0,
          unpricedMissing: 0,
          locked: 3,
        },
      ],
    ]);
    renderStandings([
      metaRow({ id: "p-1", playerName: "Ana", deckId: "d1", shareToken: "tok1" }),
      metaRow({ id: "p-2", playerName: "Bo", rank: 2, deckId: "d2", shareToken: "tok2" }),
    ]);

    expect(within(phoneRow("Ana")).getByText("€13 missing")).toBeInTheDocument();
    expect(within(phoneRow("Ana")).getByText("4 locked")).toBeInTheDocument();
    expect(within(phoneRow("Bo")).getByText("3 locked")).toBeInTheDocument();
    expect(within(phoneRow("Bo")).queryByText(/missing/u)).toBeNull();
  });

  it("prices the list alone for a signed-out reader", () => {
    archive.costs = new Map([
      [
        "d1",
        {
          needed: 40,
          owned: undefined,
          value: 123.4,
          toComplete: undefined,
          unpriced: 0,
          unpricedMissing: 0,
        },
      ],
    ]);
    renderStandings([metaRow({ playerName: "Ana", deckId: "d1", shareToken: "tok1" })]);

    expect(archive.withCollection).not.toContain(true);
    expect(within(phoneRow("Ana")).queryByText(/missing|Buildable/u)).toBeNull();
  });

  it("keeps the value column out of a field with no list on file", () => {
    session.userId = "u-1";
    renderStandings(field(2));

    expect(screen.queryByRole("columnheader", { name: "Value" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Decklist" })).toBeInTheDocument();
  });

  it("keeps the legend column when a single entry names one", () => {
    renderStandings([
      metaRow({ id: "p-1", playerName: "Ana", rank: 1 }),
      metaRow({ id: "p-2", playerName: "Bo", rank: 2, legend: null }),
    ]);

    expect(screen.getByRole("columnheader", { name: "Legend" })).toBeInTheDocument();
    expect(phoneRow("Bo").querySelector('[data-slot="card-art-thumb"]')).not.toBeNull();
  });

  it("keeps the decklist column for anyone who can send one in", () => {
    session.userId = "u-1";
    renderStandings(field(2, () => ({ legend: null, champion: null })));

    expect(screen.getByRole("columnheader", { name: "Decklist" })).toBeInTheDocument();
    expect(within(phoneRow("Player 0")).getByRole("link", { name: "+ Add" })).toBeInTheDocument();
  });

  it("washes the winner's row in the archive's gold", () => {
    renderStandings([
      metaRow({ id: "p-1", playerName: "Ana", rank: 1 }),
      metaRow({ id: "p-2", playerName: "Bo", rank: 2 }),
    ]);
    expect(phoneRow("Ana").className).toContain("bg-border-accent/10");
    expect(phoneRow("Bo").className).not.toContain("bg-border-accent/10");
  });

  it("derives the record as all three parts", () => {
    renderStandings([
      metaRow({ id: "p-1", playerName: "Ana", wins: 6, losses: 1, draws: null }),
      metaRow({ id: "p-2", playerName: "Bo", wins: 5, losses: 1, draws: 1 }),
    ]);
    expect(within(phoneRow("Ana")).getByText("6-1-0")).toBeInTheDocument();
    expect(within(phoneRow("Bo")).getByText("5-1-1")).toBeInTheDocument();
  });

  it("files the record under the run it sums up", () => {
    renderStandings(
      [metaRow({ id: "p-1", playerName: "Ana", rounds: ANA_ROUNDS })],
      "2020-01-01",
      CUT_PHASES,
    );

    const strip = within(screen.getByRole("table")).getByRole("img", { name: /Round by round/u });
    expect(strip.closest("td")).toHaveTextContent("6-1-0");
  });

  it("heads the record column as a record when the source charted no rounds", () => {
    renderStandings([metaRow({ playerName: "Ana" })]);

    expect(screen.getByRole("columnheader", { name: "Record" })).toBeInTheDocument();
  });

  it("bands the top cut by the bracket each player reached and leaves the rest bare", () => {
    renderStandings(field(10), "2020-01-01", { phases: [metaPhase()] });

    const band = (name: string) => phoneRow(name).querySelector("[data-slot=rank-band]");
    expect(band("Player 0")).toHaveTextContent("Winner");
    expect(band("Player 5")).toHaveAttribute("data-tone", "muted");
    expect(band("Player 5")).toHaveTextContent("Top 8");
    expect(band("Player 9")).toHaveAttribute("data-tone", "plain");
  });

  it("names the legend and draws its domain runes", () => {
    renderStandings();
    const row = within(phoneRow("Ana"));
    expect(row.getByText("Yasuo")).toBeInTheDocument();
    expect(row.getByText("the Unforgiven")).toBeInTheDocument();
    expect(row.getByRole("img", { name: "Fury" })).toBeInTheDocument();
  });

  it("leads the legend to its archive page on phones too", () => {
    renderStandings();
    const link = within(phoneRow("Ana")).getByRole("link", { name: "Yasuo" });
    expect(link.getAttribute("href")).toBe("/meta/legends/yasuo-yasuo-the-unforgiven");
  });

  it("marks a linked list that is only partial in place of the decklist label", async () => {
    const user = userEvent.setup();
    renderStandings([
      metaRow({ playerName: "Ana", deckId: "d1", shareToken: "tok1", listStatus: "partial" }),
    ]);
    expect(within(phoneRow("Ana")).queryByText("Decklist")).toBeNull();
    expect(within(phoneRow("Ana")).queryByRole("button")).toBeNull();

    await user.click(within(phoneRow("Ana")).getByText("Partial list"));
    expect(within(phoneRow("Ana")).getByText("Preview for tok1")).toBeInTheDocument();
  });

  it("leaves a full list unmarked", () => {
    renderStandings([
      metaRow({ playerName: "Ana", deckId: "d1", shareToken: "tok1", listStatus: "full" }),
    ]);
    expect(within(phoneRow("Ana")).queryByText("Partial list")).toBeNull();
  });

  it("offers a signed-in reader the form, prefilled from the row", () => {
    session.userId = "user-1";
    renderStandings([
      metaRow({ playerName: "Ana", rank: 8, rankIsTier: true, wins: 12, losses: 3, draws: 0 }),
    ]);

    const link = within(phoneRow("Ana")).getByRole("link", { name: "+ Add" });
    const href = link.getAttribute("href") ?? "";
    expect(href.startsWith("/meta/summoner-skirmish/submit?")).toBe(true);
    const search = new URLSearchParams(href.split("?")[1]);
    expect(search.get("player")).toBe("Ana");
    expect(search.get("rank")).toBe("8");
    expect(search.get("cut")).toBe("true");
    expect(search.get("playerId")).toBe("p-1");
  });

  it("offers a signed-out reader nothing to click on a list-less row", () => {
    renderStandings([metaRow({ playerName: "Ana" })]);
    expect(screen.queryByRole("link", { name: "+ Add" })).toBeNull();
  });

  it("tells a signed-out reader a list for the row is already in review", () => {
    renderStandings(
      [metaRow({ playerName: "Ana" })],
      undefined,
      {},
      undefined,
      new Map([["p-1", { mine: false }]]),
    );
    expect(within(phoneRow("Ana")).getByText("In review")).toBeInTheDocument();
  });

  it("points a signed-in reader's own pending list at their submissions instead of the form", () => {
    session.userId = "user-1";
    renderStandings(
      [metaRow({ playerName: "Ana" })],
      undefined,
      {},
      undefined,
      new Map([["p-1", { mine: true }]]),
    );

    const link = within(phoneRow("Ana")).getByRole("link", { name: "Yours, in review" });
    expect(link.getAttribute("href")).toBe("/meta/submissions");
    expect(within(phoneRow("Ana")).queryByRole("link", { name: "+ Add" })).toBeNull();
  });

  it("marks an archived list that has an update waiting", () => {
    renderStandings(
      [metaRow({ playerName: "Ana", deckId: "d1", shareToken: "tok1" })],
      undefined,
      {},
      undefined,
      new Map([["p-1", { mine: false }]]),
    );
    expect(
      within(phoneRow("Ana")).getByRole("img", { name: "An update to this list is in review" }),
    ).toBeInTheDocument();
  });

  it("opens a row's decklist in place", async () => {
    const user = userEvent.setup();
    renderStandings([metaRow({ playerName: "Ana", shareToken: "tok1" })]);

    expect(screen.queryByText("Preview for tok1")).toBeNull();
    await user.click(within(phoneRow("Ana")).getByText("Decklist"));
    expect(within(phoneRow("Ana")).getByText("Preview for tok1")).toBeInTheDocument();
  });

  it("opens and closes a decklist from the keyboard", async () => {
    const user = userEvent.setup();
    renderStandings([metaRow({ playerName: "Ana", shareToken: "tok1" })]);

    const row = phoneRow("Ana");
    expect(row.getAttribute("aria-expanded")).toBe("false");
    row.focus();
    await user.keyboard("{Enter}");
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(within(row).getByText("Preview for tok1")).toBeInTheDocument();

    await user.keyboard(" ");
    expect(screen.queryByText("Preview for tok1")).toBeNull();
  });

  it("gives a list-less row no disclosure to focus", () => {
    renderStandings([metaRow({ playerName: "Ana" })]);
    expect(phoneRow("Ana").hasAttribute("tabindex")).toBe(false);
    expect(phoneRow("Ana").hasAttribute("aria-expanded")).toBe(false);
  });

  it("opens and closes a decklist from anywhere on the row", async () => {
    const user = userEvent.setup();
    renderStandings([metaRow({ playerName: "Ana", shareToken: "tok1" })]);

    await user.click(within(phoneRow("Ana")).getByText("6-1-0"));
    expect(within(phoneRow("Ana")).getByText("Preview for tok1")).toBeInTheDocument();

    await user.click(within(phoneRow("Ana")).getByText("6-1-0"));
    expect(screen.queryByText("Preview for tok1")).toBeNull();
  });

  it("leaves a row's own links clickable", async () => {
    const user = userEvent.setup();
    renderStandings([metaRow({ playerName: "Ana", shareToken: "tok1" })]);

    await user.click(within(phoneRow("Ana")).getByRole("link", { name: /Yasuo/u }));
    expect(screen.queryByText("Preview for tok1")).toBeNull();
  });

  it("sends a player the archive has a page for to it, in both renderings", () => {
    renderStandings([metaRow({ playerName: "Ana", playerKey: "u1001" })]);

    const links = screen.getAllByRole("link", { name: "Ana" });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/meta/players/u1001");
    }
  });

  it("sends a player with a charted run to their run through the event", () => {
    renderStandings(
      [metaRow({ id: "p-1", playerName: "Ana", playerKey: "u1001", rounds: ANA_ROUNDS })],
      "2020-01-01",
      CUT_PHASES,
    );

    const links = screen.getAllByRole("link", { name: "Ana" });
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute("href", "/meta/summoner-skirmish/players/u1001");
    }
  });

  it("prints a player the source filed under no identity as plain text", () => {
    renderStandings([metaRow({ playerName: "Ana", playerKey: null })]);

    expect(screen.queryByRole("link", { name: "Ana" })).toBeNull();
    expect(within(phoneRow("Ana")).getByText("Ana")).toBeInTheDocument();
  });

  it("closes an open decklist when another one opens", async () => {
    const user = userEvent.setup();
    renderStandings([
      metaRow({ id: "p-1", playerName: "Ana", rank: 1, shareToken: "tok1" }),
      metaRow({ id: "p-2", playerName: "Bo", rank: 2, shareToken: "tok2" }),
    ]);

    await user.click(within(phoneRow("Ana")).getByText("Decklist"));
    await user.click(within(phoneRow("Bo")).getByText("Decklist"));

    expect(screen.queryByText("Preview for tok1")).toBeNull();
    expect(within(phoneRow("Bo")).getByText("Preview for tok2")).toBeInTheDocument();
  });

  it("narrows the field to the entries with a list", async () => {
    const user = userEvent.setup();
    renderStandings([
      metaRow({ id: "p-1", playerName: "Ana", rank: 1, shareToken: "tok1" }),
      metaRow({ id: "p-2", playerName: "Bo", rank: 2 }),
    ]);

    await user.click(screen.getByRole("button", { name: "With decklist (1)" }));
    expect(phoneRow("Ana")).toBeInTheDocument();
    expect(screen.queryByText("Bo")).toBeNull();

    await user.click(screen.getByRole("button", { name: "All entries" }));
    expect(phoneRow("Bo")).toBeInTheDocument();
  });

  it("groups the thousands in the decklist toggle's count", () => {
    renderStandings(field(1200, (index) => (index < 1100 ? { shareToken: `tok-${index}` } : {})));

    expect(screen.getByRole("button", { name: "With decklist (1,100)" })).toBeInTheDocument();
  });

  it("offers no decklist filter for a field with none on file", () => {
    renderStandings(field(12));
    expect(screen.queryByRole("button", { name: /With decklist/u })).toBeNull();
  });

  it("finds a player by name", async () => {
    const user = userEvent.setup();
    renderStandings(field(12));

    await user.type(screen.getByRole("textbox", { name: "Find a player" }), "player 7");

    await waitFor(() => {
      expect(within(screen.getByRole("list")).queryByText("Player 6")).toBeNull();
    });
    expect(phoneRow("Player 7")).toBeInTheDocument();
  });

  it("gives the whole field back when the search box is cleared", async () => {
    const user = userEvent.setup();
    renderStandings(field(12));

    const box = screen.getByRole("textbox", { name: "Find a player" });
    await user.type(box, "player 7");
    await waitFor(() => {
      expect(within(screen.getByRole("list")).queryByText("Player 6")).toBeNull();
    });

    await user.clear(box);
    await waitFor(() => {
      expect(phoneRow("Player 6")).toBeInTheDocument();
    });
    expect(phoneRow("Player 7")).toBeInTheDocument();
  });

  it("clearing a decklist narrowing reopens the unnarrowed first page without a fetch", async () => {
    const user = userEvent.setup();
    renderStandings(
      field(420, (index) => (index < 300 ? { shareToken: `tok-${index}` } : {})),
      "2020-01-01",
      { search: { page: 2, list: "with" } },
    );

    await user.click(screen.getByRole("button", { name: "All entries" }));

    expect(phoneRow("Player 0")).toBeInTheDocument();
    expect(searchStore.read().page).toBeUndefined();
    expect(archive.fetched).toEqual([]);
  });

  it("says so when nothing matches what was typed", async () => {
    const user = userEvent.setup();
    renderStandings(field(12));

    await user.type(screen.getByRole("textbox", { name: "Find a player" }), "Ziggs");

    expect(await screen.findByText("No entries match.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("mounts only the rows a long field puts in view", () => {
    renderStandings(field(200));

    expect(phoneRow("Player 0")).toBeInTheDocument();
    expect(screen.queryByText("Player 199")).toBeNull();
  });

  it("reserves the whole field's height so the scrollbar stays honest", () => {
    renderStandings(field(200));

    // oxlint-disable-next-line unicorn/prefer-number-coercion -- style.height carries a "px" suffix, which Number() cannot parse
    const reserved = Number.parseInt(screen.getByRole("list").style.height, 10);
    expect(reserved).toBeGreaterThan(200 * 40);
  });

  it("shrinks the reserved height to the narrowed field", async () => {
    const user = userEvent.setup();
    renderStandings(field(200, (index) => (index < 18 ? { shareToken: `tok-${index}` } : {})));

    // oxlint-disable-next-line unicorn/prefer-number-coercion -- style.height carries a "px" suffix, which Number() cannot parse
    const full = Number.parseInt(screen.getByRole("list").style.height, 10);
    await user.click(screen.getByRole("button", { name: "With decklist (18)" }));

    // oxlint-disable-next-line unicorn/prefer-number-coercion -- style.height carries a "px" suffix, which Number() cannot parse
    expect(Number.parseInt(screen.getByRole("list").style.height, 10)).toBeLessThan(full);
  });

  describe("paging", () => {
    it("pages a long field and reads the page from the URL", async () => {
      const user = userEvent.setup();
      renderStandings(field(420));

      expect(phoneRow("Player 0")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "2" }));

      expect(searchStore.read()).toMatchObject({ page: 2 });
      expect(phoneRow("Player 200")).toBeInTheDocument();
      expect(screen.queryByText("Player 0")).toBeNull();
    });

    it("renders the page the URL names, asking the API for its own slice", () => {
      renderStandings(field(420), "2020-01-01", { search: { page: 3 } });

      expect(phoneRow("Player 400")).toBeInTheDocument();
      expect(screen.queryByText("Player 399")).toBeNull();
      expect(screen.queryByRole("button", { name: "4" })).toBeNull();
    });

    it("keeps the size picker when a narrowing emptied the page it names", () => {
      renderStandings(field(420), "2020-01-01", { search: { per: 500, q: "Ziggs" } });

      expect(screen.getByLabelText("Entries per page")).toBeInTheDocument();
    });

    it("offers no pager for a field that fits on one page", () => {
      renderStandings(field(12));

      expect(screen.queryByRole("navigation", { name: "Standings pages" })).toBeNull();
    });

    it("offers no size picker for a field that fits the smallest page on offer", () => {
      renderStandings(field(40));

      expect(screen.queryByLabelText("Entries per page")).toBeNull();
    });

    it("offers the size picker for a one-page field that could still be cut smaller", () => {
      renderStandings(field(150));

      expect(screen.getByLabelText("Entries per page")).toBeInTheDocument();
    });

    it("offers the size picker once the field outgrows the default page", () => {
      renderStandings(field(240));

      expect(screen.getByLabelText("Entries per page")).toBeInTheDocument();
    });

    it("takes the page size from the URL and reopens at the first page", async () => {
      const user = userEvent.setup();
      renderStandings(field(420), "2020-01-01", { search: { page: 2 } });

      await user.click(screen.getByLabelText("Entries per page"));
      await user.click(await screen.findByRole("option", { name: "Show 50" }));

      expect(searchStore.read()).toMatchObject({ per: 50 });
      expect(searchStore.read().page).toBeUndefined();
      expect(phoneRow("Player 0")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "9" })).toBeInTheDocument();
    });

    it("hands the whole field over when the reader asks for all of it", () => {
      renderStandings(field(420), "2020-01-01", { search: { per: "all" } });

      expect(phoneRow("Player 0")).toBeInTheDocument();
      expect(screen.queryByRole("navigation", { name: "Standings pages" })).toBeNull();
      // oxlint-disable-next-line unicorn/prefer-number-coercion -- style.height carries a "px" suffix, which Number() cannot parse
      expect(Number.parseInt(screen.getByRole("list").style.height, 10)).toBeGreaterThan(420 * 40);
    });

    it("writes every narrowing to the URL, so a view is a link", async () => {
      const user = userEvent.setup();
      renderStandings(
        [
          metaRow({ id: "p-1", playerName: "Ana", rank: 1, shareToken: "tok1" }),
          metaRow({ id: "p-2", playerName: "Bo", rank: 2 }),
        ],
        "2020-01-01",
        { search: { page: 4 } },
      );

      await user.click(screen.getByRole("button", { name: "With decklist (1)" }));

      expect(searchStore.read()).toMatchObject({ list: "with" });
      expect(searchStore.read().page).toBeUndefined();
    });
  });

  describe("a request that fails or is still out", () => {
    const NARROWED = { q: "Player", page: 3 };

    it("says the request failed instead of showing the field the reader did not ask for", () => {
      archive.failing.add(keyFor(NARROWED, 420));
      renderStandings(field(420), "2020-01-01", { search: NARROWED });

      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
      expect(screen.queryByText("Player 0")).toBeNull();
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("leaves the reader the search box and the pager to get back out", () => {
      archive.failing.add(keyFor(NARROWED, 420));
      renderStandings(field(420), "2020-01-01", { search: NARROWED });

      expect(screen.getByRole("textbox", { name: "Find a player" })).toHaveValue("Player");
      expect(screen.getByRole("navigation", { name: "Standings pages" })).toBeInTheDocument();
    });

    it("puts the rows back when the reader retries", async () => {
      const user = userEvent.setup();
      archive.failing.add(keyFor(NARROWED, 420));
      renderStandings(field(420), "2020-01-01", { search: NARROWED });

      await user.click(screen.getByRole("button", { name: "Retry" }));

      expect(phoneRow("Player 400")).toBeInTheDocument();
      expect(screen.queryByText("Something went wrong. Please try again.")).toBeNull();
    });

    it("holds the pager on the rows on screen until the next page lands", async () => {
      const user = userEvent.setup();
      renderStandings(field(420));
      archive.holding.add(keyFor({ page: 2 }, 420));

      await user.click(screen.getByRole("button", { name: "2" }));

      expect(phoneRow("Player 0")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page");
      expect(phoneRow("Player 0").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");

      await landHeldRequests();

      expect(phoneRow("Player 200")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-current", "page");
      expect(phoneRow("Player 200").closest("[aria-busy]")).toHaveAttribute("aria-busy", "false");
    });

    it("counts the pages against the size the rows on screen were cut to", async () => {
      const user = userEvent.setup();
      renderStandings(field(420), "2020-01-01", { search: { page: 2 } });
      archive.holding.add(keyFor({ per: 50 }, 420));

      await user.click(screen.getByLabelText("Entries per page"));
      await user.click(await screen.findByRole("option", { name: "Show 50" }));

      expect(screen.queryByRole("button", { name: "9" })).toBeNull();

      await landHeldRequests();

      expect(screen.getByRole("button", { name: "9" })).toBeInTheDocument();
    });
  });

  describe("cost filter", () => {
    function pricedField() {
      session.userId = "u-1";
      archive.costs = new Map([
        [
          "d1",
          {
            needed: 40,
            owned: 20,
            value: 123.4,
            toComplete: 12.5,
            unpriced: 0,
            unpricedMissing: 0,
          },
        ],
        [
          "d2",
          { needed: 40, owned: 40, value: 80, toComplete: 0, unpriced: 0, unpricedMissing: 0 },
        ],
        [
          "d3",
          { needed: 40, owned: 30, value: 300, toComplete: 5, unpriced: 0, unpricedMissing: 0 },
        ],
      ]);
      renderStandings([
        metaRow({ id: "p-1", playerName: "Ana", rank: 1, deckId: "d1", shareToken: "tok1" }),
        metaRow({ id: "p-2", playerName: "Bo", rank: 2, deckId: "d2", shareToken: "tok2" }),
        metaRow({ id: "p-3", playerName: "Cy", rank: 3, deckId: "d3", shareToken: "tok3" }),
        metaRow({ id: "p-4", playerName: "Dee", rank: 4 }),
      ]);
    }

    it("keeps the cost filter out of a field with no list on file", () => {
      session.userId = "u-1";
      renderStandings(field(2));

      expect(screen.queryByText("cost trigger: control")).toBeNull();
    });

    it("asks the shared control for a toolbar trigger that talks about lists", () => {
      pricedField();

      expect(screen.getByText("cost trigger: control")).toBeInTheDocument();
      expect(screen.getByText("cost noun: list")).toBeInTheDocument();
    });

    it("holds the cost filter unready until the archive's prices are in", () => {
      renderStandings([metaRow({ playerName: "Ana", deckId: "d1", shareToken: "tok1" })]);
      expect(screen.getByText("cost ready: false")).toBeInTheDocument();
    });

    it("opens the cost filter once the prices are in", () => {
      pricedField();
      expect(screen.getByText("cost ready: true")).toBeInTheDocument();
    });

    it("tells the control whether a collection stands behind it", () => {
      renderStandings([metaRow({ playerName: "Ana", deckId: "d1", shareToken: "tok1" })]);
      expect(screen.getByText("cost collection: false")).toBeInTheDocument();
    });

    it("tells the control a signed-in reader has a collection", () => {
      pricedField();
      expect(screen.getByText("cost collection: true")).toBeInTheDocument();
    });

    it("hides the lists costing more than the bound, and the entries with no list at all", async () => {
      const user = userEvent.setup();
      pricedField();

      await user.click(screen.getByRole("button", { name: "cost bound" }));

      expect(phoneRow("Bo")).toBeInTheDocument();
      expect(phoneRow("Cy")).toBeInTheDocument();
      expect(screen.queryByText("Ana")).toBeNull();
      expect(screen.queryByText("Dee")).toBeNull();
    });

    it("keeps only the lists a reader already owns at a bound of nothing", async () => {
      const user = userEvent.setup();
      pricedField();

      await user.click(screen.getByRole("button", { name: "buildable" }));

      expect(phoneRow("Bo")).toBeInTheDocument();
      expect(screen.queryByText("Cy")).toBeNull();
    });

    it("narrows the field by what a list is worth", async () => {
      const user = userEvent.setup();
      pricedField();

      await user.click(screen.getByRole("button", { name: "value bound" }));

      expect(phoneRow("Bo")).toBeInTheDocument();
      expect(screen.queryByText("Ana")).toBeNull();
      expect(screen.queryByText("Cy")).toBeNull();
    });

    it("gives the whole field back when the cost filter is cleared", async () => {
      const user = userEvent.setup();
      pricedField();

      await user.click(screen.getByRole("button", { name: "cost bound" }));
      await user.click(screen.getByRole("button", { name: "clear cost" }));

      expect(phoneRow("Ana")).toBeInTheDocument();
      expect(phoneRow("Dee")).toBeInTheDocument();
    });

    it("keeps a decklist narrowing the reader picked when the cost filter is cleared", async () => {
      const user = userEvent.setup();
      pricedField();

      await user.click(screen.getByRole("button", { name: /With decklist/u }));
      await user.click(screen.getByRole("button", { name: "cost bound" }));
      await user.click(screen.getByRole("button", { name: "clear cost" }));

      expect(searchStore.read()).toMatchObject({ list: "with" });
      expect(screen.queryByText("Dee")).toBeNull();
    });

    it("leaves the entries toggle alone when Clear follows no bound at all", async () => {
      const user = userEvent.setup();
      pricedField();

      await user.click(screen.getByRole("button", { name: /With decklist/u }));
      await user.click(screen.getByRole("button", { name: "clear cost" }));

      expect(searchStore.read()).toMatchObject({ list: "with" });
    });

    it("says a bound emptied this page rather than that the field holds nothing", async () => {
      const user = userEvent.setup();
      session.userId = "u-1";
      archive.costs = new Map([
        [
          "d1",
          { needed: 40, owned: 0, value: 300, toComplete: 250, unpriced: 0, unpricedMissing: 0 },
        ],
      ]);
      renderStandings([
        metaRow({ id: "p-1", playerName: "Ana", rank: 1, deckId: "d1", shareToken: "tok1" }),
      ]);

      await user.click(screen.getByRole("button", { name: "buildable" }));

      expect(
        screen.getByText(
          "No entry on this page is within the price filter. Prices are worked out in your browser, so it only narrows the page you are on.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("No entries match.")).toBeNull();
    });

    it("counts a bound against the value range already in force, not against the raw field", async () => {
      const user = userEvent.setup();
      pricedField();

      expect(screen.getByText("cost matches: 2")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "value bound" }));
      expect(screen.getByText("cost matches: 1")).toBeInTheDocument();
    });

    it("scales the control against this event's own lists", () => {
      pricedField();

      expect(screen.getByText("cost ceiling: 300")).toBeInTheDocument();
      expect(screen.getByText("completion ceiling: 12.5")).toBeInTheDocument();
    });

    it("prices the sideboard in by default, the way the value column does", () => {
      pricedField();

      expect(screen.getByText("cost sideboard: true")).toBeInTheDocument();
      expect(archive.includeSideboard.at(-1)).toBe(true);
    });

    it("reprices the field without the sideboard when the reader drops it", async () => {
      const user = userEvent.setup();
      pricedField();

      await user.click(screen.getByRole("button", { name: "drop sideboard" }));

      expect(screen.getByText("cost sideboard: false")).toBeInTheDocument();
      expect(archive.includeSideboard.at(-1)).toBe(false);
    });
  });

  describe("by legend", () => {
    const yasuo = metaRow().legend!;
    const ahri = {
      ...yasuo,
      cardId: "card-ahri",
      name: "Ahri, the Nine-Tailed Fox",
      character: "Ahri",
      epithet: "the Nine-Tailed Fox",
      archiveSlug: "ahri-ahri-the-nine-tailed-fox",
    };
    function mixedField() {
      return field(10, (index) => ({
        legend: index === 9 ? null : index === 0 || index === 3 ? ahri : yasuo,
      }));
    }

    it("offers the legend grouping only where the legend filter shows", () => {
      renderStandings(field(9));
      expect(screen.queryByRole("button", { name: "By legend" })).toBeNull();
    });

    it("switches to the grouping and drops the narrowings it does not apply", async () => {
      const user = userEvent.setup();
      renderStandings(mixedField(), "2020-01-01", {
        search: { q: "player", list: "with", legend: "card-ahri" },
      });

      await user.click(screen.getByRole("button", { name: "By legend" }));

      expect(searchStore.read()).toMatchObject({
        by: "legend",
        q: undefined,
        list: undefined,
        legend: undefined,
      });
      expect(screen.queryByLabelText("Filter by legend")).toBeNull();
      expect(screen.queryByLabelText("Find a player")).toBeNull();
      expect(screen.queryByLabelText("Standings pages")).toBeNull();
    });

    it("orders groups by best finish and opens the first one", () => {
      renderStandings(mixedField(), "2020-01-01", { search: { by: "legend" } });

      const headers = screen.getAllByRole("button", { expanded: true });
      expect(headers).toHaveLength(1);
      expect(within(headers[0]!).getAllByText("Ahri").length).toBeGreaterThan(0);
      expect(within(headers[0]!).getAllByText("2 players").length).toBeGreaterThan(0);
      const closed = screen.getAllByRole("button", { expanded: false });
      expect(within(closed[0]!).getAllByText("Yasuo").length).toBeGreaterThan(0);
      expect(within(closed[0]!).getAllByText("7 players").length).toBeGreaterThan(0);
      expect(archive.groupFetches).toEqual(["card-ahri"]);
      expect(screen.getAllByText("Player 3").length).toBeGreaterThan(0);
      expect(screen.queryByText("Player 2")).toBeNull();
    });

    it("leaves the legend to the group header on phone rows", () => {
      renderStandings(mixedField(), "2020-01-01", { search: { by: "legend" } });
      const row = screen
        .getAllByText("Player 3")
        .map((element) => element.closest("li"))
        .find((element) => element !== null);
      expect(row).toBeDefined();
      expect(within(row!).queryByText("Ahri")).toBeNull();
    });

    it("groups the entries without a legend at the end and opens them like any legend", async () => {
      const user = userEvent.setup();
      renderStandings(mixedField(), "2020-01-01", { search: { by: "legend" } });

      const unknown = screen.getByRole("button", { name: /No legend on file/u });
      expect(within(unknown).getAllByText("1 player").length).toBeGreaterThan(0);
      expect(screen.queryByText("Player 9")).toBeNull();

      await user.click(unknown);

      expect(archive.groupFetches).toContain("none");
      expect(screen.getAllByText("Player 9").length).toBeGreaterThan(0);
    });

    it("keys the list shapes of partial lists in an open group", () => {
      const shape = {
        format: "constructed",
        legend: 1,
        champion: 1,
        battlefield: 0,
        main: 20,
        runes: 0,
        inferredChampion: false,
        inferredBattlefield: false,
      } as MetaStandingsRow["listShape"];
      renderStandings(
        field(10, (index) => ({
          legend: index === 0 || index === 3 ? ahri : yasuo,
          listShape: index === 3 ? shape : null,
          listStatus: index === 3 ? "partial" : "none",
        })),
        "2020-01-01",
        { search: { by: "legend" } },
      );

      expect(
        screen.getByText("Legend · Champion · Battlefields · Main deck · Runes"),
      ).toBeInTheDocument();
    });

    it("opens and closes groups, one at a time or all at once", async () => {
      const user = userEvent.setup();
      renderStandings(mixedField(), "2020-01-01", { search: { by: "legend" } });

      await user.click(screen.getByRole("button", { expanded: false, name: /Yasuo/u }));
      expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(2);
      expect(screen.getAllByText("Player 1").length).toBeGreaterThan(0);

      await user.click(screen.getByRole("button", { name: "Collapse all" }));
      expect(screen.queryAllByRole("button", { expanded: true })).toHaveLength(0);

      await user.click(screen.getByRole("button", { name: "Expand all" }));
      expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(3);
    });

    it("hands a group's full list to the ranked standings, narrowed to its legend", async () => {
      const user = userEvent.setup();
      renderStandings(mixedField(), "2020-01-01", { search: { by: "legend" } });

      await user.click(screen.getByRole("button", { expanded: false, name: /Yasuo/u }));
      await user.click(screen.getByRole("button", { name: "See all 7 in the standings" }));

      expect(searchStore.read()).toMatchObject({ by: undefined, legend: "card-yasuo" });
    });

    it("links an open group to its legend page", () => {
      renderStandings(mixedField(), "2020-01-01", { search: { by: "legend" } });
      expect(screen.getByRole("link", { name: "Legend page" }).getAttribute("href")).toBe(
        "/meta/legends/ahri-ahri-the-nine-tailed-fox",
      );
    });

    it("stays on the legend view when its own switch is pressed again", async () => {
      const user = userEvent.setup();
      renderStandings(mixedField(), "2020-01-01", { search: { by: "legend" } });

      await user.click(screen.getByRole("button", { name: "By legend" }));

      expect(searchStore.read()).toMatchObject({ by: "legend" });
    });

    it("drops a price bound on the way to the legend view", async () => {
      const user = userEvent.setup();
      archive.costs = new Map();
      renderStandings(
        field(10, (index) => ({
          legend: index % 2 === 0 ? ahri : yasuo,
          shareToken: `tok-${index}`,
          deckId: `deck-${index}`,
        })),
      );

      await user.click(screen.getByRole("button", { name: "cost bound" }));
      expect(screen.getByText("cost max: 10")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "By legend" }));
      await user.click(screen.getByRole("button", { name: "By rank" }));

      expect(screen.getByText("cost max: null")).toBeInTheDocument();
    });

    it("offers a retry when a group's rows fail to load", async () => {
      const user = userEvent.setup();
      archive.failingGroups.add("card-ahri");
      renderStandings(mixedField(), "2020-01-01", { search: { by: "legend" } });

      expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Retry" }));

      expect(screen.getAllByText("Player 3").length).toBeGreaterThan(0);
    });

    it("expands the legends shown past the first twelve", async () => {
      const user = userEvent.setup();
      renderStandings(
        field(14, (index) => ({
          legend: {
            ...yasuo,
            cardId: `card-${index}`,
            name: `Legend ${index}`,
            character: `Legend ${index}`,
          },
        })),
        "2020-01-01",
        { search: { by: "legend" } },
      );

      await user.click(screen.getByRole("button", { name: "Show all 14" }));
      await user.click(screen.getByRole("button", { name: "Collapse all" }));
      await user.click(screen.getByRole("button", { name: "Expand all" }));

      expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(14);
    });

    it("falls back to ranks when the field played one legend", () => {
      renderStandings(field(9), "2020-01-01", { search: { by: "legend" } });
      expect(screen.queryByText("No legend on file")).toBeNull();
      expect(archive.groupFetches).toEqual([]);
    });
  });
});
