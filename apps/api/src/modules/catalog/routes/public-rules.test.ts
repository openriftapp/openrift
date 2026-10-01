import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { rulesRouter } from "./public-rules";

const mockRulesRepo = {
  listLatest: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
  listAtVersion: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
  listVersions: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
  listCardNames: vi.fn(() => Promise.resolve([] as { name: string; slug: string }[])),
  listChangesAtVersion: vi.fn(
    () =>
      Promise.resolve(undefined) as Promise<
        | {
            added: string[];
            current: Record<string, string>;
            modifiedPrev: Record<string, string>;
            removed: Record<string, unknown>[];
          }
        | undefined
        | null
      >,
  ),
};

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("repos", {
    rules: mockRulesRepo,
    // oxlint-disable-next-line no-explicit-any -- test mock doesn't match full Repos type
  } as any);
  await next();
});
registerRouterForTest(app, rulesRouter);

const dbRule = {
  id: "r0000000-0001-4000-a000-000000000001",
  kind: "core",
  version: "1.2.0",
  ruleNumber: "3.4.1",
  sortOrder: 120,
  depth: 2,
  ruleType: "text",
  content: "A player loses the game if they would draw a card from an empty deck.",
  changeType: "added",
};

const dbVersion = {
  kind: "core",
  version: "1.2.0",
  comments: "First public release.",
  label: "Origins",
  documentVersion: "1.1",
  importedAt: new Date("2026-02-16T08:30:00Z"),
};

describe("GET /api/v1/rules", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRulesRepo.listLatest.mockResolvedValue([]);
    mockRulesRepo.listAtVersion.mockResolvedValue([]);
    mockRulesRepo.listVersions.mockResolvedValue([]);
    mockRulesRepo.listChangesAtVersion.mockResolvedValue(undefined);
    mockRulesRepo.listCardNames.mockResolvedValue([]);
  });

  it("returns the latest rules for a kind when no version is given", async () => {
    mockRulesRepo.listLatest.mockResolvedValue([dbRule]);
    mockRulesRepo.listVersions.mockResolvedValue([dbVersion]);

    const res = await app.request("/api/v1/rules?kind=core");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.kind).toBe("core");
    expect(json.version).toBe("1.2.0");
    expect(json.rules).toHaveLength(1);
    expect(json.rules[0]).toMatchObject({
      id: dbRule.id,
      ruleNumber: "3.4.1",
      ruleType: "text",
      changeType: "added",
    });
    expect(json.changes).toBeUndefined();
    expect(mockRulesRepo.listLatest).toHaveBeenCalledWith("core");
    expect(mockRulesRepo.listAtVersion).not.toHaveBeenCalled();
  });

  it("returns rules at a specific version with changes when version is given", async () => {
    mockRulesRepo.listAtVersion.mockResolvedValue([dbRule]);
    mockRulesRepo.listVersions.mockResolvedValue([dbVersion]);
    mockRulesRepo.listChangesAtVersion.mockResolvedValue({
      added: ["3.4.1"],
      current: { "3.4.1": dbRule.content },
      modifiedPrev: { "3.4.2": "old text" },
      removed: [{ ...dbRule, id: "r0000000-0001-4000-a000-000000000002", changeType: "removed" }],
    });

    const res = await app.request("/api/v1/rules?kind=core&version=1.2.0");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.version).toBe("1.2.0");
    expect(json.changes).toBeDefined();
    expect(json.changes.added).toEqual(["3.4.1"]);
    expect(json.changes.modifiedPrev).toEqual({ "3.4.2": "old text" });
    expect(json.changes.removed).toHaveLength(1);
    expect(mockRulesRepo.listAtVersion).toHaveBeenCalledWith("core", "1.2.0");
    expect(mockRulesRepo.listLatest).not.toHaveBeenCalled();
  });

  it("falls back to an empty effective version when no versions exist", async () => {
    mockRulesRepo.listLatest.mockResolvedValue([]);
    mockRulesRepo.listVersions.mockResolvedValue([]);

    const res = await app.request("/api/v1/rules?kind=tournament");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.kind).toBe("tournament");
    expect(json.version).toBe("");
    expect(json.rules).toEqual([]);
  });

  it("rejects an invalid kind with a 400", async () => {
    const res = await app.request("/api/v1/rules?kind=nonsense");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/rules/page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRulesRepo.listAtVersion.mockResolvedValue([]);
    mockRulesRepo.listCardNames.mockResolvedValue([]);
  });

  it("renders each text rule to HTML, linking cards only inside examples", async () => {
    mockRulesRepo.listAtVersion.mockResolvedValue([
      {
        ...dbRule,
        content:
          "Flash moves units.\n*Example:* A player plays Flash. Treasure Hunter reads “play a Gold gear token.”",
      },
      { ...dbRule, id: "r0000000-0001-4000-a000-000000000003", content: "Gold is a token." },
    ]);
    mockRulesRepo.listCardNames.mockResolvedValue([
      { name: "Flash", slug: "flash" },
      { name: "Gold", slug: "gold" },
      { name: "Treasure Hunter", slug: "treasure-hunter" },
    ]);

    const res = await app.request("/api/v1/rules/page?kind=core&version=1.2.0");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.version).toBe("1.2.0");
    expect(json.rules[0].contentHtml).toBe(
      '<div>Flash moves units.</div><div class="rule-example"><em>Example:</em> A player plays <a href="/cards/flash">Flash</a>. <a href="/cards/treasure-hunter">Treasure Hunter</a> reads “play a Gold gear token.”</div>',
    );
    expect(json.rules[1].contentHtml).toBe("Gold is a token.");
    expect(json.rules[0]).not.toHaveProperty("content");
    expect(mockRulesRepo.listAtVersion).toHaveBeenCalledWith("core", "1.2.0");
  });

  it("escapes titles and subtitles as plain text", async () => {
    mockRulesRepo.listAtVersion.mockResolvedValue([
      { ...dbRule, ruleType: "title", content: "Setup & *Play*" },
    ]);

    const res = await app.request("/api/v1/rules/page?kind=core&version=1.2.0");
    const json = await readJson(res);
    expect(json.rules[0].contentHtml).toBe("Setup &amp; *Play*");
  });

  it("skips the card lookup when no rule has an example", async () => {
    mockRulesRepo.listAtVersion.mockResolvedValue([dbRule]);

    const res = await app.request("/api/v1/rules/page?kind=core&version=1.2.0");
    const json = await readJson(res);
    expect(json.rules[0].contentHtml).toBe(dbRule.content);
    expect(mockRulesRepo.listCardNames).not.toHaveBeenCalled();
  });

  it("requires a version", async () => {
    const res = await app.request("/api/v1/rules/page?kind=core");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/v1/rules/source", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the markdown of the changed rules and renders removed rules for display", async () => {
    mockRulesRepo.listChangesAtVersion.mockResolvedValue({
      added: ["3.4.1"],
      current: { "3.4.1": "New *rule*.", "3.4.2": "Changed rule." },
      modifiedPrev: { "3.4.2": "Old rule." },
      removed: [{ ...dbRule, ruleNumber: "3.4.9", content: "Gone *rule*.", changeType: "removed" }],
    });

    const res = await app.request("/api/v1/rules/source?kind=core&version=1.2.0");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.added).toEqual(["3.4.1"]);
    expect(json.current).toEqual({ "3.4.1": "New *rule*.", "3.4.2": "Changed rule." });
    expect(json.modifiedPrev).toEqual({ "3.4.2": "Old rule." });
    expect(json.removed[0]).toMatchObject({
      ruleNumber: "3.4.9",
      content: "Gone *rule*.",
      contentHtml: "Gone <em>rule</em>.",
      changeType: "removed",
    });
    expect(mockRulesRepo.listChangesAtVersion).toHaveBeenCalledWith("core", "1.2.0");
  });
});

