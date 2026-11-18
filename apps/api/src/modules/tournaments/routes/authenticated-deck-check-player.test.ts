import { parsePiltoverDeckCode } from "@openrift/shared/deck-code";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

import { cardLookupSlot } from "../../../test/card-lookup.js";
import { registerRouterForTest } from "../../../test/mount-router.js";
import type { Variables } from "../../../types.js";
import { deckCheckPlayerRouter } from "./authenticated-deck-check-player.js";

// Covers the module-level helpers in deck-check-player.ts through the router
// surface, and thereby the deck-check-player *service* helpers those handlers
// call (buildPlayerLines / linesFromDeckCode / resolvePlayerCardRows), which
// are only reachable this way — services/deck-check-player.test.ts covers
// claimParticipantByToken alone.

vi.mock("@openrift/shared/deck-code", async (importOriginal) => ({
  ...(await importOriginal()),
  parsePiltoverDeckCode: vi.fn(() => ({
    entries: [],
    warnings: ["Invalid Piltover Archive deck code."],
  })),
}));

const mockParsePiltoverDeckCode = vi.mocked(parsePiltoverDeckCode);

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const TOURNAMENT_ID = "b0000000-0001-4000-a000-000000000001";
const ENTRY_ID = "c0000000-0001-4000-a000-000000000001";
const TOKEN = "submission-token-abc";

const now = new Date("2026-06-01T00:00:00Z");
const PAST = new Date("2026-01-01T00:00:00Z");

function entryRow(overrides: Record<string, any> = {}) {
  return {
    id: ENTRY_ID,
    tournamentId: TOURNAMENT_ID,
    participantId: "participant-1",
    externalId: `openrift:${USER_ID}`,
    submittedAt: null,
    allowDeckPublishing: true,
    allowNameSharing: true,
    allowRiotIdSharing: true,
    contentHash: "hash-0",
    state: "editable",
    reviewOutcome: null,
    checkedBy: null,
    checkedAt: null,
    approvedBy: null,
    approvedAt: null,
    unlockRequestedAt: null,
    preEditLines: null,
    notes: null,
    changeSummary: null,
    withdrawnAt: null,
    playerMessage: null,
    createdAt: now,
    updatedAt: now,
    playerName: "Player One",
    riotId: null,
    claimedUserId: USER_ID,
    claimSource: "self_submit",
    claimedAt: now,
    claimBlockedAt: null,
    claimToken: null,
    ...overrides,
  };
}

function playerRow(overrides: Record<string, any> = {}) {
  return {
    ...entryRow(),
    eventName: "Summoner Skirmish",
    eventDate: null,
    eventStatus: "active",
    participantStatus: "active",
    submissionsCloseAt: null,
    groupName: "Noxus Locals",
    groupSlug: "noxus-locals",
    ...overrides,
  };
}

