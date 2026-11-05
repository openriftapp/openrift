export interface PromoAnnouncement {
  date: string | null;
  url: string | null;
  quote: string | null;
  note: string | null;
}

const ANNOUNCED =
  /^Announced (?:\[(?<linked>\d{4}-\d{2}-\d{2})\]\((?<url>https?:\/\/(?:[^\s()]|\([^\s()]*\))+)\)|(?<plain>\d{4}-\d{2}-\d{2}))\.?\s*/u;
const WHITESPACE = /\s/u;

function isSpace(char: string | undefined): boolean {
  return char === undefined || WHITESPACE.test(char);
}

// A straight quote after whitespace that leads into a word opens a nested quote.
function leadingQuote(text: string): { quote: string; end: number } | null {
  if (!text.startsWith('"') && !text.startsWith("“")) {
    return null;
  }
  let depth = 1;
  for (let index = 1; index < text.length; index++) {
    const char = text[index];
    if (char !== '"' && char !== "“" && char !== "”") {
      continue;
    }
    const opens =
      char === "“" || (char === '"' && isSpace(text[index - 1]) && !isSpace(text[index + 1]));
    if (opens) {
      depth++;
      continue;
    }
    depth = Math.max(depth - 1, 0);
    if (depth === 0 && isSpace(text[index + 1])) {
      return { quote: text.slice(1, index), end: index + 1 };
    }
  }
  return null;
}

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
  const quoted = leadingQuote(rest);
  const quote = quoted?.quote.trim() || null;
  const note = (quoted ? rest.slice(quoted.end) : rest).trim() || null;
  return {
    date: parseDay(lead.groups.linked ?? lead.groups.plain ?? ""),
    url: lead.groups.url ?? null,
    quote,
    note,
  };
}
