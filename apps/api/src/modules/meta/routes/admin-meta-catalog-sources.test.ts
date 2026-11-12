import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import type * as runJob from "../../system/services/run-job.js";
import type * as metaSync from "../services/meta-sync/index.js";
import { adminMetaCatalogRouter } from "./admin-meta-catalog";

const sync = vi.hoisted(() => ({
  acceptCatalogEvent: vi.fn(),
  acceptPlayloltcgEvent: vi.fn(),
  acceptTopdeckEvent: vi.fn(),
  acceptPlayriftboundEvent: vi.fn(),
  autoAcceptCatalogBacklog: vi.fn(() => Promise.resolve({})),
  autoAcceptPlayloltcgBacklog: vi.fn(() => Promise.resolve({})),
  autoAcceptTopdeckBacklog: vi.fn(() => Promise.resolve({})),
  autoAcceptPlayriftboundBacklog: vi.fn(() => Promise.resolve({})),
  backfillCatalog: vi.fn(() => Promise.resolve({})),
  backfillPlayloltcg: vi.fn(() => Promise.resolve({})),
  backfillTopdeck: vi.fn(() => Promise.resolve({})),
  backfillPlayriftbound: vi.fn(() => Promise.resolve({})),
  processRechecks: vi.fn(() => Promise.resolve({})),
  processPlayloltcgRechecks: vi.fn(() => Promise.resolve({})),
  processPlayriftboundRechecks: vi.fn(() => Promise.resolve({})),
  fetchEventNow: vi.fn(() => Promise.resolve({})),
  fetchPlayloltcgEvent: vi.fn(() => Promise.resolve({})),
  fetchPlayriftboundEvent: vi.fn(() => Promise.resolve({})),
}));

const factories = vi.hoisted(() => ({
  createMetaSyncDeps: vi.fn(),
  createPlayloltcgSyncDeps: vi.fn(),
  createTopdeckSyncDeps: vi.fn(),
  createPlayriftboundSyncDeps: vi.fn(),
}));

const { runJobAsync } = vi.hoisted(() => ({
  runJobAsync: vi.fn(
    (
      _deps: unknown,
      _kind: string,
      _trigger: string,
      work: (runId: string) => Promise<unknown>,
      _options?: unknown,
    ) => {
      void work("run-1");
      return Promise.resolve({ runId: "run-1", status: "running" as const });
    },
  ),
}));

vi.mock("../services/meta-sync/index.js", async (importOriginal) => {
  const original = await importOriginal<typeof metaSync>();
  factories.createMetaSyncDeps.mockImplementation(original.createMetaSyncDeps);
  factories.createPlayloltcgSyncDeps.mockImplementation(original.createPlayloltcgSyncDeps);
  factories.createTopdeckSyncDeps.mockImplementation(original.createTopdeckSyncDeps);
  factories.createPlayriftboundSyncDeps.mockImplementation(original.createPlayriftboundSyncDeps);
  return { ...original, ...sync, ...factories };
});

vi.mock("../../system/services/run-job.js", async (importOriginal) => ({
  ...(await importOriginal<typeof runJob>()),
  runJobAsync,
}));

function eventsRepo() {
  return {
    list: vi.fn((..._args: unknown[]) => Promise.resolve({ rows: [], total: 0 })),
    bucketCounts: vi.fn(() => Promise.resolve(null)),
    byKey: vi.fn(),
    settings: vi.fn(),
    formatMappings: vi.fn(() => Promise.resolve(new Map())),
    watchedTemplates: vi.fn(() => Promise.resolve([])),
  };
}

const uvsgamesEvents = eventsRepo();
const playloltcgEvents = eventsRepo();
const topdeckEvents = eventsRepo();
const playriftboundEvents = eventsRepo();
const jobRuns = { getLatestForResume: vi.fn() };
const metaOverlays = {
  ignoreEvent: vi.fn(),
  unignoreEvent: vi.fn(),
  ignoreEvents: vi.fn(),
  claimIgnoreEvent: vi.fn(() => Promise.resolve(true)),
};
const meta = {
  sourceKeyUntriaged: vi.fn(() => Promise.resolve(true)),
  withPromoteLock: vi.fn((_key: string, run: (repos: unknown) => Promise<unknown>) =>
    run(requestRepos),
  ),
};
const adminEvents = { insert: vi.fn() };
const scheduler = { runNow: vi.fn(), isEnabled: vi.fn(() => false) };

