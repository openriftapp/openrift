/** The wire fields of the physical printing. Every other printing field belongs to one face. */
export const PRINTING_LEVEL_FIELDS = [
  "slug",
  "size",
  "comment",
  "distributionChannels",
  "citations",
  "hasFoilTwin",
] as const;

export type PrintingLevelField = (typeof PRINTING_LEVEL_FIELDS)[number];
