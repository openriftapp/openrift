import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Transact } from "../../../deps.js";
import { AppError } from "../../../errors.js";
import type { Io } from "../../../io.js";
import { candidatePrintingRow as cp } from "../../../test/candidate-printing-row.js";

vi.mock("../../catalog/services/printing-admin.js", () => ({
  createNewPrinting: vi.fn(),
}));
vi.mock("../../catalog/services/images/jobs.js", () => ({
  rehostImagesInBackground: vi.fn(),
}));
vi.mock("./relink-candidates.js", () => ({
  relinkCandidatePrintings: vi.fn(async () => ({ examined: 0, linked: 0 })),
}));

import { rehostImagesInBackground } from "../../catalog/services/images/jobs.js";
import { createNewPrinting } from "../../catalog/services/printing-admin.js";
import {
  acceptCandidateGroup,
  acceptCandidateGroups,
  finishPrintingAccepts,
  UNEXPECTED_FAILURE,
} from "./accept-candidate-printings.js";
import { relinkCandidatePrintings } from "./relink-candidates.js";

const transact: Transact = (fn) => fn({} as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createNewPrinting).mockResolvedValue({ printingId: "p-1", imageIds: ["img-1"] });
});

describe("acceptCandidateGroup", () => {
  it("inserts the group's printing with the inferred finish and links every candidate", async () => {
    const outcome = await acceptCandidateGroup(transact, "card-1", [
      cp("a", { finish: null, rarity: "epic" }),
      cp("b", { finish: "foil", rarity: "epic" }),
    ]);

    expect(outcome).toMatchObject({ printing: { printingId: "p-1" } });
    expect(createNewPrinting).toHaveBeenCalledWith(
      transact,
      "card-1",
      expect.objectContaining({ finish: "foil", publicCode: "OGN-027/298" }),
      ["a", "b"],
    );
  });

  it("refuses a group without a public code before touching the database", async () => {
    const outcome = await acceptCandidateGroup(transact, "card-1", [cp("a", { publicCode: null })]);

    expect(outcome).toEqual({ reason: "missing: publicCode" });
    expect(createNewPrinting).not.toHaveBeenCalled();
  });

  it("turns an existing printing into a reason", async () => {
    vi.mocked(createNewPrinting).mockRejectedValueOnce(
      new AppError(409, "CONFLICT", "This card already has a printing"),
    );

    expect(await acceptCandidateGroup(transact, "card-1", [cp("a")])).toEqual({
      reason: "This card already has a printing",
    });
  });
});

describe("skip reasons", () => {
  it("never carries a raw database message", async () => {
    vi.mocked(createNewPrinting).mockRejectedValueOnce(
      new Error(
        'insert or update on table "faces" violates foreign key constraint "fk_faces_finish"',
      ),
    );

    const outcome = await acceptCandidateGroup(transact, "card-1", [cp("a")]);

    expect(outcome).toEqual({ reason: UNEXPECTED_FAILURE });
  });

  it("passes a readable refusal through as the reason", async () => {
    vi.mocked(createNewPrinting).mockRejectedValueOnce(
      new AppError(400, "BAD_REQUEST", 'Printing not on an admin list: finish "glossy"'),
    );

    expect(await acceptCandidateGroup(transact, "card-1", [cp("a")])).toEqual({
      reason: 'Printing not on an admin list: finish "glossy"',
    });
  });
});

describe("acceptCandidateGroups", () => {
  it("accepts one printing per identity and reports the rest", async () => {
    const result = await acceptCandidateGroups(transact, "card-1", [
      cp("a"),
      cp("b", { shortCode: "ogn-027" }),
      cp("c", { shortCode: "OGN-028", artist: null }),
    ]);

    expect(createNewPrinting).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createNewPrinting).mock.calls[0]?.[3]).toEqual(["a", "b"]);
    expect(result).toEqual({
      created: [{ printingId: "p-1", imageIds: ["img-1"] }],
      skipped: [{ shortCode: "OGN-028", reason: "missing: artist" }],
    });
  });
});

describe("finishPrintingAccepts", () => {
  function repos() {
    return {
      candidateCards: {},
      ingest: {},
      catalog: { refreshCatalogViews: vi.fn(async () => {}) },
      printingEvents: { recordNew: vi.fn(async () => {}) },
      printingImages: {},
    };
  }
  const io = {} as Io;

  it("records events, refreshes, relinks and rehosts once for the whole request", async () => {
    const r = repos();

    await finishPrintingAccepts(r as never, io, [
      { printingId: "p-1", imageIds: ["img-1"] },
      { printingId: "p-2", imageIds: [] },
    ]);

    expect(r.printingEvents.recordNew).toHaveBeenCalledTimes(2);
    expect(r.catalog.refreshCatalogViews).toHaveBeenCalledTimes(1);
    expect(relinkCandidatePrintings).toHaveBeenCalledTimes(1);
    expect(rehostImagesInBackground).toHaveBeenCalledWith(io, r.printingImages, ["img-1"]);
  });

  it("refreshes only the views when the catalog changed without a new printing", async () => {
    const r = repos();

    await finishPrintingAccepts(r as never, io, [], { catalogChanged: true });

    expect(r.catalog.refreshCatalogViews).toHaveBeenCalledTimes(1);
    expect(relinkCandidatePrintings).not.toHaveBeenCalled();
  });

  it("does nothing when no printing was created", async () => {
    const r = repos();

    await finishPrintingAccepts(r as never, io, []);

    expect(r.catalog.refreshCatalogViews).not.toHaveBeenCalled();
    expect(relinkCandidatePrintings).not.toHaveBeenCalled();
  });
});
