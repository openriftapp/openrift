import type {
  DeskPrintingRow,
  DeskSecondSide,
} from "@openrift/shared/contracts/admin/printing-desk";
import { describe, expect, it } from "vitest";

import { deskRowForFace, printingFaces } from "./printing-faces";

function second(overrides: Partial<DeskSecondSide> = {}): DeskSecondSide {
  return {
    faceId: "face-tentacle",
    cardName: "Tentacle",
    cardSlug: "tentacle",
    setId: "s-ven",
    setName: "Vendetta",
    shortCode: "VEN-T06",
    publicCode: "VEN-T06",
    rarity: "common",
    finish: "normal",
    language: "EN",
    artist: "Six More Vodka",
    markerSlugs: [],
    sharedWith: [],
    ...overrides,
  };
}

function row(overrides: Partial<DeskPrintingRow> = {}): DeskPrintingRow {
  return {
    faceId: "face-empowered",
    cardName: "Empowered",
    cardSlug: "empowered",
    setName: "Vendetta",
    publicCode: "VEN-T01",
    rarity: "common",
    finish: "normal",
    language: "EN",
    artist: "Six More Vodka",
    markerSlugs: [],
    sharedWith: [],
    side: 1,
    secondSide: null,
    ...overrides,
  } as DeskPrintingRow;
}

describe("printingFaces", () => {
  it("gives a single-faced printing one face in the front image slot", () => {
    const faces = printingFaces(row());

    expect(faces).toHaveLength(1);
    expect(faces[0]).toMatchObject({ position: 1, faceId: "face-empowered", imageFace: "front" });
  });

  it("puts the row's own face first when the row presents face 1", () => {
    const faces = printingFaces(row({ secondSide: second() }));

    expect(faces.map((face) => [face.position, face.cardName, face.imageFace])).toEqual([
      [1, "Empowered", "front"],
      [2, "Tentacle", "back"],
    ]);
  });

  it("keeps face 1 first when the row presents face 2", () => {
    const faces = printingFaces(row({ side: 2, secondSide: second({ cardName: "Shadow Clone" }) }));

    expect(faces.map((face) => face.cardName)).toEqual(["Shadow Clone", "Empowered"]);
    expect(faces[1]?.imageFace).toBe("back");
  });

  it("carries the printings each face is also on", () => {
    const sharedWith = [
      { printingId: "p-2", side: 2 as const, slug: "x", cardSlug: "tentacle", publicCode: "T" },
    ];
    const faces = printingFaces(row({ secondSide: second({ sharedWith }) }));

    expect(faces[1]?.sharedWith).toEqual(sharedWith);
  });
});

describe("deskRowForFace", () => {
  it("opens the printing the user came from when it carries the face", () => {
    const from = row({ printingId: "p-pair", faceId: "face-empowered", secondSide: second() });
    const other = row({ printingId: "p-tentacle", faceId: "face-tentacle", canEdit: true });

    expect(deskRowForFace([other, from], "face-tentacle", "p-pair")).toBe(from);
  });

  it("ignores a remembered printing that does not carry the face", () => {
    const stale = row({ printingId: "p-empowered", faceId: "face-empowered" });
    const onFace = row({ printingId: "p-tentacle", faceId: "face-tentacle", canEdit: true });

    expect(deskRowForFace([stale, onFace], "face-tentacle", "p-empowered")).toBe(onFace);
  });

  it("finds nothing when no row carries the face", () => {
    const stale = row({ printingId: "p-empowered", faceId: "face-empowered" });

    expect(deskRowForFace([stale], "face-tentacle", "p-empowered")).toBeNull();
  });
});