const requestRepos = {
  uvsgamesEvents,
  playloltcgEvents,
  topdeckEvents,
  playriftboundEvents,
  jobRuns,
  metaOverlays,
  meta,
  adminEvents,
};
const backgroundRepos = { ...requestRepos };
const requestTransact = vi.fn();
const backgroundTransact = vi.fn();

const USER_ID = "a0000000-0001-4000-a000-000000000001";
const BASE = "/api/admin/v1/meta/catalogue";
const RULE = { autoAcceptMinPlayers: 16, autoAcceptOfficial: false, autoAcceptNotable: false };

const META_SYNC = {
  baseUrl: "https://uvsgames.example.invalid",
  playloltcgBaseUrl: "https://playloltcg.example.invalid",
  topdeckBaseUrl: "https://topdeck.example.invalid",
  topdeckApiKey: "topdeck-key" as string | undefined,
  playriftboundBaseUrl: "https://playriftbound.example.invalid",
};

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("user", { id: USER_ID } as never);
  c.set("repos", requestRepos as never);
  c.set("transact", requestTransact as never);
  c.set("backgroundRepos", backgroundRepos as never);
  c.set("backgroundTransact", backgroundTransact as never);
  c.set("config", { metaSync: META_SYNC } as never);
  c.set("io", { fetch: vi.fn() } as never);
  c.set("scheduler", scheduler as never);
  await next();
});
registerRouterForTest(app, adminMetaCatalogRouter);

