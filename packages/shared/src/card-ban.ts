/**
 * The wire sends every ban with its start day, scheduled ones included, so a
 * cached catalog stays correct across midnight. `Card.bans` holds only the bans in effect.
 */

import { todayUtc } from "./set-release.js";
import type { Card, CardBan } from "./types/catalog.js";

export function isBanInEffect(ban: Pick<CardBan, "bannedAt">, today = todayUtc()): boolean {
  return ban.bannedAt <= today;
}

export function splitCardBans<T extends { bans: CardBan[] }>(
  card: T,
  today = todayUtc(),
): T & Pick<Card, "upcomingBans"> {
  return {
    ...card,
    bans: card.bans.filter((ban) => isBanInEffect(ban, today)),
    upcomingBans: card.bans.filter((ban) => !isBanInEffect(ban, today)),
  };
}
