import type { SetReleases } from "@openrift/shared/set-release";
import { earliestRelease } from "@openrift/shared/set-release";

/** Keyed by `slug|LANGUAGE` for per-language releases and by `slug` for the earliest release. */
export type SetReleaseYears = Record<string, number>;

export function buildSetReleaseYears(
  sets: readonly { slug: string; releases: SetReleases }[],
): SetReleaseYears {
  const years: SetReleaseYears = {};
  for (const set of sets) {
    for (const [language, release] of Object.entries(set.releases)) {
      if (release.releasedAt) {
        years[`${set.slug}|${language}`] = Number(release.releasedAt.slice(0, 4));
      }
    }
    const earliest = earliestRelease(set.releases);
    if (earliest?.releasedAt) {
      years[set.slug] = Number(earliest.releasedAt.slice(0, 4));
    }
  }
  return years;
}

export function setReleaseYear(
  years: SetReleaseYears,
  setSlug: string,
  language?: string,
): number | undefined {
  const perLanguage = language === undefined ? undefined : years[`${setSlug}|${language}`];
  return perLanguage ?? years[setSlug];
}
