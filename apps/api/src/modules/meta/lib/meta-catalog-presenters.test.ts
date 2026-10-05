import { describe, expect, it } from "vitest";

import type { JobRun } from "../../system/repositories/job-runs.js";
import type { UvsgamesCoverageRow, UvsgamesTemplateRow } from "../repositories/uvsgames-events.js";
import {
  toMetaCatalogRow,
  toMetaSourceTemplate,
  toMetaSyncCatalog,
  toMetaSyncRun,
  toMetaSyncSettings,
} from "./meta-catalog-presenters.js";

const WATCHED = "0cbcab3e-be80-4d1d-a450-9485e584906d";
const UNWATCHED = "f0c650f5-ab18-4d69-8112-19e5cff8b7b2";

const VOCABULARY = {
  formatMappings: new Map([["constructed", "constructed"]]),
  watchedTemplates: new Map([[WATCHED, "Regional Qualifier"]]),
};

function row(overrides: Partial<UvsgamesCoverageRow> = {}): UvsgamesCoverageRow {
  return {
    externalId: "4821",
    name: "Summoner Skirmish Regional",
    startAt: new Date("2026-08-15T18:00:00Z"),
    endAtEstimate: null,
    displayStatus: "complete",
    decklistStatus: "PUBLISHED",
    playerCount: 128,
    eventType: "LOCALS",
    eventFormat: "CONSTRUCTED",
    storeId: 19_428,
    storeName: "The Rift Room",
    storeDisplayName: "The Rift Room",
    location: "Piltover, Valoran",
    timezone: "America/New_York",
    contentHash: "abc",
    resultsFetchedAt: null,
    eventConfigurationTemplate: null,
    firstSeenAt: new Date("2026-08-01T00:00:00Z"),
    lastSeenAt: new Date("2026-08-20T00:00:00Z"),
    missingSince: null,
    missingProbe: null,
    nextCheckAt: null,
    checkStage: 0,
    triage: "new",
    metaEventId: null,
    metaEventSlug: null,
    fetchedAt: null,
    stagedPlayerCount: 0,
    stagedLegendCount: 0,
    stagedDeckCount: 0,
    ...overrides,
  };
}

describe("toMetaCatalogRow", () => {
  it("serializes every timestamp and derives the mapped format and source URL", () => {
    const presented = toMetaCatalogRow(row(), VOCABULARY);

    expect(presented).toMatchObject({
      externalId: "4821",
      startAt: "2026-08-15T18:00:00.000Z",
      endAtEstimate: null,
      lastSeenAt: "2026-08-20T00:00:00.000Z",
      mappedFormat: "constructed",
      sourceUrl: "https://locator.riftbound.uvsgames.com/events/4821",
      triage: "new",
    });
  });

  it("labels a watched template's event and keeps the uuid off the wire", () => {
    const presented = toMetaCatalogRow(row({ eventConfigurationTemplate: WATCHED }), VOCABULARY);

    expect(presented.officialLabel).toBe("Regional Qualifier");
    expect(JSON.stringify(presented)).not.toContain(WATCHED);
  });

  it("leaves the label off a watched template the source stopped naming", () => {
    const vocabulary = { ...VOCABULARY, watchedTemplates: new Map([[WATCHED, null]]) };

    expect(
      toMetaCatalogRow(row({ eventConfigurationTemplate: WATCHED }), vocabulary).officialLabel,
    ).toBeNull();
  });

  it("leaves an ordinary event unlabelled, template or not", () => {
    expect(toMetaCatalogRow(row(), VOCABULARY).officialLabel).toBeNull();
    expect(
      toMetaCatalogRow(row({ eventConfigurationTemplate: UNWATCHED }), VOCABULARY).officialLabel,
    ).toBeNull();
  });

  it("reports no mapped format for a source format the archive cannot file", () => {
    expect(toMetaCatalogRow(row({ eventFormat: "SEALED" }), VOCABULARY).mappedFormat).toBeNull();
    expect(toMetaCatalogRow(row({ eventFormat: null }), VOCABULARY).mappedFormat).toBeNull();
  });

  it("carries the live link through for an accepted row", () => {
    const presented = toMetaCatalogRow(
      row({
        triage: "accepted",
        metaEventId: "live-1",
        metaEventSlug: "summoner-skirmish-regional-2026-08-15",
        nextCheckAt: new Date("2026-08-21T00:00:00Z"),
        checkStage: 2,
      }),
      VOCABULARY,
    );

    expect(presented).toMatchObject({
      triage: "accepted",
      metaEventId: "live-1",
      metaEventSlug: "summoner-skirmish-regional-2026-08-15",
      nextCheckAt: "2026-08-21T00:00:00.000Z",
      checkStage: 2,
    });
  });

  it("reports what the deep fetch staged, and when it ran", () => {
    const presented = toMetaCatalogRow(
      row({
        triage: "accepted",
        metaEventId: "live-1",
        fetchedAt: new Date("2026-08-19T04:00:00Z"),
        stagedPlayerCount: 128,
        stagedLegendCount: 120,
        stagedDeckCount: 8,
      }),
      VOCABULARY,
    );

    expect(presented).toMatchObject({
      fetchedAt: "2026-08-19T04:00:00.000Z",
      stagedPlayerCount: 128,
      stagedLegendCount: 120,
      stagedDeckCount: 8,
    });
  });

  it("counts a row nothing was fetched for as zero, and dates it never", () => {
    expect(toMetaCatalogRow(row(), VOCABULARY)).toMatchObject({
      fetchedAt: null,
      stagedPlayerCount: 0,
      stagedLegendCount: 0,
      stagedDeckCount: 0,
    });
  });

  it("distinguishes a fetch that staged nothing from no fetch at all", () => {
    const presented = toMetaCatalogRow(
      row({
        triage: "accepted",
        metaEventId: "live-1",
        fetchedAt: new Date("2026-08-19T04:00:00Z"),
        stagedPlayerCount: 0,
        stagedLegendCount: 0,
        stagedDeckCount: 0,
      }),
      VOCABULARY,
    );

    expect(presented.stagedPlayerCount).toBe(0);
    expect(presented.fetchedAt).toBe("2026-08-19T04:00:00.000Z");
  });
});

