import type {
  ProfileLastActive,
  PublicUserProfileStats,
} from "@openrift/shared/types/api/user-share";

import { formatRank } from "@/features/meta/lib/meta-format";
import { m } from "@/paraglide/messages.js";

const LAST_ACTIVE_LABELS: Record<ProfileLastActive, () => string> = {
  today: () => m.user_profile_active_today(),
  week: () => m.user_profile_active_week(),
  month: () => m.user_profile_active_month(),
  older: () => m.user_profile_active_older(),
};

export function lastActiveLabel(lastActive: ProfileLastActive): string {
  return LAST_ACTIVE_LABELS[lastActive]();
}

/** The parts under the contributions number, non-zero kinds only. */
export function contributionsHint(
  contributions: PublicUserProfileStats["contributions"],
): string | null {
  const { cardFixes, newCards, photos, metaEvents } = contributions;
  const parts = [
    cardFixes > 0 ? m.user_profile_card_fixes({ count: cardFixes }) : null,
    newCards > 0 ? m.user_profile_new_cards({ count: newCards }) : null,
    photos > 0 ? m.user_profile_photos({ count: photos }) : null,
    metaEvents > 0 ? m.user_profile_meta_events({ count: metaEvents }) : null,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}

export function bestFinishHint(
  bestFinish: PublicUserProfileStats["tournaments"]["bestFinish"],
): string | null {
  if (bestFinish === null) {
    return null;
  }
  return m.user_profile_best_finish({
    rank: formatRank(bestFinish.rank, false),
    players: bestFinish.players,
  });
}

export function groupsInCommonLabel(names: readonly string[]): string | null {
  const [first, second] = names;
  if (first === undefined) {
    return null;
  }
  if (second === undefined) {
    return m.user_profile_groups_one({ group: first });
  }
  if (names.length === 2) {
    return m.user_profile_groups_two({ first, second });
  }
  return m.user_profile_groups_more({ first, count: names.length - 1 });
}
