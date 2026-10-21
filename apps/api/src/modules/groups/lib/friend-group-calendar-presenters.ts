import type { FriendGroupCalendarFeedKind } from "@openrift/shared/types/api/friend-group";

import type { CalendarEvent } from "../../../lib/icalendar.js";
import type { Tournament } from "../../tournaments/repositories/tournaments-shared.js";
import type { ShopFeedEventRow } from "../repositories/friend-group-shops.js";
import { shopEventFormat, shopEventUrl } from "./friend-group-shop-presenters.js";

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

// uvsgames uids keep their original, unprefixed form so subscribed calendars do not duplicate them.
export function presentShopCalendarEvent(row: ShopFeedEventRow): CalendarEvent {
  const url = shopEventUrl(row.source, row.externalId);
  const format = shopEventFormat(row.source, row.eventFormat);
  return {
    uid:
      row.source === "uvsgames"
        ? `openrift-shop-event-${row.externalId}`
        : `openrift-shop-event-${row.source}-${row.externalId}`,
    start: row.startAt,
    end: eventEnd(row.startAt, row.endAtEstimate),
    summary: row.name,
    location: row.location === null ? row.storeName : `${row.storeName}, ${row.location}`,
    description: format === null ? url : `${format}\n${url}`,
    url,
  };
}
