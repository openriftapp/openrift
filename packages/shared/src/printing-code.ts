const TBA_CODE = "TBA";

/** Placeholder set for a printing whose set is not known yet. */
export const TBA_SET_SLUG = "TBA";

export function isTbaCode(code: string): boolean {
  return code.split("-")[1] === TBA_CODE;
}

/**
 * `uq_printings_variant` has no `card_id`, so a code without the card slug
 * collides across cards. Only the public code stays card-agnostic.
 */
export function tbaShortCode(setSlug: string, cardSlug: string): string {
  return `${setSlug}-${TBA_CODE}-${cardSlug}`;
}

export function tbaPublicCode(setSlug: string): string {
  return `${setSlug}-${TBA_CODE}`;
}

export function formatPrintingCode(publicCode: string): string {
  return isTbaCode(publicCode) ? "Code TBA" : publicCode;
}
