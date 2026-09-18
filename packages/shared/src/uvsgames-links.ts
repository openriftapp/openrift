const EVENT_ID = /^[1-9]\d{0,11}$/u;

export function uvsgamesEventUrl(externalId: string): string {
  return `https://locator.riftbound.uvsgames.com/events/${externalId}`;
}

/** Accepts a bare event id or any URL whose path carries `/events/<id>`. */
export function parseUvsgamesEventId(input: string): string | null {
  const trimmed = input.trim();
  if (EVENT_ID.test(trimmed)) {
    return trimmed;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.hostname !== "uvsgames.com" && !url.hostname.endsWith(".uvsgames.com")) {
    return null;
  }
  const id = /\/events\/(?<id>\d+)(?:\/|$)/u.exec(url.pathname)?.groups?.id;
  return id !== undefined && EVENT_ID.test(id) ? id : null;
}
