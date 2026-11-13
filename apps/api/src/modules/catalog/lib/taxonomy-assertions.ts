import { conflict } from "../../../errors.js";

export async function assertSlugFreeForRename(
  getBySlug: (slug: string) => Promise<unknown>,
  currentSlug: string,
  nextSlug?: string,
): Promise<void> {
  if (nextSlug === undefined || nextSlug === currentSlug) {
    return;
  }
  const existing = await getBySlug(nextSlug);
  if (existing !== null && existing !== undefined) {
    throw conflict(`Slug "${nextSlug}" already in use`);
  }
}
