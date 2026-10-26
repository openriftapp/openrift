import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { describe, expect, it } from "vitest";

import { makeAdminPrinting, makeCandidatePrinting } from "@/test/factories";

import type { CreationDraft, DraftFace, DuplicateProbe } from "./creation-draft";
import {
  draftFromBasePrinting,
  draftFromCandidatePrinting,
  draftFromDeskPrinting,
  duplicateProbeFromAdminPrinting,
  duplicateProbeFromDeskRow,
  emptyFaceFields,
  existingFacesFromDeskRows,
  faceToNew,
  findDuplicateCandidates,
  plannedImageUploads,
  printingFollowUpFields,
  toAcceptInput,
  toDeskCreateInput,
  validateDraft,
} from "./creation-draft";

const CARD = { id: "card-ahri", slug: "ahri-alluring", name: "Ahri, Alluring" };

function deskRow(overrides: Partial<DeskPrintingRow> = {}): DeskPrintingRow {
  return {
    printingId: "p-1",
    slug: "ogn-066",
    cardId: CARD.id,
    cardSlug: CARD.slug,
    cardName: CARD.name,
    cardType: "unit",
    setId: "set-uuid",
    setName: "Origins",
    setSlug: "OGN",
    shortCode: "OGN-066",
    publicCode: "OGN-066/298",
    rarity: "rare",
    finish: "normal",
    language: "EN",
    size: "standard",
    artist: "Kudos",
    markerSlugs: [],
    distributionChannelSlugs: [],
    announcedAt: null,
    releasedAt: null,
    releasePrecision: null,
    comment: null,
    imageCount: 1,
    faceId: "face-1",
    side: 1,
    secondSide: null,
    sharedWith: [],
    activeImageFileId: null,
    activeImageUrl: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    canEdit: true,
    ...overrides,
  };
}

function promoDraft(overrides: Partial<CreationDraft> = {}): CreationDraft {
  const draft = draftFromBasePrinting(CARD, deskRow(), {
    language: "FR",
    finish: "normal",
    size: "standard",
  });
  const face = draft.faces[0] as DraftFace;
  return {
    ...draft,
    faces: [{ ...face, fields: { ...face.fields, shortCode: "OGN-066p", finish: "foil" } }],
    printing: { ...draft.printing, distributionChannelSlugs: ["regional", "organized-play"] },
    ...overrides,
  };
}

function probe(overrides: Partial<DuplicateProbe> = {}): DuplicateProbe {
  return {
    printingId: "existing",
    cardId: CARD.id,
    side: 1,
    shortCode: "OGN-066p",
    publicCode: "OGN-066p",
    language: "ZH",
    finish: "foil",
    size: "standard",
    markerSlugs: [],
    distributionChannelSlugs: ["organized-play", "regional"],
    ...overrides,
  };
}

function file(name: string): File {
  return new File(["x"], name, { type: "image/png" });
}

