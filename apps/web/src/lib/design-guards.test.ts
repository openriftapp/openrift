// oxlint-disable no-nodejs-modules -- this test introspects the source tree, so it must read files from disk
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const SRC_DIR = join(import.meta.dirname, "..");

const COMMENT_LINE = /^\s*(?:\/\/|\/?\*)/u;

const HUE =
  "(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";

interface Guard {
  title: string;
  pattern: RegExp;
  exempt?: ReadonlySet<string>;
  /** Directory prefixes the guard never scans (the primitives that own the pattern). */
  exemptDirs?: readonly string[];
}

const GUARDS: readonly Guard[] = [
  {
    title: "names state with a theme token, never a raw Tailwind hue",
    pattern: new RegExp(
      `\\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|decoration|divide|shadow)-${HUE}-\\d+\\b`,
      "u",
    ),
    exempt: new Set(["components/ui/podium.tsx"]),
  },
  {
    title: "never pairs a dark: variant with a status token",
    pattern:
      /\bdark:(?:hover:|group-hover:)?(?:bg|text|border|ring)-(?:success|warning|info|violet|destructive-soft)\b/u,
  },
  {
    title: "draws every edge in the border token, not a foreground ring",
    pattern: /\bring-foreground\/10\b/u,
  },
  {
    title: "highlights with the muted wash, never the accent fill",
    pattern: /(?:^|[\s"'`:])bg-accent(?:\/\d+)?(?=[\s"'`]|$)/u,
  },
  {
    title: "uses the token radius, not Tailwind's bare rounded",
    pattern: /["'`][^"'`]*(?:^|[\s"'`])rounded(?=[\s"'`])/u,
  },
  {
    title: "hovers rows with the one muted wash",
    pattern: /\bhover:bg-muted\/(?:20|30|40|60|80|90)\b/u,
    exempt: new Set(["components/ui/count-pill.tsx"]),
  },
  {
    title: "keeps focus rings at ring-2",
    pattern: /\bring-\[3px\]/u,
  },
  {
    title: "writes gradients in the Tailwind v4 spelling",
    pattern: /\bbg-gradient-to-/u,
  },
  {
    title: "never uses a padding-less Card as a bare list or table wrapper",
    pattern: /<Card(?:Panel)?\b[^>]*className="[^"]*\b(?:py-0|p-0)\b/u,
    exempt: new Set([
      "features/account/components/auth-form-shell.tsx",
      "features/admin/components/meta-review-event-group.tsx",
      "features/decks/components/deck-hero.tsx",
      "features/decks/components/deck-matchup-card.tsx",
      "features/groups/components/trade-settle-section.tsx",
      "features/groups/components/user-profile-header.tsx",
      "features/meta/components/meta-event-header.tsx",
      "features/meta/components/meta-event-run-page.tsx",
      "features/meta/components/meta-legend-hero.tsx",
      "features/meta/components/meta-player-hero.tsx",
      "features/tournaments/components/champion-plate.tsx",
      "routes/_app/reset-password.lazy.tsx",
      "routes/_app/verify-email.lazy.tsx",
    ]),
  },
  {
    title: "separates sibling sections with spacing, never a Separator",
    pattern: /<Separator\b/u,
    exemptDirs: ["components/ui/"],
    // Call sites still on the old pattern; remove each as it is swept.
    exempt: new Set(["features/admin/components/design/layout-section.tsx"]),
  },
  {
    title: "pads a page column with the gutter, never a hard-coded px",
    pattern: /PAGE_WIDTH\.(?:capped|full)\b[^\n]*\bpx-\d/u,
  },
];

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return listSourceFiles(path);
      }
      if (!/\.tsx?$/u.test(entry.name) || entry.name.includes(".test.")) {
        return [];
      }
      return [path];
    }),
  );
  return files.flat();
}

describe("design guards", () => {
  for (const guard of GUARDS) {
    it(guard.title, async () => {
      const files = await listSourceFiles(SRC_DIR);
      const offenders: string[] = [];
      for (const file of files) {
        const rel = relative(SRC_DIR, file);
        if (guard.exempt?.has(rel) || guard.exemptDirs?.some((dir) => rel.startsWith(dir))) {
          continue;
        }
        const contents = await readFile(file, "utf-8");
        for (const [index, line] of contents.split("\n").entries()) {
          if (COMMENT_LINE.test(line)) {
            continue;
          }
          if (guard.pattern.test(line)) {
            offenders.push(`${rel}:${index + 1}`);
          }
        }
      }
      expect(offenders).toStrictEqual([]);
    });
  }
});