function deckEvent(overrides: Record<string, any> = {}) {
  return {
    id: TOURNAMENT_ID,
    groupId: null,
    name: "Summoner Skirmish",
    eventDate: null,
    format: "constructed",
    playMode: "1v1",
    allowedSets: null,
    status: "active",
    listLockMode: "manual",
    allowSelfSubmission: true,
    submissionToken: TOKEN,
    submissionsCloseAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function cardRow(overrides: Record<string, any> = {}) {
  return {
    id: "stored-card-1",
    entryId: ENTRY_ID,
    sortOrder: 0,
    rawName: "Garen, Might of Demacia",
    section: "main",
    zone: "main",
    quantity: 2,
    resolvedCardId: null,
    resolvedPrintingId: null,
    matchStatus: "unmatched" as const,
    foundCopies: [],
    ...overrides,
  };
}

/**
 * Builds a `vi.fn` typed to resolve `T` (widened past whatever the default
 * value's literal type would otherwise pin it to), so a later
 * `.mockResolvedValue(...)` / `.mockImplementation(...)` in a test can hand it
 * any realistic fixture without fighting inference.
 */
function stub<T = any>(defaultValue: T) {
  return vi.fn((..._args: any[]): Promise<T> => Promise.resolve(defaultValue));
}

/**
 * A repos double covering every method the player router (and the services it
 * delegates to) can call, all defaulting to "nothing found" / "no-op" so a test
 * only has to override what it cares about.
 */
function makeRepos() {
  const deckCheck = {
    getEntryForPlayer: stub<any>(undefined),
    getEntryForPlayerByTournament: stub<any>(undefined),
    getEventById: stub<any>(undefined),
    getEventBySubmissionToken: stub<any>(undefined),
    lockSelfSubmission: stub<any>(undefined),
    participantHasDeck: stub(false),
    getLinkedEntryForUser: stub<any>(undefined),
    getEntryForUpdate: stub<any>(undefined),
    getEntryByExternalId: stub<any>(undefined),
    getUserAccount: stub<any>(undefined),
    listCardsForEntry: stub([] as unknown[]),
    listCardsForEntries: stub(new Map()),
    listEditableBaselines: stub([] as unknown[]),
    settleEditableEntries: stub([] as string[]),
    replaceEntryCards: stub<any>(undefined),
    updateEntry: stub<any>(undefined),
    createEntry: stub<any>(undefined),
    canonicalPrintingByCard: stub(new Map()),
    getCardDetails: stub(new Map()),
    getCardSetSlugs: stub(new Map()),
    getEntryIdByParticipant: stub<any>(null),
  };
  // The locked re-read in a save sees the event the token resolved to, unless a test sets it.
  deckCheck.getEventById.mockImplementation(() => deckCheck.getEventBySubmissionToken());
  const tournaments = {
    lockRounds: stub<any>(undefined),
    getParticipantByUser: stub<any>(undefined),
    getParticipantById: stub<any>({ id: "participant-1", status: "active" }),
    resolveOrCreateParticipant: stub({ id: "participant-new" }),
    lockParticipant: stub(true),
    getParticipantByClaimToken: stub<any>(undefined),
    linkParticipantByClaimTokenIfUnclaimed: stub<any>(undefined),
  };
  const decks = {
    getByIdForUser: stub<any>(undefined),
    cardsWithDetails: stub([] as unknown[]),
  };
  const enums = { all: stub({ cardTypes: [] as unknown[], domains: [] as unknown[] }) };
  const catalog = {
    championIdentifierTags: stub([] as string[]),
    cards: stub([] as unknown[]),
    printingLookupRows: stub([] as unknown[]),
    catalogContentVersion: stub("catalog-v1"),
  };
  const cardLookup = cardLookupSlot(catalog);
  const cardBans = { listInEffectForCards: stub([] as unknown[]) };
  const tournamentGroups = { syncParticipantLegendsFromDeckCheck: stub<any>(undefined) };
  return { deckCheck, tournaments, decks, enums, catalog, cardLookup, cardBans, tournamentGroups };
}

function catalogCards(
  repos: ReturnType<typeof makeRepos>,
  rows: [shortCode: string, cardId: string, name: string, types?: string[], tags?: string[]][],
) {
  repos.catalog.cards.mockResolvedValue(
    rows.map(([, id, name, types = ["unit"], tags = []]) => ({
      id,
      slug: id,
      name,
      types,
      superTypes: [],
      tags,
    })),
  );
  repos.catalog.printingLookupRows.mockResolvedValue(
    rows.map(([shortCode, cardId]) => ({
      cardId,
      shortCode,
      publicCode: `${shortCode}/298`,
      printedName: null,
    })),
  );
}

function makeApp(repos: ReturnType<typeof makeRepos>) {
  const app = new Hono<{ Variables: Variables }>();
  app.use("*", async (c, next) => {
    c.set("user", { id: USER_ID } as never);
    c.set("repos", repos as never);
    c.set("transact", (async (fn: (r: typeof repos) => unknown) => fn(repos)) as never);
    await next();
  });
  registerRouterForTest(app, deckCheckPlayerRouter);
  return app;
}

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://test/api/v1/deck-check${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("GET /deck-check/mine/tournament/{tournamentId} (getMine)", () => {
  it("reports canUnlock, not canRequestUnlock, for a submitted at_deadline entry", async () => {
    // TR 401.3: at_deadline is the lenient mode — a submitted entry
    // can still self-unlock while the window is open, so no judge request is
    // needed. canUnlock and canRequestUnlock must never both be true.
    const { res, body } = await runGetMine(
      playerRow({ state: "submitted", unlockRequestedAt: null }),
      deckEvent({ listLockMode: "at_deadline" }),
    );
    expect(res.status).toBe(200);
    expect(body.entry.canUnlock).toBe(true);
    expect(body.entry.canRequestUnlock).toBe(false);
  });

  it("reports canRequestUnlock, not canUnlock, for a submitted on_submit entry", async () => {
    // TR 401.3: on_submit is the strict mode — submitting was the delivery, so
    // the player can only file a judge-gated unlock request.
    const { res, body } = await runGetMine(
      playerRow({ state: "submitted", unlockRequestedAt: null }),
      deckEvent({ listLockMode: "on_submit" }),
    );
    expect(res.status).toBe(200);
    expect(body.entry.canUnlock).toBe(false);
    expect(body.entry.canRequestUnlock).toBe(true);
  });

  it("reports canRequestUnlock for an approved entry with no pending request", async () => {
    const { res, body } = await runGetMine(
      playerRow({ state: "approved", unlockRequestedAt: null }),
      deckEvent(),
    );
    expect(res.status).toBe(200);
    expect(body.entry.canRequestUnlock).toBe(true);
    expect(body.entry.unlockRequested).toBe(false);
  });

  it("suppresses canRequestUnlock once a request is already pending", async () => {
    const { res, body } = await runGetMine(
      playerRow({ state: "approved", unlockRequestedAt: now }),
      deckEvent(),
    );
    expect(res.status).toBe(200);
    expect(body.entry.canRequestUnlock).toBe(false);
    expect(body.entry.unlockRequested).toBe(true);
  });

  it("closes every self-service action once submissions are closed", async () => {
    const { res, body } = await runGetMine(
      playerRow({ state: "submitted", unlockRequestedAt: null }),
      deckEvent({ status: "archived", listLockMode: "at_deadline" }),
    );
    expect(res.status).toBe(200);
    expect(body.entry.windowOpen).toBe(false);
    expect(body.entry.canEdit).toBe(false);
    expect(body.entry.canUnlock).toBe(false);
    expect(body.entry.canRequestUnlock).toBe(false);
  });

  it("presents an entry left editable past the deadline as submitted without writing", async () => {
    const repos = makeRepos();
    const row = playerRow({ state: "editable", submissionsCloseAt: PAST });
    const event = deckEvent({ submissionsCloseAt: PAST });
    repos.deckCheck.getEntryForPlayerByTournament.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(event);

    const res = await makeApp(repos).fetch(req("GET", `/mine/tournament/${TOURNAMENT_ID}`));
    const body = (await res.json()) as {
      entry: { state: string; windowOpen: boolean; submittedAt: string | null };
    };

    expect(res.status).toBe(200);
    expect(body.entry.state).toBe("submitted");
    expect(body.entry.submittedAt).toBe(PAST.toISOString());
    expect(body.entry.windowOpen).toBe(false);
    expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
    expect(repos.deckCheck.settleEditableEntries).not.toHaveBeenCalled();
  });

  it("404s without leaking existence when the caller has no entry in the tournament", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayerByTournament.mockResolvedValue(undefined);

    const res = await makeApp(repos).fetch(req("GET", `/mine/tournament/${TOURNAMENT_ID}`));
    const body = (await res.json()) as { message: string; code: string };

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toBe("Entry not found");
  });

  async function runGetMine(row: unknown, event: unknown) {
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayerByTournament.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(event);
    const res = await makeApp(repos).fetch(req("GET", `/mine/tournament/${TOURNAMENT_ID}`));
    const body = (await res.json()) as any;
    return { res, body };
  }
});

