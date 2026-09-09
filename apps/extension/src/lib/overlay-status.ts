import type { OverlaySnapshot } from "./overlay-snapshot";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function relativeAge(from: string, now: Date): string {
  const elapsed = now.getTime() - new Date(from).getTime();
  if (Number.isNaN(elapsed) || elapsed < MINUTE_MS) {
    return "just now";
  }
  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(elapsed / DAY_MS);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const NAMES_SHOWN = 3;

export function listNames(names: readonly string[]): string {
  if (names.length <= NAMES_SHOWN) {
    return names.join(", ");
  }
  const rest = names.length - NAMES_SHOWN;
  return `${names.slice(0, NAMES_SHOWN).join(", ")} and ${rest} more`;
}

const STALE_AFTER_MS = 2 * DAY_MS;

export interface SnapshotStatus {
  headline: string;
  detail: string;
  action: string;
  stale: boolean;
}

export function snapshotStatus(snapshot: OverlaySnapshot | undefined, now: Date): SnapshotStatus {
  if (snapshot === undefined) {
    return {
      headline: "No counts yet",
      detail: "OpenRift has not handed anything over.",
      action: "Get my counts",
      stale: true,
    };
  }
  // Price-only rows cover the whole catalogue; the count the user cares about is their own.
  const cards = Object.values(snapshot.products).filter(
    (counts) => counts.owned > 0 || counts.wanted > 0,
  ).length;
  const names = listNames(snapshot.lists.map((list) => list.name));
  return {
    headline: `Counts from ${relativeAge(snapshot.capturedAt, now)}`,
    detail: `${names} · ${cards} card${cards === 1 ? "" : "s"} you own or want`,
    action: "Refresh counts",
    stale: now.getTime() - new Date(snapshot.capturedAt).getTime() >= STALE_AFTER_MS,
  };
}

export function snapshotSummary(snapshot: OverlaySnapshot | undefined, now: Date): string {
  const status = snapshotStatus(snapshot, now);
  return `${status.headline}. ${status.detail}.`;
}