async function post(path: string, body?: unknown): Promise<Response> {
  return await app.request(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

interface SourceCase {
  source: string;
  factory: ReturnType<typeof vi.fn>;
  env: Record<string, unknown>;
  events: ReturnType<typeof eventsRepo>;
  paths: { accept: string; dismiss: string; undismiss: string; fetch?: string };
  body: Record<string, unknown>;
  key: string | number;
  externalId: string;
  accept: ReturnType<typeof vi.fn>;
  acceptArgs: unknown[];
  dismissStatus: number;
  fetch?: { kind: string; fn: ReturnType<typeof vi.fn>; withRunId: boolean; status: number };
}

const CASES: SourceCase[] = [
  {
    source: "uvsgames",
    factory: factories.createMetaSyncDeps,
    env: { baseUrl: META_SYNC.baseUrl },
    events: uvsgamesEvents,
    paths: {
      accept: "/accept",
      dismiss: "/dismiss",
      undismiss: "/undismiss",
      fetch: "/sync/fetch",
    },
    body: { externalId: "ev-7" },
    key: "ev-7",
    externalId: "ev-7",
    accept: sync.acceptCatalogEvent,
    acceptArgs: [{ format: undefined }],
    dismissStatus: 204,
    fetch: {
      kind: "meta.uvsgames_event_fetch",
      fn: sync.fetchEventNow,
      withRunId: true,
      status: 200,
    },
  },
  {
    source: "playloltcg",
    factory: factories.createPlayloltcgSyncDeps,
    env: { baseUrl: META_SYNC.playloltcgBaseUrl },
    events: playloltcgEvents,
    paths: {
      accept: "/playloltcg/events/accept",
      dismiss: "/playloltcg/events/dismiss",
      undismiss: "/playloltcg/events/undismiss",
      fetch: "/playloltcg/events/fetch",
    },
    body: { activityShopId: 4242 },
    key: 4242,
    externalId: "4242",
    accept: sync.acceptPlayloltcgEvent,
    acceptArgs: [],
    dismissStatus: 200,
    fetch: {
      kind: "meta.playloltcg_event_fetch",
      fn: sync.fetchPlayloltcgEvent,
      withRunId: false,
      status: 202,
    },
  },
  {
    source: "topdeck",
    factory: factories.createTopdeckSyncDeps,
    env: { baseUrl: META_SYNC.topdeckBaseUrl, apiKey: "topdeck-key" },
    events: topdeckEvents,
    paths: {
      accept: "/topdeck/events/accept",
      dismiss: "/topdeck/events/dismiss",
      undismiss: "/topdeck/events/undismiss",
    },
    body: { tid: "summoner-skirmish" },
    key: "summoner-skirmish",
    externalId: "summoner-skirmish",
    accept: sync.acceptTopdeckEvent,
    acceptArgs: [],
    dismissStatus: 200,
  },
  {
    source: "playriftbound",
    factory: factories.createPlayriftboundSyncDeps,
    env: { baseUrl: META_SYNC.playriftboundBaseUrl },
    events: playriftboundEvents,
    paths: {
      accept: "/playriftbound/events/accept",
      dismiss: "/playriftbound/events/dismiss",
      undismiss: "/playriftbound/events/undismiss",
      fetch: "/playriftbound/events/fetch",
    },
    body: { tournamentId: "t-99" },
    key: "t-99",
    externalId: "t-99",
    accept: sync.acceptPlayriftboundEvent,
    acceptArgs: [],
    dismissStatus: 200,
    fetch: {
      kind: "meta.playriftbound_event_fetch",
      fn: sync.fetchPlayriftboundEvent,
      withRunId: false,
      status: 202,
    },
  },
];

function rowFor(c: SourceCase, overrides: Record<string, unknown> = {}) {
  const keyField = Object.keys(c.body)[0] ?? "key";
  return {
    [keyField]: c.key,
    name: "Summoner Skirmish",
    triage: "new",
    metaEventId: null,
    ...overrides,
  };
}

function lastDeps(fn: ReturnType<typeof vi.fn>): { repos: unknown; transact: unknown } {
  return fn.mock.calls.at(-1)?.[0] as { repos: unknown; transact: unknown };
}

beforeEach(() => {
  vi.clearAllMocks();
  jobRuns.getLatestForResume.mockResolvedValue(null);
  uvsgamesEvents.settings.mockResolvedValue(RULE);
});

describe.each(CASES)("$source event writes", (c) => {
  it("accepts on the request pool and audits the provider key", async () => {
    const row = rowFor(c);
    c.events.byKey.mockResolvedValue(row);
    c.accept.mockResolvedValue({ metaEventId: "live-1", slug: "summoner-skirmish", created: true });

    const res = await post(c.paths.accept, c.body);

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      metaEventId: "live-1",
      slug: "summoner-skirmish",
      created: true,
    });
    expect(c.events.byKey).toHaveBeenCalledWith(c.key);
    expect(c.accept).toHaveBeenCalledWith(expect.anything(), row, ...c.acceptArgs);
    expect(lastDeps(c.accept).repos).toBe(requestRepos);
    expect(lastDeps(c.accept).transact).toBe(requestTransact);
    expect(adminEvents.insert).toHaveBeenCalledTimes(1);
    expect(adminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER_ID,
        action: "meta-catalog.accept",
        entityType: "meta-catalog",
        entityId: `${c.source}:${c.externalId}`,
        entityLabel: "Summoner Skirmish",
        newValues: { metaEventId: "live-1", slug: "summoner-skirmish" },
      }),
    );
  });

  it("builds the source's deps from its own config", async () => {
    c.events.byKey.mockResolvedValue(rowFor(c));
    c.accept.mockResolvedValue({ metaEventId: "live-1", slug: "s", created: true });

    await post(c.paths.accept, c.body);

    expect(c.factory).toHaveBeenCalledTimes(1);
    const env = c.factory.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(env).toSorted()).toEqual(
      ["repos", "transact", "fetch", "log", ...Object.keys(c.env)].toSorted(),
    );
    expect(env).toMatchObject({ repos: requestRepos, transact: requestTransact, ...c.env });
  });

  it("404s an accept for a key the mirror does not carry", async () => {
    c.events.byKey.mockResolvedValue(undefined);

    const res = await post(c.paths.accept, c.body);

    expect(res.status).toBe(404);
    expect(await readJson(res)).toMatchObject({
      code: "NOT_FOUND",
      message: "Mirrored event not found",
    });
    expect(c.accept).not.toHaveBeenCalled();
    expect(adminEvents.insert).not.toHaveBeenCalled();
  });

  it("rejects an accept without the source's key", async () => {
    const res = await post(c.paths.accept, {});

    expect(res.status).toBe(400);
    expect(c.events.byKey).not.toHaveBeenCalled();
  });

  it("dismisses under the provider and audits it", async () => {
    c.events.byKey.mockResolvedValue(rowFor(c));

    const res = await post(c.paths.dismiss, c.body);

    expect(res.status).toBe(c.dismissStatus);
    expect(metaOverlays.claimIgnoreEvent).toHaveBeenCalledWith(c.source, c.externalId);
    expect(adminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "meta-catalog.dismiss",
        entityType: "meta-catalog",
        entityId: `${c.source}:${c.externalId}`,
        entityLabel: "Summoner Skirmish",
      }),
    );
  });

  it.each(["accepted", "dismissed"])("409s an accept of a %s row", async (triage) => {
    c.events.byKey.mockResolvedValue(rowFor(c, { triage }));

    const res = await post(c.paths.accept, c.body);

    expect(res.status).toBe(409);
    expect(await readJson(res)).toMatchObject({ code: "CONFLICT" });
    expect(c.accept).not.toHaveBeenCalled();
    expect(adminEvents.insert).not.toHaveBeenCalled();
  });

  it.each(["accepted", "dismissed"])("409s a dismiss of a %s row", async (triage) => {
    c.events.byKey.mockResolvedValue(rowFor(c, { triage }));

    const res = await post(c.paths.dismiss, c.body);

    expect(res.status).toBe(409);
    expect(metaOverlays.claimIgnoreEvent).not.toHaveBeenCalled();
    expect(adminEvents.insert).not.toHaveBeenCalled();
  });

  it("409s the accept that loses a race for the same event, and audits only the winner", async () => {
    c.events.byKey.mockResolvedValue(rowFor(c));
    meta.sourceKeyUntriaged.mockResolvedValueOnce(false);

    const res = await post(c.paths.accept, c.body);

    expect(res.status).toBe(409);
    expect(meta.withPromoteLock).toHaveBeenCalledWith(
      `source:${c.source}:${c.externalId}`,
      expect.any(Function),
    );
    expect(c.accept).not.toHaveBeenCalled();
    expect(adminEvents.insert).not.toHaveBeenCalled();
  });

  it("409s the dismiss that loses a race for the same event, and audits nothing", async () => {
    c.events.byKey.mockResolvedValue(rowFor(c));
    metaOverlays.claimIgnoreEvent.mockResolvedValueOnce(false);

    const res = await post(c.paths.dismiss, c.body);

    expect(res.status).toBe(409);
    expect(adminEvents.insert).not.toHaveBeenCalled();
  });

  it("404s a dismiss for a key the mirror does not carry", async () => {
    c.events.byKey.mockResolvedValue(undefined);

    const res = await post(c.paths.dismiss, c.body);

    expect(res.status).toBe(404);
    expect(metaOverlays.claimIgnoreEvent).not.toHaveBeenCalled();
  });

  it("undismisses without reading the mirror and audits it", async () => {
    metaOverlays.unignoreEvent.mockResolvedValue(true);

    const res = await post(c.paths.undismiss, c.body);

    expect(res.status).toBe(c.dismissStatus);
    expect(c.events.byKey).not.toHaveBeenCalled();
    expect(metaOverlays.unignoreEvent).toHaveBeenCalledWith(c.source, c.externalId);
    const audit = adminEvents.insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(audit).toMatchObject({
      action: "meta-catalog.undismiss",
      entityType: "meta-catalog",
      entityId: `${c.source}:${c.externalId}`,
    });
    expect(audit.entityLabel ?? null).toBeNull();
  });

  it("404s an undismiss for a key that was never dismissed", async () => {
    metaOverlays.unignoreEvent.mockResolvedValue(false);

    const res = await post(c.paths.undismiss, c.body);

    expect(res.status).toBe(404);
    expect(adminEvents.insert).not.toHaveBeenCalled();
  });

  it("publishes a bulk selection through the same accept on the request pool", async () => {
    const row = rowFor(c);
    c.events.byKey.mockResolvedValue(row);
    c.accept.mockResolvedValue({ metaEventId: "live-1", slug: "s", created: true });

    const res = await post("/bulk/publish", { source: c.source, keys: [String(c.key)] });

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ published: [String(c.key)], skipped: 0 });
    expect(c.events.byKey).toHaveBeenCalledWith(c.key);
    expect(c.accept).toHaveBeenCalledWith(expect.anything(), row, ...c.acceptArgs.map(() => ({})));
    expect(lastDeps(c.accept).repos).toBe(requestRepos);
    expect(adminEvents.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "meta-catalog.accept-bulk", entityId: c.source }),
    );
  });
});

