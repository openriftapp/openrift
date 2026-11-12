import type { Selectable } from "kysely";

import type { CandidatePrintingsTable } from "../db/tables/candidates.js";

export function candidatePrintingRow(
  id: string,
  over: Partial<Selectable<CandidatePrintingsTable>> = {},
): Selectable<CandidatePrintingsTable> {
  return {
    id,
    candidateCardId: "cc-1",
    printingId: null,
    shortCode: "OGN-027",
    setId: "ogn",
    setName: "Origins",
    rarity: "rare",
    artVariant: null,
    isSigned: null,
    isOvernumbered: null,
    markerSlugs: [],
    distributionChannelSlugs: [],
    finish: "normal",
    size: null,
    artist: "Kudos Productions",
    publicCode: "OGN-027/298",
    printedRulesText: null,
    printedEffectText: null,
    imageUrl: null,
    imageFingerprint: null,
    imageFingerprintUrl: null,
    flavorText: null,
    externalId: id,
    extraData: null,
    language: "EN",
    printedName: null,
    printedYear: null,
    releasedAt: null,
    releasePrecision: null,
    announcedAt: null,
    checkedAt: null,
    uploadedAt: new Date("2026-10-20T00:00:00.000Z"),
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    updatedAt: new Date("2026-10-20T00:00:00.000Z"),
    ...over,
  };
}
