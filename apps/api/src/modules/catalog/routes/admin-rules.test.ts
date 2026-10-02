import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import { adminRulesRouter, parseRulesText } from "./admin-rules";

describe("parseRulesText", () => {
  it("recognises titles, subtitles, and plain text by markdown prefix", () => {
    const input = [
      "000. # Golden and Silver Rules",
      "001. ## Golden Rule",
      "002. Card text supersedes rules text.",
    ].join("\n");

    const rules = parseRulesText(input);

    expect(rules).toEqual([
      {
        ruleNumber: "000",
        ruleType: "title",
        content: "Golden and Silver Rules",
        depth: 0,
        sortOrder: 0,
      },
      { ruleNumber: "001", ruleType: "subtitle", content: "Golden Rule", depth: 0, sortOrder: 1 },
      {
        ruleNumber: "002",
        ruleType: "text",
        content: "Card text supersedes rules text.",
        depth: 0,
        sortOrder: 2,
      },
    ]);
  });

  it("derives depth from the dot-separated rule number, capped at 3", () => {
    const input = [
      "100. Top",
      "100.1. Second",
      "100.1.a. Third",
      "100.1.a.1. Fourth",
      "100.1.a.1.x. Fifth (clamped)",
    ].join("\n");

    const rules = parseRulesText(input);

    expect(rules.map((rule) => [rule.ruleNumber, rule.depth])).toEqual([
      ["100", 0],
      ["100.1", 1],
      ["100.1.a", 2],
      ["100.1.a.1", 3],
      ["100.1.a.1.x", 3],
    ]);
  });

  it("expands the literal two-character backslash-n sequence into real newlines", () => {
    const input = String.raw`103.2. *A Main Deck of at least 40 cards*\n  1 Chosen Champion Unit\n  Units`;

    const rules = parseRulesText(input);

    expect(rules).toHaveLength(1);
    expect(rules[0]!.content).toBe(
      "*A Main Deck of at least 40 cards*\n  1 Chosen Champion Unit\n  Units",
    );
  });

  it("skips blank lines, separator lines, and unparseable lines", () => {
    const input = [
      "",
      "=== version 1.0 ===",
      "not a rule line",
      "001. ## Golden Rule",
      "",
      "002. Card text supersedes rules text.",
    ].join("\n");

    const rules = parseRulesText(input);

    expect(rules.map((rule) => rule.ruleNumber)).toEqual(["001", "002"]);
  });

  it("preserves markdown markers (italics, etc.) in the stored content", () => {
    const input = '052. *Card*, when written in card effects, is shorthand for "Main Deck card."';

    const rules = parseRulesText(input);

    expect(rules[0]!.content).toBe(
      '*Card*, when written in card effects, is shorthand for "Main Deck card."',
    );
  });

  it("strips a leading pipe separator before detecting the markdown prefix", () => {
    const input = [
      "000. | # Golden and Silver Rules",
      "001. | ## Golden Rule",
      "002. | Card text supersedes rules text.",
    ].join("\n");

    const rules = parseRulesText(input);

    expect(rules.map((rule) => [rule.ruleType, rule.content])).toEqual([
      ["title", "Golden and Silver Rules"],
      ["subtitle", "Golden Rule"],
      ["text", "Card text supersedes rules text."],
    ]);
  });
});

const mockRulesRepo = {
  getVersion: vi.fn(),
  listVersions: vi.fn(),
  listLatest: vi.fn(),
  createVersion: vi.fn(),
  insertRules: vi.fn(),
  deleteVersion: vi.fn(),
  updateDetails: vi.fn(),
  listAllVersions: vi.fn(),
  listChangeTypesAtVersion: vi.fn(),
  listTranslations: vi.fn(),
};

const mockTransact = vi.fn(async (cb: (txRepos: { rules: typeof mockRulesRepo }) => unknown) =>
  cb({ rules: mockRulesRepo }),
);

const mockFetch = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const testConfig: {
  appBaseUrl: string;
  cloudflare?: { apiToken: string; zoneId: string };
} = { appBaseUrl: "https://openrift.example" };

const app = new Hono<{ Variables: Variables }>();
app.use("*", async (c, next) => {
  c.set("config", testConfig as never);
  c.set("io", { fetch: mockFetch } as never);
  c.set("repos", { rules: mockRulesRepo } as never);
  c.set("transact", mockTransact as never);
  c.set("user", { id: "a0000000-0001-4000-a000-000000000001" } as never);
  await next();
});
registerRouterForTest(app, adminRulesRouter);

