import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Repos, Transact } from "../../../deps.js";
import type { Io } from "../../../io.js";
import type { AdminAccess } from "../../../middleware/require-admin.js";
import {
  assertDeskImageFileScope,
  assertDeskPrintingScope,
  assertImageUploader,
  createDeskPrinting,
  imagesDeletableBy,
  removeDeskSide,
  setDeskSecondSide,
  updateDeskPrinting,
} from "./printing-desk.js";

const acceptPrinting = vi.hoisted(() =>
  vi.fn((..._args: unknown[]) => Promise.resolve("new-printing")),
);
const updatePrintingMarkers = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const updatePrintingDistributionChannels = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const recordAdminEvent = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("./printing-admin.js", () => ({
  acceptPrinting,
  updatePrintingMarkers,
  updatePrintingDistributionChannels,
}));
vi.mock("../../system/services/record-admin-event.js", () => ({ recordAdminEvent }));

const CARD = { id: "card-1", slug: "poro-snack", name: "Poro Snack" };

const OGN_SET_ID = "00000000-0000-4000-8000-000000000001";
const SFD_SET_ID = "00000000-0000-4000-8000-000000000002";
const SET_SLUGS: Record<string, string> = { [OGN_SET_ID]: "OGN", [SFD_SET_ID]: "SFD" };

const BASE_PRINTING = {
  id: "base-1",
  cardId: CARD.id,
  setId: OGN_SET_ID,
  shortCode: "OGN-001",
  publicCode: "OGN-001/298",
  rarity: "rare",
  artist: "Base Artist",
  printedRulesText: "Draw a card.",
  printedEffectText: null,
  flavorText: "Crunchy.",
  printedName: "Poro Snack",
  announcedAt: null,
  releasedAt: null,
  releasePrecision: null,
};

const FACE_LINKS: Record<string, { face1Id: string; face2Id: string | null }> = {
  bird: { face1Id: "face-bird", face2Id: null },
  gold: { face1Id: "face-gold", face2Id: null },
  paired: { face1Id: "face-bird", face2Id: "face-gold" },
  birdReprint: { face1Id: "face-bird", face2Id: null },
};

function makeRepos() {
  return {
    adminEvents: {
      imageIdsUploadedBy: vi.fn(() => Promise.resolve([] as string[])),
      printingIdsCreatedBy: vi.fn(() => Promise.resolve([] as string[])),
      wasPrintingCreatedBy: vi.fn(() => Promise.resolve(false)),
    },
    catalog: { refreshCatalogViews: vi.fn(() => Promise.resolve()) },
    catalogMutations: {
      getCardById: vi.fn(() => Promise.resolve(CARD)),
      getSetPrintedTotalForPrinting: vi.fn(() => Promise.resolve({ printedTotal: 298 })),
      findFaceIdByIdentity: vi.fn(() => Promise.resolve({ id: "new-face" })),
      updateFaceById: vi.fn(() => Promise.resolve(true)),
    },
    distributionChannels: {
      listForPrintingIds: vi.fn(() => Promise.resolve([{ channelSlug: "nexus-night-2026-09" }])),
    },
    markers: {},
    printingDesk: {
      isDeskPrinting: vi.fn((_id: string) => Promise.resolve(false)),
      nonDeskPrintingIdsForImageFile: vi.fn(() => Promise.resolve([] as string[])),
      getFullPrinting: vi.fn(() => Promise.resolve(BASE_PRINTING)),
      getFullPrintingForCard: vi.fn(() => Promise.resolve(BASE_PRINTING)),
      getBasePrinting: vi.fn(() => Promise.resolve(BASE_PRINTING)),
      updatePrintingDeskFields: vi.fn(() => Promise.resolve()),
      getFaceLinks: vi.fn((id: string) =>
        Promise.resolve(FACE_LINKS[id] as { face1Id: string; face2Id: string | null } | undefined),
      ),
      setSecondFace: vi.fn(() => Promise.resolve()),
      printingIdsShowingFace: vi.fn((): Promise<string[]> => Promise.resolve([])),
      deckCoversShowingFace: vi.fn(() => Promise.resolve(0)),
      lockFaceLinks: vi.fn((id: string) =>
        Promise.resolve(FACE_LINKS[id] as { face1Id: string; face2Id: string | null }),
      ),
      dropFace: vi.fn(() => Promise.resolve()),
      userReferenceCounts: vi.fn(() =>
        Promise.resolve({ copies: 0, listEntries: 0, trades: 0, loans: 0, listings: 0 }),
      ),
      findFace: vi.fn((id: string) => Promise.resolve(id === "face-missing" ? undefined : { id })),
    },
    printingEvents: {},
    printingImages: {},
    sets: {
      getPrintedTotal: vi.fn(() => Promise.resolve({ printedTotal: 298 })),
      getRef: vi.fn((id: string) =>
        Promise.resolve(SET_SLUGS[id] ? { slug: SET_SLUGS[id], name: "Set" } : undefined),
      ),
    },
  };
}