describe("PUT /deck-check/mine/{entryId}/list (editList)", () => {
  it("previews a card-list submission without writing anything (dry run)", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(entryRow({ state: "editable" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, {
        cards: [{ name: "Garen, Might of Demacia", quantity: 3, section: "main" }],
        dryRun: true,
      }),
    );
    const body = (await res.json()) as {
      entryId: string | null;
      tournamentId: string;
      cards: { id: string; quantity: number; foundCopies: boolean[]; matchStatus: string }[];
    };

    expect(res.status).toBe(200);
    expect(body.entryId).toBeNull();
    expect(body.tournamentId).toBe(TOURNAMENT_ID);
    // toPreviewCards: synthetic "preview-<sortOrder>" id, all-false found ticks
    // sized to quantity, since nothing is persisted yet.
    expect(body.cards).toEqual([
      {
        id: "preview-0",
        sortOrder: 0,
        rawName: "Garen, Might of Demacia",
        section: "main",
        zone: "main",
        quantity: 3,
        matchStatus: "unmatched",
        foundCopies: [false, false, false],
        resolvedCardId: null,
        resolvedPrintingId: null,
      },
    ]);
    expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
    expect(repos.deckCheck.replaceEntryCards).not.toHaveBeenCalled();
  });

  it("keeps duplicate rows for the same card name as separate lines, not merged", async () => {
    // Pins current behavior: resolvePlayerCardRows never dedupes/aggregates by
    // name — a card split across two zones (or listed twice by mistake) stays
    // two distinct card-line rows, each with its own sortOrder.
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(entryRow({ state: "editable" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, {
        cards: [
          { name: "Fizz, The Tidal Trickster", quantity: 2, section: "main" },
          { name: "Fizz, The Tidal Trickster", quantity: 1, section: "sideboard" },
        ],
        dryRun: true,
      }),
    );
    const body = (await res.json()) as {
      cards: { sortOrder: number; zone: string; quantity: number }[];
    };

    expect(res.status).toBe(200);
    expect(body.cards).toHaveLength(2);
    expect(body.cards[0]).toMatchObject({ sortOrder: 0, zone: "main", quantity: 2 });
    expect(body.cards[1]).toMatchObject({ sortOrder: 1, zone: "sideboard", quantity: 1 });
  });

  it("resolves to an empty preview when a deck's only cards sit in the overflow zone", async () => {
    const repos = makeRepos();
    const deckId = "d0000000-0001-4000-a000-000000000001";
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(entryRow({ state: "editable" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());
    repos.decks.getByIdForUser.mockResolvedValue({ id: deckId });
    repos.decks.cardsWithDetails.mockResolvedValue([
      { cardName: "Bench Warmer", zone: "overflow", quantity: 4 },
    ]);

    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, { deckId, dryRun: true }),
    );
    const body = (await res.json()) as { cards: unknown[] };

    expect(res.status).toBe(200);
    expect(body.cards).toEqual([]);
  });

  it("409s once submissions have closed, even for an editable entry", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(entryRow({ state: "editable" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent({ status: "archived" }));

    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    const body = (await res.json()) as { message: string; code: string };

    expect(res.status).toBe(409);
    expect(body.code).toBe("CONFLICT");
    expect(body.message).toBe("Submissions closed. Contact a judge.");
  });

  it("409s with the withdrawn message for a withdrawn entry", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(entryRow({ state: "withdrawn" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(409);
    expect(body.message).toBe("Your entry was withdrawn by the organizer. Contact a judge.");
  });

  it("409s with the locked message for a non-withdrawn, non-editable entry", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(entryRow({ state: "approved" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(409);
    expect(body.message).toBe("Your deck is locked. Unlock it before editing.");
  });

  it("writes the replaced list and returns the persisted cards on a real (non-dry-run) edit", async () => {
    const repos = makeRepos();
    const row = entryRow({ state: "editable" });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());
    repos.deckCheck.updateEntry.mockImplementation((_id: string, patch: Record<string, unknown>) =>
      Promise.resolve({ ...row, ...patch }),
    );
    repos.deckCheck.listCardsForEntry.mockResolvedValue([
      cardRow({ rawName: "Card", section: "main", zone: "main", quantity: 1 }),
    ]);

    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    const body = (await res.json()) as { entryId: string; cards: { rawName: string }[] };

    expect(res.status).toBe(200);
    expect(body.entryId).toBe(ENTRY_ID);
    expect(body.cards).toEqual([expect.objectContaining({ rawName: "Card" })]);
    expect(repos.deckCheck.replaceEntryCards).toHaveBeenCalledWith(
      ENTRY_ID,
      expect.arrayContaining([expect.objectContaining({ rawName: "Card" })]),
    );
    expect(repos.tournamentGroups.syncParticipantLegendsFromDeckCheck).toHaveBeenCalledWith(
      TOURNAMENT_ID,
      ["participant-1"],
    );
  });

  it("404s when the entry doesn't belong to (or doesn't exist for) the caller", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(undefined);

    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    const body = (await res.json()) as { code: string };

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
  });
});

describe("deck-code decoding (linesFromDeckCode)", () => {
  it("422s with 'contains no cards' when the code decodes cleanly to nothing", async () => {
    // parsePiltoverDeckCode warns only when the code itself failed to decode;
    // a code that decodes to zero entries and zero warnings gets this message.
    mockParsePiltoverDeckCode.mockReturnValueOnce({ entries: [], warnings: [] });
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(entryRow({ state: "editable" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, { deckCode: "EMPTYCODE", dryRun: true }),
    );
    const body = (await res.json()) as { message: string; code: string };

    expect(res.status).toBe(422);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.message).toBe("The deck code contains no cards");
  });

  it("422s with 'could not be read' when the code fails to decode at all", async () => {
    mockParsePiltoverDeckCode.mockReturnValueOnce({
      entries: [],
      warnings: ["Invalid Piltover Archive deck code."],
    });
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(entryRow({ state: "editable" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, { deckCode: "garbage", dryRun: true }),
    );
    const body = (await res.json()) as { message: string; code: string };

    expect(res.status).toBe(422);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.message).toBe("The deck code could not be read");
  });

  it("preserves the parser's emission order: main deck, then sideboard, then champion last", async () => {
    // The rewritten linesFromDeckCode only maps parsePiltoverDeckCode's entries
    // — it must not reorder or re-group them by zone.
    mockParsePiltoverDeckCode.mockReturnValueOnce({
      entries: [
        { shortCode: "OGN-001", quantity: 2, sourceSlot: "mainDeck", rawFields: {} },
        { shortCode: "OGN-002", quantity: 1, sourceSlot: "sideboard", rawFields: {} },
        {
          shortCode: "OGN-003",
          quantity: 1,
          sourceSlot: "chosenChampion",
          explicitZone: "champion",
          rawFields: {},
        },
      ],
      warnings: [],
    });
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(entryRow({ state: "editable" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());
    catalogCards(repos, [
      ["OGN-001", "card-main", "Main Card"],
      ["OGN-002", "card-side", "Side Card"],
      ["OGN-003", "card-champ", "Champion Card"],
    ]);

    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, { deckCode: "SOMECODE", dryRun: true }),
    );
    const body = (await res.json()) as {
      cards: { sortOrder: number; rawName: string; zone: string }[];
    };

    expect(res.status).toBe(200);
    expect(
      body.cards.map((c) => ({ sortOrder: c.sortOrder, rawName: c.rawName, zone: c.zone })),
    ).toEqual([
      { sortOrder: 0, rawName: "Main Card", zone: "main" },
      { sortOrder: 1, rawName: "Side Card", zone: "sideboard" },
      { sortOrder: 2, rawName: "Champion Card", zone: "champion" },
    ]);
  });

  it("resolves a deck code's printing code regardless of case", async () => {
    mockParsePiltoverDeckCode.mockReturnValueOnce({
      entries: [{ shortCode: "sfd-001", quantity: 1, sourceSlot: "mainDeck", rawFields: {} }],
      warnings: [],
    });
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(entryRow({ state: "editable" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());
    catalogCards(repos, [["SFD-001", "card-azir", "Emperor of the Sands", ["legend"], ["Azir"]]]);

    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, { deckCode: "SOMECODE", dryRun: true }),
    );
    const body = (await res.json()) as {
      cards: { rawName: string; zone: string; matchStatus: string; resolvedCardId: string }[];
    };

    expect(res.status).toBe(200);
    expect(body.cards).toEqual([
      expect.objectContaining({
        rawName: "Emperor of the Sands",
        zone: "legend",
        matchStatus: "matched",
        resolvedCardId: "card-azir",
      }),
    ]);
  });

  it("falls back an unresolved short code to a MAIN-zone placeholder, even from the sideboard", async () => {
    // linesFromDeckCode's "not found" branch always returns
    // WellKnown.deckZone.MAIN — it does not consult entry.sourceSlot the way
    // the matched branch does via inferZone. A code referencing a short code
    // our catalog doesn't recognize silently reassigns it to main.
    mockParsePiltoverDeckCode.mockReturnValueOnce({
      entries: [{ shortCode: "UNKNOWN-999", quantity: 1, sourceSlot: "sideboard", rawFields: {} }],
      warnings: [],
    });
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(entryRow({ state: "editable" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, { deckCode: "SOMECODE", dryRun: true }),
    );
    const body = (await res.json()) as {
      cards: { rawName: string; zone: string; matchStatus: string }[];
    };

    expect(res.status).toBe(200);
    expect(body.cards).toEqual([
      expect.objectContaining({ rawName: "UNKNOWN-999", zone: "main", matchStatus: "unmatched" }),
    ]);
  });

  it("blows up the whole response instead of dropping a non-positive-quantity entry", async () => {
    // parsePiltoverDeckCode's `quantity > 0` guard (packages/shared/src/deck-code.ts)
    // is applied only while consolidating mainDeck totals; sideboard entries are
    // pushed unconditionally. linesFromDeckCode itself applies no guard of its
    // own for any sourceSlot. This test mocks the parser to simulate that gap
    // directly (a real decode practically never produces it) and pins what the
    // API does with such an entry: it does NOT drop the line — it passes it
    // straight through to toPreviewCards, whose foundCopies is
    // `Array.from({length: quantity}, ...)` (harmless at 0, but silently clamps
    // a negative quantity to a 0-length array too). Either way the response
    // then fails oRPC's own output validation, since
    // deckCheckEntryCardResponseSchema requires
    // `quantity: z.number().int().positive()` — so a decoder that ever emitted
    // this shape wouldn't render a "0 copies" placeholder, it would 500 the
    // whole request.
    mockParsePiltoverDeckCode.mockReturnValueOnce({
      entries: [{ shortCode: "OGN-004", quantity: 0, sourceSlot: "sideboard", rawFields: {} }],
      warnings: [],
    });
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(entryRow({ state: "editable" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, { deckCode: "SOMECODE", dryRun: true }),
    );
    const body = (await res.json()) as { code: string; message: string };

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_SERVER_ERROR");
    expect(body.message).toBe("Output validation failed");
  });
});

describe("POST /deck-check/mine/{entryId}/submit", () => {
  it("submits an editable entry", async () => {
    const repos = makeRepos();
    const row = playerRow({ state: "editable" });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());
    repos.deckCheck.updateEntry.mockImplementation((_id: string, patch: Record<string, unknown>) =>
      Promise.resolve({ ...row, ...patch }),
    );

    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/submit`));
    const body = (await res.json()) as { entry: { state: string; submittedAt: string | null } };

    expect(res.status).toBe(200);
    expect(body.entry.state).toBe("submitted");
    expect(body.entry.submittedAt).not.toBeNull();
  });

  it("409s when the entry is not editable", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(playerRow({ state: "submitted" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/submit`));
    const body = (await res.json()) as { message: string; code: string };

    expect(res.status).toBe(409);
    expect(body.code).toBe("CONFLICT");
    expect(body.message).toBe("Only an editable deck can be submitted");
    expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
  });

  it("409s when submissions are closed, for an already-submitted entry", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(playerRow({ state: "submitted" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent({ status: "archived" }));

    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/submit`));

    expect(res.status).toBe(409);
    expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
  });

  it("answers 200 and persists the deadline submit when the stored entry is still editable", async () => {
    const repos = makeRepos();
    const row = playerRow({ state: "editable", submissionsCloseAt: PAST });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent({ submissionsCloseAt: PAST }));
    repos.deckCheck.listEditableBaselines.mockResolvedValue([
      { id: ENTRY_ID, preEditLines: null, updatedAt: now },
    ]);

    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/submit`));
    const body = (await res.json()) as { entry: { state: string } };

    expect(res.status).toBe(200);
    expect(body.entry.state).toBe("submitted");
    expect(repos.deckCheck.settleEditableEntries).toHaveBeenCalledWith(TOURNAMENT_ID, [
      { id: ENTRY_ID, submittedAt: PAST, changeSummary: null },
    ]);
  });

  it("still 409s a closed window when the entry was already settled before this request", async () => {
    // The counterpart to the case above: nothing is written here, because the
    // entry is not editable, so there is no write for the rejection to
    // contradict. This is the genuine conflict the 409 is for.
    const repos = makeRepos();
    const row = playerRow({ state: "submitted", submissionsCloseAt: PAST });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent({ submissionsCloseAt: PAST }));

    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/submit`));
    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(409);
    expect(body.message).toBe("Submissions closed. Contact a judge.");
    expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
  });
});

describe("POST/DELETE /deck-check/mine/{entryId}/unlock", () => {
  it("self-unlocks a submitted entry in at_deadline mode, keeping the existing baseline", async () => {
    // `preEditLines` is a jsonb column typed as its parsed shape, so a read
    // hands back the stored array itself, never JSON text.
    const storedPreEditLines = [{ name: "Old Card", zone: "main", quantity: 1 }];
    const repos = makeRepos();
    const row = playerRow({ state: "submitted", preEditLines: storedPreEditLines });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent({ listLockMode: "at_deadline" }));
    repos.deckCheck.updateEntry.mockImplementation((_id: string, patch: Record<string, unknown>) =>
      Promise.resolve({ ...row, ...patch }),
    );

    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/unlock`));
    const body = (await res.json()) as { entry: { state: string; canEdit: boolean } };

    expect(res.status).toBe(200);
    expect(body.entry.state).toBe("editable");
    expect(body.entry.canEdit).toBe(true);
    // keepExistingBaseline: true means the stored baseline is kept and just
    // re-stringified, not rebuilt from the current cards.
    expect(repos.deckCheck.updateEntry).toHaveBeenCalledWith(
      ENTRY_ID,
      expect.objectContaining({ preEditLines: storedPreEditLines }),
    );
  });

  it("files a judge-gated unlock request for a submitted entry in on_submit mode", async () => {
    const repos = makeRepos();
    const row = playerRow({ state: "submitted", unlockRequestedAt: null });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent({ listLockMode: "on_submit" }));
    repos.deckCheck.updateEntry.mockImplementation((_id: string, patch: Record<string, unknown>) =>
      Promise.resolve({ ...row, ...patch }),
    );

    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/unlock`));
    const body = (await res.json()) as { entry: { state: string; unlockRequested: boolean } };

    expect(res.status).toBe(200);
    // Judge-gated: the entry stays "submitted", only the request flag flips.
    expect(body.entry.state).toBe("submitted");
    expect(body.entry.unlockRequested).toBe(true);
  });

  it("files an unlock request for an approved entry", async () => {
    const repos = makeRepos();
    const row = playerRow({ state: "approved", unlockRequestedAt: null });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());
    repos.deckCheck.updateEntry.mockImplementation((_id: string, patch: Record<string, unknown>) =>
      Promise.resolve({ ...row, ...patch }),
    );

    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/unlock`));
    const body = (await res.json()) as { entry: { unlockRequested: boolean } };

    expect(res.status).toBe(200);
    expect(body.entry.unlockRequested).toBe(true);
  });

  it("files the unlock request when a judge approved the submitted entry in the meantime", async () => {
    const repos = makeRepos();
    const row = playerRow({ state: "submitted", unlockRequestedAt: null });
    const approved = { ...row, state: "approved" };
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(approved);
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent({ listLockMode: "on_submit" }));
    repos.deckCheck.updateEntry.mockImplementation((_id: string, patch: Record<string, unknown>) =>
      Promise.resolve({ ...approved, ...patch }),
    );

    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/unlock`));
    const body = (await res.json()) as { entry: { state: string; unlockRequested: boolean } };

    expect(res.status).toBe(200);
    expect(body.entry).toMatchObject({ state: "approved", unlockRequested: true });
  });

  it("files no unlock request when a judge unlocked the entry in the meantime", async () => {
    const repos = makeRepos();
    const row = playerRow({ state: "approved", unlockRequestedAt: null });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue({ ...row, state: "editable" });
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/unlock`));

    expect(res.status).toBe(409);
    expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
  });

  it("409s an already-editable entry with its own message", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(playerRow({ state: "editable" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/unlock`));
    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(409);
    expect(body.message).toBe("Your deck is already editable");
  });

  it("409s a checked entry, directing the player to a judge", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(playerRow({ state: "checked" }));
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/unlock`));
    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(409);
    expect(body.message).toBe("Contact a judge to unlock this deck");
  });

  it("clears a pending unlock request on cancel", async () => {
    const repos = makeRepos();
    const row = playerRow({ state: "approved", unlockRequestedAt: now });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());
    repos.deckCheck.updateEntry.mockImplementation((_id: string, patch: Record<string, unknown>) =>
      Promise.resolve({ ...row, ...patch }),
    );

    const res = await makeApp(repos).fetch(req("DELETE", `/mine/${ENTRY_ID}/unlock`));
    const body = (await res.json()) as { entry: { unlockRequested: boolean } };

    expect(res.status).toBe(200);
    expect(body.entry.unlockRequested).toBe(false);
    expect(repos.deckCheck.updateEntry).toHaveBeenCalledWith(ENTRY_ID, { unlockRequestedAt: null });
    const lockOrder = repos.tournaments.lockRounds.mock.invocationCallOrder[0] ?? 0;
    expect(lockOrder).toBeGreaterThan(0);
    expect(lockOrder).toBeLessThan(repos.deckCheck.updateEntry.mock.invocationCallOrder[0] ?? 0);
  });

  it("writes nothing on cancel when a judge resolved the request in the meantime", async () => {
    const repos = makeRepos();
    const row = playerRow({ state: "approved", unlockRequestedAt: now });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue({
      ...row,
      state: "editable",
      unlockRequestedAt: null,
    });
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(req("DELETE", `/mine/${ENTRY_ID}/unlock`));
    const body = (await res.json()) as { entry: { state: string; unlockRequested: boolean } };

    expect(res.status).toBe(200);
    expect(body.entry).toMatchObject({ state: "editable", unlockRequested: false });
    expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
  });

  it("409s cancel when the entry left the reviewable states with the request still set", async () => {
    const repos = makeRepos();
    const row = playerRow({ state: "approved", unlockRequestedAt: now });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue({ ...row, state: "withdrawn" });
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(req("DELETE", `/mine/${ENTRY_ID}/unlock`));

    expect(res.status).toBe(409);
    expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
  });

  it("no-ops cancel when nothing is pending, without writing", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(
      playerRow({ state: "approved", unlockRequestedAt: null }),
    );
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(req("DELETE", `/mine/${ENTRY_ID}/unlock`));

    expect(res.status).toBe(200);
    expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
  });
});