describe("POST /api/admin/v1/rules/import", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb({ rules: mockRulesRepo }));
  });

  it("imports a first version with every rule counted as added (201)", async () => {
    mockRulesRepo.getVersion.mockResolvedValue(null);
    mockRulesRepo.listVersions.mockResolvedValue([]);

    const res = await app.request("/api/admin/v1/rules/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "core",
        version: "1.0",
        comments: "Initial import",
        label: "Origins",
        documentVersion: "1.1",
        content: ["001. # Title", "002. A rule."].join("\n"),
      }),
    });

    expect(res.status).toBe(201);
    const json = await readJson(res);
    expect(json).toEqual({
      kind: "core",
      language: "en",
      version: "1.0",
      rulesCount: 2,
      added: 2,
      modified: 0,
      removed: 0,
    });
    expect(mockTransact).toHaveBeenCalledOnce();
    expect(mockRulesRepo.createVersion).toHaveBeenCalledWith({
      kind: "core",
      language: "en",
      version: "1.0",
      comments: "Initial import",
      label: "Origins",
      documentVersion: "1.1",
    });
    expect(mockRulesRepo.insertRules).toHaveBeenCalledOnce();
  });

  it("computes added/modified/removed against the previous version (001 changed, 002 added, 003 removed)", async () => {
    mockRulesRepo.getVersion.mockResolvedValue(null);
    mockRulesRepo.listVersions.mockResolvedValue([{ version: "1.0" }]);
    mockRulesRepo.listLatest.mockResolvedValue([
      { ruleNumber: "001", content: "Old text." },
      { ruleNumber: "003", content: "To be removed." },
    ]);

    const res = await app.request("/api/admin/v1/rules/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "core",
        version: "2.0",
        content: ["001. New text.", "002. Brand new."].join("\n"),
      }),
    });

    expect(res.status).toBe(201);
    const json = await readJson(res);
    expect(json).toMatchObject({ added: 1, modified: 1, removed: 1 });
  });

  it("409s when the version already exists for the kind", async () => {
    mockRulesRepo.getVersion.mockResolvedValue({ kind: "core", version: "1.0" });

    const res = await app.request("/api/admin/v1/rules/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "core", version: "1.0", content: "001. A rule." }),
    });

    expect(res.status).toBe(409);
    const json = await readJson(res);
    expect(json.message).toContain("already exists");
    expect(mockRulesRepo.createVersion).not.toHaveBeenCalled();
  });

  it("400s when the content holds no parseable rules", async () => {
    mockRulesRepo.getVersion.mockResolvedValue(null);
    mockRulesRepo.listVersions.mockResolvedValue([]);

    const res = await app.request("/api/admin/v1/rules/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "core", version: "1.0", content: "not a rule line" }),
    });

    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toContain("No valid rules");
  });

  it("400s when importing a version older than the latest", async () => {
    mockRulesRepo.getVersion.mockResolvedValue(null);
    mockRulesRepo.listVersions.mockResolvedValue([{ version: "2.0" }]);

    const res = await app.request("/api/admin/v1/rules/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "core", version: "1.0", content: "001. A rule." }),
    });

    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toContain("older than");
  });

  describe("translations", () => {
    const importFr = (version: string, content: string) =>
      app.request("/api/admin/v1/rules/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "core", language: "fr", version, content }),
      });

    it("400s when the English version does not exist", async () => {
      mockRulesRepo.getVersion.mockResolvedValue(undefined);

      const res = await importFr("1.0", "001. Une regle.");

      expect(res.status).toBe(400);
      const json = await readJson(res);
      expect(json.message).toContain("English");
      expect(mockRulesRepo.getVersion).toHaveBeenCalledWith("core", "fr", "1.0");
      expect(mockRulesRepo.getVersion).toHaveBeenCalledWith("core", "en", "1.0");
      expect(mockRulesRepo.createVersion).not.toHaveBeenCalled();
    });

    it("409s when the translation already exists", async () => {
      mockRulesRepo.getVersion.mockResolvedValue({ kind: "core", language: "fr", version: "1.0" });

      const res = await importFr("1.0", "001. Une regle.");

      expect(res.status).toBe(409);
      expect(mockRulesRepo.createVersion).not.toHaveBeenCalled();
    });

    it("copies English change types onto the first translated version", async () => {
      mockRulesRepo.getVersion.mockImplementation((_kind: string, language: string) =>
        Promise.resolve(language === "en" ? { kind: "core", language, version: "2.0" } : undefined),
      );
      mockRulesRepo.listVersions.mockResolvedValue([]);
      mockRulesRepo.listChangeTypesAtVersion.mockResolvedValue([
        { ruleNumber: "001", changeType: "added" },
        { ruleNumber: "002", changeType: "modified" },
        { ruleNumber: "003", changeType: "removed" },
        { ruleNumber: "004", changeType: "unchanged" },
      ]);

      const res = await importFr(
        "2.0",
        ["001. Un.", "002. Deux.", "004. Quatre.", "005. Cinq."].join("\n"),
      );

      expect(res.status).toBe(201);
      const json = await readJson(res);
      expect(json).toEqual({
        kind: "core",
        language: "fr",
        version: "2.0",
        rulesCount: 5,
        added: 1,
        modified: 1,
        removed: 1,
      });
      expect(mockRulesRepo.listChangeTypesAtVersion).toHaveBeenCalledWith("core", "en", "2.0");
      expect(mockRulesRepo.createVersion).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "core", language: "fr", version: "2.0" }),
      );
      const inserted = mockRulesRepo.insertRules.mock.calls[0]![0] as {
        ruleNumber: string;
        language: string;
        changeType: string;
        content: string;
      }[];
      expect(inserted.map((r) => [r.ruleNumber, r.changeType, r.language])).toEqual([
        ["001", "added", "fr"],
        ["002", "modified", "fr"],
        ["004", "unchanged", "fr"],
        ["005", "unchanged", "fr"],
        ["003", "removed", "fr"],
      ]);
      expect(inserted.at(-1)!.content).toBe("");
    });

    it("diffs a later translated version against the previous one in the same language", async () => {
      mockRulesRepo.getVersion.mockImplementation((_kind: string, language: string) =>
        Promise.resolve(language === "en" ? { kind: "core", language, version: "2.0" } : undefined),
      );
      mockRulesRepo.listVersions.mockResolvedValue([{ version: "1.0" }]);
      mockRulesRepo.listLatest.mockResolvedValue([{ ruleNumber: "001", content: "Un." }]);

      const res = await importFr("2.0", ["001. Un.", "002. Deux."].join("\n"));

      expect(res.status).toBe(201);
      expect(await readJson(res)).toMatchObject({ added: 1, modified: 0, removed: 0 });
      expect(mockRulesRepo.listVersions).toHaveBeenCalledWith("fr", "core");
      expect(mockRulesRepo.listLatest).toHaveBeenCalledWith("core", "fr");
      expect(mockRulesRepo.listChangeTypesAtVersion).not.toHaveBeenCalled();
    });

    it("checks chronological order per language", async () => {
      mockRulesRepo.getVersion.mockImplementation((_kind: string, language: string) =>
        Promise.resolve(language === "en" ? { kind: "core", language, version: "1.5" } : undefined),
      );
      mockRulesRepo.listVersions.mockImplementation((language: string) =>
        Promise.resolve(language === "fr" ? [{ version: "2.0" }] : [{ version: "1.0" }]),
      );

      const older = await importFr("1.5", "001. Une.");
      expect(older.status).toBe(400);
      const olderJson = await readJson(older);
      expect(olderJson.message).toContain("older than");

      mockRulesRepo.listVersions.mockResolvedValue([{ version: "1.0" }]);
      mockRulesRepo.listLatest.mockResolvedValue([]);
      const newer = await importFr("1.5", "001. Une.");
      expect(newer.status).toBe(201);
    });
  });
});

