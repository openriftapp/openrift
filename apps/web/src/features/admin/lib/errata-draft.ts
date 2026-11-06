import type { CardErrata } from "@openrift/shared/types/catalog";
import { WellKnown } from "@openrift/shared/well-known";

export type AdminCardErrata = CardErrata & { announcementId: string | null };

export interface ErrataDraft {
  language: string;
  announcementId: string;
  correctedRulesText: string;
  correctedEffectText: string;
  source: string;
  sourceUrl: string;
  effectiveDate: string;
}

export interface ErrataInput {
  cardId: string;
  language: string;
  announcementId: string | null;
  correctedRulesText: string | null;
  correctedEffectText: string | null;
  source: string | null;
  sourceUrl: string | null;
  effectiveDate: string | null;
}

export const EMPTY_ERRATA_DRAFT: ErrataDraft = {
  language: WellKnown.language.EN,
  announcementId: "",
  correctedRulesText: "",
  correctedEffectText: "",
  source: "",
  sourceUrl: "",
  effectiveDate: "",
};

export function errataDraftFrom(errata: AdminCardErrata): ErrataDraft {
  const announced = errata.announcementId !== null;
  return {
    language: errata.language,
    announcementId: errata.announcementId ?? "",
    correctedRulesText: errata.correctedRulesText ?? "",
    correctedEffectText: errata.correctedEffectText ?? "",
    source: announced ? "" : errata.source,
    sourceUrl: announced ? "" : (errata.sourceUrl ?? ""),
    effectiveDate: announced ? "" : (errata.effectiveDate ?? ""),
  };
}

export function errataDraftInput(cardId: string, draft: ErrataDraft): ErrataInput {
  const texts = {
    correctedRulesText: draft.correctedRulesText.trim() || null,
    correctedEffectText: draft.correctedEffectText.trim() || null,
  };
  if (draft.announcementId !== "") {
    return {
      cardId,
      language: draft.language,
      announcementId: draft.announcementId,
      ...texts,
      source: null,
      sourceUrl: null,
      effectiveDate: null,
    };
  }
  return {
    cardId,
    language: draft.language,
    announcementId: null,
    ...texts,
    source: draft.source.trim(),
    sourceUrl: draft.sourceUrl.trim() || null,
    effectiveDate: draft.effectiveDate || null,
  };
}

export function isErrataDraftComplete(draft: ErrataDraft): boolean {
  const hasText = draft.correctedRulesText.trim() !== "" || draft.correctedEffectText.trim() !== "";
  return hasText && (draft.announcementId !== "" || draft.source.trim() !== "");
}

export function nextErrataLanguage(
  errata: readonly Pick<CardErrata, "language">[],
  order: readonly string[],
): string | null {
  const taken = new Set(errata.map((entry) => entry.language));
  return order.find((language) => !taken.has(language)) ?? null;
}
