import { ERROR_CODES } from "@openrift/shared/error-codes";

import { AppError } from "../../../errors.js";

export async function assertSlugFreeForRename(
  getBySlug: (slug: string) => Promise<unknown>,
  currentSlug: string,
  nextSlug?: string,
): Promise<void> {
  if (nextSlug === undefined || nextSlug === currentSlug) {
    return;
  }
  const conflict = await getBySlug(nextSlug);
  if (conflict !== null && conflict !== undefined) {
    throw new AppError(409, ERROR_CODES.CONFLICT, `Slug "${nextSlug}" already in use`);
  }
}
