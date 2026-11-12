import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Transact } from "../../../deps.js";
import type { Io } from "../../../io.js";
import {
  cleanupOrphanedImageFiles,
  createNewPrinting,
  deletePrinting,
  insertNewPrinting,
  updatePrintingMarkers,
  withPrintingIdentityConflicts,
} from "./printing-admin.js";

vi.mock("./images/variants.js", () => ({
  deleteRehostFiles: vi.fn(async () => {}),
}));

import { deleteRehostFiles } from "./images/variants.js";

function mockTransact(trxRepos: unknown): Transact {
  return (fn) => fn(trxRepos as any) as any;
}

describe("updatePrintingMarkers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws NOT_FOUND when printing does not exist", async () => {
    const trxRepos = {
      catalogMutations: {
        getPrintingById: vi.fn(async () => null),
      },
      markers: {},
    };

    await expect(
      updatePrintingMarkers(mockTransact(trxRepos), "p-missing", ["promo"]),
    ).rejects.toThrow("Printing not found");
  });

  it("throws BAD_REQUEST when any marker slug is unknown", async () => {
    const trxRepos = {
      catalogMutations: {
        getPrintingById: vi.fn(async () => ({
          id: "p-uuid",
          shortCode: "OGN-001",
          finish: "normal",
        })),
      },
      markers: {
        listBySlugs: vi.fn(async () => [{ id: "m-1", slug: "promo" }]),
        setForPrinting: vi.fn(async () => {}),
      },
    };

    await expect(
      updatePrintingMarkers(mockTransact(trxRepos), "p-uuid", ["promo", "unknown"]),
    ).rejects.toThrow("Unknown marker slug(s): unknown");
  });

  it("clears markers when the slug list is empty", async () => {
    const setForPrinting = vi.fn(async () => {});
    const trxRepos = {
      catalogMutations: {
        getPrintingById: vi.fn(async () => ({
          id: "p-uuid",
          shortCode: "OGN-001",
          finish: "normal",
        })),
      },
      markers: { setForPrinting },
    };

    await updatePrintingMarkers(mockTransact(trxRepos), "p-uuid", []);

    expect(setForPrinting).toHaveBeenCalledWith("p-uuid", [], 1);
  });

  it("syncs markers via the join table for a non-empty slug list", async () => {
    const setForPrinting = vi.fn(async () => {});
    const trxRepos = {
      catalogMutations: {
        getPrintingById: vi.fn(async () => ({
          id: "p-uuid",
          shortCode: "OGN-001",
          finish: "normal",
        })),
      },
      markers: {
        listBySlugs: vi.fn(async () => [{ id: "m-1", slug: "promo" }]),
        setForPrinting,
      },
    };

    await updatePrintingMarkers(mockTransact(trxRepos), "p-uuid", ["promo"]);

    expect(setForPrinting).toHaveBeenCalledWith("p-uuid", ["m-1"], 1);
  });
});

const NO_PRINTING_BLOCKERS = {
  copies: 0,
  collectionEvents: 0,
  listEntries: 0,
  loans: 0,
  cardTrades: 0,
  marketplaceProductVariants: 0,
  productPrintings: 0,
};