describe("GET /deck-check/submissions/{token} (submissionPage)", () => {
  it("404s an unknown token", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(undefined);

    const res = await makeApp(repos).fetch(req("GET", `/submissions/${TOKEN}`));
    const body = (await res.json()) as { message: string; code: string };

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toBe("Submission link not found");
  });

  it("403s a non-participant when self-registration is closed", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ allowSelfSubmission: false, groupName: "Noxus Locals" }),
    );
    repos.tournaments.getParticipantByUser.mockResolvedValue(undefined);

    const res = await makeApp(repos).fetch(req("GET", `/submissions/${TOKEN}`));
    const body = (await res.json()) as { message: string; code: string };

    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
    expect(body.message).toContain("Self-registration is closed");
  });

  it("reports linkedEntry: null when the caller has no linked entry", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals" }),
    );
    repos.deckCheck.getLinkedEntryForUser.mockResolvedValue(undefined);

    const res = await makeApp(repos).fetch(req("GET", `/submissions/${TOKEN}`));
    const body = (await res.json()) as { linkedEntry: unknown };

    expect(res.status).toBe(200);
    expect(body.linkedEntry).toBeNull();
  });

  it("displays a closed-window editable entry as 'submitted' and disallows replace", async () => {
    // A linked entry still "editable" once the window has closed hasn't been
    // settled yet (that only happens when the entry itself is loaded); the
    // submission page compensates by presenting it as submitted so the player
    // isn't told they can still edit.
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ status: "archived", groupName: "Noxus Locals" }),
    );
    repos.deckCheck.getLinkedEntryForUser.mockResolvedValue(entryRow({ state: "editable" }));

    const res = await makeApp(repos).fetch(req("GET", `/submissions/${TOKEN}`));
    const body = (await res.json()) as {
      submissionsOpen: boolean;
      linkedEntry: { state: string; canReplace: boolean };
    };

    expect(res.status).toBe(200);
    expect(body.submissionsOpen).toBe(false);
    expect(body.linkedEntry.state).toBe("submitted");
    expect(body.linkedEntry.canReplace).toBe(false);
  });
});

