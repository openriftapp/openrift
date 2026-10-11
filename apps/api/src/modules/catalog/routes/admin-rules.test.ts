import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerRouterForTest } from "../../../test/mount-router.js";
import { readJson } from "../../../test/read-json.js";
import type { Variables } from "../../../types.js";
import type * as RuleVersions from "../lib/rule-versions.js";
import { retypeLanguage, saveRulesVersion } from "../lib/rule-versions.js";
import { adminRulesRouter } from "./admin-rules";

vi.mock("../lib/rule-versions.js", async (importOriginal) => {
  const actual = await importOriginal<typeof RuleVersions>();
  return { ...actual, saveRulesVersion: vi.fn(), retypeLanguage: vi.fn() };
});

const mockRulesRepo = {
  getVersion: vi.fn(),
  deleteVersion: vi.fn(),
  updateDetails: vi.fn(),
  listAllVersions: vi.fn(),
  listTranslations: vi.fn(),
};
const mockSave = vi.mocked(saveRulesVersion);
const mockRetype = vi.mocked(retypeLanguage);

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

describe("PUT /api/admin/v1/rules/:kind/:language/versions/:version", () => {
  const put = (path: string, body: object) =>
    app.request(`/api/admin/v1/rules/${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const saved = { status: "created", rulesCount: 2, added: 2, modified: 0, removed: 0 } as const;

  beforeEach(() => {
    vi.resetAllMocks();
    mockTransact.mockImplementation(async (cb) => cb({ rules: mockRulesRepo }));
    mockSave.mockResolvedValue(saved);
  });

  it("saves the parsed rules and details inside a transaction", async () => {
    const res = await put("core/en/versions/1.0", {
      comments: "Initial import",
      label: "Origins",
      content: ["001. # Title", "002. A rule."].join("\n"),
    });

    expect(res.status).toBe(200);
    expect(await readJson(res)).toEqual({ kind: "core", language: "en", version: "1.0", ...saved });
    expect(mockTransact).toHaveBeenCalledOnce();
    expect(mockSave).toHaveBeenCalledWith(
      mockRulesRepo,
      { kind: "core", language: "en", version: "1.0" },
      [
        { ruleNumber: "001", ruleType: "title", content: "Title", depth: 0, sortOrder: 0 },
        { ruleNumber: "002", ruleType: "text", content: "A rule.", depth: 0, sortOrder: 1 },
      ],
      { comments: "Initial import", label: "Origins", documentVersion: undefined },
    );
  });

  it("400s when the content holds no parseable rules", async () => {
    const res = await put("core/en/versions/1.0", { content: "not a rule line" });

    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toContain("No valid rules");
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("400s when a rule number appears twice", async () => {
    const res = await put("core/en/versions/1.0", { content: "001. A.\n001. B." });

    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toContain("001");
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("400s for a translation without the English version of its date", async () => {
    mockRulesRepo.getVersion.mockResolvedValue(undefined);

    const res = await put("core/fr/versions/1.0", { content: "001. Une regle." });

    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.message).toContain("English");
    expect(mockRulesRepo.getVersion).toHaveBeenCalledWith("core", "en", "1.0");
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("saves a translation when the English version exists", async () => {
    mockRulesRepo.getVersion.mockResolvedValue({ kind: "core", language: "en", version: "1.0" });

    const res = await put("core/fr/versions/1.0", { content: "001. Une regle." });

    expect(res.status).toBe(200);
    expect(mockSave).toHaveBeenCalledWith(
      mockRulesRepo,
      { kind: "core", language: "fr", version: "1.0" },
      expect.any(Array),
      expect.any(Object),
    );
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
    mockTransact.mockImplementation(async (cb) => cb({ rules: mockRulesRepo }));
  });

  it("deletes an existing version (204)", async () => {
    mockRulesRepo.getVersion.mockResolvedValue({ kind: "core", language: "en", version: "1.0" });
    mockRulesRepo.listTranslations.mockResolvedValue([]);

    const res = await app.request("/api/admin/v1/rules/core/en/versions/1.0", { method: "DELETE" });

    expect(res.status).toBe(204);
    expect(mockRulesRepo.deleteVersion).toHaveBeenCalledWith("core", "en", "1.0");
    expect(mockRetype).toHaveBeenCalledWith(mockRulesRepo, "core", "en");
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

  it("purges the rules index, the kind redirect and every version page after a save", async () => {
    mockSave.mockResolvedValue({
      status: "updated",
      rulesCount: 1,
      added: 0,
      modified: 1,
      removed: 0,
    });
    mockRulesRepo.listAllVersions.mockResolvedValue([
      { language: "en", version: "2026-03-30" },
      { language: "en", version: "2026-07-16" },
      { language: "fr", version: "2026-07-16" },
    ]);

    const res = await app.request("/api/admin/v1/rules/core/en/versions/2026-07-16", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "001. A rule." }),
    });

    expect(res.status).toBe(200);
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

  it("skips the purge when the save changed nothing", async () => {
    mockSave.mockResolvedValue({
      status: "unchanged",
      rulesCount: 1,
      added: 1,
      modified: 0,
      removed: 0,
    });

    const res = await app.request("/api/admin/v1/rules/core/en/versions/2026-07-16", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "001. A rule." }),
    });

    expect(res.status).toBe(200);
    expect(mockFetch).not.toHaveBeenCalled();
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
