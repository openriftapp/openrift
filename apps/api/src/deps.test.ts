import { describe, expect, it, vi } from "vitest";

import { createRepos, createTransact, services } from "./deps.js";
import { createCardLookupIndexLoader } from "./modules/catalog/lib/card-lookup-index.js";
import { createRecordingDb } from "./test/recording-db.js";

describe("createRepos", () => {
  it("returns an object with all expected repo keys", () => {
    const mockDb = {} as any;
    const repos = createRepos(mockDb);

    const expectedKeys = [
      "collectionEvents",
      "admins",
      "cardTrades",
      "meta",
      "scanIndex",
      "stagePresets",
      "tournaments",
      "candidateCards",
      "cardErrata",
      "catalog",
      "catalogDeleteGuards",
      "catalogMutations",
      "collections",
      "copies",
      "decks",
      "featureFlags",
      "health",
      "keywords",
      "ignoredCandidates",
      "lists",
      "marketplace",
      "marketplaceAdmin",
      "printingImages",
      "markers",
      "distributionChannels",
      "sets",
      "providerSettings",
      "siteSettings",
      "userPreferences",
      "ingest",
      "marketplaceMapping",
      "priceRefresh",
    ];
    for (const key of expectedKeys) {
      expect(repos).toHaveProperty(key);
    }
  });
});

describe("createTransact", () => {
  it("executes the callback within a transaction and returns the result", async () => {
    const mockTrx = {} as any;
    const mockExecute = vi.fn((callback: (trx: any) => Promise<unknown>) => callback(mockTrx));
    const mockTransaction = vi.fn(() => ({ execute: mockExecute }));
    const mockDb = { transaction: mockTransaction } as any;

    const transact = createTransact(mockDb);
    const result = await transact(async (repos) => {
      expect(repos).toBeDefined();
      return "transaction-result";
    });

    expect(result).toBe("transaction-result");
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});

describe("catalog caches", () => {
  it("serves a transaction the lookup the pool built, probing the version only", async () => {
    const recorded = createRecordingDb();
    await createCardLookupIndexLoader(createRepos(recorded.db))();
    expect(recorded.queries.length).toBeGreaterThan(1);

    recorded.reset();
    await createTransact(recorded.db)((trx) => createCardLookupIndexLoader(trx)());

    expect(recorded.queries).toEqual([expect.stringContaining("catalog_versions")]);
  });

  it("serves a transaction the enum rows the pool loaded", async () => {
    const recorded = createRecordingDb();
    await createRepos(recorded.db).enums.all();

    recorded.reset();
    await createTransact(recorded.db)((trx) => trx.enums.all());

    expect(recorded.queries).toHaveLength(1);
  });
});

describe("services", () => {
  it("exports all expected service functions", () => {
    const expectedKeys = ["ensureInbox", "notifyAdminsOfGroupJoinRequest", "createTrade"];
    for (const key of expectedKeys) {
      expect(services).toHaveProperty(key);
      expect(typeof (services as any)[key]).toBe("function");
    }
  });
});
