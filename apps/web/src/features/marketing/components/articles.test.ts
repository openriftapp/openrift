import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  helpArticleLabels,
  helpArticleList,
  visibleHelpArticles,
} from "@/features/marketing/components/articles";
import { buildPaletteGroups } from "@/lib/command-palette-results";
import { getLocale, overwriteGetLocale } from "@/paraglide/runtime.js";

vi.mock("@/paraglide/messages.js", async () => ({
  m: await import("@/test/paraglide-all.js"),
}));

const englishMessages = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../../../messages/en.json"), "utf-8"),
) as Record<string, string>;

const baseGetLocale = getLocale;

const flaggedArticles = helpArticleList.filter((article) => article.featureFlag);
const unflaggedSlugs = helpArticleList
  .filter((article) => !article.featureFlag)
  .map((article) => article.slug);

describe("visibleHelpArticles", () => {
  it("keeps every unflagged article when no flags are set", () => {
    expect(visibleHelpArticles({}).map((article) => article.slug)).toEqual(unflaggedSlugs);
  });

  it("hides a flagged article while its flag is off", () => {
    const visible = visibleHelpArticles({ "help-how-to-play": false });

    expect(visible.map((article) => article.slug)).not.toContain("how-to-play");
  });

  it("shows a flagged article once its flag is on", () => {
    const visible = visibleHelpArticles({ "help-how-to-play": true });

    expect(visible.map((article) => article.slug)).toContain("how-to-play");
  });

  it("shows the Discord bot article unconditionally now that its flag is gone", () => {
    expect(visibleHelpArticles({}).map((article) => article.slug)).toContain("discord-bot");
  });

  it("treats a missing flag as off", () => {
    expect(visibleHelpArticles({ unrelated: true }).map((article) => article.slug)).toEqual(
      unflaggedSlugs,
    );
  });

  it("gates each flagged article independently, without hiding unrelated flagged articles", () => {
    for (const article of flaggedArticles) {
      const visible = visibleHelpArticles({ [article.featureFlag as string]: true });
      const slugs = visible.map((entry) => entry.slug);

      expect(slugs).toContain(article.slug);
      for (const other of flaggedArticles) {
        if (other.slug !== article.slug) {
          expect(slugs).not.toContain(other.slug);
        }
      }
    }
  });

  it("preserves declaration order", () => {
    const allFlagsOn = Object.fromEntries(
      flaggedArticles.map((article) => [article.featureFlag as string, true]),
    );

    expect(visibleHelpArticles(allFlagsOn).map((article) => article.slug)).toEqual(
      helpArticleList.map((article) => article.slug),
    );
  });
});

describe("helpArticleLabels", () => {
  afterEach(() => {
    overwriteGetLocale(baseGetLocale);
  });

  it.each(helpArticleList.map((article) => [article.slug, article] as const))(
    "reads the English messages for %s in heads, whatever the viewer's locale",
    (slug, article) => {
      overwriteGetLocale(() => "de");
      const key = slug.replaceAll("-", "_");

      expect(helpArticleLabels(article, { locale: "en" })).toEqual({
        title: englishMessages[`help_article_${key}_title`],
        description: englishMessages[`help_article_${key}_description`],
      });
    },
  );

  it("reads the viewer's locale without options", () => {
    overwriteGetLocale(() => "de");
    const article = helpArticleList.find((entry) => entry.slug === "deck-building");

    expect(article && helpArticleLabels(article).title).toBe("Decks bauen");
  });
});

describe("command palette help rows", () => {
  afterEach(() => {
    overwriteGetLocale(baseGetLocale);
  });

  it("show and search the viewer's locale title", () => {
    const article = helpArticleList.find((entry) => entry.slug === "deck-building");
    overwriteGetLocale(() => "de");

    const groups = buildPaletteGroups({
      query: "Decks bauen",
      cards: [],
      navItems: [],
      helpArticles: article ? [article] : [],
      quickAdd: null,
    });

    const help = groups.flatMap((group) => group.rows).find((row) => row.kind === "help");
    expect(help).toMatchObject({ slug: "deck-building", title: "Decks bauen" });
  });
});