describe("deletePrinting", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws NOT_FOUND when printing does not exist", async () => {
    const repos = {
      catalogMutations: {
        getPrintingById: vi.fn(async () => null),
      },
    };
    const transact = mockTransact(repos);

    await expect(deletePrinting(transact, {} as Io, repos as any, "p-missing")).rejects.toThrow(
      "Printing not found",
    );
  });

  it("unlinks candidates, deletes images, link overrides, and printing", async () => {
    const unlinkCandidatePrintingsByPrintingId = vi.fn(async () => {});
    const deletePrintingImagesByPrintingId = vi.fn(async () => []);
    const deletePrintingLinkOverridesById = vi.fn(async () => {});
    const deletePrintingById = vi.fn(async () => {});

    const repos = {
      catalogMutations: {
        getPrintingById: vi.fn(async () => ({ id: "p-uuid" })),
        deletePrintingImagesByPrintingId,
        deletePrintingById,
      },
      candidateCards: {
        unlinkCandidatePrintingsByPrintingId,
        deletePrintingLinkOverridesById,
      },
      catalogDeleteGuards: {
        countForPrinting: vi.fn(async () => NO_PRINTING_BLOCKERS),
      },
    };
    const transact = mockTransact(repos);

    await deletePrinting(transact, {} as Io, repos as any, "p-uuid");

    expect(unlinkCandidatePrintingsByPrintingId).toHaveBeenCalledWith("p-uuid");
    expect(deletePrintingImagesByPrintingId).toHaveBeenCalledWith("p-uuid");
    expect(deletePrintingLinkOverridesById).toHaveBeenCalledWith("p-uuid");
    expect(deletePrintingById).toHaveBeenCalledWith("p-uuid");
  });

  it("blocks the delete with a typed 409 naming the referencing user data", async () => {
    const deletePrintingById = vi.fn(async () => {});
    const repos = {
      catalogMutations: {
        getPrintingById: vi.fn(async () => ({ id: "p-uuid" })),
        deletePrintingById,
      },
      catalogDeleteGuards: {
        countForPrinting: vi.fn(async () => ({
          ...NO_PRINTING_BLOCKERS,
          copies: 3,
          listEntries: 1,
        })),
      },
    };
    const transact = mockTransact(repos);

    await expect(deletePrinting(transact, {} as Io, repos as any, "p-uuid")).rejects.toMatchObject({
      name: "AppError",
      status: 409,
      message:
        "Printing cannot be deleted, it is still referenced by: collection copies (3), list entries (1)",
    });
    expect(deletePrintingById).not.toHaveBeenCalled();
  });

  it("cleans up rehosted files on disk after transaction", async () => {
    const repos = {
      catalogMutations: {
        getPrintingById: vi.fn(async () => ({ id: "p-uuid" })),
        deletePrintingImagesByPrintingId: vi.fn(async () => [
          { imageFileId: "ci-1" },
          { imageFileId: "ci-2" },
        ]),
        deletePrintingById: vi.fn(async () => {}),
        getImageFileById: vi.fn(async (id: string) =>
          id === "ci-1"
            ? { id: "ci-1", rehostedUrl: "/media/cards/g1/img-1" }
            : { id: "ci-2", rehostedUrl: null },
        ),
        isImageFileReferenced: vi.fn(async () => false),
        deleteImageFileById: vi.fn(async () => {}),
      },
      candidateCards: {
        unlinkCandidatePrintingsByPrintingId: vi.fn(async () => {}),
        deletePrintingLinkOverridesById: vi.fn(async () => {}),
      },
      catalogDeleteGuards: {
        countForPrinting: vi.fn(async () => NO_PRINTING_BLOCKERS),
      },
    };
    const transact = mockTransact(repos);

    await deletePrinting(transact, {} as Io, repos as any, "p-uuid");

    expect(deleteRehostFiles).toHaveBeenCalledTimes(1);
    expect(deleteRehostFiles).toHaveBeenCalledWith({}, "/media/cards/g1/img-1");
  });
});

describe("cleanupOrphanedImageFiles", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function mut(file: { rehostedUrl: string | null } | undefined, referenced: boolean) {
    return {
      getImageFileById: vi.fn(async () => (file ? { id: "if-1", ...file } : undefined)),
      isImageFileReferenced: vi.fn(async () => referenced),
      deleteImageFileById: vi.fn(async () => true),
    };
  }

  it("keeps a file another image or a pin still uses, on disk and in the table", async () => {
    const repo = mut({ rehostedUrl: "/media/cards/f1/if-1" }, true);

    await cleanupOrphanedImageFiles({} as Io, repo as any, ["if-1"]);

    expect(deleteRehostFiles).not.toHaveBeenCalled();
    expect(repo.deleteImageFileById).not.toHaveBeenCalled();
  });

  it("deletes an unreferenced rehosted file from disk and the table", async () => {
    const repo = mut({ rehostedUrl: "/media/cards/f1/if-1" }, false);

    await cleanupOrphanedImageFiles({} as Io, repo as any, ["if-1"]);

    expect(deleteRehostFiles).toHaveBeenCalledWith({}, "/media/cards/f1/if-1");
    expect(repo.deleteImageFileById).toHaveBeenCalledWith("if-1");
  });

  it("deletes the row of an unreferenced file that was never rehosted", async () => {
    const repo = mut({ rehostedUrl: null }, false);

    await cleanupOrphanedImageFiles({} as Io, repo as any, ["if-1"]);

    expect(deleteRehostFiles).not.toHaveBeenCalled();
    expect(repo.deleteImageFileById).toHaveBeenCalledWith("if-1");
  });

  it("skips a file that is already gone", async () => {
    const repo = mut(undefined, false);

    await cleanupOrphanedImageFiles({} as Io, repo as any, ["if-1"]);

    expect(repo.isImageFileReferenced).not.toHaveBeenCalled();
    expect(repo.deleteImageFileById).not.toHaveBeenCalled();
  });
});

