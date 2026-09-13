// oxlint-disable-next-line import/no-nodejs-modules -- Vite/Vitest config runs in Node.js
import { readFileSync } from "node:fs";
// oxlint-disable-next-line import/no-nodejs-modules -- Vite/Vitest config runs in Node.js
import path from "node:path";

import { parseChangelog } from "@openrift/shared/changelog";
import type { Plugin } from "vite";

const changelogPath = path.resolve(import.meta.dirname, "../src/CHANGELOG.md");
const LATEST_MILESTONE_ID = "virtual:latest-milestone";
const RESOLVED_LATEST_MILESTONE_ID = `\0${LATEST_MILESTONE_ID}`;

/**
 * The app shell shows the newest milestone in a banner; this keeps the 300 KB
 * changelog out of that bundle by resolving it at build time. Shared between
 * `vite.config.ts` and `vitest.config.ts` so tests can resolve the import too.
 */
export function latestMilestonePlugin(): Plugin {
  return {
    name: "latest-milestone",
    resolveId(id) {
      return id === LATEST_MILESTONE_ID ? RESOLVED_LATEST_MILESTONE_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_LATEST_MILESTONE_ID) {
        return null;
      }
      this.addWatchFile(changelogPath);
      const latest = parseChangelog(readFileSync(changelogPath, "utf-8")).find(
        (group) => group.milestone !== undefined,
      )?.milestone;
      const value =
        latest === undefined
          ? null
          : { date: latest.date, icon: latest.icon, title: latest.title, message: latest.message };
      return `export default ${JSON.stringify(value)};`;
    },
  };
}
