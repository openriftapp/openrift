import type { ProfileLastActive } from "@openrift/shared/types/api/user-share";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Coarse on purpose: the profile says how recently, never when. */
export function lastActiveBucket(lastActiveAt: Date | null, now: Date): ProfileLastActive | null {
  if (lastActiveAt === null) {
    return null;
  }
  const age = now.getTime() - lastActiveAt.getTime();
  if (age < DAY_MS) {
    return "today";
  }
  if (age < 7 * DAY_MS) {
    return "week";
  }
  if (age < 30 * DAY_MS) {
    return "month";
  }
  return "older";
}