describe("POST /deck-check/submissions/{token} (submitToToken / persistSubmission)", () => {
  function linkEntry(repos: ReturnType<typeof makeRepos>, row: unknown) {
    repos.deckCheck.getLinkedEntryForUser.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(row);
  }

  it("creates a fresh self-submitted entry when the caller has nothing linked yet", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals" }),
    );
    linkEntry(repos, undefined);
    repos.deckCheck.getEntryByExternalId.mockResolvedValue(undefined);
    repos.deckCheck.getUserAccount.mockResolvedValue({
      id: USER_ID,
      name: "Player One",
      email: "player@example.com",
      riotId: null,
    });
    const created = entryRow({ state: "submitted" });
    repos.deckCheck.createEntry.mockResolvedValue(created);
    repos.deckCheck.listCardsForEntry.mockResolvedValue([cardRow()]);

    const res = await makeApp(repos).fetch(
      req("POST", `/submissions/${TOKEN}`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    const body = (await res.json()) as { entryId: string };

    expect(res.status).toBe(200);
    expect(body.entryId).toBe(ENTRY_ID);
    expect(repos.tournaments.resolveOrCreateParticipant).toHaveBeenCalledWith(
      expect.objectContaining({
        tournamentId: TOURNAMENT_ID,
        userId: USER_ID,
        status: "requested",
      }),
    );
    expect(repos.deckCheck.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: `openrift:${USER_ID}`, state: "submitted" }),
    );
  });

  it("reruns the submission transaction when the new participant's claim token collides", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals" }),
    );
    linkEntry(repos, undefined);
    repos.deckCheck.getEntryByExternalId.mockResolvedValue(undefined);
    repos.deckCheck.getUserAccount.mockResolvedValue({
      id: USER_ID,
      name: "Player One",
      email: "player@example.com",
      riotId: null,
    });
    repos.tournaments.resolveOrCreateParticipant.mockRejectedValueOnce(
      Object.assign(new Error("duplicate key"), {
        code: "23505",
        constraint_name: "uq_tournament_participants_claim_token",
      }),
    );
    repos.deckCheck.createEntry.mockResolvedValue(entryRow({ state: "submitted" }));
    repos.deckCheck.listCardsForEntry.mockResolvedValue([cardRow()]);

    const res = await makeApp(repos).fetch(
      req("POST", `/submissions/${TOKEN}`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );

    expect(res.status).toBe(200);
    expect(repos.tournaments.resolveOrCreateParticipant).toHaveBeenCalledTimes(2);
    expect(repos.deckCheck.createEntry).toHaveBeenCalledOnce();
  });

  it("replaces and resubmits a linked editable entry", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals" }),
    );
    const linked = entryRow({ state: "editable" });
    linkEntry(repos, linked);
    repos.deckCheck.updateEntry.mockImplementation((_id: string, patch: Record<string, unknown>) =>
      Promise.resolve({ ...linked, ...patch }),
    );
    repos.deckCheck.listCardsForEntry.mockResolvedValue([cardRow()]);

    const res = await makeApp(repos).fetch(
      req("POST", `/submissions/${TOKEN}`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    const body = (await res.json()) as { entryId: string };

    expect(res.status).toBe(200);
    expect(body.entryId).toBe(ENTRY_ID);
    expect(repos.deckCheck.replaceEntryCards).toHaveBeenCalled();
    expect(repos.deckCheck.createEntry).not.toHaveBeenCalled();
    // applyPlayerList then submitEntryList: the final state must be "submitted".
    expect(repos.deckCheck.updateEntry).toHaveBeenLastCalledWith(
      ENTRY_ID,
      expect.objectContaining({ state: "submitted" }),
    );
  });

  it("replaces and resubmits a linked submitted entry in at_deadline mode (self-service replace)", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals", listLockMode: "at_deadline" }),
    );
    const linked = entryRow({ state: "submitted" });
    linkEntry(repos, linked);
    repos.deckCheck.updateEntry.mockImplementation((_id: string, patch: Record<string, unknown>) =>
      Promise.resolve({ ...linked, ...patch }),
    );
    repos.deckCheck.listCardsForEntry.mockResolvedValue([cardRow()]);

    const res = await makeApp(repos).fetch(
      req("POST", `/submissions/${TOKEN}`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );

    expect(res.status).toBe(200);
    expect(repos.deckCheck.replaceEntryCards).toHaveBeenCalled();
  });

  it("409s replacing a withdrawn linked entry", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals" }),
    );
    linkEntry(repos, entryRow({ state: "withdrawn" }));

    const res = await makeApp(repos).fetch(
      req("POST", `/submissions/${TOKEN}`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(409);
    expect(body.message).toBe("Your entry was withdrawn by the organizer. Contact a judge.");
  });

  it("409s replacing an already-reviewed (approved/checked) linked entry", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals" }),
    );
    linkEntry(repos, entryRow({ state: "checked" }));

    const res = await makeApp(repos).fetch(
      req("POST", `/submissions/${TOKEN}`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(409);
    expect(body.message).toBe(
      "Your deck was already reviewed by a judge. Ask for it to be unlocked from your deck page.",
    );
  });

  it("409s a first submission when a judge entered a deck for the spot meanwhile", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals" }),
    );
    linkEntry(repos, undefined);
    repos.deckCheck.getUserAccount.mockResolvedValue({
      id: "u",
      name: "Player",
      email: "player@test.com",
      riotId: null,
    });
    repos.deckCheck.participantHasDeck.mockResolvedValue(true);

    const res = await makeApp(repos).fetch(
      req("POST", `/submissions/${TOKEN}`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );

    expect(res.status).toBe(409);
    expect(repos.deckCheck.createEntry).not.toHaveBeenCalled();
  });

  it("409s a resubmit when a judge approved the entry while it was being read", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals" }),
    );
    repos.deckCheck.getLinkedEntryForUser.mockResolvedValue(entryRow({ state: "submitted" }));
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(entryRow({ state: "approved" }));

    const res = await makeApp(repos).fetch(
      req("POST", `/submissions/${TOKEN}`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );

    expect(res.status).toBe(409);
    expect(repos.deckCheck.replaceEntryCards).not.toHaveBeenCalled();
  });

  it("409s replacing a submitted linked entry in on_submit mode", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals", listLockMode: "on_submit" }),
    );
    linkEntry(repos, entryRow({ state: "submitted" }));

    const res = await makeApp(repos).fetch(
      req("POST", `/submissions/${TOKEN}`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(409);
    expect(body.message).toBe(
      "Your deck is already submitted. Ask for it to be unlocked from your deck page.",
    );
  });

  it("409s a stranger whose previous self-submitted entry a judge detached", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals" }),
    );
    linkEntry(repos, undefined);
    repos.deckCheck.getEntryByExternalId.mockResolvedValue(entryRow({ claimedUserId: null }));

    const res = await makeApp(repos).fetch(
      req("POST", `/submissions/${TOKEN}`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(409);
    expect(body.message).toBe("A judge detached your previous submission. Contact a judge.");
    expect(repos.deckCheck.createEntry).not.toHaveBeenCalled();
  });

  it("404s when the account backing the session no longer exists", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals" }),
    );
    linkEntry(repos, undefined);
    repos.deckCheck.getEntryByExternalId.mockResolvedValue(undefined);
    repos.deckCheck.getUserAccount.mockResolvedValue(undefined);

    const res = await makeApp(repos).fetch(
      req("POST", `/submissions/${TOKEN}`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    const body = (await res.json()) as { message: string; code: string };

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toBe("Account not found");
  });

  it("409s a real submission once the window is closed, with its own message", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals", status: "archived" }),
    );
    linkEntry(repos, undefined);

    const res = await makeApp(repos).fetch(
      req("POST", `/submissions/${TOKEN}`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    const body = (await res.json()) as { message: string };

    expect(res.status).toBe(409);
    // Distinct wording from editList's "Submissions closed. Contact a judge." —
    // pinned so the two don't silently drift onto the same copy or vice versa.
    expect(body.message).toBe("Submissions are closed");
  });

  it("dry-runs even when the window is closed, since a preview never writes", async () => {
    // dryRun is checked before the submissionWindowOpen guard in submitToToken,
    // unlike every other mutation on this router.
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals", status: "archived" }),
    );

    const res = await makeApp(repos).fetch(
      req("POST", `/submissions/${TOKEN}`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
        dryRun: true,
      }),
    );

    expect(res.status).toBe(200);
  });
});

