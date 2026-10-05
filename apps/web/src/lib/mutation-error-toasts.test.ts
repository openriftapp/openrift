// oxlint-disable no-nodejs-modules -- this test introspects the source tree, so it must read files from disk
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const SRC_DIR = join(import.meta.dirname, "..");

const ON_ERROR_TOAST = /onError:\s*\([^)]*\)\s*=>\s*\{?\s*toast\.error\(/u;

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return entry.name === "paraglide" ? [] : listSourceFiles(path);
      }
      if (!/\.tsx?$/u.test(entry.name) || entry.name.includes(".test.")) {
        return [];
      }
      return [path];
    }),
  );
  return files.flat();
}

describe("mutation error toasts", () => {
  it("leaves the error toast to the global mutation handler", async () => {
    const files = await listSourceFiles(SRC_DIR);
    const offenders: string[] = [];
    for (const file of files) {
      // oxlint-disable-next-line no-await-in-loop -- a few hundred small files, read in order
      const contents = await readFile(file, "utf-8");
      if (ON_ERROR_TOAST.test(contents)) {
        offenders.push(relative(SRC_DIR, file));
      }
    }
    expect(offenders).toStrictEqual([]);
  });
});
