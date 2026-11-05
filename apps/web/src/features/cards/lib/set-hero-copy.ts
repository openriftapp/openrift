import { formatMonthYear, formatShortDayYear, todayUtc } from "@openrift/shared/format-date";
import type { SetRelease, SetReleases } from "@openrift/shared/set-release";
import { isReleased, isReleasedAnywhere } from "@openrift/shared/set-release";
import type { SetListEntry } from "@openrift/shared/types/api/catalog";

import { DATE_WORDS } from "@/lib/date-words";
import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

const BCP47_BY_CARD_LANGUAGE: Record<string, string> = {
  KR: "ko",
  SC: "zh-Hans",
  TC: "zh-Hant",
};

const languageNames = new Map<string, Intl.DisplayNames>();

export function cardLanguageName(code: string): string {
  const locale = getLocale();
  let names = languageNames.get(locale);
  if (names === undefined) {
    names = new Intl.DisplayNames([locale], { type: "language" });
    languageNames.set(locale, names);
  }
  return names.of(BCP47_BY_CARD_LANGUAGE[code] ?? code.toLowerCase()) ?? code;
}

export interface ReleaseGroup {
  languages: string[];
  release: SetRelease;
}

export function groupReleases(releases: SetReleases): ReleaseGroup[] {
  const groups: ReleaseGroup[] = [];
  const dated = Object.entries(releases)
    .filter(([, release]) => release.releasedAt !== null && release.precision !== null)
    .toSorted(
      ([languageA, a], [languageB, b]) =>
        (a.releasedAt ?? "").localeCompare(b.releasedAt ?? "") ||
        languageA.localeCompare(languageB),
    );
  for (const [language, release] of dated) {
    const last = groups.at(-1);
    if (
      last?.release.releasedAt === release.releasedAt &&
      last.release.precision === release.precision
    ) {
      last.languages.push(language);
    } else {
      groups.push({ languages: [language], release });
    }
  }
  return groups;
}

function quarterLabel(releasedAt: string): string {
  return m.release_quarter({
    quarter: String(Math.floor((Number(releasedAt.slice(5, 7)) - 1) / 3) + 1),
    year: releasedAt.slice(0, 4),
  });
}

export function releaseDateText(release: SetRelease): string {
  const { releasedAt, precision } = release;
  if (releasedAt === null || precision === null) {
    return "";
  }
  if (precision === "day") {
    return formatShortDayYear(releasedAt, DATE_WORDS);
  }
  if (precision === "month") {
    return formatMonthYear(releasedAt, DATE_WORDS);
  }
  if (precision === "quarter") {
    return quarterLabel(releasedAt);
  }
  return releasedAt.slice(0, 4);
}

function releaseWhen(release: SetRelease): string {
  if (release.releasedAt === null || release.precision === null) {
    return "";
  }
  const date = releaseDateText(release);
  return release.precision === "day"
    ? m.release_when_day({ date })
    : m.release_when_period({ date });
}

export function releaseStatusText(release: SetRelease, today = todayUtc()): string {
  const date = releaseDateText(release);
  const released = isReleased(release, today);
  if (release.precision === "day") {
    return released ? m.sets_released_on({ date }) : m.sets_releases_on({ date });
  }
  return released ? m.sets_released_in({ date }) : m.sets_releases_in({ date });
}

export interface LanguageRelease {
  language: string;
  release: SetRelease;
}

function datedReleases(releases: SetReleases): LanguageRelease[] {
  return Object.entries(releases)
    .filter(([, release]) => release.releasedAt !== null && release.precision !== null)
    .map(([language, release]) => ({ language, release }))
    .toSorted(
      (a, b) =>
        (a.release.releasedAt ?? "").localeCompare(b.release.releasedAt ?? "") ||
        a.language.localeCompare(b.language),
    );
}

