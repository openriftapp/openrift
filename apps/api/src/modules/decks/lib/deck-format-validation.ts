import type { DeckFormatConfig } from "@openrift/shared/types/api/deck";
import { WellKnown } from "@openrift/shared/well-known";

import type { Repos } from "../../../deps.js";
import { badRequest } from "../../../errors.js";

/** Rejects a format not in `deck_formats`, before the FK turns it into a raw constraint violation. */
export async function assertKnownFormat(
  deckFormats: Repos["deckFormats"],
  format: string,
): Promise<void> {
  const row = await deckFormats.getBySlug(format);
  if (!row) {
    throw badRequest(`Unknown deck format: ${format}`);
  }
}

/** Validates `formatConfig` against the shape the given format's slug declares. */
export async function validateFormatConfig(
  customTagsRepo: Repos["customTags"],
  format: string,
  config: Record<string, unknown> | null | undefined,
): Promise<DeckFormatConfig | null> {
  if (config === undefined || config === null) {
    return null;
  }

  if (format === WellKnown.deckFormat.CUSTOM_REGION) {
    const raw = config.tagSlugs;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw badRequest("formatConfig.tagSlugs must be a non-empty array for Custom - Region decks");
    }
    const slugs = [
      ...new Set(raw.filter((slug): slug is string => typeof slug === "string" && slug !== "")),
    ];
    if (slugs.length !== raw.length) {
      throw badRequest("formatConfig.tagSlugs must contain unique non-empty strings");
    }
    const tags = await customTagsRepo.listBySlugs(slugs);
    const tagBySlug = new Map(tags.map((tag) => [tag.slug, tag]));
    for (const slug of slugs) {
      const tag = tagBySlug.get(slug);
      if (!tag) {
        throw badRequest(`Unknown custom tag slug: ${slug}`);
      }
      if (tag.category !== "region") {
        throw badRequest(`Custom tag "${slug}" is not in the region category`);
      }
    }
    return { tagSlugs: slugs };
  }

  throw badRequest(`Format "${format}" does not accept format_config`);
}
