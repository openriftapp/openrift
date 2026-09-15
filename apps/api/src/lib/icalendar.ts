export interface CalendarEvent {
  uid: string;
  start: Date;
  end: Date | null;
  summary: string;
  location?: string;
  description?: string;
  url?: string;
  status?: "CONFIRMED" | "CANCELLED";
  lastModified?: Date;
}

export interface Calendar {
  name: string;
  generatedAt: Date;
  events: readonly CalendarEvent[];
}

const PRODUCT_ID = "-//OpenRift//Group calendar feeds//EN";

const REFRESH_INTERVAL = "PT4H";

const MAX_LINE_OCTETS = 75;

const encoder = new TextEncoder();

export function icsDateTime(date: Date): string {
  return date.toISOString().replaceAll(/[-:]|\.\d{3}/gu, "");
}

export function escapeIcsText(value: string): string {
  return value
    .replaceAll(/[\\;,]/gu, (char) => `\\${char}`)
    .replaceAll(/\r\n|\r|\n/gu, String.raw`\n`);
}

/** RFC 5545 caps a content line at 75 octets; each continuation line starts with one space. */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) {
    return line;
  }
  const parts: string[] = [];
  let part = "";
  let partOctets = 0;
  for (const char of line) {
    const octets = encoder.encode(char).length;
    const limit = parts.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    if (partOctets + octets > limit) {
      parts.push(part);
      part = "";
      partOctets = 0;
    }
    part += char;
    partOctets += octets;
  }
  parts.push(part);
  return parts.join("\r\n ");
}

export function renderCalendar(calendar: Calendar): string {
  const stamp = icsDateTime(calendar.generatedAt);
  const name = escapeIcsText(calendar.name);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODUCT_ID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `NAME:${name}`,
    `X-WR-CALNAME:${name}`,
    `REFRESH-INTERVAL;VALUE=DURATION:${REFRESH_INTERVAL}`,
    `X-PUBLISHED-TTL:${REFRESH_INTERVAL}`,
  ];
  for (const event of calendar.events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(event.uid)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDateTime(event.start)}`,
    );
    if (event.end !== null && event.end.getTime() > event.start.getTime()) {
      lines.push(`DTEND:${icsDateTime(event.end)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(event.summary)}`);
    if (event.location !== undefined) {
      lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    }
    if (event.description !== undefined) {
      lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    }
    if (event.url !== undefined) {
      lines.push(`URL:${event.url}`);
    }
    if (event.status !== undefined) {
      lines.push(`STATUS:${event.status}`);
    }
    if (event.lastModified !== undefined) {
      lines.push(`LAST-MODIFIED:${icsDateTime(event.lastModified)}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return `${lines.map((line) => foldIcsLine(line)).join("\r\n")}\r\n`;
}
