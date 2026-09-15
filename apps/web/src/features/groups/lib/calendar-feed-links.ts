export function calendarFeedUrl(siteUrl: string, token: string): string {
  return `${siteUrl}/api/v1/calendar-feeds/${token}.ics`;
}

export function webcalUrl(feedUrl: string): string {
  return feedUrl.replace(/^https?:/u, "webcal:");
}

export function googleCalendarSubscribeUrl(feedUrl: string): string {
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl(feedUrl))}`;
}
