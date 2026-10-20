const PRINTING_LEVEL_FIELDS: ReadonlySet<string> = new Set([
  "size",
  "distributionChannelSlugs",
  "comment",
  "releasedAt",
  "releasePrecision",
  "announcedAt",
]);

/** Fields stored on the printing and shared by its faces. Every other printing field belongs to a face. */
export function isPrintingLevelField(field: string): boolean {
  return PRINTING_LEVEL_FIELDS.has(field);
}
