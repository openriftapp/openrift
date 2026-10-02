import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { rulesRouter } from "./public-rules";

const mockRulesRepo = {
  listLatest: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
  listKeywordLabels: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
  listCardImages: vi.fn((_slugs: string[], _language: string) =>
    Promise.resolve([] as Record<string, unknown>[]),
  ),
  listAtVersion: vi.fn((_kind: string, _language: string, _version?: string) =>
    Promise.resolve([] as Record<string, unknown>[]),
  ),
  listVersions: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
  listAllVersions: vi.fn(() => Promise.resolve([] as Record<string, unknown>[])),
  listCardNames: vi.fn(() => Promise.resolve([] as { name: string; slug: string }[])),
  listChangesAtVersion: vi.fn(
    () =>
      Promise.resolve(undefined) as Promise<
        | {
            added: string[];
            current: Record<string, string>;
            modified: string[];
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
  language: "en",
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
  language: "en",
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
    mockRulesRepo.listAllVersions.mockResolvedValue([]);
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
    expect(mockRulesRepo.listLatest).toHaveBeenCalledWith("core", "en");
    expect(mockRulesRepo.listAtVersion).not.toHaveBeenCalled();
  });

  it("returns rules at a specific version with changes when version is given", async () => {
    mockRulesRepo.listAtVersion.mockResolvedValue([dbRule]);
    mockRulesRepo.listVersions.mockResolvedValue([dbVersion]);
    mockRulesRepo.listChangesAtVersion.mockResolvedValue({
      added: ["3.4.1"],
      current: { "3.4.1": dbRule.content },
      modified: ["3.4.2"],
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
    expect(mockRulesRepo.listAtVersion).toHaveBeenCalledWith("core", "en", "1.2.0");
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

  it("passes the requested language to the repository", async () => {
    mockRulesRepo.listAtVersion.mockResolvedValue([{ ...dbRule, language: "fr" }]);
    mockRulesRepo.listVersions.mockResolvedValue([{ ...dbVersion, language: "fr" }]);

    const res = await app.request("/api/v1/rules?kind=core&version=1.2.0&language=fr");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.language).toBe("fr");
    expect(mockRulesRepo.listAtVersion).toHaveBeenCalledWith("core", "fr", "1.2.0");
    expect(mockRulesRepo.listChangesAtVersion).toHaveBeenCalledWith("core", "fr", "1.2.0");
    expect(mockRulesRepo.listVersions).toHaveBeenCalledWith("fr", "core");
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
    mockRulesRepo.listKeywordLabels.mockResolvedValue([]);
    mockRulesRepo.listCardImages.mockResolvedValue([]);
  });

  it("badges the keywords of the requested language", async () => {
    mockRulesRepo.listAtVersion.mockResolvedValue([
      { ...dbRule, language: "fr", content: "[Réaction] — Ajoutez [1]." },
    ]);
    mockRulesRepo.listKeywordLabels.mockResolvedValue([
      { label: "Reaction", name: "Reaction", color: "#24705f", darkText: false },
      { label: "Réaction", name: "Reaction", color: "#24705f", darkText: false },
    ]);

    const json = await readJson(
      await app.request("/api/v1/rules/page?kind=core&version=1.2.0&language=fr"),
    );

    expect(mockRulesRepo.listKeywordLabels).toHaveBeenCalledWith("fr");
    expect(json.rules[0].contentHtml).toBe(
      '<span data-keyword="Reaction" style="--keyword-color:#24705f">Réaction</span> — Ajoutez [1].',
    );
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
    expect(mockRulesRepo.listAtVersion).toHaveBeenCalledWith("core", "en", "1.2.0");
  });

  it("loads that language's card names for a translation", async () => {
    mockRulesRepo.listAtVersion.mockResolvedValue([
      {
        ...dbRule,
        language: "fr",
        id: "r0000000-0001-4000-a000-000000000004",
        ruleNumber: "3.5",
        content: "Voir 3.4.\n*Exemple :* Flamme joue Eclair.",
      },
    ]);
    mockRulesRepo.listCardNames.mockResolvedValue([{ name: "Eclair", slug: "flash" }]);
    mockRulesRepo.listCardImages.mockResolvedValue([
      { slug: "flash", imageId: "019a0000-0000-7000-8000-000000000001", types: ["spell"] },
    ]);

    const res = await app.request("/api/v1/rules/page?kind=core&version=1.2.0&language=fr");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.language).toBe("fr");
    expect(mockRulesRepo.listAtVersion).toHaveBeenCalledWith("core", "fr", "1.2.0");
    expect(mockRulesRepo.listCardNames).toHaveBeenCalledWith("fr");
    expect(mockRulesRepo.listCardImages).toHaveBeenCalledWith(["flash"], "fr");
    expect(json.rules[0].contentHtml).toContain(
      '<a href="/cards/flash" data-card-image="019a0000-0000-7000-8000-000000000001">Eclair</a>',
    );
  });

  it("links French terms through the English anchors and Korean terms not at all", async () => {
    const rows = (language: string, heading: string, body: string) => [
      { ...dbRule, language, ruleNumber: "700", depth: 0, content: heading },
      {
        ...dbRule,
        language,
        id: "r0000000-0001-4000-a000-000000000005",
        ruleNumber: "701.1",
        depth: 1,
        content: body,
      },
    ];
    const english = rows("en", "Shields", "A *Shield* blocks damage.");
    mockRulesRepo.listAtVersion.mockImplementation((_kind: string, language: string) =>
      Promise.resolve(
        language === "en"
          ? english
          : language === "fr"
            ? rows("fr", "Boucliers", "Un *bouclier* bloque les dégâts.")
            : rows("ko", "방패", "*방패*는 피해를 막습니다."),
      ),
    );

    const en = await readJson(await app.request("/api/v1/rules/page?kind=core&version=1.2.0"));
    const fr = await readJson(
      await app.request("/api/v1/rules/page?kind=core&version=1.2.0&language=fr"),
    );
    const ko = await readJson(
      await app.request("/api/v1/rules/page?kind=core&version=1.2.0&language=ko"),
    );

    expect(en.rules[1].contentHtml).toContain('<a href="#rule-700">');
    expect(fr.rules[1].contentHtml).toContain('<a href="#rule-700"><em>bouclier</em></a>');
    expect(ko.rules[1].contentHtml).not.toContain("<a ");
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
      modified: ["3.4.2"],
      modifiedPrev: { "3.4.2": "Old rule." },
      removed: [{ ...dbRule, ruleNumber: "3.4.9", content: "Gone *rule*.", changeType: "removed" }],
    });

    const res = await app.request("/api/v1/rules/source?kind=core&version=1.2.0");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.added).toEqual(["3.4.1"]);
    expect(json.modified).toEqual(["3.4.2"]);
    expect(json.current).toEqual({ "3.4.1": "New *rule*.", "3.4.2": "Changed rule." });
    expect(json.modifiedPrev).toEqual({ "3.4.2": "Old rule." });
    expect(json.removed[0]).toMatchObject({
      ruleNumber: "3.4.9",
      content: "Gone *rule*.",
      contentHtml: "Gone <em>rule</em>.",
      changeType: "removed",
    });
    expect(mockRulesRepo.listChangesAtVersion).toHaveBeenCalledWith("core", "en", "1.2.0");
  });
});

