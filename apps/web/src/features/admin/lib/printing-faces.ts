import type {
  DeskImage,
  DeskPrintingRow,
  DeskSharedPrinting,
} from "@openrift/shared/contracts/admin/printing-desk";

export interface PrintingFace {
  position: 1 | 2;
  faceId: string;
  imageFace: DeskImage["face"];
  cardName: string;
  cardSlug: string;
  setName: string;
  publicCode: string;
  rarity: string;
  finish: string;
  language: string;
  artist: string;
  markerSlugs: string[];
  sharedWith: DeskSharedPrinting[];
}

/** The printing's faces in display order, whichever face the row presents. */
export function printingFaces(row: DeskPrintingRow): PrintingFace[] {
  const own = {
    faceId: row.faceId,
    cardName: row.cardName,
    cardSlug: row.cardSlug,
    setName: row.setName,
    publicCode: row.publicCode,
    rarity: row.rarity,
    finish: row.finish,
    language: row.language,
    artist: row.artist,
    markerSlugs: row.markerSlugs,
    sharedWith: row.sharedWith,
  };
  const second = row.secondSide;
  if (second === null) {
    return [{ ...own, position: 1, imageFace: "front" }];
  }
  const other = {
    faceId: second.faceId,
    cardName: second.cardName,
    cardSlug: second.cardSlug,
    setName: second.setName,
    publicCode: second.publicCode,
    rarity: second.rarity,
    finish: second.finish,
    language: second.language,
    artist: second.artist,
    markerSlugs: second.markerSlugs,
    sharedWith: second.sharedWith,
  };
  const [first, last] = row.side === 2 ? [other, own] : [own, other];
  return [
    { ...first, position: 1, imageFace: "front" },
    { ...last, position: 2, imageFace: "back" },
  ];
}
