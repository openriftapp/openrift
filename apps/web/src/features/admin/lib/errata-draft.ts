import type { CardErrata } from "@openrift/shared/types/catalog";

export type AdminCardErrata = CardErrata & { announcementId: string | null };

export interface ErrataDraft {
  announcementId: string;
  correctedRulesText: string;
  correctedEffectText: string;
  source: string;
  sourceUrl: string;
  effectiveDate: string;
}

export interface ErrataInput {
  cardId: string;
  announcementId: string | null;
  correctedRulesText: string | null;
  correctedEffectText: string | null;
  source: string | null;
  sourceUrl: string | null;
  effectiveDate: string | null;
}

export const EMPTY_ERRATA_DRAFT: ErrataDraft = {
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
      announcementId: draft.announcementId,
      ...texts,
      source: null,
      sourceUrl: null,
      effectiveDate: null,
    };
  }
  return {
    cardId,
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