describe("POST /deck-check/claim/{token}", () => {
  it("404s an unknown claim token", async () => {
    const repos = makeRepos();
    repos.tournaments.getParticipantByClaimToken.mockResolvedValue(undefined);

    const res = await makeApp(repos).fetch(req("POST", `/claim/${TOKEN}`));
    const body = (await res.json()) as { message: string; code: string };

    expect(res.status).toBe(404);
    expect(body.code).toBe("NOT_FOUND");
    expect(body.message).toBe("Claim link not found");
  });
});

describe("a player who dropped or was marked no-show", () => {
  const LEFT_MESSAGE =
    "You're no longer playing in this event. Ask the host if you want to rejoin.";
  const LIST = { cards: [{ name: "Card", quantity: 1, section: "main" }] };

  function ownEntry(
    repos: ReturnType<typeof makeRepos>,
    participantStatus: string,
    state = "editable",
    event = deckEvent(),
  ) {
    const row = playerRow({ state, participantStatus });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForPlayerByTournament.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(event);
    repos.deckCheck.updateEntry.mockImplementation((_id: string, patch: Record<string, unknown>) =>
      Promise.resolve({ ...row, ...patch }),
    );
    return row;
  }

  function tokenSpot(
    repos: ReturnType<typeof makeRepos>,
    status: string,
    options: { allowSelfSubmission: boolean; linked?: unknown },
  ) {
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ allowSelfSubmission: options.allowSelfSubmission, groupName: "Noxus Locals" }),
    );
    repos.tournaments.getParticipantByUser.mockResolvedValue({
      id: "participant-1",
      tournamentId: TOURNAMENT_ID,
      userId: USER_ID,
      status,
    });
    repos.tournaments.resolveOrCreateParticipant.mockResolvedValue({
      id: "participant-1",
      status,
    } as never);
    repos.tournaments.getParticipantById.mockResolvedValue({ id: "participant-1", status });
    repos.deckCheck.getLinkedEntryForUser.mockResolvedValue(options.linked);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(options.linked);
    repos.deckCheck.getUserAccount.mockResolvedValue({
      id: USER_ID,
      name: "Player One",
      email: "player@example.com",
      riotId: null,
    });
    repos.deckCheck.createEntry.mockResolvedValue(entryRow({ state: "submitted" }));
    repos.deckCheck.updateEntry.mockImplementation((_id: string, patch: Record<string, unknown>) =>
      Promise.resolve({ ...entryRow(), ...patch }),
    );
  }

  async function expectRefused(res: Response) {
    const body = (await res.json()) as { message: string; code: string };
    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
    expect(body.message).toBe(LEFT_MESSAGE);
  }

  describe.each(["dropped", "no_show"])("with status %s", (status) => {
    it("refuses a deck through the join link while self-registration is open", async () => {
      const repos = makeRepos();
      tokenSpot(repos, status, { allowSelfSubmission: true });

      await expectRefused(await makeApp(repos).fetch(req("POST", `/submissions/${TOKEN}`, LIST)));
      expect(repos.tournaments.resolveOrCreateParticipant).not.toHaveBeenCalled();
      expect(repos.deckCheck.createEntry).not.toHaveBeenCalled();
    });

    it("refuses a deck through the join link while self-registration is closed", async () => {
      const repos = makeRepos();
      tokenSpot(repos, status, { allowSelfSubmission: false });

      await expectRefused(await makeApp(repos).fetch(req("POST", `/submissions/${TOKEN}`, LIST)));
      expect(repos.deckCheck.createEntry).not.toHaveBeenCalled();
    });

    it("refuses a join-link preview", async () => {
      const repos = makeRepos();
      tokenSpot(repos, status, { allowSelfSubmission: true });

      await expectRefused(
        await makeApp(repos).fetch(req("POST", `/submissions/${TOKEN}`, { ...LIST, dryRun: true })),
      );
    });

    it("refuses replacing an existing entry through the join link", async () => {
      const repos = makeRepos();
      tokenSpot(repos, status, {
        allowSelfSubmission: true,
        linked: entryRow({ state: "editable" }),
      });

      await expectRefused(await makeApp(repos).fetch(req("POST", `/submissions/${TOKEN}`, LIST)));
      expect(repos.deckCheck.replaceEntryCards).not.toHaveBeenCalled();
      expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
    });

    it("refuses replacing the deck from the deck page", async () => {
      const repos = makeRepos();
      ownEntry(repos, status);

      await expectRefused(await makeApp(repos).fetch(req("PUT", `/mine/${ENTRY_ID}/list`, LIST)));
      expect(repos.deckCheck.replaceEntryCards).not.toHaveBeenCalled();
    });

    it("refuses submitting the deck from the deck page", async () => {
      const repos = makeRepos();
      ownEntry(repos, status);

      await expectRefused(await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/submit`)));
      expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
    });

    it("refuses unlocking the deck from the deck page", async () => {
      const repos = makeRepos();
      ownEntry(repos, status, "submitted", deckEvent({ listLockMode: "at_deadline" }));

      await expectRefused(await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/unlock`)));
      expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
    });

    it("reports the deck page as read-only", async () => {
      const repos = makeRepos();
      ownEntry(repos, status, "submitted", deckEvent({ listLockMode: "at_deadline" }));

      const res = await makeApp(repos).fetch(req("GET", `/mine/tournament/${TOURNAMENT_ID}`));
      const body = (await res.json()) as { entry: Record<string, boolean> };

      expect(res.status).toBe(200);
      expect(body.entry).toMatchObject({
        leftEvent: true,
        windowOpen: true,
        canEdit: false,
        canUnlock: false,
        canRequestUnlock: false,
      });
    });
  });

  describe.each(["active", "requested", "invited"])("with status %s", (status) => {
    it("takes a deck through the join link", async () => {
      const repos = makeRepos();
      tokenSpot(repos, status, {
        allowSelfSubmission: false,
        linked: entryRow({ state: "editable" }),
      });

      const res = await makeApp(repos).fetch(req("POST", `/submissions/${TOKEN}`, LIST));
      expect(res.status).toBe(200);
      expect(repos.deckCheck.replaceEntryCards).toHaveBeenCalled();
    });

    it("submits the deck from the deck page", async () => {
      const repos = makeRepos();
      ownEntry(repos, status);

      const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/submit`));
      const body = (await res.json()) as { entry: { leftEvent: boolean } };
      expect(res.status).toBe(200);
      expect(body.entry.leftEvent).toBe(false);
    });
  });

  it("takes a deck again once the host brings the player back", async () => {
    const repos = makeRepos();
    tokenSpot(repos, "dropped", { allowSelfSubmission: true });
    await expectRefused(await makeApp(repos).fetch(req("POST", `/submissions/${TOKEN}`, LIST)));

    tokenSpot(repos, "active", { allowSelfSubmission: true });
    repos.deckCheck.listCardsForEntry.mockResolvedValue([cardRow()]);
    const res = await makeApp(repos).fetch(req("POST", `/submissions/${TOKEN}`, LIST));
    expect(res.status).toBe(200);
    expect(repos.deckCheck.createEntry).toHaveBeenCalledOnce();
  });
});

describe("a drop that lands while a player's write is in flight", () => {
  function staleActiveEntry(
    repos: ReturnType<typeof makeRepos>,
    state: string,
    event = deckEvent(),
  ) {
    const row = playerRow({ state, participantStatus: "active" });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(event);
    repos.tournaments.getParticipantById.mockResolvedValue({
      id: "participant-1",
      status: "dropped",
    });
  }

  async function expectRefusedUnderLock(repos: ReturnType<typeof makeRepos>, res: Response) {
    const body = (await res.json()) as { code: string };
    expect(res.status).toBe(403);
    expect(body.code).toBe("FORBIDDEN");
    expect(repos.tournaments.lockParticipant).toHaveBeenCalledWith("participant-1");
    expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
    expect(repos.deckCheck.replaceEntryCards).not.toHaveBeenCalled();
  }

  it("refuses the deck page's replace once the participant row says dropped", async () => {
    const repos = makeRepos();
    staleActiveEntry(repos, "editable");
    const res = await makeApp(repos).fetch(
      req("PUT", `/mine/${ENTRY_ID}/list`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    await expectRefusedUnderLock(repos, res);
  });

  it("refuses the deck page's submit once the participant row says dropped", async () => {
    const repos = makeRepos();
    staleActiveEntry(repos, "editable");
    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/submit`));
    await expectRefusedUnderLock(repos, res);
  });

  it("refuses a self-unlock once the participant row says dropped", async () => {
    const repos = makeRepos();
    staleActiveEntry(repos, "submitted", deckEvent({ listLockMode: "at_deadline" }));
    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/unlock`));
    await expectRefusedUnderLock(repos, res);
  });

  it("refuses an unlock request once the participant row says dropped", async () => {
    const repos = makeRepos();
    staleActiveEntry(repos, "approved");
    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/unlock`));
    await expectRefusedUnderLock(repos, res);
  });

  it("refuses a join-link replace once the participant row says dropped", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals" }),
    );
    repos.tournaments.getParticipantByUser.mockResolvedValue({
      id: "participant-1",
      status: "active",
    });
    const linked = entryRow({ state: "editable" });
    repos.deckCheck.getLinkedEntryForUser.mockResolvedValue(linked);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(linked);
    repos.tournaments.getParticipantById.mockResolvedValue({
      id: "participant-1",
      status: "no_show",
    });
    const res = await makeApp(repos).fetch(
      req("POST", `/submissions/${TOKEN}`, {
        cards: [{ name: "Card", quantity: 1, section: "main" }],
      }),
    );
    await expectRefusedUnderLock(repos, res);
  });
});

