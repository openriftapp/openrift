import { formatDayMonthYear, formatMonthYear, todayUtc } from "@openrift/shared/format-date";
import type { SetRelease, SetReleases } from "@openrift/shared/set-release";
import { isReleased } from "@openrift/shared/set-release";
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

function releaseWhen(release: SetRelease): string {
  const { releasedAt, precision } = release;
  if (releasedAt === null || precision === null) {
    return "";
  }
  if (precision === "day") {
    return m.release_when_day({ date: formatDayMonthYear(releasedAt, DATE_WORDS) });
  }
  const year = releasedAt.slice(0, 4);
  if (precision === "month") {
    return m.release_when_period({ date: formatMonthYear(releasedAt, DATE_WORDS) });
  }
  if (precision === "quarter") {
    const quarter = Math.floor((Number(releasedAt.slice(5, 7)) - 1) / 3) + 1;
    return m.release_when_period({ date: `Q${quarter} ${year}` });
  }
  return m.release_when_period({ date: year });
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
