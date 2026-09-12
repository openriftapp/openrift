import { appendSetTotal, fixTypography } from "./fix-typography.js";

interface ProvidedPrintingValueOptions {
  costKeywords?: readonly string[];
  printedTotal?: number | null;
}

/**
 * The transforms the accept path applies to a value taken verbatim from a
 * source. Comparing a source row against the catalog runs them first, or an
 * accepted field reads as a difference forever.
 */
export function normalizeProvidedPrintingValue(
  field: string,
  value: unknown,
  options?: ProvidedPrintingValueOptions,
): unknown {
  if (typeof value !== "string") {
    return value;
  }
  const { costKeywords = [], printedTotal = null } = options ?? {};
  if (field === "printedRulesText" || field === "printedEffectText") {
    return fixTypography(value, { costKeywords });
  }
  if (field === "flavorText") {
    return fixTypography(value, { italicParens: false, keywordGlyphs: false });
  }
  if (field === "publicCode") {
    return appendSetTotal(value, printedTotal);
  }
  return value;
}

export function normalizeProvidedPrintingRecord<T extends Record<string, unknown>>(
  record: T,
  options?: ProvidedPrintingValueOptions,
): T {
  return Object.fromEntries(
    Object.entries(record).map(([field, value]) => [
      field,
      normalizeProvidedPrintingValue(field, value, options),
    ]),
  ) as T;
}
