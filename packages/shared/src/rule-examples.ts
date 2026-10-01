export interface RuleSection {
  kind: "text" | "example";
  content: string;
}

const EXAMPLE_LINE_REGEX = /^\s*\*?Examples?:/u;
const SEE_ALSO_LINE_REGEX = /^\s*\*?See\b/u;

export function splitRuleSections(content: string): RuleSection[] {
  const groups: { kind: RuleSection["kind"]; lines: string[] }[] = [];
  for (const line of content.split("\n")) {
    const last = groups.at(-1);
    const startsExample = EXAMPLE_LINE_REGEX.test(line);
    const kind: RuleSection["kind"] =
      startsExample || (last?.kind === "example" && !SEE_ALSO_LINE_REGEX.test(line))
        ? "example"
        : "text";
    if (last === undefined || startsExample || kind !== last.kind) {
      groups.push({ kind, lines: [line] });
    } else {
      last.lines.push(line);
    }
  }
  return groups
    .map((group) => ({ kind: group.kind, content: group.lines.join("\n").trim() }))
    .filter((section) => section.content !== "");
}

export function ruleExampleText(content: string): string {
  return splitRuleSections(content)
    .filter((section) => section.kind === "example")
    .map((section) => section.content)
    .join("\n");
}

function escapeRegex(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

export function cardMentionPattern(names: Iterable<string>): RegExp | null {
  const sorted = [...new Set(names)].filter(Boolean).toSorted((a, b) => b.length - a.length);
  if (sorted.length === 0) {
    return null;
  }
  return new RegExp(
    String.raw`(?<![\p{L}\p{N}])(?:${sorted.map((name) => escapeRegex(name)).join("|")})(?![\p{L}\p{N}])`,
    "gu",
  );
}

// Quoted text is card wording and *emphasis* marks game terms, so neither is linked.
function linkableRuns(text: string): { text: string; linkable: boolean }[] {
  const runs: { text: string; linkable: boolean }[] = [];
  let start = 0;
  let inQuote = false;
  let inEmphasis = false;
  const push = (end: number, linkable: boolean) => {
    if (end > start) {
      runs.push({ text: text.slice(start, end), linkable });
    }
    start = end;
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const wasLinkable = !inQuote && !inEmphasis;
    if (char === "“" || (char === '"' && !inQuote)) {
      push(index, wasLinkable);
      inQuote = true;
    } else if (char === "”" || (char === '"' && inQuote)) {
      inQuote = false;
      push(index + 1, false);
    } else if (char === "*") {
      push(index, wasLinkable);
      inEmphasis = !inEmphasis;
    }
  }
  push(text.length, !inQuote && !inEmphasis);
  return runs;
}

export function findCardMentions(text: string, pattern: RegExp): Set<string> {
  const found = new Set<string>();
  for (const run of linkableRuns(text)) {
    if (run.linkable) {
      for (const match of run.text.matchAll(pattern)) {
        found.add(match[0]);
      }
    }
  }
  return found;
}

export function linkCardMentions(
  text: string,
  pattern: RegExp,
  slugsByName: ReadonlyMap<string, string>,
): string {
  return linkableRuns(text)
    .map((run) =>
      run.linkable
        ? run.text.replaceAll(pattern, (name) => {
            const slug = slugsByName.get(name);
            return slug === undefined ? name : `[${name}](/cards/${slug})`;
          })
        : run.text,
    )
    .join("");
}
