import type {
  ProfileLastActive,
  PublicUserProfileStats,
} from "@openrift/shared/types/api/user-share";

const LAST_ACTIVE_LABELS: Record<ProfileLastActive, string> = {
  today: "Active today",
  week: "Active this week",
  month: "Active this month",
  older: "Last active a while ago",
};

export function lastActiveLabel(lastActive: ProfileLastActive): string {
  return LAST_ACTIVE_LABELS[lastActive];
}

const ORDINAL_SUFFIXES: Record<number, string> = { 1: "st", 2: "nd", 3: "rd" };

export function ordinal(n: number): string {
  const mod100 = n % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : (ORDINAL_SUFFIXES[n % 10] ?? "th");
  return `${n}${suffix}`;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** The parts under the contributions number, non-zero kinds only. */
export function contributionsHint(
  contributions: PublicUserProfileStats["contributions"],
): string | null {
  const parts = [
    contributions.cardFixes > 0 ? plural(contributions.cardFixes, "card fix", "card fixes") : null,
    contributions.newCards > 0 ? plural(contributions.newCards, "new card") : null,
    contributions.photos > 0 ? plural(contributions.photos, "photo") : null,
    contributions.metaEvents > 0 ? plural(contributions.metaEvents, "meta event") : null,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

export function bestFinishHint(
  bestFinish: PublicUserProfileStats["tournaments"]["bestFinish"],
): string | null {
  if (bestFinish === null) {
    return null;
  }
  return `Best finish: ${ordinal(bestFinish.rank)} of ${bestFinish.players}`;
}

export function groupsInCommonLabel(names: readonly string[]): string | null {
  if (names.length === 0) {
    return null;
  }
  if (names.length === 1) {
    return `In ${names[0]} with you`;
  }
  if (names.length === 2) {
    return `In ${names[0]} and ${names[1]} with you`;
  }
  return `In ${names[0]} and ${names.length - 1} other groups with you`;
}
