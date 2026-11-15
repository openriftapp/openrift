import { createLogger } from "@openrift/shared/logger";
import { describe, expect, it } from "vitest";

import type { Repos, Transact } from "../../../../deps.js";
import { RECHECK_LADDER_SPAN_MS } from "../../lib/meta-recheck-schedule.js";
import type { PlayloltcgRecheckRow } from "../../repositories/playloltcg-events.js";
import type { PlayloltcgClient, PlayloltcgList } from "./playloltcg-client.js";
import { PlayloltcgRefusedError } from "./playloltcg-client.js";
import type { PlayloltcgSyncDeps } from "./playloltcg-deps.js";
import { processPlayloltcgRechecks } from "./playloltcg-sync.js";
import { SourceThrottledError } from "./source-http.js";

const EVENT_DAY = new Date("2026-08-20T00:00:00Z");
const START = new Date("2026-08-20T12:00:00Z");
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const PAUSE_MS = 30 * 60 * 1000;
const EMPTY_DECK = 12;
const STANDINGS_PATH = "/xcx/activityUser/pageForActivityDetail";
const DECK_PATH = "/xcx/cardGroup/getActivityCardGroupCardListImage";
const CARD = { cardNo: "OGN-001", cardName: "亚索", cardCount: 1 };

interface StoredDeck {
  fetchStatus: string;
  fetchedAt: Date;
  cards: number;
}

interface World {
  row: PlayloltcgRecheckRow;
  decks: Map<string, StoredDeck>;
  deckAsks: Map<number, Date[]>;
  visits: Date[];
  requests: () => number;
  run: (at: Date) => Promise<void>;
}