describe("the join-link page for a player who left", () => {
  it.each([
    ["dropped", true],
    ["no_show", true],
    ["active", false],
  ])("reports leftEvent for %s and only lets a current player replace", async (status, left) => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals", listLockMode: "at_deadline" }),
    );
    repos.tournaments.getParticipantByUser.mockResolvedValue({ id: "participant-1", status });
    repos.deckCheck.getLinkedEntryForUser.mockResolvedValue(entryRow({ state: "editable" }));

    const res = await makeApp(repos).fetch(req("GET", `/submissions/${TOKEN}`));
    const body = (await res.json()) as {
      leftEvent: boolean;
      linkedEntry: { canReplace: boolean } | null;
    };

    expect(res.status).toBe(200);
    expect(body.leftEvent).toBe(left);
    expect(body.linkedEntry?.canReplace).toBe(!left);
  });
});

describe("cancelling an unlock request after leaving", () => {
  it.each(["dropped", "no_show"])("refuses a %s player and leaves the request", async (status) => {
    const repos = makeRepos();
    const row = playerRow({
      state: "approved",
      unlockRequestedAt: now,
      participantStatus: status,
    });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    const res = await makeApp(repos).fetch(req("DELETE", `/mine/${ENTRY_ID}/unlock`));

    expect(res.status).toBe(403);
    expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
  });
});

