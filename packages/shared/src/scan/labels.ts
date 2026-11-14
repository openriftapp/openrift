/**
 * Label table published beside the embedding bank under `media/scan`.
 * Written by the API's bank rebuild and read by the web scanner: a wire
 * contract between the two.
 */
export interface CardLabel {
  name: string;
  code: string;
  language: string;
  type?: string;
  /** "promo", "" for none. */
  markers?: string | null;
}

export type CardLabels = Record<string, CardLabel>;

/** Logs and bench output only; players see display names from the catalogue. */
export function describeScanKey(
  label: Pick<CardLabel, "name" | "code" | "language"> | undefined,
  key: string,
): string {
  return label ? `${label.name} (${label.code} ${label.language})` : `unknown ${key.slice(0, 8)}`;
}