describe("toMetaSourceTemplate", () => {
  function templateRow(overrides: Partial<UvsgamesTemplateRow> = {}): UvsgamesTemplateRow {
    return {
      templateId: WATCHED,
      sourceName: "Regional Qualifier",
      watched: true,
      tier: null,
      eventCount: 12,
      avgPlayers: 24.5,
      ranEventCount: 10,
      sampleEventName: "Regional Qualifier Berlin",
      lastStartAt: new Date("2026-08-15T18:00:00Z"),
      ...overrides,
    };
  }

  it("prefills the tier the name rules would guess for a template nobody has mapped", () => {
    const presented = toMetaSourceTemplate(templateRow());

    expect(presented).toEqual({
      templateId: WATCHED,
      sourceName: "Regional Qualifier",
      watched: true,
      tier: null,
      suggestedTier: "premier",
      eventCount: 12,
      avgPlayers: 24.5,
      ranEventCount: 10,
      sampleEventName: "Regional Qualifier Berlin",
      lastStartAt: "2026-08-15T18:00:00.000Z",
    });
  });

  it("keeps the prefill beside a mapped tier rather than in place of it", () => {
    const presented = toMetaSourceTemplate(templateRow({ tier: "local" }));

    expect(presented.tier).toBe("local");
    expect(presented.suggestedTier).toBe("premier");
  });

  it("suggests nothing for a template the source has stopped naming", () => {
    const presented = toMetaSourceTemplate(
      templateRow({ sourceName: null, tier: "local", lastStartAt: null }),
    );

    expect(presented.sourceName).toBeNull();
    expect(presented.suggestedTier).toBeNull();
    expect(presented.lastStartAt).toBeNull();
  });
});

function jobRun(overrides: Partial<JobRun> = {}): JobRun {
  return {
    id: "run-1",
    kind: "meta.uvsgames_sync",
    trigger: "cron",
    status: "succeeded",
    startedAt: new Date("2026-08-15T18:00:00Z"),
    finishedAt: new Date("2026-08-15T18:05:00Z"),
    durationMs: 300_000,
    errorMessage: null,
    result: { accepted: 3 },
    noop: false,
    ...overrides,
  };
}

describe("toMetaSyncRun", () => {
  it("serializes the timestamps and drops the noop flag", () => {
    expect(toMetaSyncRun(jobRun())).toEqual({
      id: "run-1",
      kind: "meta.uvsgames_sync",
      trigger: "cron",
      status: "succeeded",
      startedAt: "2026-08-15T18:00:00.000Z",
      finishedAt: "2026-08-15T18:05:00.000Z",
      durationMs: 300_000,
      errorMessage: null,
      result: { accepted: 3 },
    });
  });

  it("keeps a running job's missing finish and result as null", () => {
    const presented = toMetaSyncRun(
      jobRun({ status: "running", finishedAt: null, durationMs: null, result: undefined }),
    );

    expect(presented.finishedAt).toBeNull();
    expect(presented.result).toBeNull();
  });
});

describe("toMetaSyncSettings", () => {
  it("serializes updatedAt and keeps the toggles", () => {
    expect(
      toMetaSyncSettings({
        autoAcceptMinPlayers: null,
        autoAcceptNotable: true,
        autoAcceptOfficial: false,
        competitivePlayerFloor: 16,
        updatedAt: new Date("2026-08-15T18:00:00Z"),
      }),
    ).toEqual({
      autoAcceptMinPlayers: null,
      autoAcceptNotable: true,
      autoAcceptOfficial: false,
      competitivePlayerFloor: 16,
      updatedAt: "2026-08-15T18:00:00.000Z",
    });
  });
});

describe("toMetaSyncCatalog", () => {
  const overview = {
    total: 120,
    completed: 90,
    decklistPublished: 40,
    missing: 2,
    queued: 5,
    dueRecheck: 7,
    oldestDueAt: new Date("2026-08-01T00:00:00Z"),
    acceptedAwaitingResults: 3,
    acceptedMissing: 1,
    lastSeenAt: new Date("2026-08-20T00:00:00Z"),
  };

  it("serializes the two timestamps and keeps the counts", () => {
    expect(toMetaSyncCatalog(overview)).toEqual({
      ...overview,
      oldestDueAt: "2026-08-01T00:00:00.000Z",
      lastSeenAt: "2026-08-20T00:00:00.000Z",
    });
  });

  it("keeps an empty catalogue's timestamps null", () => {
    const presented = toMetaSyncCatalog({ ...overview, oldestDueAt: null, lastSeenAt: null });

    expect(presented.oldestDueAt).toBeNull();
    expect(presented.lastSeenAt).toBeNull();
  });
});