describe("GET /api/v1/rules/versions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRulesRepo.listVersions.mockResolvedValue([]);
  });

  it("returns the list of versions for a kind", async () => {
    mockRulesRepo.listVersions.mockResolvedValue([dbVersion]);

    const res = await app.request("/api/v1/rules/versions?kind=core");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.versions).toHaveLength(1);
    expect(json.versions[0]).toEqual({
      kind: "core",
      version: "1.2.0",
      comments: "First public release.",
      commentsHtml: "<p>First public release.</p>",
      label: "Origins",
      documentVersion: "1.1",
      importedAt: "2026-02-16T08:30:00.000Z",
    });
  });

  it("returns an empty list when there are no versions", async () => {
    mockRulesRepo.listVersions.mockResolvedValue([]);

    const res = await app.request("/api/v1/rules/versions?kind=tournament");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.versions).toEqual([]);
  });
});

describe("rules route registration", () => {
  it("registers every rules route", async () => {
    const mountedApp = new Hono<{ Variables: Variables }>();
    mountedApp.use("*", async (c, next) => {
      c.set("repos", {
        rules: mockRulesRepo,
        // oxlint-disable-next-line no-explicit-any -- test mock doesn't match full Repos type
      } as any);
      await next();
    });
    registerRouterForTest(mountedApp, rulesRouter);

    mockRulesRepo.listLatest.mockResolvedValue([]);
    mockRulesRepo.listVersions.mockResolvedValue([]);

    const listRes = await mountedApp.request("/api/v1/rules?kind=core");
    expect(listRes.status).toBe(200);

    const versionsRes = await mountedApp.request("/api/v1/rules/versions?kind=core");
    expect(versionsRes.status).toBe(200);

    mockRulesRepo.listAtVersion.mockResolvedValue([]);
    const pageRes = await mountedApp.request("/api/v1/rules/page?kind=core&version=1.2.0");
    expect(pageRes.status).toBe(200);

    mockRulesRepo.listChangesAtVersion.mockResolvedValue({
      added: [],
      current: {},
      modifiedPrev: {},
      removed: [],
    });
    const sourceRes = await mountedApp.request("/api/v1/rules/source?kind=core&version=1.2.0");
    expect(sourceRes.status).toBe(200);
  });
});
