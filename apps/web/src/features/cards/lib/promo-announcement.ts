export interface PromoAnnouncement {
  date: string | null;
  url: string | null;
  quote: string | null;
  note: string | null;
}

const ANNOUNCED =
  /^Announced (?:\[(?<linked>\d{4}-\d{2}-\d{2})\]\((?<url>https?:\/\/[^\s)]+)\)|(?<plain>\d{4}-\d{2}-\d{2}))\.?\s*/u;
const LEADING_QUOTE = /^["“](?<quote>[\s\S]*?)["”](?=\s|$)\s*/u;

function parseDay(iso: string): PromoAnnouncement["date"] {
  const [year = 0, month = 0, day = 0] = iso.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? iso
    : null;
}

/** Parses `Announced [YYYY-MM-DD](url). "quote" note`; other text comes back whole as `note`. */
export function parsePromoAnnouncement(description: string): PromoAnnouncement {
  const text = description.trim();
  const lead = ANNOUNCED.exec(text);
  if (!lead?.groups) {
    return { date: null, url: null, quote: null, note: text || null };
  }
  const rest = text.slice(lead[0].length);
  const quoted = LEADING_QUOTE.exec(rest);
  const quote = quoted?.groups?.quote?.trim() || null;
  const note = (quoted ? rest.slice(quoted[0].length) : rest).trim() || null;
  return {
    date: parseDay(lead.groups.linked ?? lead.groups.plain ?? ""),
    url: lead.groups.url ?? null,
    quote,
    note,
  };
}
