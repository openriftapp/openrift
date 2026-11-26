/**
 * Runs the React Compiler over the web and shared source files a branch changed and fails on a
 * bailout, the check the production build makes over every file.
 * Usage: bun apps/web/scripts/check-react-compiler.ts [base-ref]   (default: main)
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { transformAsync } from "@babel/core";
import reactCompiler from "babel-plugin-react-compiler";

import { createCompilerBailouts } from "../vite-plugins/react-compiler-bailouts.ts";

const webRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(webRoot, "../..");
const baseRef = process.argv[2] ?? "main";

const COMPILED_SOURCE = /^(?:apps\/web|packages\/shared)\/src\/.*\.tsx?$/u;
const SKIPPED = /\.test\.tsx?$|\/src\/paraglide\//u;

function git(args: string[]): string[] {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf-8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.split("\n").filter((line) => line !== "");
}

const [mergeBase] = git(["merge-base", baseRef, "HEAD"]);
const files = [
  ...new Set([
    ...git(["diff", "--name-only", mergeBase ?? baseRef]),
    ...git(["ls-files", "--others", "--exclude-standard"]),
  ]),
]
  .filter((file) => COMPILED_SOURCE.test(file) && !SKIPPED.test(file))
  .map((file) => path.resolve(repoRoot, file))
  .filter((file) => existsSync(file));

const bailouts = createCompilerBailouts(webRoot, false);
for (const filename of files) {
  await transformAsync(readFileSync(filename, "utf-8"), {
    filename,
    babelrc: false,
    configFile: false,
    code: false,
    parserOpts: { plugins: filename.endsWith(".tsx") ? ["typescript", "jsx"] : ["typescript"] },
    plugins: [[reactCompiler, { logger: bailouts.logger }]],
  });
}

const report = bailouts.takeReport();
if (report !== undefined) {
  console.error(report);
  process.exit(1);
}
console.log(`React Compiler: ${files.length} changed files compile without a bailout`);
