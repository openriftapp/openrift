interface ChangelogEntry {
  date: string;
  type: "feat" | "fix";
  section: "milestone" | "highlight" | "other";
  area?: string;
  /** Lucide icon name in kebab-case, milestone entries only. */
  icon?: string;
  title?: string;
  message: string;
}

interface ChangelogGroup {
  date: string;
  milestone?: ChangelogEntry;
  highlights: ChangelogEntry[];
  other: ChangelogEntry[];
}

type ChangelogSection = ChangelogEntry["section"];

/**
 * Splits a `**Title** — body` entry into its bold title and body. Entries
 * without the ` — ` separator keep their full text as the message.
 */
function parseEntryBody(raw: string): { icon?: string; title?: string; message: string } {
  const match = /^(?:(?<icon>[a-z0-9-]+) )?\*\*(?<title>[^*]+)\*\* — (?<message>.+)$/u.exec(raw);
  const title = match?.groups?.title;
  const message = match?.groups?.message;
  if (title !== undefined && message !== undefined) {
    return { icon: match?.groups?.icon, title: title.trim(), message: message.trim() };
  }
  return { message: raw.trim() };
}

function sectionFor(heading: string): ChangelogSection {
  if (heading === "milestone") {
    return "milestone";
  }
  return heading === "highlights" ? "highlight" : "other";
}

/**
 * Each `## date` section may contain `### Highlights` / `### Other`
 * sub-sections; lines before any sub-section fall into `other`.
 */
export function parseChangelog(markdown: string): ChangelogGroup[] {
  const groups: ChangelogGroup[] = [];
  const sections = markdown.split(/^## /mu).slice(1);

  for (const section of sections) {
    const [dateLine, ...body] = section.trim().split("\n");
    if (dateLine === undefined) {
      continue;
    }
    const date = dateLine.trim();
    let milestone: ChangelogEntry | undefined;
    const highlights: ChangelogEntry[] = [];
    const other: ChangelogEntry[] = [];

    let current: ChangelogSection = "other";

    for (const line of body) {
      const heading = /^### (?<name>.+)$/u.exec(line)?.groups?.name?.trim().toLowerCase();
      if (heading) {
        current = sectionFor(heading);
        continue;
      }

      const match = /^- (?<type>feat|fix)(?:\((?<area>[^)]+)\))?: (?<rest>.+)$/u.exec(line);
      const fields = match?.groups;
      if (!fields || fields.rest === undefined) {
        continue;
      }

      const { icon, title, message } = parseEntryBody(fields.rest);
      const entry: ChangelogEntry = {
        date,
        type: fields.type as "feat" | "fix",
        section: current,
        area: fields.area?.trim(),
        title,
        message,
      };
      if (current === "milestone") {
        if (milestone === undefined && title !== undefined) {
          milestone = { ...entry, icon };
        }
        continue;
      }
      (current === "highlight" ? highlights : other).push(entry);
    }

    if (milestone !== undefined || highlights.length > 0 || other.length > 0) {
      groups.push({ date, milestone, highlights, other });
    }
  }

  return groups;
}

export type { ChangelogEntry, ChangelogGroup };