describe("findDuplicateCandidates", () => {
  it("flags a printing with the same stem and channels in another language", () => {
    const hits = findDuplicateCandidates(promoDraft(), [probe()]);

    expect(hits).toEqual([
      expect.objectContaining({ printingId: "existing", kind: "other-language", identical: false }),
    ]);
  });

  it("marks a same-language match with the same identity as identical", () => {
    const hits = findDuplicateCandidates(promoDraft(), [probe({ language: "FR" })]);

    expect(hits).toEqual([expect.objectContaining({ kind: "same-language", identical: true })]);
  });

  it("matches on the code stem, so a different suffix still hits", () => {
    const hits = findDuplicateCandidates(promoDraft(), [
      probe({ shortCode: "OGN-066", publicCode: "OGN-066/298", language: "FR" }),
    ]);

    expect(hits).toEqual([expect.objectContaining({ kind: "same-language", identical: false })]);
  });

  it("lists same-language hits before other languages", () => {
    const hits = findDuplicateCandidates(promoDraft(), [
      probe({ printingId: "zh" }),
      probe({ printingId: "fr", language: "FR", finish: "normal" }),
    ]);

    expect(hits.map((hit) => hit.printingId)).toEqual(["fr", "zh"]);
  });

  it("misses a printing on different channels", () => {
    expect(
      findDuplicateCandidates(promoDraft(), [probe({ distributionChannelSlugs: ["store-event"] })]),
    ).toEqual([]);
  });

  it("flags an identical printing on other channels, which would conflict", () => {
    const hits = findDuplicateCandidates(promoDraft(), [
      probe({ language: "FR", distributionChannelSlugs: ["store-event"] }),
    ]);

    expect(hits).toEqual([expect.objectContaining({ kind: "same-language", identical: true })]);
  });

  it("misses a printing with a different stem", () => {
    expect(findDuplicateCandidates(promoDraft(), [probe({ shortCode: "OGN-067p" })])).toEqual([]);
  });

  it("matches two printings without channels", () => {
    const draft = promoDraft();
    const hits = findDuplicateCandidates(
      { ...draft, printing: { ...draft.printing, distributionChannelSlugs: [] } },
      [probe({ distributionChannelSlugs: [] })],
    );

    expect(hits).toHaveLength(1);
  });

  it("ignores other cards and second sides", () => {
    expect(
      findDuplicateCandidates(promoDraft(), [probe({ cardId: "other" }), probe({ side: 2 })]),
    ).toEqual([]);
  });

  it("returns nothing for a code that is not announced yet", () => {
    const draft = promoDraft();
    const face = draft.faces[0] as DraftFace;
    const tba: CreationDraft = {
      ...draft,
      faces: [{ ...face, fields: { ...face.fields, codeTba: true } }],
    };

    expect(findDuplicateCandidates(tba, [probe()])).toEqual([]);
  });

  it("returns nothing for a new card", () => {
    const draft = promoDraft({ card: { mode: "new", slug: "x", name: "X", summary: "" } });

    expect(findDuplicateCandidates(draft, [probe()])).toEqual([]);
  });

  it("reads desk rows and admin printings alike", () => {
    expect(duplicateProbeFromDeskRow(deskRow())).toMatchObject({
      printingId: "p-1",
      cardId: CARD.id,
      side: 1,
    });
    const admin = makeAdminPrinting({ id: "a-1", cardId: CARD.id, side: 2 });

    expect(duplicateProbeFromAdminPrinting(admin)).toMatchObject({ printingId: "a-1", side: 2 });
  });
});

describe("draftFromBasePrinting", () => {
  it("copies the base face without code or markers and takes the chosen language", () => {
    const draft = draftFromBasePrinting(CARD, deskRow({ markerSlugs: ["promo"] }), {
      language: "FR",
      finish: "normal",
      size: "standard",
    });

    expect(draft.basePrintingId).toBe("p-1");
    expect(draft.faces[0]?.fields).toMatchObject({
      shortCode: "",
      markerSlugs: [],
      language: "FR",
      setId: "set-uuid",
      artist: "Kudos",
    });
  });

  it("starts empty when the card has nothing to copy from", () => {
    const draft = draftFromBasePrinting(CARD, undefined, {
      language: "EN",
      finish: "normal",
      size: "standard",
    });

    expect(draft.basePrintingId).toBeUndefined();
    expect(draft.faces[0]?.fields.setId).toBe("");
    expect(draft.printing.size).toBe("standard");
  });

  it("takes a prefilled finish over the base face's finish", () => {
    const draft = draftFromBasePrinting(
      CARD,
      deskRow({ finish: "normal" }),
      { language: "FR", finish: "normal", size: "standard" },
      { finish: "foil" },
    );

    expect(draft.faces[0]?.fields).toMatchObject({ language: "FR", finish: "foil" });
  });
});

describe("draftFromDeskPrinting", () => {
  it("picks the printing's faces and copies its printing fields", () => {
    const printing = deskRow({
      distributionChannelSlugs: ["regional"],
      comment: "One per player.",
      secondSide: {
        faceId: "face-gold",
        cardName: "Gold",
        cardSlug: "gold",
        setId: "set-uuid",
        setName: "Origins",
        shortCode: "OGN-T01",
        publicCode: "OGN-T01",
        rarity: "common",
        finish: "normal",
        language: "EN",
        artist: "Kudos",
        markerSlugs: [],
        sharedWith: [],
      },
    });
    const draft = draftFromDeskPrinting(CARD, printing);

    expect(draft.faces.map((face) => face.mode === "existing" && face.faceId)).toEqual([
      "face-1",
      "face-gold",
    ]);
    expect(draft.printing).toMatchObject({
      distributionChannelSlugs: ["regional"],
      comment: "One per player.",
    });
  });
});

describe("existingFacesFromDeskRows", () => {
  it("lists each face once, second faces included", () => {
    const gold = {
      faceId: "face-gold",
      cardName: "Gold",
      cardSlug: "gold",
      setId: "set-uuid",
      setName: "Origins",
      shortCode: "OGN-T01",
      publicCode: "OGN-T01",
      rarity: "common",
      finish: "normal",
      language: "EN",
      artist: "Kudos",
      markerSlugs: [],
      sharedWith: [],
    };
    const faces = existingFacesFromDeskRows([
      deskRow({ printingId: "a", secondSide: gold }),
      deskRow({ printingId: "b", secondSide: gold }),
    ]);

    expect(faces.map((face) => face.mode === "existing" && face.faceId)).toEqual([
      "face-1",
      "face-gold",
    ]);
  });
});