type FakeRepos = ReturnType<typeof makeRepos>;

const transact = ((fn) => fn({} as never)) as Transact;
const io = {} as Io;

const CREATE_INPUT = {
  cardId: CARD.id,
  setId: OGN_SET_ID,
  distributionChannelSlugs: ["skirmish-2026"],
  markerSlugs: ["prerelease"],
  codeTba: false,
  shortCode: "OGN-P01",
  finish: "foil",
  language: "EN",
  size: "standard",
  announcedAt: null,
  releasedAt: null,
  releasePrecision: null,
  comment: null,
} as const;

function create(repos: FakeRepos, over: Record<string, unknown> = {}) {
  return createDeskPrinting(transact, repos as unknown as Repos, io, "user-1", {
    ...CREATE_INPUT,
    ...over,
  } as never);
}

let repos: FakeRepos;

beforeEach(() => {
  vi.clearAllMocks();
  acceptPrinting.mockResolvedValue("new-printing");
  repos = makeRepos();
});

describe("createDeskPrinting", () => {
  it("derives a set-scoped TBA short code and leaves the public code unnumbered", async () => {
    await create(repos, { codeTba: true, shortCode: undefined });

    expect(acceptPrinting.mock.calls[0]?.[3]).toMatchObject({
      shortCode: "OGN-TBA-poro-snack",
      publicCode: "OGN-TBA",
    });
    // appendSetTotal would otherwise write "OGN-TBA/<set total>".
    expect(repos.catalogMutations.updateFaceById).toHaveBeenCalledWith("new-face", {
      publicCode: "OGN-TBA",
    });
  });

  it("leaves a real code alone and writes no public-code override", async () => {
    await create(repos);

    expect(acceptPrinting.mock.calls[0]?.[3]).toMatchObject({
      shortCode: "OGN-P01",
      publicCode: "OGN-P01",
    });
    expect(repos.catalogMutations.updateFaceById).not.toHaveBeenCalled();
  });

  it("rejects a create with no code and no TBA flag", async () => {
    await expect(create(repos, { shortCode: undefined })).rejects.toThrow("short code is required");
  });

  it("copies presentation fields off the base printing", async () => {
    await create(repos);

    expect(acceptPrinting.mock.calls[0]?.[3]).toMatchObject({
      artist: "Base Artist",
      rarity: "rare",
      printedRulesText: "Draw a card.",
      flavorText: "Crunchy.",
      printedName: "Poro Snack",
      artVariant: "normal",
      isSigned: false,
    });
  });

  it("prefers an explicitly given artist over the base printing's", async () => {
    await create(repos, { artist: "Guest Artist" });
    expect(acceptPrinting.mock.calls[0]?.[3]).toMatchObject({ artist: "Guest Artist" });
  });

  it("rejects a card with no base printing when no artist is given", async () => {
    repos.printingDesk.getBasePrinting.mockResolvedValue(undefined as never);
    await expect(create(repos)).rejects.toThrow("artist is required");
  });

  it("reads the named base printing's side that shows the card", async () => {
    await create(repos, { basePrintingId: "base-9" });
    expect(repos.printingDesk.getFullPrintingForCard).toHaveBeenCalledWith(
      "base-9",
      expect.any(String),
    );
    expect(repos.printingDesk.getBasePrinting).not.toHaveBeenCalled();
  });

  it("snaps a coarse release date to the start of its period", async () => {
    await create(repos, { releasedAt: "2026-05-17", releasePrecision: "quarter" });

    expect(repos.printingDesk.updatePrintingDeskFields).toHaveBeenCalledWith(
      "new-printing",
      expect.objectContaining({ releasedAt: "2026-04-01", releasePrecision: "quarter" }),
    );
  });

  it("keeps a day-precision date exactly as given", async () => {
    await create(repos, { releasedAt: "2026-05-17", releasePrecision: "day" });

    expect(repos.printingDesk.updatePrintingDeskFields).toHaveBeenCalledWith(
      "new-printing",
      expect.objectContaining({ releasedAt: "2026-05-17" }),
    );
  });

  it("writes the announcement date the caller gave", async () => {
    await create(repos, { announcedAt: "2026-02-14" });

    expect(repos.printingDesk.updatePrintingDeskFields).toHaveBeenCalledWith(
      "new-printing",
      expect.objectContaining({ announcedAt: "2026-02-14" }),
    );
  });

  it("rejects a release date without a precision", async () => {
    await expect(create(repos, { releasedAt: "2026-05-17" })).rejects.toThrow(
      "release date and a precision",
    );
  });

  it("rejects a precision without a release date", async () => {
    await expect(create(repos, { releasePrecision: "year" })).rejects.toThrow(
      "release date and a precision",
    );
  });

  it("records the create event and refreshes the catalog views", async () => {
    await create(repos);

    expect(recordAdminEvent).toHaveBeenCalledWith(
      repos,
      "user-1",
      expect.objectContaining({
        action: "printing.create",
        entityType: "printing",
        entityId: "new-printing",
        entityLabel: "OGN-P01",
        cardSlug: "poro-snack",
      }),
    );
    expect(repos.catalog.refreshCatalogViews).toHaveBeenCalled();
  });

  it("maps an identity unique violation to a 409", async () => {
    acceptPrinting.mockRejectedValue(
      Object.assign(new Error("duplicate"), {
        code: "23505",
        constraint_name: "uq_printings_identity",
      }),
    );

    await expect(create(repos)).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });
});