describe.each(CASES.filter((c) => c.fetch !== undefined))("$source event fetch", (c) => {
  const fetch = c.fetch!;

  it("starts the fetch job on the background pool", async () => {
    const row = rowFor(c, { triage: "accepted", metaEventId: "live-1" });
    c.events.byKey.mockResolvedValue(row);

    const res = await post(c.paths.fetch!, c.body);

    expect(res.status).toBe(fetch.status);
    expect(await readJson(res)).toEqual({
      status: "running",
      runId: "run-1",
      message: null,
      result: null,
    });
    expect(runJobAsync).toHaveBeenCalledWith(
      { repos: backgroundRepos, log: expect.anything() },
      fetch.kind,
      "admin",
      expect.any(Function),
      { summarize: expect.any(Function), classifyNoop: undefined },
    );
    const args: unknown[] = [expect.anything(), row];
    if (fetch.withRunId) {
      args.push("run-1");
    }
    expect(fetch.fn).toHaveBeenCalledWith(...args);
    expect(fetch.fn.mock.calls[0]).toHaveLength(args.length);
    expect(lastDeps(fetch.fn).repos).toBe(backgroundRepos);
    expect(lastDeps(fetch.fn).transact).toBe(backgroundTransact);
    expect(adminEvents.insert).not.toHaveBeenCalled();
  });

  it("refuses an event nobody has published yet", async () => {
    c.events.byKey.mockResolvedValue(rowFor(c));

    const res = await post(c.paths.fetch!, c.body);

    expect(res.status).toBe(400);
    expect(await readJson(res)).toMatchObject({
      code: "BAD_REQUEST",
      message: "Publish this event before collecting its results.",
    });
    expect(runJobAsync).not.toHaveBeenCalled();
  });

  it("404s a key the mirror does not carry", async () => {
    c.events.byKey.mockResolvedValue(undefined);

    const res = await post(c.paths.fetch!, c.body);

    expect(res.status).toBe(404);
    expect(runJobAsync).not.toHaveBeenCalled();
  });
});

