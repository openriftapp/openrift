import { describe, expect, it } from "vitest";

import { parseChangelog } from "./changelog.js";

describe("parseChangelog", () => {
  it("splits highlights and other sub-sections per date", () => {
    const md = [
      "# Changelog",
      "",
      "## 2026-06-17",
      "### Highlights",
      "- feat: **Inline removal** — each card has a remove button",
      "### Other",
      "- fix: **Breadcrumb separator** — the title bar now separates trail from title",
    ].join("\n");

    const result = parseChangelog(md);
    expect(result).toHaveLength(1);
    expect(result[0]!.date).toBe("2026-06-17");
    expect(result[0]!.highlights).toHaveLength(1);
    expect(result[0]!.other).toHaveLength(1);
    expect(result[0]!.highlights[0]).toMatchObject({
      type: "feat",
      section: "highlight",
      title: "Inline removal",
      message: "each card has a remove button",
    });
    expect(result[0]!.other[0]).toMatchObject({
      type: "fix",
      section: "other",
      title: "Breadcrumb separator",
      message: "the title bar now separates trail from title",
    });
  });

  it("captures the optional (Area) tag", () => {
    const md = [
      "## 2026-06-17",
      "### Highlights",
      "- feat(Collection): **Owned-count popover** — opens a popover listing each variant",
      "- fix(Decks): **Deck rename** — renaming a deck now saves",
    ].join("\n");

    const result = parseChangelog(md);
    expect(result[0]!.highlights[0]).toMatchObject({
      area: "Collection",
      title: "Owned-count popover",
      message: "opens a popover listing each variant",
    });
    expect(result[0]!.highlights[1]).toMatchObject({ area: "Decks", title: "Deck rename" });
  });

  it("leaves area undefined when no tag is present", () => {
    const md = ["## 2026-06-17", "- feat: **No area** — body"].join("\n");
    expect(parseChangelog(md)[0]!.other[0]!.area).toBeUndefined();
  });

  it("treats legacy un-sectioned entries as 'other' with no title", () => {
    const md = `## 2025-06-01

- feat: Cards are grouped by set
- fix: App updates now show up faster on iOS`;

    const result = parseChangelog(md);
    expect(result[0]!.highlights).toHaveLength(0);
    expect(result[0]!.other).toEqual([
      {
        date: "2025-06-01",
        type: "feat",
        section: "other",
        title: undefined,
        message: "Cards are grouped by set",
      },
      {
        date: "2025-06-01",
        type: "fix",
        section: "other",
        title: undefined,
        message: "App updates now show up faster on iOS",
      },
    ]);
  });

  it("keeps the full text as the message when a titled entry has no separator", () => {
    const md = [
      "## 2026-06-10",
      "### Highlights",
      "- fix: A plain sentence with no bold title",
    ].join("\n");

    const result = parseChangelog(md);
    expect(result[0]!.highlights[0]).toMatchObject({
      title: undefined,
      message: "A plain sentence with no bold title",
    });
  });

  it("ignores em dashes inside the body when splitting title from message", () => {
    const md = [
      "## 2026-06-09",
      "### Highlights",
      "- feat: **Trades page** — active trades on top — completed ones collapse away",
    ].join("\n");

    const result = parseChangelog(md);
    expect(result[0]!.highlights[0]).toMatchObject({
      title: "Trades page",
      message: "active trades on top — completed ones collapse away",
    });
  });

  it("parses multiple sections newest-first and skips empty ones", () => {
    const md = `## 2025-06-15

- feat: New feature

## 2025-06-10

## 2025-06-01

- fix: Old bug fixed`;

    const result = parseChangelog(md);
    expect(result.map((group) => group.date)).toEqual(["2025-06-15", "2025-06-01"]);
  });

  it("ignores lines that don't match the entry pattern", () => {
    const md = `## 2025-06-01

- feat: Valid entry
- chore: This won't match
- Not a valid line
- fix: Another valid entry`;

    const result = parseChangelog(md);
    expect(result[0]!.other).toHaveLength(2);
    expect(result[0]!.other[0]!.type).toBe("feat");
    expect(result[0]!.other[1]!.type).toBe("fix");
  });

  it("returns empty array for empty string", () => {
    expect(parseChangelog("")).toEqual([]);
  });

  it("returns empty array for text with no ## headings", () => {
    expect(parseChangelog("just some text\nno headings")).toEqual([]);
  });

  it("parses a milestone with its icon token", () => {
    const md = [
      "## 2026-09-12",
      "### Milestone",
      "- feat(Account): languages **Speak your language** — the whole interface in three languages.",
      "### Highlights",
      "- feat(Decks): **Stats band** — turn-1 odds sit in their own row.",
    ].join("\n");

    const result = parseChangelog(md);
    expect(result[0]!.milestone).toMatchObject({
      section: "milestone",
      area: "Account",
      icon: "languages",
      title: "Speak your language",
      message: "the whole interface in three languages.",
    });
    expect(result[0]!.highlights).toHaveLength(1);
    expect(result[0]!.other).toHaveLength(0);
  });

  it("keeps a date that holds only a milestone", () => {
    const md = [
      "## 2026-02-01",
      "### Milestone",
      "- feat(App): rocket **Launch** — the card browser goes live.",
    ].join("\n");
    const result = parseChangelog(md);
    expect(result).toHaveLength(1);
    expect(result[0]!.milestone?.title).toBe("Launch");
  });

  it("keeps only the first milestone of a date and drops one without a title", () => {
    const md = [
      "## 2026-02-01",
      "### Milestone",
      "- feat(App): no title here",
      "- feat(App): rocket **Launch** — the card browser goes live.",
      "- feat(App): bot **Second** — ignored.",
    ].join("\n");
    const result = parseChangelog(md);
    expect(result[0]!.milestone?.title).toBe("Launch");
    expect(result[0]!.other).toHaveLength(0);
  });

  it("does not read a plain entry's first word as an icon", () => {
    const md = ["## 2026-02-01", "- feat(App): **Title** — body."].join("\n");
    const entry = parseChangelog(md)[0]!.other[0]!;
    expect(entry.title).toBe("Title");
    expect(entry).not.toHaveProperty("icon");
  });
});