describe("a cancel or an earlier deadline that lands while a save waits for the lock", () => {
  const LIST = { cards: [{ name: "Card", quantity: 1, section: "main" }] };
  const cancelled = deckEvent({ status: "archived" });
  const deadlinePassed = deckEvent({ submissionsCloseAt: PAST });

  function waitingSave(
    repos: ReturnType<typeof makeRepos>,
    state: string,
    lockedEvent: ReturnType<typeof deckEvent>,
    event = deckEvent(),
  ) {
    const row = playerRow({ state });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(event);
    repos.tournaments.lockRounds.mockImplementation(() => {
      repos.deckCheck.getEventById.mockResolvedValue(lockedEvent);
      return Promise.resolve();
    });
  }

  async function expectClosedUnderLock(
    repos: ReturnType<typeof makeRepos>,
    res: Response,
    message = "Submissions closed. Contact a judge.",
  ) {
    const body = (await res.json()) as { code: string; message: string };
    expect(res.status).toBe(409);
    expect(body.message).toBe(message);
    expect(repos.tournaments.lockRounds).toHaveBeenCalledWith(TOURNAMENT_ID);
    expect(repos.tournaments.lockParticipant).not.toHaveBeenCalled();
    expect(repos.deckCheck.updateEntry).not.toHaveBeenCalled();
    expect(repos.deckCheck.replaceEntryCards).not.toHaveBeenCalled();
    expect(repos.deckCheck.createEntry).not.toHaveBeenCalled();
  }

  it.each([
    ["a cancel", cancelled],
    ["an earlier deadline", deadlinePassed],
  ])("refuses the deck page's replace after %s", async (_label, lockedEvent) => {
    const repos = makeRepos();
    waitingSave(repos, "editable", lockedEvent);
    const res = await makeApp(repos).fetch(req("PUT", `/mine/${ENTRY_ID}/list`, LIST));
    await expectClosedUnderLock(repos, res);
  });

  it("refuses the deck page's submit after an earlier deadline", async () => {
    const repos = makeRepos();
    waitingSave(repos, "editable", deadlinePassed);
    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/submit`));
    await expectClosedUnderLock(repos, res);
  });

  it("refuses a self-unlock after a cancel", async () => {
    const repos = makeRepos();
    waitingSave(
      repos,
      "submitted",
      { ...cancelled, listLockMode: "at_deadline" },
      deckEvent({ listLockMode: "at_deadline" }),
    );
    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/unlock`));
    await expectClosedUnderLock(repos, res);
  });

  it("refuses a self-unlock once the host switched the list lock to on submit", async () => {
    const repos = makeRepos();
    waitingSave(
      repos,
      "submitted",
      deckEvent({ listLockMode: "on_submit" }),
      deckEvent({ listLockMode: "at_deadline" }),
    );
    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/unlock`));
    await expectClosedUnderLock(
      repos,
      res,
      "The deck's state changed in the meantime. Reload and try again.",
    );
  });

  it("refuses an unlock request after an earlier deadline", async () => {
    const repos = makeRepos();
    waitingSave(repos, "approved", deadlinePassed);
    const res = await makeApp(repos).fetch(req("POST", `/mine/${ENTRY_ID}/unlock`));
    await expectClosedUnderLock(repos, res);
  });

  it("refuses a join-link submission after a cancel", async () => {
    const repos = makeRepos();
    repos.deckCheck.getEventBySubmissionToken.mockResolvedValue(
      deckEvent({ groupName: "Noxus Locals" }),
    );
    repos.tournaments.lockRounds.mockImplementation(() => {
      repos.deckCheck.getEventById.mockResolvedValue(cancelled);
      return Promise.resolve();
    });
    const res = await makeApp(repos).fetch(req("POST", `/submissions/${TOKEN}`, LIST));
    await expectClosedUnderLock(repos, res, "Submissions are closed");
    expect(repos.deckCheck.lockSelfSubmission).not.toHaveBeenCalled();
  });

  it("resolves the list, then takes the tournament lock before any row lock", async () => {
    const repos = makeRepos();
    const row = playerRow({ state: "editable" });
    repos.deckCheck.getEntryForPlayer.mockResolvedValue(row);
    repos.deckCheck.getEntryForUpdate.mockResolvedValue(row);
    repos.deckCheck.getEventById.mockResolvedValue(deckEvent());

    await makeApp(repos).fetch(req("PUT", `/mine/${ENTRY_ID}/list`, LIST));

    const [resolved] = repos.catalog.cards.mock.invocationCallOrder;
    const [locked] = repos.tournaments.lockRounds.mock.invocationCallOrder;
    const [participantLocked] = repos.tournaments.lockParticipant.mock.invocationCallOrder;
    const [entryLocked] = repos.deckCheck.getEntryForUpdate.mock.invocationCallOrder;
    expect(resolved).toBeLessThan(locked ?? 0);
    expect(locked).toBeLessThan(participantLocked ?? 0);
    expect(participantLocked).toBeLessThan(entryLocked ?? 0);
  });
});
