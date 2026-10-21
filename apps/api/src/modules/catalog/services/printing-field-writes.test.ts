import { describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../deps.js";
import { normalizePrintingFieldValue, writePrintingField } from "./printing-field-writes.js";

vi.mock("./printing-admin.js", () => ({
  updatePrintingMarkers: vi.fn(),
  updatePrintingDistributionChannels: vi.fn(),
}));

function makeRepos(before: { releasedAt: string | null; releasePrecision: string | null }) {
  const updatePrintingById = vi.fn(() => Promise.resolve());
  const updatePrintingFieldById = vi.fn(() => Promise.resolve());
  const repos = {
    catalogMutations: {
      getFullPrintingById: vi.fn(() => Promise.resolve({ id: "printing-1", ...before })),
      updatePrintingById,
      updatePrintingFieldById,
    },
    rarities: { listAll: vi.fn(() => Promise.resolve([])) },
    keywords: { listCostKeywords: vi.fn(() => Promise.resolve([])) },
  } as unknown as Repos;
  return { repos, updatePrintingById, updatePrintingFieldById };
}

const UNDATED = { releasedAt: null, releasePrecision: null };

function normalize(repos: Repos, field: "releasedAt" | "releasePrecision", value: unknown) {
  return normalizePrintingFieldValue(repos, {
    printingId: "printing-1",
    field,
    value,
    source: "provider",
  });
}

describe("normalizePrintingFieldValue release fields", () => {
  it("snaps a date with its precision to the period start", async () => {
    const { repos } = makeRepos(UNDATED);
    await expect(
      normalize(repos, "releasedAt", { releasedAt: "2026-11-20", releasePrecision: "month" }),
    ).resolves.toEqual({ releasedAt: "2026-11-01", releasePrecision: "month" });
  });

  it("gives a bare date on an undated printing the precision of its shape", async () => {
    const { repos } = makeRepos(UNDATED);
    await expect(normalize(repos, "releasedAt", "2026-11-20")).resolves.toEqual({
      releasedAt: "2026-11-20",
      releasePrecision: "day",
    });
    await expect(normalize(repos, "releasedAt", "2026")).resolves.toEqual({
      releasedAt: "2026-01-01",
      releasePrecision: "year",
    });
  });

  it("keeps the printing's precision for a bare date", async () => {
    const { repos } = makeRepos({ releasedAt: "2026-04-01", releasePrecision: "quarter" });
    await expect(normalize(repos, "releasedAt", "2026-08-14")).resolves.toEqual({
      releasedAt: "2026-07-01",
      releasePrecision: "quarter",
    });
  });

  it("clears both columns for a null date", async () => {
    const { repos } = makeRepos({ releasedAt: "2026-04-01", releasePrecision: "month" });
    await expect(normalize(repos, "releasedAt", null)).resolves.toEqual(UNDATED);
  });

  it("re-snaps the printing's date to a new precision", async () => {
    const { repos } = makeRepos({ releasedAt: "2026-11-20", releasePrecision: "day" });
    await expect(normalize(repos, "releasePrecision", "month")).resolves.toEqual({
      releasedAt: "2026-11-01",
      releasePrecision: "month",
    });
  });

  it("rejects a precision on an undated printing", async () => {
    const { repos } = makeRepos(UNDATED);
    await expect(normalize(repos, "releasePrecision", "month")).rejects.toThrow(
      "Set a release date before its precision.",
    );
  });

  it("rejects a malformed date, an unknown precision and a precision finer than the date", async () => {
    const { repos } = makeRepos(UNDATED);
    await expect(normalize(repos, "releasedAt", "next spring")).rejects.toThrow(
      "Invalid value for releasedAt",
    );
    await expect(normalize(repos, "releasePrecision", "week")).rejects.toThrow(
      "Invalid value for releasePrecision",
    );
    await expect(
      normalize(repos, "releasedAt", { releasedAt: "2026-11", releasePrecision: "day" }),
    ).rejects.toThrow("Invalid value for releasedAt");
  });
});

describe("writePrintingField release fields", () => {
  const transact = vi.fn() as unknown as Transact;

  it("writes the date and precision in one update", async () => {
    const { repos, updatePrintingById, updatePrintingFieldById } = makeRepos(UNDATED);
    const release = { releasedAt: "2026-11-01", releasePrecision: "month" };
    const result = await writePrintingField(transact, repos, {
      printingId: "printing-1",
      field: "releasedAt",
      value: release,
    });
    expect(updatePrintingById).toHaveBeenCalledWith("printing-1", release);
    expect(updatePrintingFieldById).not.toHaveBeenCalled();
    expect(result.auditValue).toEqual(release);
  });

  it("writes announcedAt as a single printing column", async () => {
    const { repos, updatePrintingFieldById } = makeRepos(UNDATED);
    const value = await normalizePrintingFieldValue(repos, {
      printingId: "printing-1",
      field: "announcedAt",
      value: "2026-10-18",
      source: "provider",
    });
    await writePrintingField(transact, repos, {
      printingId: "printing-1",
      field: "announcedAt",
      value,
    });
    expect(updatePrintingFieldById).toHaveBeenCalledWith(
      "printing-1",
      "announcedAt",
      "2026-10-18",
      1,
    );
  });

  it("rejects an announcedAt that is not a date", async () => {
    const { repos } = makeRepos(UNDATED);
    await expect(
      normalizePrintingFieldValue(repos, {
        printingId: "printing-1",
        field: "announcedAt",
        value: "2026-10",
        source: "provider",
      }),
    ).rejects.toThrow("Invalid value for announcedAt");
  });
});