describe("GET /api/admin/v1/rules/versions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns every language's versions with ISO import dates", async () => {
    mockRulesRepo.listAllVersions.mockResolvedValue([
      {
        kind: "core",
        language: "en",
        version: "1.0",
        comments: "Note",
        label: "Origins",
        documentVersion: "1.1",
        importedAt: new Date("2026-02-16T08:30:00Z"),
      },
      {
        kind: "core",
        language: "fr",
        version: "1.0",
        comments: null,
        label: null,
        documentVersion: null,
        importedAt: new Date("2026-02-17T08:30:00Z"),
      },
    ]);

    const res = await app.request("/api/admin/v1/rules/versions");

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      versions: [
        {
          kind: "core",
          language: "en",
          version: "1.0",
          comments: "Note",
          label: "Origins",
          documentVersion: "1.1",
          importedAt: "2026-02-16T08:30:00.000Z",
        },
        {
          kind: "core",
          language: "fr",
          version: "1.0",
          comments: null,
          label: null,
          documentVersion: null,
          importedAt: "2026-02-17T08:30:00.000Z",
        },
      ],
    });
    expect(mockRulesRepo.listAllVersions).toHaveBeenCalledWith();
  });
});

describe("DELETE /api/admin/v1/rules/:kind/:language/versions/:version", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("deletes an existing version (204)", async () => {
    mockRulesRepo.getVersion.mockResolvedValue({ kind: "core", language: "en", version: "1.0" });
    mockRulesRepo.listTranslations.mockResolvedValue([]);

    const res = await app.request("/api/admin/v1/rules/core/en/versions/1.0", { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(mockRulesRepo.deleteVersion).toHaveBeenCalledWith("core", "en", "1.0");
  });

  it("passes the language through when deleting a translation", async () => {
    mockRulesRepo.getVersion.mockResolvedValue({ kind: "core", language: "fr", version: "1.0" });

    const res = await app.request("/api/admin/v1/rules/core/fr/versions/1.0", { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(mockRulesRepo.getVersion).toHaveBeenCalledWith("core", "fr", "1.0");
    expect(mockRulesRepo.deleteVersion).toHaveBeenCalledWith("core", "fr", "1.0");
    expect(mockRulesRepo.listTranslations).not.toHaveBeenCalled();
  });

  it("409s when deleting an English version that still has translations", async () => {
    mockRulesRepo.getVersion.mockResolvedValue({ kind: "core", language: "en", version: "1.0" });
    mockRulesRepo.listTranslations.mockResolvedValue([{ language: "fr" }, { language: "ko" }]);

    const res = await app.request("/api/admin/v1/rules/core/en/versions/1.0", { method: "DELETE" });

    expect(res.status).toBe(409);
    const json = await readJson(res);
    expect(json.message).toContain("fr, ko");
    expect(mockRulesRepo.listTranslations).toHaveBeenCalledWith("core", "1.0");
    expect(mockRulesRepo.deleteVersion).not.toHaveBeenCalled();
  });

  it("deletes an English version without translations", async () => {
    mockRulesRepo.getVersion.mockResolvedValue({ kind: "core", language: "en", version: "1.0" });
    mockRulesRepo.listTranslations.mockResolvedValue([]);

    const res = await app.request("/api/admin/v1/rules/core/en/versions/1.0", { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(mockRulesRepo.deleteVersion).toHaveBeenCalledWith("core", "en", "1.0");
  });

  it("404s when the version does not exist", async () => {
    mockRulesRepo.getVersion.mockResolvedValue(null);

    const res = await app.request("/api/admin/v1/rules/core/en/versions/9.9", { method: "DELETE" });

    expect(res.status).toBe(404);
    expect(mockRulesRepo.deleteVersion).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/admin/v1/rules/:kind/:language/versions/:version", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("updates the version comments, label and document version", async () => {
    const details = { comments: "Updated note", label: "Vendetta", documentVersion: "1.4" };
    mockRulesRepo.updateDetails.mockResolvedValue({
      kind: "core",
      language: "en",
      version: "1.0",
      ...details,
    });

    const res = await app.request("/api/admin/v1/rules/core/en/versions/1.0", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ kind: "core", language: "en", version: "1.0", ...details });
    expect(mockRulesRepo.updateDetails).toHaveBeenCalledWith("core", "en", "1.0", details);
  });

  it("clears the details when null is passed", async () => {
    const details = { comments: null, label: null, documentVersion: null };
    mockRulesRepo.updateDetails.mockResolvedValue({
      kind: "tournament",
      language: "en",
      version: "1.0",
      ...details,
    });

    const res = await app.request("/api/admin/v1/rules/tournament/en/versions/1.0", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });

    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json).toEqual({ kind: "tournament", language: "en", version: "1.0", ...details });
  });

  it("passes the language through when updating a translation", async () => {
    const details = { comments: null, label: "Origines", documentVersion: null };
    mockRulesRepo.updateDetails.mockResolvedValue({
      kind: "core",
      language: "fr",
      version: "1.0",
      ...details,
    });

    const res = await app.request("/api/admin/v1/rules/core/fr/versions/1.0", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({
      kind: "core",
      language: "fr",
      version: "1.0",
      ...details,
    });
    expect(mockRulesRepo.updateDetails).toHaveBeenCalledWith("core", "fr", "1.0", details);
  });

  it("rejects an empty label", async () => {
    const res = await app.request("/api/admin/v1/rules/core/en/versions/1.0", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: null, label: "", documentVersion: null }),
    });

    expect(res.status).toBe(400);
    expect(mockRulesRepo.updateDetails).not.toHaveBeenCalled();
  });

  it("404s when the version does not exist", async () => {
    mockRulesRepo.updateDetails.mockResolvedValue(null);

    const res = await app.request("/api/admin/v1/rules/core/en/versions/9.9", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: "x", label: null, documentVersion: null }),
    });

    expect(res.status).toBe(404);
  });
});

