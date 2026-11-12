import type { RequiredAcceptPrintingField } from "@openrift/shared/printing-accept";
import { REQUIRED_ACCEPT_PRINTING_FIELDS, resolveFinish } from "@openrift/shared/printing-accept";
import { WellKnown } from "@openrift/shared/well-known";
import type { Selectable } from "kysely";

import type { CandidatePrintingsTable } from "../../../db/tables/candidates.js";
import { buildSizedPrintingLinkKey } from "../../../lib/printing-link-key.js";

type CandidatePrintingRow = Selectable<CandidatePrintingsTable>;

export interface CandidateAcceptFields {
  shortCode: string;
  setId: string;
  setName: string | null;
  rarity: string;
  artVariant: string;
  isSigned: boolean;
  isOvernumbered: boolean;
  markerSlugs: string[];
  distributionChannelSlugs: string[];
  finish: string;
  size: string;
  artist: string;
  publicCode: string;
  printedRulesText: string | null;
  printedEffectText: string | null;
  flavorText: string | null;
  imageUrl: string | null;
  language: string;
  printedName: string | null;
  printedYear: number | null;
}

type CandidateAcceptResult =
  | { fields: CandidateAcceptFields; missing?: undefined }
  | { fields?: undefined; missing: RequiredAcceptPrintingField[] };

export function acceptFieldsFromCandidate(cp: CandidatePrintingRow): CandidateAcceptResult {
  const finish = resolveFinish(cp.finish, cp.rarity);
  const required: Record<RequiredAcceptPrintingField, string | null> = {
    shortCode: cp.shortCode,
    setId: cp.setId,
    rarity: cp.rarity,
    finish,
    artist: cp.artist,
    publicCode: cp.publicCode,
  };
  const missing = REQUIRED_ACCEPT_PRINTING_FIELDS.filter((field) => !required[field]);
  if (missing.length > 0 || !cp.setId || !cp.rarity || !finish || !cp.artist || !cp.publicCode) {
    return { missing };
  }
  return {
    fields: {
      shortCode: cp.shortCode,
      setId: cp.setId,
      setName: cp.setName,
      rarity: cp.rarity,
      artVariant: cp.artVariant ?? WellKnown.artVariant.NORMAL,
      isSigned: cp.isSigned ?? false,
      isOvernumbered: cp.isOvernumbered ?? false,
      markerSlugs: cp.markerSlugs,
      distributionChannelSlugs: cp.distributionChannelSlugs,
      finish,
      size: cp.size ?? WellKnown.cardSize.STANDARD,
      artist: cp.artist,
      publicCode: cp.publicCode,
      printedRulesText: cp.printedRulesText,
      printedEffectText: cp.printedEffectText,
      flavorText: cp.flavorText,
      imageUrl: cp.imageUrl,
      language: cp.language ?? WellKnown.language.EN,
      printedName: cp.printedName,
      printedYear: cp.printedYear,
    },
  };
}

type KeyedCandidate = Pick<
  CandidatePrintingRow,
  "shortCode" | "finish" | "rarity" | "markerSlugs" | "language" | "size"
>;

export function candidateAcceptKey(cp: KeyedCandidate): string {
  return buildSizedPrintingLinkKey({
    shortCode: cp.shortCode,
    finish: resolveFinish(cp.finish, cp.rarity) ?? "",
    markerSlugs: cp.markerSlugs,
    language: cp.language,
    size: cp.size,
  });
}

export function groupCandidatePrintings<T extends KeyedCandidate>(candidates: readonly T[]): T[][] {
  return [...Map.groupBy(candidates, candidateAcceptKey).values()];
}

export function candidatePrintingLabel(
  cp: Pick<CandidatePrintingRow, "shortCode" | "finish" | "rarity" | "language">,
): string {
  return [cp.shortCode, resolveFinish(cp.finish, cp.rarity), cp.language ?? WellKnown.language.EN]
    .filter((part) => part !== null && part !== "")
    .join(" ");
}
