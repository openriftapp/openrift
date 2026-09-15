import { Hono } from "hono";

import type { CalendarEvent } from "../../../lib/icalendar.js";
import { renderCalendar } from "../../../lib/icalendar.js";
import type { Variables } from "../../../types.js";
import {
  calendarFeedName,
  presentShopCalendarEvent,
  presentTournamentCalendarEvent,
} from "../lib/friend-group-calendar-presenters.js";

const SHOP_FEED_PAST_DAYS = 30;

// Calendar apps fetch with no session, so the token in the path is the only
// credential. Plain Hono route since the body is iCalendar text.
export const publicFriendGroupCalendarFeedsRoute = new Hono<{ Variables: Variables }>().get(
  "/calendar-feeds/:file{[A-Za-z0-9_-]+[.]ics}",
  async (c) => {
    const repos = c.get("repos");
    const token = c.req.param("file").slice(0, -".ics".length);
    const feed = await repos.friendGroupCalendarFeeds.findByToken(token);
    if (!feed) {
      return c.body(null, 404);
    }

    let events: CalendarEvent[];
    if (feed.kind === "tournaments") {
      const appBaseUrl = c.get("config").appBaseUrl;
      const tournaments = await repos.tournaments.listForGroup(feed.groupId);
      events = tournaments.map((tournament) =>
        presentTournamentCalendarEvent(tournament, appBaseUrl),
      );
    } else {
      const rows = await repos.friendGroupShops.listFeedEvents(feed.groupId, SHOP_FEED_PAST_DAYS);
      events = rows.map((row) => presentShopCalendarEvent(row));
    }

    const body = renderCalendar({
      name: calendarFeedName(feed.groupName, feed.kind),
      generatedAt: new Date(),
      events,
    });
    return c.body(body, 200, {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=900",
      "X-Robots-Tag": "noindex",
    });
  },
);