describe.each([
  ["/sync/daily", "meta.uvsgames_sync"],
  ["/playloltcg/sync", "meta.playloltcg_sync"],
  ["/topdeck/sync", "meta.topdeck_sync"],
  ["/playriftbound/sync", "meta.playriftbound_sync"],
])("POST %s", (path, kind) => {
  it("hands the run to the scheduler", async () => {
    scheduler.runNow.mockResolvedValue({ runId: "run-9", status: "running" });

    const res = await post(path);

    expect(res.status).toBe(202);
    expect(scheduler.runNow).toHaveBeenCalledWith(kind);
    expect(runJobAsync).not.toHaveBeenCalled();
  });
});

const JOB_CASES = [
  {
    path: "/sync/backfill",
    restart: "/sync/backfill/restart",
    kind: "meta.uvsgames_backfill",
    fn: sync.backfillCatalog,
    covered: "2026-03-01T00:00:00.000Z",
    resumeFrom: new Date("2026-03-01T00:00:00.000Z"),
  },
  {
    path: "/playloltcg/backfill",
    restart: "/playloltcg/backfill/restart",
    kind: "meta.playloltcg_backfill",
    fn: sync.backfillPlayloltcg,
    covered: "2026-03-01T00:00:00.000Z",
    resumeFrom: new Date("2026-03-01T00:00:00.000Z"),
  },
  {
    path: "/topdeck/backfill",
    restart: "/topdeck/backfill/restart",
    kind: "meta.topdeck_backfill",
    fn: sync.backfillTopdeck,
    covered: "2026-03-01T00:00:00.000Z",
    resumeFrom: new Date("2026-03-01T00:00:00.000Z"),
  },
  {
    path: "/playriftbound/backfill",
    restart: "/playriftbound/backfill/restart",
    kind: "meta.playriftbound_backfill",
    fn: sync.backfillPlayriftbound,
    covered: "42",
    resumeFrom: 42,
  },
];

