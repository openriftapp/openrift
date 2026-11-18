import { describe, expect, it } from "vitest";

import { createRecordingDb } from "../../../test/recording-db.js";
import { printingCitationsRepo } from "./printing-citations.js";

describe("printingCitationsRepo", () => {
  it("short-circuits an empty batch instead of building an empty IN list", async () => {
    const { db, statements } = createRecordingDb();

    await expect(printingCitationsRepo(db).listForPrintingIds([])).resolves.toEqual([]);
    expect(statements).toHaveLength(0);
  });

  describe("update", () => {
    it("binds only the fields the caller sent", async () => {
      const { db, parameters } = createRecordingDb([[{ id: "citation-1" }]]);

      await printingCitationsRepo(db).update("citation-1", {
        sourceUrl: "https://web.archive.org/x",
      });

      expect(parameters).toEqual([["https://web.archive.org/x", "citation-1"]]);
    });

    it("clears the link when sourceUrl is explicitly null", async () => {
      const { db, parameters } = createRecordingDb([[{ id: "citation-1" }]]);

      await printingCitationsRepo(db).update("citation-1", { sourceUrl: null });

      expect(parameters).toEqual([[null, "citation-1"]]);
    });

    it("falls back to an existence check when nothing was sent", async () => {
      const { db, parameters } = createRecordingDb([[{ id: "citation-1" }]]);

      await expect(printingCitationsRepo(db).update("citation-1", {})).resolves.toBe("citation-1");

      expect(parameters).toEqual([["citation-1"]]);
    });

    it("returns undefined when nothing matched, so the route can answer 404", async () => {
      const { db } = createRecordingDb([[]]);

      await expect(
        printingCitationsRepo(db).update("missing", { label: "Corrected" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("delete", () => {
    it("returns the deleted id", async () => {
      const { db } = createRecordingDb([[{ id: "citation-1" }]]);

      await expect(printingCitationsRepo(db).delete("citation-1")).resolves.toBe("citation-1");
    });

    it("returns undefined when nothing matched, so the route can answer 404", async () => {
      const { db } = createRecordingDb([[]]);

      await expect(printingCitationsRepo(db).delete("missing")).resolves.toBeUndefined();
    });
  });
});