export function primaryRelease(
  releases: SetReleases,
  languages: readonly string[] = ["EN"],
): LanguageRelease | undefined {
  const dated = datedReleases(releases);
  for (const language of languages) {
    const match = dated.find((entry) => entry.language === language);
    if (match) {
      return match;
    }
  }
  return dated.find((entry) => entry.language === "EN") ?? dated.at(0);
}

export function otherReleases(
  releases: SetReleases,
  languages: readonly string[] = ["EN"],
): LanguageRelease[] {
  const primary = primaryRelease(releases, languages);
  const others = datedReleases(releases).filter((entry) => entry.language !== primary?.language);
  const allSame = others.every(
    (entry) =>
      entry.release.releasedAt === primary?.release.releasedAt &&
      entry.release.precision === primary?.release.precision,
  );
  return allSame ? [] : others;
}

export function isSetUpcoming(
  set: Pick<SetListEntry, "cardCount" | "releases">,
  languages: readonly string[] = ["EN"],
  today = todayUtc(),
): boolean {
  const own = datedReleases(set.releases).filter((entry) => languages.includes(entry.language));
  if (own.length > 0) {
    return !own.some((entry) => isReleased(entry.release, today));
  }
  if (isReleasedAnywhere(set.releases, today)) {
    return false;
  }
  return primaryRelease(set.releases) !== undefined || set.cardCount === 0;
}

function listFormat(items: string[]): string {
  return new Intl.ListFormat(getLocale(), { type: "conjunction" }).format(items);
}

function releaseItems(groups: ReleaseGroup[]): string {
  return listFormat(
    groups.map((group) =>
      m.set_release_item({
        languages: listFormat(group.languages.map((code) => cardLanguageName(code))),
        when: releaseWhen(group.release),
      }),
    ),
  );
}

export function setReleaseSentence(releases: SetReleases, today = todayUtc()): string | null {
  const groups = groupReleases(releases);
  const released = groups.filter((group) => isReleased(group.release, today));
  const upcoming = groups.filter((group) => !isReleased(group.release, today));
  const sentences = [
    ...(released.length > 0 ? [m.set_released_in({ items: releaseItems(released) })] : []),
    ...(upcoming.length > 0 ? [m.set_releases_in({ items: releaseItems(upcoming) })] : []),
  ];
  return sentences.length > 0 ? sentences.join(" ") : null;
}

const CARD_LANGUAGE_BY_LOCALE: Record<string, string> = {
  fr: "FR",
  ko: "KR",
  "zh-Hans": "SC",
  "zh-Hant": "TC",
};

export function cardLanguageForLocale(locale = getLocale()): string {
  return CARD_LANGUAGE_BY_LOCALE[locale] ?? "EN";
}

export function setsOverviewSentence(
  sets: readonly SetListEntry[],
  today = todayUtc(),
  language = cardLanguageForLocale(),
): string | null {
  const dated = sets
    .filter((set) => set.setType === "main")
    .flatMap((set) => {
      const release = set.releases[language];
      return release?.releasedAt ? [{ set, release, releasedAt: release.releasedAt }] : [];
    });
  const newest = dated
    .filter((entry) => isReleased(entry.release, today))
    .toSorted((a, b) => b.releasedAt.localeCompare(a.releasedAt))
    .at(0)?.set;
  const nextEntry = dated
    .filter((entry) => !isReleased(entry.release, today))
    .toSorted((a, b) => a.releasedAt.localeCompare(b.releasedAt))
    .at(0);
  const next = nextEntry?.set;
  const nextRelease = nextEntry?.release;

  const sentences: string[] = [];
  if (newest) {
    sentences.push(m.sets_hero_newest({ name: newest.name }));
  }
  if (next && nextRelease) {
    const when = releaseWhen(nextRelease);
    const total = next.printedTotal;
    sentences.push(
      total !== null && next.cardCount > 0 && next.cardCount < total
        ? m.sets_hero_next_listed({ name: next.name, when, listed: next.cardCount, total })
        : m.sets_hero_next({ name: next.name, when }),
    );
  }
  return sentences.length > 0 ? sentences.join(" ") : null;
}
