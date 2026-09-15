import type { FriendGroupCalendarFeedKind } from "@openrift/shared/types/api/friend-group";

import type { CalendarEvent } from "../../../lib/icalendar.js";
import { uvsgamesEventUrl } from "../../meta/lib/uvsgames-catalog.js";
import type { Tournament } from "../../tournaments/repositories/tournaments-shared.js";
import type { ShopFeedEventRow } from "../repositories/friend-group-shops.js";

const FEED_NAME_SUFFIX: Record<FriendGroupCalendarFeedKind, string> = {
  tournaments: "Tournaments",
  shop_events: "Shop events",
};

const DEFAULT_EVENT_HOURS = 5;

function eventEnd(start: Date, end: Date | null): Date {
  if (end !== null && end.getTime() > start.getTime()) {
    return end;
  }
  return new Date(start.getTime() + DEFAULT_EVENT_HOURS * 60 * 60 * 1000);
}

export function calendarFeedName(groupName: string, kind: FriendGroupCalendarFeedKind): string {
  return `${groupName} · ${FEED_NAME_SUFFIX[kind]}`;
}

export function presentTournamentCalendarEvent(
  tournament: Pick<Tournament, "id" | "name" | "status" | "startsAt" | "endsAt" | "updatedAt">,
  appBaseUrl: string,
): CalendarEvent {
  const url = `${appBaseUrl}/tournaments/${tournament.id}`;
  return {
    uid: `openrift-tournament-${tournament.id}`,
    start: tournament.startsAt,
    end: eventEnd(tournament.startsAt, tournament.endsAt),
    summary: tournament.name,
    description: url,
    url,
    status: tournament.status === "cancelled" ? "CANCELLED" : "CONFIRMED",
    lastModified: tournament.updatedAt,
  };
}

export function presentShopCalendarEvent(row: ShopFeedEventRow): CalendarEvent {
  const url = uvsgamesEventUrl(row.externalId);
  return {
    uid: `openrift-shop-event-${row.externalId}`,
    start: row.startAt,
    end: eventEnd(row.startAt, row.endAtEstimate),
    summary: row.name,
    location: row.location === null ? row.storeName : `${row.storeName}, ${row.location}`,
    description: row.eventFormat === null ? url : `${row.eventFormat}\n${url}`,
    url,
  };
}