describe("insertNewPrinting", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function trxRepos(overrides: Record<string, Record<string, unknown>> = {}) {
    const base: Record<string, Record<string, unknown>> = {
      catalogMutations: {
        getCardById: vi.fn(async () => ({ id: "card-uuid", name: "Test", slug: "test" })),
        getPrintingCardIdByComposite: vi.fn(async () => null),
        findPrintingIdByIdentity: vi.fn(async () => null),
        insertPrinting: vi.fn(async () => "p-uuid"),
        findFaceIdByIdentity: vi.fn(async (): Promise<{ id: string } | undefined> => ({
          id: "face-1",
        })),
        findFaceById: vi.fn(async (): Promise<{ id: string } | undefined> => ({ id: "face-x" })),
        getSetIdBySlug: vi.fn(async () => ({ id: "set-uuid" })),
        sideOfFace: vi.fn(async () => 1),
      },
      candidateCards: {
        linkAndCheckCandidatePrintings: vi.fn(async () => {}),
      },
      printingImages: {
        insertImage: vi.fn(async () => "pi-1"),
      },
      enums: {
        all: vi.fn(async () => ({
          languages: ["EN", "DE"].map((slug) => ({ slug })),
          rarities: ["common", "uncommon", "rare", "epic", "showcase"].map((slug) => ({ slug })),
          artVariants: ["normal"].map((slug) => ({ slug })),
          finishes: ["normal", "foil"].map((slug) => ({ slug })),
          cardSizes: ["standard", "oversized"].map((slug) => ({ slug })),
          markers: ["promo"].map((slug) => ({ slug })),
        })),
      },
      distributionChannels: {
        listBySlugs: vi.fn(async (slugs: string[]) =>
          slugs.filter((slug) => slug === "worlds-2025").map((slug) => ({ id: "ch-1", slug })),
        ),
        setForPrinting: vi.fn(async () => {}),
      },
      sets: {
        upsert: vi.fn(async () => {}),
        getPrintedTotal: vi.fn(async () => null),
      },
      keywords: {
        listCostKeywords: vi.fn(async () => ["Equip", "Repeat"]),
        recomputeForPrintingCard: vi.fn(async () => {}),
      },
      cardTokens: {
        recomputeForPrintingCard: vi.fn(async () => {}),
      },
    };
    for (const [key, value] of Object.entries(overrides)) {
      base[key] = { ...base[key], ...value };
    }
    return base;
  }

  const FIELDS = {
    shortCode: "OGN-001",
    setId: "ogn",
    rarity: "common",
    artist: "A",
    publicCode: "001",
  };

  it("400s a printing without a set", async () => {
    const repos = trxRepos();
    await expect(
      insertNewPrinting(repos as any, "card-uuid", { ...FIELDS, setId: undefined }, ["cp-1"]),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("setId") });
    expect(repos.catalogMutations!.insertPrinting).not.toHaveBeenCalled();
  });

  it("400s a printing without a rarity instead of making it common", async () => {
    const repos = trxRepos();
    await expect(
      insertNewPrinting(repos as any, "card-uuid", { ...FIELDS, rarity: "" }, []),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("rarity, finish"),
    });
    expect(repos.catalogMutations!.insertPrinting).not.toHaveBeenCalled();
  });

  it("400s a printing without an artist or a public code", async () => {
    await expect(
      insertNewPrinting(
        trxRepos() as any,
        "card-uuid",
        { ...FIELDS, artist: "", publicCode: "" },
        [],
      ),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining("artist, publicCode"),
    });
  });

  it("keeps a stated finish over the one the rarity implies", async () => {
    const repos = trxRepos();

    await insertNewPrinting(repos as any, "card-uuid", { ...FIELDS, finish: "foil" }, []);

    expect(repos.catalogMutations!.insertPrinting).toHaveBeenCalledWith(
      expect.objectContaining({ finish: "foil", rarity: "common" }),
      null,
    );
  });

  it("throws BAD_REQUEST when any marker slug is unknown", async () => {
    await expect(
      insertNewPrinting(trxRepos() as any, "card-uuid", { ...FIELDS, markerSlugs: ["bogus"] }, [
        "cp-1",
      ]),
    ).rejects.toThrow('Printing not on an admin list: marker "bogus"');
  });

  it.each([
    ["finish", { finish: "glossy" }, 'finish "glossy"'],
    ["size", { size: "jumbo" }, 'size "jumbo"'],
    ["language", { language: "XX" }, 'language "XX"'],
    ["art variant", { artVariant: "borderless" }, 'art variant "borderless"'],
    ["distribution channel", { distributionChannelSlugs: ["mail-in"] }, 'channel "mail-in"'],
  ])("400s an unknown %s before touching the database", async (_field, override, named) => {
    const repos = trxRepos();

    await expect(
      insertNewPrinting(repos as any, "card-uuid", { ...FIELDS, ...override }, []),
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining(named) });
    expect(repos.catalogMutations!.insertPrinting).not.toHaveBeenCalled();
  });

  it("checks the finish it inferred from the rarity", async () => {
    const repos = trxRepos({
      enums: {
        all: vi.fn(async () => ({
          languages: [{ slug: "EN" }],
          rarities: [{ slug: "epic" }],
          artVariants: [],
          finishes: [{ slug: "normal" }],
          cardSizes: [{ slug: "standard" }],
          markers: [],
        })),
      },
    });

    await expect(
      insertNewPrinting(repos as any, "card-uuid", { ...FIELDS, rarity: "epic" }, []),
    ).rejects.toThrow('finish "foil"');
  });

  it("throws CONFLICT when printing identity belongs to a different card", async () => {
    const repos = trxRepos({
      catalogMutations: {
        getPrintingCardIdByComposite: vi.fn(async () => ({ cardId: "other-card-uuid" })),
      },
    });
    await expect(insertNewPrinting(repos as any, "card-uuid", FIELDS, ["cp-1"])).rejects.toThrow(
      "already belongs to a different card",
    );
  });

  it("throws CONFLICT when the card already has this printing identity, for every caller", async () => {
    const repos = trxRepos({
      catalogMutations: {
        getPrintingCardIdByComposite: vi.fn(async () => ({ cardId: "card-uuid" })),
        findPrintingIdByIdentity: vi.fn(async () => ({ id: "existing-uuid" })),
      },
    });

    await expect(
      insertNewPrinting(repos as any, "card-uuid", FIELDS, ["cp-1"]),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining(
        'This card already has a printing with short code "OGN-001"',
      ),
    });
    expect(repos.catalogMutations!.insertPrinting).not.toHaveBeenCalled();
    expect(repos.candidateCards!.linkAndCheckCandidatePrintings).not.toHaveBeenCalled();
  });

  it("matches the identity on finish, size, language and markers", async () => {
    const repos = trxRepos({});

    await insertNewPrinting(
      repos as any,
      "card-uuid",
      { ...FIELDS, finish: "foil", size: "oversized", language: "DE", markerSlugs: ["promo"] },
      [],
    );

    expect(repos.catalogMutations!.findPrintingIdByIdentity).toHaveBeenCalledWith(
      {
        cardId: "card-uuid",
        shortCode: "OGN-001",
        finish: "foil",
        size: "oversized",
        language: "DE",
        markerSlugs: ["promo"],
      },
      null,
    );
  });

  it("infers an omitted finish from the rarity", async () => {
    const repos = trxRepos();

    await insertNewPrinting(repos as any, "card-uuid", { ...FIELDS, rarity: "epic" }, []);

    expect(repos.catalogMutations!.insertPrinting).toHaveBeenCalledWith(
      expect.objectContaining({ finish: "foil" }),
      null,
    );
  });

  it("creates a double-sided printing on an existing second face", async () => {
    const repos = trxRepos({
      catalogMutations: {
        findFaceIdByIdentity: vi.fn(async (): Promise<{ id: string } | undefined> => undefined),
      },
    });

    await insertNewPrinting(
      repos as any,
      "card-uuid",
      { shortCode: "SGN-T01", setId: "sgn", rarity: "common", artist: "A", publicCode: "T01" },
      ["cp-1"],
      { secondFaceId: "face-gold" },
    );

    expect(repos.catalogMutations!.findPrintingIdByIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ shortCode: "SGN-T01" }),
      "face-gold",
    );
    expect(repos.catalogMutations!.insertPrinting).toHaveBeenCalledWith(
      expect.objectContaining({ shortCode: "SGN-T01" }),
      "face-gold",
    );
  });

  it("rejects a second face that is the printing's own side", async () => {
    const repos = trxRepos({
      catalogMutations: { findFaceIdByIdentity: vi.fn(async () => ({ id: "face-bird" })) },
    });

    await expect(
      insertNewPrinting(repos as any, "card-uuid", FIELDS, [], { secondFaceId: "face-bird" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("404s a second side that does not exist", async () => {
    const repos = trxRepos({ catalogMutations: { findFaceById: vi.fn(async () => undefined) } });

    await expect(
      insertNewPrinting(repos as any, "card-uuid", FIELDS, [], { secondFaceId: "face-missing" }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("creates a printing, syncs the channel join, attaches the image and links candidates", async () => {
    const repos = trxRepos();

    const result = await insertNewPrinting(
      repos as any,
      "card-uuid",
      {
        ...FIELDS,
        setName: "Origins",
        rarity: "common",
        imageUrl: "https://example.com/img.png",
        markerSlugs: ["promo"],
        distributionChannelSlugs: ["worlds-2025"],
      },
      ["cp-1"],
    );

    expect(result).toEqual({ printingId: "p-uuid", imageIds: ["pi-1"] });
    expect(repos.catalogMutations!.insertPrinting).toHaveBeenCalledWith(
      expect.objectContaining({ markerSlugs: ["promo"] }),
      null,
    );
    expect(repos.distributionChannels!.setForPrinting).toHaveBeenCalledWith("p-uuid", [
      { channelId: "ch-1" },
    ]);
    expect(repos.printingImages!.insertImage).toHaveBeenCalledWith(
      "p-uuid",
      "https://example.com/img.png",
      "main",
      "front",
    );
    expect(repos.candidateCards!.linkAndCheckCandidatePrintings).toHaveBeenCalledWith(
      ["cp-1"],
      "p-uuid",
    );
  });

  it("links nothing for a manual entry", async () => {
    const repos = trxRepos();

    await insertNewPrinting(repos as any, "card-uuid", FIELDS, []);

    expect(repos.catalogMutations!.insertPrinting).toHaveBeenCalledTimes(1);
    expect(repos.candidateCards!.linkAndCheckCandidatePrintings).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST for invalid rarity", async () => {
    await expect(
      insertNewPrinting(trxRepos() as any, "card-uuid", { ...FIELDS, rarity: "SuperDuperRare" }, [
        "cp-1",
      ]),
    ).rejects.toThrow('rarity "SuperDuperRare"');
  });

  it("puts the image on the accepted card's side when it sorts second", async () => {
    const repos = trxRepos({ catalogMutations: { sideOfFace: vi.fn(async () => 2) } });

    await insertNewPrinting(
      repos as any,
      "card-uuid",
      { ...FIELDS, imageUrl: "https://example.com/gold.png" },
      [],
      { secondFaceId: "face-bird" },
    );

    expect(repos.catalogMutations!.sideOfFace).toHaveBeenCalledWith("p-uuid", "face-1");
    expect(repos.printingImages!.insertImage).toHaveBeenCalledWith(
      "p-uuid",
      "https://example.com/gold.png",
      "main",
      "back",
    );
  });

  it("inserts no image and returns no image ids when imageUrl is absent", async () => {
    const repos = trxRepos();

    const result = await insertNewPrinting(repos as any, "card-uuid", FIELDS, ["cp-1"]);

    expect(repos.printingImages!.insertImage).not.toHaveBeenCalled();
    expect(result.imageIds).toEqual([]);
  });

  const uniqueViolation = (constraint: string) =>
    Object.assign(new Error("duplicate key"), { code: "23505", constraint_name: constraint });

  function failingCommit(repos: unknown, error: Error): Transact {
    return async (fn) => {
      await fn(repos as any);
      throw error;
    };
  }

  it("turns a concurrent duplicate caught at commit into the same 409", async () => {
    const transact = failingCommit(trxRepos(), uniqueViolation("uq_faces_identity"));

    await expect(
      createNewPrinting(transact, "card-uuid", { ...FIELDS, finish: "foil" }, ["cp-1"]),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining(
        'This card already has a printing with short code "OGN-001" (foil, standard, EN, no markers)',
      ),
    });
  });

  it("passes any other commit failure through", async () => {
    const error = uniqueViolation("uq_something_else");
    const transact = failingCommit(trxRepos(), error);

    await expect(createNewPrinting(transact, "card-uuid", FIELDS, [])).rejects.toBe(error);
  });

  it("maps the duplicate for a transaction that creates printings among other writes", async () => {
    const guarded = withPrintingIdentityConflicts(
      failingCommit({}, uniqueViolation("uq_printings_identity")),
    );

    await expect(guarded(async () => "done")).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });
});
