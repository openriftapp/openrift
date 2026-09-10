import type { CardErrata } from "@openrift/shared/types/catalog";

export interface ErrataDraft {
  correctedRulesText: string;
  correctedEffectText: string;
  source: string;
  sourceUrl: string;
  effectiveDate: string;
}

export interface ErrataInput {
  cardId: string;
  correctedRulesText: string | null;
  correctedEffectText: string | null;
  source: string;
  sourceUrl: string | null;
  effectiveDate: string | null;
}

export const EMPTY_ERRATA_DRAFT: ErrataDraft = {
  correctedRulesText: "",
  correctedEffectText: "",
  source: "",
  sourceUrl: "",
  effectiveDate: "",
};

export function errataDraftFrom(errata: CardErrata): ErrataDraft {
  return {
    correctedRulesText: errata.correctedRulesText ?? "",
    correctedEffectText: errata.correctedEffectText ?? "",
    source: errata.source,
    sourceUrl: errata.sourceUrl ?? "",
    effectiveDate: errata.effectiveDate ?? "",
  };
}

export function errataDraftInput(cardId: string, draft: ErrataDraft): ErrataInput {
  return {
    cardId,
    correctedRulesText: draft.correctedRulesText.trim() || null,
    correctedEffectText: draft.correctedEffectText.trim() || null,
    source: draft.source.trim(),
    sourceUrl: draft.sourceUrl.trim() || null,
    effectiveDate: draft.effectiveDate || null,
  };
}

export function isErrataDraftComplete(draft: ErrataDraft): boolean {
  const hasText = draft.correctedRulesText.trim() !== "" || draft.correctedEffectText.trim() !== "";
  return hasText && draft.source.trim() !== "";
}