describe("rules page purge", () => {
  const purgedFiles = () =>
    mockFetch.mock.calls.flatMap(([, init]) => JSON.parse(init?.body as string).files as string[]);

  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb({ rules: mockRulesRepo }));
    testConfig.cloudflare = { apiToken: "token", zoneId: "zone" };
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
  });

  afterEach(() => {
    delete testConfig.cloudflare;
  });

  it("purges the rules index, the kind redirect and every version page after an import", async () => {
    mockRulesRepo.getVersion.mockResolvedValue(null);
    mockRulesRepo.listVersions.mockResolvedValue([{ version: "2026-03-30" }]);
    mockRulesRepo.listAllVersions.mockResolvedValue([
      { language: "en", version: "2026-03-30" },
      { language: "en", version: "2026-07-16" },
      { language: "fr", version: "2026-07-16" },
    ]);
    mockRulesRepo.listLatest.mockResolvedValue([]);

    const res = await app.request("/api/admin/v1/rules/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "core", version: "2026-07-16", content: "001. A rule." }),
    });

    expect(res.status).toBe(201);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/zones/zone/purge_cache",
      expect.objectContaining({ method: "POST" }),
    );
    expect(purgedFiles()).toEqual([
      "https://openrift.example/rules",
      "https://openrift.example/rules/core",
      "https://openrift.example/rules/core?lang=en",
      "https://openrift.example/rules/core?lang=fr",
      "https://openrift.example/rules/core/2026-03-30",
      "https://openrift.example/rules/core/2026-03-30?lang=en",
      "https://openrift.example/rules/core/2026-07-16",
      "https://openrift.example/rules/core/2026-07-16?lang=en",
      "https://openrift.example/rules/core/2026-07-16?lang=fr",
    ]);
  });

  it("also purges the page of a deleted version", async () => {
    mockRulesRepo.getVersion.mockResolvedValue({
      kind: "tournament",
      language: "en",
      version: "2026-04-29",
    });
    mockRulesRepo.listTranslations.mockResolvedValue([]);
    mockRulesRepo.listAllVersions.mockResolvedValue([{ language: "en", version: "2026-03-30" }]);

    const res = await app.request("/api/admin/v1/rules/tournament/en/versions/2026-04-29", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
    expect(purgedFiles()).toContain("https://openrift.example/rules/tournament/2026-04-29");
    expect(purgedFiles()).toContain("https://openrift.example/rules/tournament/2026-04-29?lang=en");
  });

  it("still succeeds when the purge fails", async () => {
    mockFetch.mockResolvedValue(new Response("nope", { status: 500 }));
    const details = { comments: null, label: "Vendetta", documentVersion: "1.4" };
    mockRulesRepo.updateDetails.mockResolvedValue({
      kind: "core",
      language: "en",
      version: "2026-07-16",
      ...details,
    });
    mockRulesRepo.listAllVersions.mockResolvedValue([{ language: "en", version: "2026-07-16" }]);

    const res = await app.request("/api/admin/v1/rules/core/en/versions/2026-07-16", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("skips the purge without Cloudflare credentials", async () => {
    delete testConfig.cloudflare;
    mockRulesRepo.getVersion.mockResolvedValue({
      kind: "core",
      language: "en",
      version: "2026-07-16",
    });
    mockRulesRepo.listTranslations.mockResolvedValue([]);

    await app.request("/api/admin/v1/rules/core/en/versions/2026-07-16", { method: "DELETE" });

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
