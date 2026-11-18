/**
 * Runs the unit tests a branch can have broken: the tests whose import graph
 * reaches a changed file, plus every test that reads the source tree from
 * disk. A change vitest cannot trace through imports runs the whole package.
 * Usage: bun scripts/test-affected.ts [base-ref]   (default: main)
 *        bun scripts/test-affected.ts --guards [files]   (guards only, of the packages the files are in)
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname ?? ".", "..");
const baseRef = process.argv[2] ?? "main";

const SHARED = "packages/shared";
const PACKAGES = [
  { dir: SHARED, name: "@openrift/shared" },
  { dir: "apps/api", name: "api" },
  { dir: "apps/web", name: "web" },
  { dir: "apps/discord-bot", name: "discord-bot" },
  { dir: "apps/extension", name: "extension" },
];

const ROOT_TRIGGERS = new Set(["package.json", "bun.lock", "tsconfig.json"]);
const MESSAGES_DIR = "apps/web/messages/";
const GUARD_PATTERN = String.raw`node:fs|repo-checks|import\.meta\.glob`;

function git(args: string[]): string {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout;
}

function lines(output: string): string[] {
  return output.split("\n").filter((line) => line !== "");
}

function changedFiles(mergeBase: string): string[] {
  return [
    ...new Set([
      ...lines(git(["diff", "--name-only", mergeBase])),
      ...lines(git(["ls-files", "--others", "--exclude-standard"])),
    ]),
  ];
}

function readMessages(source: string | null): Record<string, unknown> {
  if (source === null) {
    return {};
  }
  return JSON.parse(source) as Record<string, unknown>;
}

function changedMessageKeys(mergeBase: string, files: string[]): Set<string> {
  const keys = new Set<string>();
  for (const file of files.filter((path) => path.startsWith(MESSAGES_DIR))) {
    const shown = spawnSync("git", ["show", `${mergeBase}:${file}`], {
      cwd: repoRoot,
      encoding: "utf-8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const before = readMessages(shown.status === 0 ? shown.stdout : null);
    const path = resolve(repoRoot, file);
    const after = readMessages(existsSync(path) ? readFileSync(path, "utf-8") : null);
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        keys.add(key);
      }
    }
  }
  return keys;
}

function filesUsingMessages(keys: Set<string>): string[] {
  if (keys.size === 0) {
    return [];
  }
  const found = new Set<string>();
  const all = [...keys];
  for (let start = 0; start < all.length; start += 200) {
    const pattern = String.raw`\bm\.(${all.slice(start, start + 200).join("|")})\b`;
    const result = spawnSync("git", ["grep", "-lE", pattern, "--", "apps/web/src"], {
      cwd: repoRoot,
      encoding: "utf-8",
    });
    for (const file of lines(result.stdout)) {
      found.add(file);
    }
  }
  return [...found];
}

function guardTests(dir: string): string[] {
  const result = spawnSync(
    "git",
    [
      "grep",
      "-lE",
      GUARD_PATTERN,
      "--",
      `${dir}/*.test.ts`,
      `${dir}/*.test.tsx`,
      ":!*.integration.test.ts",
    ],
    { cwd: repoRoot, encoding: "utf-8" },
  );
  return lines(result.stdout);
}

function isModule(file: string): boolean {
  return /\.(?:ts|tsx|md)$/u.test(file);
}

function needsFullRun(dir: string, files: string[]): string | undefined {
  return files.find((file) => {
    if (ROOT_TRIGGERS.has(file)) {
      return true;
    }
    if (file.startsWith(MESSAGES_DIR)) {
      return false;
    }
    const inScope = file.startsWith(`${dir}/`) || file.startsWith(`${SHARED}/`);
    const outsideGraph =
      dirname(file) === dir || !isModule(file) || file.endsWith("vitest.setup.ts");
    return inScope && outsideGraph;
  });
}

function check(name: string, command: string[], cwd: string): void {
  const result = spawnSync(command[0], command.slice(1), { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`FAILED: ${name}`);
    process.exit(1);
  }
}

if (baseRef === "--guards") {
  const staged = process.argv.slice(3);
  for (const { dir, name } of PACKAGES) {
    if (staged.length > 0 && !staged.some((file) => file.startsWith(`${dir}/`))) {
      continue;
    }
    const guards = guardTests(dir).map((file) => resolve(repoRoot, file));
    if (guards.length > 0) {
      check(name, ["bunx", "vitest", "run", "--reporter=dot", ...guards], resolve(repoRoot, dir));
    }
  }
  process.exit(0);
}

const mergeBase = git(["merge-base", baseRef, "HEAD"]).trim();
const files = changedFiles(mergeBase);
const messageUsers = filesUsingMessages(changedMessageKeys(mergeBase, files));
const related = [...new Set([...files, ...messageUsers])]
  .map((file) => resolve(repoRoot, file))
  .filter((path) => existsSync(path));

for (const { dir, name } of PACKAGES) {
  const touched = files.some(
    (file) =>
      ROOT_TRIGGERS.has(file) ||
      file.startsWith("scripts/") ||
      file.startsWith(`${dir}/`) ||
      file.startsWith(`${SHARED}/`),
  );
  if (!touched) {
    console.log(`${name}: skipped, nothing it depends on changed`);
    continue;
  }
  const trigger = needsFullRun(dir, files);
  if (trigger !== undefined) {
    console.log(`${name}: full suite, ${trigger} is outside the import graph`);
    check(name, ["bunx", "turbo", "test", `--filter=${name}`], repoRoot);
    continue;
  }
  const guards = guardTests(dir).map((file) => resolve(repoRoot, file));
  console.log(`${name}: tests related to ${related.length} files, ${guards.length} guards`);
  check(
    name,
    ["bunx", "vitest", "related", "--run", "--passWithNoTests", ...related, ...guards],
    resolve(repoRoot, dir),
  );
}