const FULL_ADMIN = { isAdmin: true, sections: [] } as unknown as AdminAccess;
const GRANT_HOLDER = { isAdmin: false, sections: ["printing-desk"] } as unknown as AdminAccess;

function update(targetRepos: FakeRepos, access: AdminAccess, patch: Record<string, unknown>) {
  const viaRepos = ((fn) => fn(targetRepos as unknown as Repos)) as Transact;
  return updateDeskPrinting(viaRepos, targetRepos as unknown as Repos, access, "user-1", {
    printingId: "p-1",
    ...patch,
  } as never);
}

describe("updateDeskPrinting", () => {
  it("writes only the fields the caller sent", async () => {
    await update(repos, FULL_ADMIN, { comment: "Handed out at the skirmish." });

    expect(repos.printingDesk.updatePrintingDeskFields).toHaveBeenCalledWith(
      "p-1",
      {
        comment: "Handed out at the skirmish.",
      },
      1,
    );
    expect(updatePrintingMarkers).not.toHaveBeenCalled();
    expect(updatePrintingDistributionChannels).not.toHaveBeenCalled();
  });

  it("routes markers and channels through the junction services", async () => {
    await update(repos, FULL_ADMIN, {
      markerSlugs: ["prerelease"],
      distributionChannelSlugs: ["skirmish-2026"],
    });

    expect(updatePrintingMarkers).toHaveBeenCalledWith(
      expect.any(Function),
      "p-1",
      ["prerelease"],
      1,
    );
    expect(updatePrintingDistributionChannels).toHaveBeenCalledWith(repos, "p-1", [
      "skirmish-2026",
    ]);
  });

  it("403s a grant holder editing a side another out-of-scope printing shows", async () => {
    repos.printingDesk.getFaceLinks.mockResolvedValue({ face1Id: "face-1", face2Id: null });
    repos.printingDesk.printingIdsShowingFace.mockResolvedValue(["p-1", "base-set"]);
    repos.printingDesk.isDeskPrinting.mockImplementation((id: string) =>
      Promise.resolve(id === "p-1"),
    );
    await expect(update(repos, GRANT_HOLDER, { artist: "New" })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("lets a grant holder change a shared printing's release date", async () => {
    repos.printingDesk.printingIdsShowingFace.mockResolvedValue(["p-1", "base-set"]);
    repos.printingDesk.isDeskPrinting.mockImplementation((id: string) =>
      Promise.resolve(id === "p-1"),
    );
    await expect(
      update(repos, GRANT_HOLDER, { releasedAt: "2026-05-01", releasePrecision: "day" }),
    ).resolves.toBeUndefined();
  });

  it("writes markers before a code change can re-sort the sides", async () => {
    await update(repos, FULL_ADMIN, { side: 2, shortCode: "OGN-T01", markerSlugs: ["promo"] });

    const markerCall = vi.mocked(updatePrintingMarkers).mock.invocationCallOrder[0]!;
    const fieldsCall = repos.printingDesk.updatePrintingDeskFields.mock.invocationCallOrder[0]!;
    expect(markerCall).toBeLessThan(fieldsCall);
    expect(updatePrintingMarkers).toHaveBeenCalledWith(expect.any(Function), "p-1", ["promo"], 2);
  });

  it("recomputes both codes when the TBA flag is set", async () => {
    await update(repos, FULL_ADMIN, { codeTba: true });

    expect(repos.printingDesk.updatePrintingDeskFields).toHaveBeenCalledWith(
      "p-1",
      {
        shortCode: "OGN-TBA-poro-snack",
        publicCode: "OGN-TBA",
      },
      1,
    );
  });

  it("rewrites a TBA code when the printing moves to another set", async () => {
    repos.printingDesk.getFullPrinting.mockResolvedValue({
      ...BASE_PRINTING,
      shortCode: "OGN-TBA-poro-snack",
      publicCode: "OGN-TBA",
    });

    await update(repos, FULL_ADMIN, { setId: SFD_SET_ID });

    expect(repos.printingDesk.updatePrintingDeskFields).toHaveBeenCalledWith(
      "p-1",
      {
        setId: SFD_SET_ID,
        shortCode: "SFD-TBA-poro-snack",
        publicCode: "SFD-TBA",
      },
      1,
    );
  });

  it("leaves a real code alone when the printing moves to another set", async () => {
    await update(repos, FULL_ADMIN, { setId: SFD_SET_ID });

    expect(repos.printingDesk.updatePrintingDeskFields).toHaveBeenCalledWith(
      "p-1",
      {
        setId: SFD_SET_ID,
      },
      1,
    );
  });

  it("appends the set total to a real code and leaves TBA unnumbered", async () => {
    await update(repos, FULL_ADMIN, { codeTba: false, shortCode: "OGN-P02" });

    expect(repos.printingDesk.updatePrintingDeskFields).toHaveBeenCalledWith(
      "p-1",
      {
        shortCode: "OGN-P02",
        publicCode: "OGN-P02/298",
      },
      1,
    );
  });

  it("snaps a coarse release date", async () => {
    await update(repos, FULL_ADMIN, { releasedAt: "2026-11-20", releasePrecision: "year" });

    expect(repos.printingDesk.updatePrintingDeskFields).toHaveBeenCalledWith(
      "p-1",
      {
        releasedAt: "2026-01-01",
        releasePrecision: "year",
      },
      1,
    );
  });

  it("clears a stored release date when both fields are sent as null", async () => {
    repos.printingDesk.getFullPrinting.mockResolvedValue({
      ...BASE_PRINTING,
      releasedAt: "2026-10-01",
      releasePrecision: "month",
    } as never);

    await update(repos, FULL_ADMIN, { releasedAt: null, releasePrecision: null });

    expect(repos.printingDesk.updatePrintingDeskFields).toHaveBeenCalledWith(
      "p-1",
      {
        releasedAt: null,
        releasePrecision: null,
      },
      1,
    );
  });

  it("clears a stored announcement date when null is sent", async () => {
    repos.printingDesk.getFullPrinting.mockResolvedValue({
      ...BASE_PRINTING,
      announcedAt: "2026-02-14",
    } as never);

    await update(repos, FULL_ADMIN, { announcedAt: null });

    expect(repos.printingDesk.updatePrintingDeskFields).toHaveBeenCalledWith(
      "p-1",
      {
        announcedAt: null,
      },
      1,
    );
  });

  it("records the update event with old and new values", async () => {
    await update(repos, FULL_ADMIN, { artist: "Guest Artist" });

    expect(recordAdminEvent).toHaveBeenCalledWith(
      repos,
      "user-1",
      expect.objectContaining({
        action: "printing.update",
        entityType: "printing",
        entityId: "p-1",
        oldValues: { artist: "Base Artist" },
        newValues: { artist: "Guest Artist" },
      }),
    );
  });

  it("files a face edit under the face's card, so its card history shows it", async () => {
    await update(repos, FULL_ADMIN, { artist: "Guest Artist" });

    expect(recordAdminEvent).toHaveBeenCalledWith(
      repos,
      "user-1",
      expect.objectContaining({ cardSlug: "poro-snack" }),
    );
  });

  it("files a printing-only edit under no card", async () => {
    await update(repos, FULL_ADMIN, { size: "oversized" });

    expect(recordAdminEvent).toHaveBeenCalledWith(
      repos,
      "user-1",
      expect.objectContaining({ cardSlug: null }),
    );
  });

  it("records the marker and channel slugs on both sides of the change", async () => {
    repos.printingDesk.getFullPrinting.mockResolvedValue({
      ...BASE_PRINTING,
      markerSlugs: ["stamped"],
    } as never);

    await update(repos, FULL_ADMIN, {
      markerSlugs: ["prerelease"],
      distributionChannelSlugs: ["skirmish-2026"],
    });

    expect(recordAdminEvent).toHaveBeenCalledWith(
      repos,
      "user-1",
      expect.objectContaining({
        oldValues: {
          markerSlugs: ["stamped"],
          distributionChannelSlugs: ["nexus-night-2026-09"],
        },
        newValues: {
          markerSlugs: ["prerelease"],
          distributionChannelSlugs: ["skirmish-2026"],
        },
      }),
    );
  });

  it("lets a grant holder edit a promo they did not add", async () => {
    repos.printingDesk.isDeskPrinting.mockResolvedValue(true);
    repos.adminEvents.wasPrintingCreatedBy.mockResolvedValue(false);

    await expect(update(repos, GRANT_HOLDER, { releasedAt: null })).resolves.toBeUndefined();
  });

  it("403s a grant holder on a printing outside the desk", async () => {
    repos.printingDesk.isDeskPrinting.mockResolvedValue(false);
    repos.adminEvents.wasPrintingCreatedBy.mockResolvedValue(false);

    await expect(update(repos, GRANT_HOLDER, { artist: "Guest Artist" })).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("maps an identity unique violation to a 409", async () => {
    repos.printingDesk.updatePrintingDeskFields.mockRejectedValue(
      Object.assign(new Error("duplicate"), {
        code: "23505",
        constraint_name: "uq_faces_variant",
      }),
    );

    await expect(update(repos, FULL_ADMIN, { shortCode: "OGN-P02" })).rejects.toMatchObject({
      status: 409,
      code: "CONFLICT",
    });
  });

  it("404s on a printing that does not exist", async () => {
    repos.printingDesk.getFullPrinting.mockResolvedValue(undefined as never);
    await expect(update(repos, FULL_ADMIN, { artist: "X" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("imagesDeletableBy", () => {
  it("gives a full admin every image without reading the event log", async () => {
    await expect(
      imagesDeletableBy(repos as unknown as Repos, FULL_ADMIN, "user-1", ["i-1", "i-2"]),
    ).resolves.toEqual(new Set(["i-1", "i-2"]));
    expect(repos.adminEvents.imageIdsUploadedBy).not.toHaveBeenCalled();
  });

  it("gives a grant holder only the images they uploaded", async () => {
    repos.adminEvents.imageIdsUploadedBy.mockResolvedValue(["i-2"]);
    await expect(
      imagesDeletableBy(repos as unknown as Repos, GRANT_HOLDER, "user-1", ["i-1", "i-2"]),
    ).resolves.toEqual(new Set(["i-2"]));
  });
});

describe("assertImageUploader", () => {
  it("lets the grant holder who uploaded the image through", async () => {
    repos.adminEvents.imageIdsUploadedBy.mockResolvedValue(["i-1"]);
    await expect(
      assertImageUploader(repos as unknown as Repos, GRANT_HOLDER, "user-1", "i-1"),
    ).resolves.toBeUndefined();
  });

  it("403s a grant holder on someone else's upload", async () => {
    repos.adminEvents.imageIdsUploadedBy.mockResolvedValue([]);
    await expect(
      assertImageUploader(repos as unknown as Repos, GRANT_HOLDER, "user-2", "i-1"),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("lets a full admin delete an image they did not upload", async () => {
    await expect(
      assertImageUploader(repos as unknown as Repos, FULL_ADMIN, "user-2", "i-1"),
    ).resolves.toBeUndefined();
  });
});

describe("assertDeskPrintingScope", () => {
  it("lets a full admin through without reading anything", async () => {
    await expect(
      assertDeskPrintingScope(repos as unknown as Repos, FULL_ADMIN, "user-1", "p-1"),
    ).resolves.toBeUndefined();
    expect(repos.printingDesk.isDeskPrinting).not.toHaveBeenCalled();
  });

  it("lets a grant holder through on a promo printing", async () => {
    repos.printingDesk.isDeskPrinting.mockResolvedValue(true);
    await expect(
      assertDeskPrintingScope(repos as unknown as Repos, GRANT_HOLDER, "user-1", "p-1"),
    ).resolves.toBeUndefined();
  });

  it("lets a grant holder through on a printing they added", async () => {
    repos.adminEvents.wasPrintingCreatedBy.mockResolvedValue(true);
    await expect(
      assertDeskPrintingScope(repos as unknown as Repos, GRANT_HOLDER, "user-1", "p-1"),
    ).resolves.toBeUndefined();
  });

  it("403s a grant holder on a base-set printing", async () => {
    await expect(
      assertDeskPrintingScope(repos as unknown as Repos, GRANT_HOLDER, "user-1", "p-1"),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });
});

describe("assertDeskImageFileScope", () => {
  it("passes a file that hangs on nothing outside the desk", async () => {
    await expect(
      assertDeskImageFileScope(repos as unknown as Repos, GRANT_HOLDER, "user-1", "if-1"),
    ).resolves.toBeUndefined();
  });

  it("403s a file shared with a base-set printing", async () => {
    repos.printingDesk.nonDeskPrintingIdsForImageFile.mockResolvedValue(["p-1"]);
    await expect(
      assertDeskImageFileScope(repos as unknown as Repos, GRANT_HOLDER, "user-1", "if-1"),
    ).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("passes when every printing outside the desk was added by the caller", async () => {
    repos.printingDesk.nonDeskPrintingIdsForImageFile.mockResolvedValue(["p-1"]);
    repos.adminEvents.wasPrintingCreatedBy.mockResolvedValue(true);
    await expect(
      assertDeskImageFileScope(repos as unknown as Repos, GRANT_HOLDER, "user-1", "if-1"),
    ).resolves.toBeUndefined();
  });
});

describe("setDeskSecondSide", () => {
  function pair(printingId: string, faceId: string, access = FULL_ADMIN) {
    const viaRepos = ((fn) => fn(repos as unknown as Repos)) as Transact;
    return setDeskSecondSide(viaRepos, repos as unknown as Repos, access, "user-1", {
      printingId,
      faceId,
    });
  }

  it("puts the face on the second side", async () => {
    await pair("bird", "face-gold");
    expect(repos.printingDesk.setSecondFace).toHaveBeenCalledWith("bird", "face-gold");
    expect(repos.catalog.refreshCatalogViews).toHaveBeenCalled();
  });

  it("reuses a face that another double-sided printing already shows", async () => {
    await pair("gold", "face-bird");
    expect(repos.printingDesk.setSecondFace).toHaveBeenCalledWith("gold", "face-bird");
  });

  it("refuses a second side on a printing users already hold", async () => {
    repos.printingDesk.userReferenceCounts.mockResolvedValue({
      copies: 1,
      listEntries: 0,
      trades: 0,
      loans: 0,
      listings: 0,
    });
    await expect(pair("bird", "face-gold")).rejects.toMatchObject({ status: 409 });
    expect(repos.printingDesk.setSecondFace).not.toHaveBeenCalled();
  });

  it("refuses to replace an existing second side", async () => {
    await expect(pair("paired", "face-brush")).rejects.toMatchObject({ status: 400 });
  });

  it("rejects the printing's own first side", async () => {
    await expect(pair("bird", "face-bird")).rejects.toMatchObject({ status: 400 });
    expect(repos.printingDesk.setSecondFace).not.toHaveBeenCalled();
  });

  it("404s an unknown face", async () => {
    await expect(pair("bird", "face-missing")).rejects.toMatchObject({ status: 404 });
  });

  it("404s an unknown printing", async () => {
    await expect(pair("missing", "face-gold")).rejects.toMatchObject({ status: 404 });
  });

  it("403s a grant holder outside the desk", async () => {
    await expect(pair("bird", "face-gold", GRANT_HOLDER)).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("removeDeskSide", () => {
  function remove(printingId: string, faceId: string) {
    const viaRepos = ((fn) => fn(repos as unknown as Repos)) as Transact;
    return removeDeskSide(viaRepos, repos as unknown as Repos, FULL_ADMIN, "user-1", {
      printingId,
      faceId,
    });
  }

  it("drops the named side, including the one stored first", async () => {
    await remove("paired", "face-bird");
    expect(repos.printingDesk.dropFace).toHaveBeenCalledWith("paired", "face-bird");
    expect(repos.catalog.refreshCatalogViews).toHaveBeenCalled();
  });

  it("refuses while users hold or point at the printing", async () => {
    repos.printingDesk.userReferenceCounts.mockResolvedValue({
      copies: 3,
      listEntries: 0,
      trades: 0,
      loans: 0,
      listings: 2,
    });
    await expect(remove("paired", "face-gold")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("3 copies, 2 marketplace listings"),
    });
    expect(repos.printingDesk.dropFace).not.toHaveBeenCalled();
  });

  it("refuses dropping a side only this printing shows while a deck uses it as a cover", async () => {
    repos.printingDesk.printingIdsShowingFace.mockResolvedValue(["paired"]);
    repos.printingDesk.deckCoversShowingFace.mockResolvedValue(2);
    await expect(remove("paired", "face-gold")).rejects.toMatchObject({ status: 409 });
    expect(repos.printingDesk.dropFace).not.toHaveBeenCalled();
  });

  it("rejects a side the printing does not show", async () => {
    await expect(remove("paired", "face-other")).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a single-sided printing", async () => {
    await expect(remove("bird", "face-bird")).rejects.toMatchObject({ status: 400 });
  });
});