function world(options: {
  important: boolean;
  finished: boolean;
  startAt?: string | null;
  checkStage?: number;
  held?: [string, StoredDeck][];
  deckBody?: (id: number, asks: number) => Record<string, unknown>[] | Error;
}): World {
  const decks = new Map<string, StoredDeck>(options.held);
  const deckAsks = new Map<number, Date[]>();
  const visits: Date[] = [];
  let standings: { sourceDeckId: string | null }[] = [];
  let now = START;
  const row: PlayloltcgRecheckRow = {
    activityShopId: 109_991,
    shopId: null,
    shopName: "卡之域卡牌",
    name: "本命传奇挑战",
    activityType: "rune_competition",
    activityTypeName: "符文竞技",
    battleMode: "1v1",
    status: options.finished ? 5 : 3,
    startAt: options.startAt === undefined ? "2026-08-20" : options.startAt,
    endAt: "2026-08-20",
    playerCount: 2,
    maxUser: 8,
    fee: 0,
    province: null,
    city: null,
    area: null,
    address: null,
    longitude: null,
    latitude: null,
    contentHash: "hash",
    firstSeenAt: START,
    lastSeenAt: START,
    missingSince: null,
    triage: "accepted",
    heldBy: null,
    metaEventId: null,
    metaEventSlug: null,
    shopDisplayName: null,
    nextCheckAt: START,
    checkStage: options.checkStage ?? 0,
    stagedPlayerCount: 0,
    stagedLegendCount: 0,
    stagedDeckCount: 0,
    fetchedAt: null,
    important: options.important,
  };

  const client = {
    requests: 0,
    get: () => {
      client.requests++;
      return Promise.resolve({ isPublishResult: options.finished, shopInfoResponse: null });
    },
    postList: <T>(path: string, body: Record<string, unknown>): Promise<PlayloltcgList<T>> => {
      client.requests++;
      if (path === STANDINGS_PATH) {
        const items = [
          { name: "张三", finalRanking: 1, winCount: 3, cardGroupId: 11 },
          { name: "李四", finalRanking: 2, winCount: 2, cardGroupId: EMPTY_DECK },
        ];
        return Promise.resolve({ items: (body.pageNum === 1 ? items : []) as T[], total: null });
      }
      if (path === DECK_PATH) {
        const id = Number(body.id);
        const asks = [...(deckAsks.get(id) ?? []), now];
        deckAsks.set(id, asks);
        const answer = id === EMPTY_DECK ? (options.deckBody?.(id, asks.length) ?? []) : [CARD];
        if (answer instanceof Error) {
          return Promise.reject(answer);
        }
        return Promise.resolve({ items: answer as T[], total: null });
      }
      return Promise.reject(new Error(`unexpected path ${path}`));
    },
  } as unknown as PlayloltcgClient & { requests: number };

  const playloltcgEvents = {
    dueForRecheck: (at: Date) =>
      Promise.resolve(
        row.nextCheckAt !== null && row.nextCheckAt.getTime() <= at.getTime() ? [{ ...row }] : [],
      ),
    setRecheck: (_id: number, values: { nextCheckAt: Date | null; checkStage: number }) => {
      row.nextCheckAt = values.nextCheckAt;
      row.checkStage = values.checkStage;
      return Promise.resolve();
    },
    linkShopFromDetail: () => Promise.resolve(),
    cardsByShortCode: () => Promise.resolve(new Map()),
  };

  const isEmpty = (deck: StoredDeck) => deck.fetchStatus === "fetched" && deck.cards === 0;
  const playloltcgResults = {
    heldDeckIds: () => Promise.resolve(new Set(decks.keys())),
    deckCoverage: () => {
      const outstanding = standings
        .map((entry) => entry.sourceDeckId)
        .filter((id): id is string => id !== null && !decks.has(id));
      return Promise.resolve({ outstanding, held: decks.size });
    },
    emptyDeckIds: (_id: number, askedBefore: Date) =>
      Promise.resolve(
        [...decks]
          .filter(([, deck]) => isEmpty(deck) && deck.fetchedAt.getTime() < askedBefore.getTime())
          .map(([sourceDeckId]) => sourceDeckId),
      ),
    markDecksAsked: (_id: number, ids: readonly string[], at: Date) => {
      for (const id of ids) {
        const deck = decks.get(id);
        if (deck !== undefined) {
          deck.fetchedAt = at;
        }
      }
      return Promise.resolve();
    },
    finalizeEmptyDecks: () => {
      for (const deck of decks.values()) {
        if (isEmpty(deck)) {
          deck.fetchStatus = "refused";
        }
      }
      return Promise.resolve();
    },
    putDecklist: (
      stored: { sourceDeckId: string; fetchStatus: string; fetchedAt: Date },
      cards: unknown[],
    ) => {
      decks.set(stored.sourceDeckId, {
        fetchStatus: stored.fetchStatus,
        fetchedAt: stored.fetchedAt,
        cards: cards.length,
      });
      return Promise.resolve();
    },
    decklistCards: () => Promise.resolve(new Map()),
    replaceStandings: (_id: number, rows: { sourceDeckId: string | null }[]) => {
      standings = rows;
      row.fetchedAt = now;
      return Promise.resolve();
    },
  };

  const deps: PlayloltcgSyncDeps = {
    repos: {
      playloltcgEvents,
      playloltcgResults,
      meta: { sourceByKey: () => Promise.resolve(undefined) },
      jobRuns: { updateResult: () => Promise.resolve() },
    } as unknown as Repos,
    transact: (() => Promise.reject(new Error("no writes here"))) as unknown as Transact,
    client,
    log: createLogger("test"),
    now: () => now,
  };

  return {
    row,
    decks,
    deckAsks,
    visits,
    requests: () => client.requests,
    run: async (at: Date) => {
      now = at;
      visits.push(at);
      await processPlayloltcgRechecks(deps, { budgetMs: 60_000 });
    },
  };
}

function throttledEveryAsk(): World {
  return world({
    important: true,
    finished: true,
    checkStage: 1,
    deckBody: () => new SourceThrottledError(DECK_PATH),
    held: [
      ["11", { fetchStatus: "fetched", fetchedAt: START, cards: 1 }],
      emptyAnswered(new Date(START.getTime() - DAY_MS)),
    ],
  });
}

async function runToEnd(target: World, maxVisits = 10_000): Promise<void> {
  for (let visit = 0; visit < maxVisits && target.row.nextCheckAt !== null; visit++) {
    await target.run(target.row.nextCheckAt);
  }
}

function asksFor(target: World): number {
  return target.deckAsks.get(EMPTY_DECK)?.length ?? 0;
}

function emptyAnswered(at: Date): [string, StoredDeck] {
  return [String(EMPTY_DECK), { fetchStatus: "fetched", fetchedAt: at, cards: 0 }];
}