describe("faceToNew", () => {
  it("keeps the fields and images and makes them editable", () => {
    const [existing] = existingFacesFromDeskRows([deskRow()]);
    const face = faceToNew(existing as DraftFace);

    expect(face.mode).toBe("new");
    expect(face.fields.shortCode).toBe("OGN-066");
  });
});

describe("validateDraft", () => {
  it("accepts a filled promo draft", () => {
    expect(validateDraft(promoDraft())).toEqual([]);
  });

  it("asks for the card and the code", () => {
    const draft = promoDraft({ card: null });
    const face = draft.faces[0] as DraftFace;
    const issues = validateDraft({
      ...draft,
      faces: [{ ...face, fields: { ...face.fields, shortCode: " " } }],
    });

    expect(issues.map((issue) => issue.path)).toEqual(["card", "faces.0.shortCode"]);
  });

  it("does not need a code that is not announced yet", () => {
    const draft = promoDraft();
    const face = draft.faces[0] as DraftFace;

    expect(
      validateDraft({
        ...draft,
        faces: [{ ...face, fields: { ...face.fields, shortCode: "", codeTba: true } }],
      }),
    ).toEqual([]);
  });

  it("rejects a new second face, which neither create path can make", () => {
    const draft = promoDraft();
    const issues = validateDraft({
      ...draft,
      faces: [...draft.faces, { mode: "new", fields: emptyFaceFields(), images: [] }],
    });

    expect(issues).toEqual([
      { path: "faces.1", message: "Pick an existing face for the second face." },
    ]);
  });

  it("rejects the same face twice and a first face from another card", () => {
    const [face] = existingFacesFromDeskRows([deskRow({ cardSlug: "other" })]);
    const issues = validateDraft({
      ...promoDraft(),
      faces: [face as DraftFace, face as DraftFace],
    });

    expect(issues.map((issue) => issue.path)).toEqual(["faces.1", "faces.0"]);
  });

  it("needs the artist without a base printing", () => {
    const draft = promoDraft({ basePrintingId: undefined });
    const face = draft.faces[0] as DraftFace;

    expect(
      validateDraft({ ...draft, faces: [{ ...face, fields: { ...face.fields, artist: "" } }] }),
    ).toEqual([{ path: "faces.0.artist", message: "Enter the artist." }]);
  });

  it("refuses a new card on the desk", () => {
    expect(
      validateDraft(promoDraft({ card: { mode: "new", slug: "x", name: "X", summary: "" } })),
    ).toEqual([{ path: "card", message: "The printing desk adds printings to existing cards." }]);
  });
});

describe("toDeskCreateInput", () => {
  it("maps a new face onto the desk create input", () => {
    const draft = promoDraft();
    const input = toDeskCreateInput({
      ...draft,
      printing: {
        ...draft.printing,
        announcedAt: "2026-10-18",
        releasedAt: "2026-11-20",
        releasePrecision: "month",
        comment: "  One per player. ",
      },
    });

    expect(input).toEqual({
      cardId: CARD.id,
      setId: "set-uuid",
      distributionChannelSlugs: ["regional", "organized-play"],
      markerSlugs: [],
      codeTba: false,
      shortCode: "OGN-066p",
      finish: "foil",
      language: "FR",
      size: "standard",
      artist: "Kudos",
      announcedAt: "2026-10-18",
      releasedAt: "2026-11-01",
      releasePrecision: "month",
      comment: "One per player.",
      basePrintingId: "p-1",
      secondSideFaceId: undefined,
    });
  });

  it("drops the code when it is not announced and clears an empty note", () => {
    const draft = promoDraft();
    const face = draft.faces[0] as DraftFace;
    const input = toDeskCreateInput({
      ...draft,
      faces: [{ ...face, fields: { ...face.fields, codeTba: true, artist: " " } }],
    });

    expect(input).toMatchObject({ codeTba: true, shortCode: undefined, artist: undefined });
    expect(input.comment).toBeNull();
    expect(input.releasedAt).toBeNull();
    expect(input.releasePrecision).toBeNull();
  });

  it("copies from an existing first face and sends the second face by id", () => {
    const [first] = existingFacesFromDeskRows([deskRow({ printingId: "p-base" })]);
    const [second] = existingFacesFromDeskRows([
      deskRow({ printingId: "p-gold", faceId: "face-gold", cardSlug: "gold" }),
    ]);
    const input = toDeskCreateInput({
      ...promoDraft(),
      faces: [first as DraftFace, second as DraftFace],
    });

    expect(input).toMatchObject({
      shortCode: "OGN-066",
      basePrintingId: "p-base",
      secondSideFaceId: "face-gold",
    });
  });

  it("throws without an existing card", () => {
    expect(() => toDeskCreateInput(promoDraft({ card: null }))).toThrow();
  });
});

