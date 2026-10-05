export function toCardArt(
  imageId: string,
  landscapeIds: ReadonlySet<string>,
): { imageId: string; landscape: boolean } {
  return { imageId, landscape: landscapeIds.has(imageId) };
}
