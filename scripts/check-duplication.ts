import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  compareToCeiling,
  formatClonePair,
  parseCeiling,
  parseCloneReport,
  parseJscpdVersion,
} from "../packages/shared/src/repo-checks/clone-ceiling.js";

const repoRoot = resolve(import.meta.dirname ?? ".", "..");
const ceilingPath = join(repoRoot, "scripts/data/clone-ceiling.json");
const jscpd = [process.execPath, join(repoRoot, "node_modules/.bin/jscpd")];
const update = process.argv.includes("--update");

const ceiling = parseCeiling(readFileSync(ceilingPath, "utf-8"));

const versionRun = Bun.spawnSync([...jscpd, "--version"], {
  cwd: repoRoot,
  stdout: "pipe",
  stderr: "pipe",
});
const installed = parseJscpdVersion(versionRun.stdout.toString());
if (versionRun.exitCode !== 0 || installed === null) {
  console.error(
    `Could not run jscpd (exit ${versionRun.exitCode}):\n${versionRun.stderr.toString()}`,
  );
  process.exit(1);
}
if (installed !== ceiling.jscpd) {
  console.error(
    `jscpd ${installed} is installed, but the clone ceiling was measured with jscpd ${ceiling.jscpd}.\n` +
      "Engine versions count clones differently. Run `bun install`, or after an upgrade set\n" +
      `"jscpd": "${installed}" in scripts/data/clone-ceiling.json, run the check again and set\n` +
      '"clones" to the count it reports.',
  );
  process.exit(1);
}

const outputDir = mkdtempSync(join(tmpdir(), "openrift-jscpd-"));
let exitCode: number | null = null;
let stderr = "";
let reportText = "";
try {
  const run = Bun.spawnSync(
    [
      ...jscpd,
      "--config",
      join(repoRoot, ".jscpd.json"),
      "--reporters",
      "json",
      "--absolute",
      "--silent",
      "--output",
      outputDir,
    ],
    { cwd: repoRoot, stdout: "pipe", stderr: "pipe" },
  );
  exitCode = run.exitCode;
  stderr = run.stderr.toString();
  if (exitCode === 0) {
    reportText = readFileSync(join(outputDir, "jscpd-report.json"), "utf-8");
  }
} finally {
  rmSync(outputDir, { recursive: true, force: true });
}
if (exitCode !== 0) {
  console.error(`jscpd exited with ${exitCode}:\n${stderr}`);
  process.exit(1);
}

const { sources, clones } = parseCloneReport(JSON.parse(reportText), repoRoot);
if (sources === 0) {
  console.error("jscpd analyzed no files. Check the paths and ignores in .jscpd.json.");
  process.exit(1);
}

const verdict = compareToCeiling(clones.length, ceiling.clones);

if (verdict === "over") {
  console.error(
    `jscpd found ${clones.length} clones, the ceiling is ${ceiling.clones}. ` +
      "Merge the new copy into the code it repeats. All clones, largest first:\n",
  );
  for (const clone of clones) {
    console.error(`  ${formatClonePair(clone)}`);
  }
  process.exit(1);
}

if (verdict === "under") {
  if (update) {
    writeFileSync(
      ceilingPath,
      `${JSON.stringify({ ...ceiling, clones: clones.length }, null, 2)}\n`,
    );
    console.log(`Clone ceiling lowered from ${ceiling.clones} to ${clones.length}.`);
  } else {
    console.log(
      `Duplication OK: ${clones.length} clones, ceiling ${ceiling.clones}. ` +
        "Lower the ceiling with `bun run check:duplication --update`.",
    );
  }
  process.exit(0);
}

console.log(
  `Duplication OK: ${clones.length} clones (ceiling ${ceiling.clones}, jscpd ${installed}).`,
);