describe("toAcceptInput", () => {
  const candidate = makeCandidatePrinting({
    id: "cand-1",
    shortCode: "OGN-066p",
    publicCode: "OGN-066p",
    setId: "OGN",
    rarity: "rare",
    finish: "foil",
    language: "FR",
    distributionChannelSlugs: ["regional"],
    imageUrl: "https://img.example/ahri.png",
  });

  it("maps a candidate draft onto the accept input with its source image", () => {
    const draft = draftFromCandidatePrinting(
      { mode: "existing", ...CARD },
      candidate,
      "Provider A",
    );

    expect(toAcceptInput(draft)).toEqual({
      cardId: CARD.id,
      candidatePrintingIds: ["cand-1"],
      printingFields: expect.objectContaining({
        shortCode: "OGN-066p",
        publicCode: "OGN-066p",
        setId: "OGN",
        rarity: "rare",
        finish: "foil",
        size: "standard",
        language: "FR",
        distributionChannelSlugs: ["regional"],
        imageUrl: "https://img.example/ahri.png",
      }),
    });
  });

  it("takes the id of a card created in the same step and the second face", () => {
    const draft = draftFromCandidatePrinting(
      { mode: "new", slug: "ahri", name: "Ahri", summary: "" },
      candidate,
      "Provider A",
    );
    const [second] = existingFacesFromDeskRows([deskRow({ faceId: "face-gold" })]);
    const input = toAcceptInput(
      { ...draft, faces: [...draft.faces, second as DraftFace] },
      "new-id",
    );

    expect(input.cardId).toBe("new-id");
    expect(input.secondSideFaceId).toBe("face-gold");
  });

  it("throws for a new card without an id", () => {
    const draft = draftFromCandidatePrinting(
      { mode: "new", slug: "ahri", name: "Ahri", summary: "" },
      candidate,
      "Provider A",
    );

    expect(() => toAcceptInput(draft)).toThrow();
  });
});

describe("printingFollowUpFields", () => {
  it("is null when there is nothing the accept path leaves out", () => {
    expect(printingFollowUpFields(promoDraft())).toBeNull();
  });

  it("returns the dates and the note", () => {
    const draft = promoDraft();

    expect(
      printingFollowUpFields({
        ...draft,
        printing: { ...draft.printing, releasedAt: "2026-11-20", releasePrecision: "year" },
      }),
    ).toEqual({
      announcedAt: null,
      releasedAt: "2026-01-01",
      releasePrecision: "year",
      comment: null,
    });
  });
});

describe("plannedImageUploads", () => {
  it("makes the first file on a new face the main image and maps faces to front and back", () => {
    const draft = promoDraft();
    const face = draft.faces[0] as DraftFace;
    const [second] = existingFacesFromDeskRows([deskRow({ faceId: "face-gold" })]);
    const plan = plannedImageUploads({
      ...draft,
      faces: [
        {
          ...face,
          images: [
            { kind: "file", key: "a", file: file("a.png") },
            { kind: "file", key: "b", file: file("b.png") },
          ],
        },
        { ...(second as DraftFace), images: [{ kind: "file", key: "c", file: file("c.png") }] },
      ],
    });

    expect(plan.map(({ face: side, mode, image }) => [side, mode, image.key])).toEqual([
      ["front", "main", "a"],
      ["front", "additional", "b"],
      ["back", "additional", "c"],
    ]);
  });

  it("leaves the first source scan to the accept call", () => {
    const candidate = makeCandidatePrinting({ id: "c", imageUrl: "https://img.example/x.png" });
    const draft = draftFromCandidatePrinting(
      { mode: "existing", ...CARD },
      candidate,
      "Provider A",
    );
    const face = draft.faces[0] as DraftFace;
    const plan = plannedImageUploads({
      ...draft,
      faces: [
        { ...face, images: [...face.images, { kind: "file", key: "f", file: file("f.png") }] },
      ],
    });

    expect(plan.map(({ mode, image }) => [mode, image.key])).toEqual([["additional", "f"]]);
  });
});
