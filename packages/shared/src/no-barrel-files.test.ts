// oxlint-disable no-nodejs-modules -- this test introspects the source tree, so it must read files from disk
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "..", "..", "..");

const SKIPPED_DIRS = new Set(["node_modules", "dist", ".output", ".nitro", ".turbo", "paraglide"]);

const MOUNTED_AS_ONE_AGGREGATE_ROUTER = "packages/shared/src/contracts/index.ts";

const EXEMPT_SHARED_REEXPORTS = new Set(["apps/web/src/lib/server-fns/api-types.ts"]);

const SHARED_REEXPORT =
  /export\s+(?:type\s+)?(?:\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s+from\s+["']@openrift\/shared\/[^"']+["'];?/gu;

const COMMENT = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu;
const REEXPORT =
  /export\s+(?:type\s+)?(?:\*(?:\s+as\s+[A-Za-z_$][\w$]*)?|\{[^}]*\})\s+from\s+["'][^"']+["'];?/gu;

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return SKIPPED_DIRS.has(entry.name) ? [] : listSourceFiles(path);
      }
      if (!/\.tsx?$/u.test(entry.name)) {
        return [];
      }
      if (entry.name.includes(".test.") || entry.name.endsWith(".gen.ts")) {
        return [];
      }
      return [path];
    }),
  );
  return files.flat();
}

function isReexportOnly(contents: string): boolean {
  const withoutComments = contents.replace(COMMENT, "");
  const statements = withoutComments.match(REEXPORT);
  if (!statements) {
    return false;
  }
  return withoutComments.replace(REEXPORT, "").trim() === "";
}

async function sourceRoots(): Promise<string[]> {
  const apps = await readdir(join(REPO_ROOT, "apps"), { withFileTypes: true });
  const roots = apps
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(REPO_ROOT, "apps", entry.name, "src"));
  roots.push(join(REPO_ROOT, "packages", "shared", "src"));
  return roots;
}

async function findBarrels(): Promise<string[]> {
  const roots = await sourceRoots();
  const fileLists = await Promise.all(roots.map((root) => listSourceFiles(root)));
  const files = fileLists.flat();
  const barrels = await Promise.all(
    files.map(async (file) => (isReexportOnly(await readFile(file, "utf-8")) ? file : null)),
  );
  return barrels
    .filter((file) => file !== null)
    .map((file) => relative(REPO_ROOT, file).replaceAll("\\", "/"))
    .toSorted();
}

describe("barrel files", () => {
  it("exist nowhere outside the aggregate contract router", async () => {
    expect(await findBarrels()).toStrictEqual([MOUNTED_AS_ONE_AGGREGATE_ROUTER]);
  }, 30_000);

  it("recognises the multi-line and single-line re-export forms", () => {
    expect(
      isReexportOnly(`export { a } from "./a.js";\nexport type {\n  B,\n} from "./b.js";\n`),
    ).toBe(true);
    expect(isReexportOnly(`export { a } from "./a.js";\nexport const b = 1;\n`)).toBe(false);
  });
});

describe("shared re-exports", () => {
  it("recognises a re-export from a shared module", () => {
    expect(`export { a } from "@openrift/shared/rules";`.match(SHARED_REEXPORT)).toHaveLength(1);
    expect(
      `export type {\n  B,\n} from "@openrift/shared/deck-code";`.match(SHARED_REEXPORT),
    ).toHaveLength(1);
    expect(`export { a } from "./a.js";`.match(SHARED_REEXPORT)).toBeNull();
  });

  it("do not appear in app code outside api-types", async () => {
    const apps = await readdir(join(REPO_ROOT, "apps"), { withFileTypes: true });
    const roots = apps
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(REPO_ROOT, "apps", entry.name, "src"));
    const fileLists = await Promise.all(roots.map((root) => listSourceFiles(root)));
    const files = fileLists.flat();
    const offenders = await Promise.all(
      files.map(async (file) => {
        const raw = await readFile(file, "utf-8");
        const contents = raw.replace(COMMENT, "");
        return contents.match(SHARED_REEXPORT) === null ? null : file;
      }),
    );
    expect(
      offenders
        .filter((file) => file !== null)
        .map((file) => relative(REPO_ROOT, file).replaceAll("\\", "/"))
        .filter((file) => !EXEMPT_SHARED_REEXPORTS.has(file))
        .toSorted(),
    ).toStrictEqual([]);
  }, 30_000);
});