describe("GET /api/v1/rules/versions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRulesRepo.listAllVersions.mockResolvedValue([]);
  });

  it("returns the list of versions for a kind", async () => {
    mockRulesRepo.listAllVersions.mockResolvedValue([dbVersion]);

    const res = await app.request("/api/v1/rules/versions?kind=core");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.versions).toHaveLength(1);
    expect(json.languages).toEqual(["en"]);
    expect(json.versions[0]).toEqual({
      kind: "core",
      language: "en",
      languages: ["en"],
      version: "1.2.0",
      comments: "First public release.",
      commentsHtml: "<p>First public release.</p>",
      label: "Origins",
      documentVersion: "1.1",
      importedAt: "2026-02-16T08:30:00.000Z",
    });
  });

  it("inherits label, document version and comments from English and lists the languages per version", async () => {
    mockRulesRepo.listAllVersions.mockResolvedValue([
      dbVersion,
      { ...dbVersion, language: "fr", label: null, documentVersion: null, comments: null },
      { ...dbVersion, version: "1.3.0", label: "Later", documentVersion: "1.2" },
    ]);

    const res = await app.request("/api/v1/rules/versions?kind=core&language=fr");
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.versions).toHaveLength(1);
    expect(json.versions[0]).toMatchObject({
      language: "fr",
      version: "1.2.0",
      comments: "First public release.",
      commentsHtml: "<p>First public release.</p>",
      label: "Origins",
      documentVersion: "1.1",
      languages: ["en", "fr"],
    });
    expect(json.languages).toEqual(["en", "fr"]);
    expect(mockRulesRepo.listAllVersions).toHaveBeenCalledWith("core");
  });

  it("keeps a translation's own label over the English one", async () => {
    mockRulesRepo.listAllVersions.mockResolvedValue([
      dbVersion,
      { ...dbVersion, language: "ko", label: "기원", documentVersion: "2.0", comments: "첫 공개." },
    ]);

    const res = await app.request("/api/v1/rules/versions?kind=core&language=ko");
    const json = await readJson(res);
    expect(json.versions[0]).toMatchObject({
      label: "기원",
      documentVersion: "2.0",
      comments: "첫 공개.",
    });
  });

  it("returns an empty list when there are no versions", async () => {
    mockRulesRepo.listAllVersions.mockResolvedValue([]);

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
      modified: [],
      modifiedPrev: {},
      removed: [],
    });
    const sourceRes = await mountedApp.request("/api/v1/rules/source?kind=core&version=1.2.0");
    expect(sourceRes.status).toBe(200);
  });
});