describe("a deck the source keeps serving empty", () => {
  it("is asked at most 5 times over an important event's ladder, then stored as final", async () => {
    const target = world({ important: true, finished: true });

    await runToEnd(target);

    expect(asksFor(target)).toBe(5);
    expect(target.decks.get(String(EMPTY_DECK))?.fetchStatus).toBe("refused");
  });

  it("is asked at most 5 times when the event first reaches it later on the ladder", async () => {
    const target = world({ important: true, finished: true, checkStage: 1 });

    await runToEnd(target);

    expect(asksFor(target)).toBe(5);
    expect(target.decks.get(String(EMPTY_DECK))?.fetchStatus).toBe("refused");
  });

  it("is asked at most twice for a local event, then stored as final", async () => {
    const target = world({ important: false, finished: true });

    await runToEnd(target);

    expect(asksFor(target)).toBe(2);
    expect(target.decks.get(String(EMPTY_DECK))?.fetchStatus).toBe("refused");
  });

  it("leaves the event on the same visits as a deck stored final at once", async () => {
    for (const important of [true, false]) {
      const empty = world({ important, finished: true });
      await runToEnd(empty);
      const final = world({
        important,
        finished: true,
        deckBody: () => new PlayloltcgRefusedError("playloltcg code 404 for deck 12"),
      });
      await runToEnd(final);

      expect(empty.visits).toEqual(final.visits);
      expect(empty.requests() - final.requests()).toBe(asksFor(empty) - 1);
      expect(asksFor(final)).toBe(1);
    }
  });

  it("never triggers the one-minute resume", async () => {
    const target = world({ important: true, finished: true });

    await runToEnd(target);

    const gaps = target.visits
      .slice(1)
      .map((at, index) => at.getTime() - target.visits[index]!.getTime());
    expect(gaps.every((gap) => gap >= DAY_MS)).toBe(true);
  });

  it("is stored normally once a retry finds cards, and asked no more", async () => {
    const target = world({
      important: true,
      finished: true,
      deckBody: (_id, asks) => (asks >= 2 ? [CARD] : []),
    });

    await runToEnd(target);

    expect(asksFor(target)).toBe(2);
    expect(target.decks.get(String(EMPTY_DECK))).toMatchObject({
      fetchStatus: "fetched",
      cards: 1,
    });
  });

  it("is never asked for an event the source never finishes", async () => {
    for (const startAt of ["2026-08-20", null]) {
      const target = world({ important: true, finished: false, startAt });

      await runToEnd(target, 500);

      expect(asksFor(target)).toBe(0);
    }
  });

  it("is final at the first visit that finds the event unfinished", async () => {
    const target = world({
      important: true,
      finished: false,
      checkStage: 2,
      held: [["11", { fetchStatus: "fetched", fetchedAt: START, cards: 1 }], emptyAnswered(START)],
    });

    await target.run(START);

    expect(asksFor(target)).toBe(0);
    expect(target.decks.get(String(EMPTY_DECK))?.fetchStatus).toBe("refused");
  });

  it("is asked once a day at most when every ask is throttled", async () => {
    const target = throttledEveryAsk();

    for (let at = START.getTime(); at < START.getTime() + DAY_MS; at += PAUSE_MS) {
      await target.run(new Date(at));
    }

    expect(asksFor(target)).toBe(1);
  });

  it("is asked at most once per day of the ladder span, then stored as final", async () => {
    const target = throttledEveryAsk();
    const cutoff = EVENT_DAY.getTime() + RECHECK_LADDER_SPAN_MS;

    for (let at = START.getTime(); at < cutoff + 10 * DAY_MS; at += PAUSE_MS) {
      await target.run(new Date(at));
    }

    const asks = target.deckAsks.get(EMPTY_DECK) ?? [];
    expect(asks.length).toBeGreaterThan(1);
    expect(asks.length).toBeLessThanOrEqual(RECHECK_LADDER_SPAN_MS / DAY_MS);
    expect(asks.every((ask) => ask.getTime() < cutoff)).toBe(true);
    expect(target.decks.get(String(EMPTY_DECK))?.fetchStatus).toBe("refused");
  });

  it("is final on the same visit for an event without a start day or older than the ladder", async () => {
    for (const startAt of [null, "2026-03-01"]) {
      const target = world({ important: true, finished: true, startAt });

      await target.run(START);

      expect(asksFor(target)).toBe(1);
      expect(target.decks.get(String(EMPTY_DECK))?.fetchStatus).toBe("refused");
    }
  });
});