describe.each(JOB_CASES)("POST $path", (c) => {
  const checkpoint = {
    complete: false,
    cancelRequested: false,
    rows: 1,
    coveredThrough: c.covered,
  };

  it("resumes from the last checkpoint on the background pool", async () => {
    jobRuns.getLatestForResume.mockResolvedValue({ result: checkpoint });

    const res = await post(c.path);

    expect(res.status).toBe(202);
    expect(jobRuns.getLatestForResume).toHaveBeenCalledWith(c.kind);
    expect(runJobAsync).toHaveBeenCalledWith(
      { repos: backgroundRepos, log: expect.anything() },
      c.kind,
      "admin",
      expect.any(Function),
      { summarize: expect.any(Function), classifyNoop: expect.any(Function) },
    );
    expect(c.fn).toHaveBeenCalledWith(expect.anything(), "run-1", { resumeFrom: c.resumeFrom });
    expect(lastDeps(c.fn).repos).toBe(backgroundRepos);
  });

  it("starts fresh when no checkpoint is stored", async () => {
    await post(c.path);

    expect(c.fn).toHaveBeenCalledWith(expect.anything(), "run-1", { resumeFrom: undefined });
  });

  it("restarts without reading the checkpoint", async () => {
    jobRuns.getLatestForResume.mockResolvedValue({ result: checkpoint });

    const res = await post(c.restart);

    expect(res.status).toBe(202);
    expect(jobRuns.getLatestForResume).not.toHaveBeenCalled();
    expect(c.fn).toHaveBeenCalledWith(expect.anything(), "run-1");
    expect(c.fn.mock.calls[0]).toHaveLength(2);
  });
});

it("sends an empty topdeck key when none is configured", async () => {
  META_SYNC.topdeckApiKey = undefined;
  try {
    await post("/topdeck/auto-accept");
  } finally {
    META_SYNC.topdeckApiKey = "topdeck-key";
  }

  expect(factories.createTopdeckSyncDeps).toHaveBeenCalledWith(
    expect.objectContaining({ repos: backgroundRepos, transact: backgroundTransact, apiKey: "" }),
  );
});

it("skips a playloltcg bulk key that is not an id without reading the mirror", async () => {
  const res = await post("/bulk/publish", { source: "playloltcg", keys: ["abc", "1.5"] });

  expect(await readJson(res)).toEqual({ published: [], skipped: 2 });
  expect(playloltcgEvents.byKey).not.toHaveBeenCalled();
});

it("undismiss 404s with the ignore entry message", async () => {
  metaOverlays.unignoreEvent.mockResolvedValue(false);

  const res = await post("/topdeck/events/undismiss", { tid: "gone" });

  expect(await readJson(res)).toMatchObject({
    code: "NOT_FOUND",
    message: "Ignore entry not found",
  });
});

it("ignores a playriftbound checkpoint that is not a cell index", async () => {
  jobRuns.getLatestForResume.mockResolvedValue({
    result: { complete: false, cancelRequested: false, rows: 1, coveredThrough: "2026-03-01" },
  });

  await post("/playriftbound/backfill");

  expect(sync.backfillPlayriftbound).toHaveBeenCalledWith(expect.anything(), "run-1", {
    resumeFrom: undefined,
  });
});

describe.each([
  ["/sync/auto-accept", "meta.uvsgames_auto_accept", sync.autoAcceptCatalogBacklog],
  ["/playloltcg/auto-accept", "meta.playloltcg_auto_accept", sync.autoAcceptPlayloltcgBacklog],
  ["/topdeck/auto-accept", "meta.topdeck_auto_accept", sync.autoAcceptTopdeckBacklog],
  [
    "/playriftbound/auto-accept",
    "meta.playriftbound_auto_accept",
    sync.autoAcceptPlayriftboundBacklog,
  ],
])("POST %s", (path, kind, fn) => {
  it("sweeps the backlog on the background pool and counts an empty sweep as a no-op", async () => {
    const res = await post(path);

    expect(res.status).toBe(202);
    expect(runJobAsync).toHaveBeenCalledWith(
      { repos: backgroundRepos, log: expect.anything() },
      kind,
      "admin",
      expect.any(Function),
      { summarize: expect.any(Function), classifyNoop: expect.any(Function) },
    );
    expect(fn).toHaveBeenCalledWith(expect.anything(), "run-1");
    expect(lastDeps(fn).repos).toBe(backgroundRepos);
    const options = runJobAsync.mock.calls[0]?.[4] as unknown as {
      classifyNoop: (summary: Record<string, number>) => boolean;
    };
    expect(options.classifyNoop({ accepted: 0, failed: 0 })).toBe(true);
    expect(options.classifyNoop({ accepted: 0, failed: 0, held: 1 })).toBe(false);
    expect(options.classifyNoop({ accepted: 1, failed: 0 })).toBe(false);
  });
});

