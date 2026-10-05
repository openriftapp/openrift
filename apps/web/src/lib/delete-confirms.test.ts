// oxlint-disable no-nodejs-modules -- this test introspects the source tree, so it must read files from disk
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const SRC_DIR = join(import.meta.dirname, "..");

const ACTION = /<AlertDialogAction\b(?<attributes>[^>]*)>(?<label>[\s\S]*?)<\/AlertDialogAction>/gu;
const DELETE_LABEL = /common_delete\(\)|\bDelete\b/u;

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return listSourceFiles(path);
      }
      if (!entry.name.endsWith(".tsx") || entry.name.includes(".test.")) {
        return [];
      }
      return [path];
    }),
  );
  return files.flat();
}

describe("delete confirms", () => {
  it("renders every Delete confirm button in the destructive variant", async () => {
    const files = await listSourceFiles(SRC_DIR);
    const offenders: string[] = [];
    for (const file of files) {
      // oxlint-disable-next-line no-await-in-loop -- a few hundred small files, read in order
      const contents = await readFile(file, "utf-8");
      for (const match of contents.matchAll(ACTION)) {
        const { attributes = "", label = "" } = match.groups ?? {};
        if (DELETE_LABEL.test(label) && !attributes.includes('variant="destructive"')) {
          offenders.push(relative(SRC_DIR, file));
        }
      }
    }
    expect(offenders).toStrictEqual([]);
  });
});
