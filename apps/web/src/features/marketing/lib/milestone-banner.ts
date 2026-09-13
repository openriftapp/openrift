export interface LatestMilestone {
  date: string;
  icon?: string;
  title: string;
  message: string;
}

export const MILESTONE_BANNER_MAX_AGE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A first visit seeds the dismissed date instead of showing a banner, so the
 * caller must dismiss when this returns "seed".
 */
export function milestoneBannerDecision(
  latest: LatestMilestone | null,
  dismissedDate: string | null,
  now: Date = new Date(),
): "hide" | "seed" | "show" {
  if (latest === null) {
    return "hide";
  }
  if (dismissedDate === null) {
    return "seed";
  }
  if (latest.date <= dismissedDate) {
    return "hide";
  }
  const ageMs = now.getTime() - new Date(`${latest.date}T00:00:00Z`).getTime();
  return ageMs > MILESTONE_BANNER_MAX_AGE_DAYS * DAY_MS ? "hide" : "show";
}