describe.each([
  [
    "/sync/recheck",
    "meta.uvsgames_recheck",
    sync.processRechecks,
    { runId: "run-1", listing: true },
  ],
  [
    "/playloltcg/recheck",
    "meta.playloltcg_recheck",
    sync.processPlayloltcgRechecks,
    { runId: "run-1", listing: true },
  ],
  [
    "/playriftbound/recheck",
    "meta.playriftbound_recheck",
    sync.processPlayriftboundRechecks,
    { runId: "run-1", rearm: true },
  ],
])("POST %s", (path, kind, fn, options) => {
  it("runs the recheck on the background pool with the source's own options", async () => {
    const res = await post(path);

    expect(res.status).toBe(202);
    expect(runJobAsync).toHaveBeenCalledWith(
      { repos: backgroundRepos, log: expect.anything() },
      kind,
      "admin",
      expect.any(Function),
      { summarize: expect.any(Function), classifyNoop: expect.any(Function) },
    );
    expect(fn).toHaveBeenCalledWith(expect.anything(), options);
    expect(lastDeps(fn).repos).toBe(backgroundRepos);
  });
});

describe("catalogue lists", () => {
  it("pages the uvsgames mirror with its vocabulary and date filters", async () => {
    const res = await app.request(
      `${BASE}?page=3&limit=20&search=nexus&displayStatus=complete&decklistPublished=true&minPlayers=8&dateFrom=2026-08-01T00:00:00.000Z&triage=new&missing=true&bucket=collecting&sort=name&direction=asc`,
    );

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ rows: [], total: 0, page: 3, limit: 20, buckets: null });
    const filters = {
      search: "nexus",
      displayStatus: "complete",
      decklistPublished: true,
      minPlayers: 8,
      dateFrom: new Date("2026-08-01T00:00:00.000Z"),
      dateTo: undefined,
      triage: "new",
      missing: true,
      bucket: { name: "collecting", rule: RULE },
    };
    expect(uvsgamesEvents.list).toHaveBeenCalledWith(
      filters,
      { limit: 20, offset: 40 },
      { sort: "name", direction: "asc" },
    );
    expect(uvsgamesEvents.bucketCounts).toHaveBeenCalledWith(filters, RULE);
    expect(uvsgamesEvents.formatMappings).toHaveBeenCalled();
    expect(uvsgamesEvents.watchedTemplates).toHaveBeenCalled();
  });

  it("defaults to the first page of fifty", async () => {
    const res = await app.request(`${BASE}/topdeck/events`);

    expect(await readJson(res)).toEqual({ rows: [], total: 0, page: 1, limit: 50, buckets: null });
    expect(topdeckEvents.list).toHaveBeenCalledWith(
      {
        search: undefined,
        triage: undefined,
        format: undefined,
        minPlayers: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        missing: undefined,
        bucket: undefined,
      },
      { limit: 50, offset: 0 },
      { sort: undefined, direction: undefined },
    );
  });

  it("carries the topdeck format filter", async () => {
    await app.request(`${BASE}/topdeck/events?format=constructed&dateFrom=2026-08-01`);

    expect(topdeckEvents.list).toHaveBeenCalledWith(
      expect.objectContaining({ format: "constructed", dateFrom: "2026-08-01" }),
      expect.anything(),
      expect.anything(),
    );
    expect(uvsgamesEvents.formatMappings).not.toHaveBeenCalled();
  });

  it("carries the playriftbound tournament type and format filters", async () => {
    const res = await app.request(
      `${BASE}/playriftbound/events?tournamentType=NEXUS_NIGHT&format=CONSTRUCTED&bucket=final`,
    );

    expect(res.status).toBe(200);
    const filters = playriftboundEvents.list.mock.calls[0]?.[0];
    expect(filters).toMatchObject({
      tournamentType: "NEXUS_NIGHT",
      format: "CONSTRUCTED",
      bucket: { name: "final", rule: RULE },
    });
    expect(playriftboundEvents.bucketCounts).toHaveBeenCalledWith(filters, RULE);
  });
});
