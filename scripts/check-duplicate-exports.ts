import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  collectExportNames,
  diffBaseline,
  findDuplicateNames,
  formatBaseline,
  nextBaseline,
  parseBaseline,
} from "../packages/shared/src/repo-checks/duplicate-exports.js";

const SOURCE_ROOTS = [
  "apps/web/src",
  "apps/api/src",
  "packages/shared/src",
  "apps/discord-bot/src",
];

const CONVENTIONAL_EXPORTS = [{ files: "apps/web/src/routes/**", names: ["Route"] }];

const repoRoot = resolve(import.meta.dirname ?? ".", "..");
const baselinePath = join(repoRoot, "scripts/data/duplicate-exports-baseline.txt");
const update = process.argv.includes("--update");
const allowGrowth = process.argv.includes("--allow-growth");

const jscpdConfig = JSON.parse(readFileSync(join(repoRoot, ".jscpd.json"), "utf-8")) as {
  ignore: string[];
};
const ignores = jscpdConfig.ignore.map((pattern) => new Bun.Glob(pattern));
const conventional = CONVENTIONAL_EXPORTS.map(({ files, names }) => ({
  glob: new Bun.Glob(files),
  names: new Set(names),
}));

const listing = Bun.spawnSync(
  ["git", "ls-files", "--cached", "--others", "--exclude-standard", "--", ...SOURCE_ROOTS],
  { cwd: repoRoot, stdout: "pipe", stderr: "pipe" },
);
if (listing.exitCode !== 0) {
  console.error(`git ls-files failed:\n${listing.stderr.toString()}`);
  process.exit(1);
}

const exportsByFile = new Map<string, string[]>();
for (const file of new Set(listing.stdout.toString().split("\n"))) {
  if (
    !/\.tsx?$/u.test(file) ||
    ignores.some((glob) => glob.match(file)) ||
    !existsSync(join(repoRoot, file))
  ) {
    continue;
  }
  const exempt = new Set(
    conventional.filter(({ glob }) => glob.match(file)).flatMap(({ names }) => [...names]),
  );
  const names = collectExportNames(file, readFileSync(join(repoRoot, file), "utf-8"));
  exportsByFile.set(
    file,
    [...names].filter((name) => !exempt.has(name)),
  );
}

if (exportsByFile.size === 0) {
  console.error("No source files found. Check SOURCE_ROOTS in scripts/check-duplicate-exports.ts.");
  process.exit(1);
}

const duplicates = findDuplicateNames(exportsByFile);
const current = new Map([...duplicates].map(([name, files]) => [name, files.length]));
const baseline = parseBaseline(existsSync(baselinePath) ? readFileSync(baselinePath, "utf-8") : "");
const { grown, shrunk } = diffBaseline(current, baseline);

if (update) {
  const next = nextBaseline(current, baseline, allowGrowth);
  writeFileSync(baselinePath, formatBaseline(next));
  console.log(`Duplicate-export baseline: ${baseline.size} → ${next.size} names.`);
  if (allowGrowth || grown.length === 0) {
    process.exit(0);
  }
}

if (grown.length > 0) {
  console.error(
    "Exported names defined in more files than the baseline allows (one name should mean one thing):\n",
  );
  for (const name of grown) {
    const allowed = baseline.get(name);
    console.error(`  ${name}${allowed === undefined ? "" : ` (baseline allows ${allowed} files)`}`);
    for (const file of duplicates.get(name) ?? []) {
      console.error(`    ${file}`);
    }
  }
  console.error(
    "\nRename one of them, or merge them when they do the same job. A deliberate" +
      "\nduplicate goes into the baseline with `bun run check:duplicate-exports --update --allow-growth`.",
  );
  process.exit(1);
}

if (shrunk.length > 0) {
  console.log(
    `Duplicate exports OK. ${shrunk.length} baseline names are now defined in fewer files ` +
      `(${shrunk.join(", ")}). Shrink the baseline with \`bun run check:duplicate-exports --update\`.`,
  );
  process.exit(0);
}

console.log(`Duplicate exports OK (${duplicates.size} known duplicated names).`);
