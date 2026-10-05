/**
 * Compares two `run-clips.ts --json` outputs and exits non-zero when a clip is missing from
 * either run, or the candidate has more wrong locks, duplicates or wrong printings added, fewer
 * cards found or correct, or a frame mean over 25% slower on a clip that did not sweep.
 * Usage: bun scripts/scan/compare-runs.ts baseline.json candidate.json
 */
import { compareRuns } from "../../packages/shared/src/scan/bench-score.js";
import { loadRun } from "./lib";

const [baselineFile, candidateFile] = process.argv.slice(2);
if (!baselineFile || !candidateFile) {
  process.stderr.write("usage: bun scripts/scan/compare-runs.ts baseline.json candidate.json\n");
  process.exit(2);
}

const baseline = loadRun(baselineFile);
const candidate = loadRun(candidateFile);
const result = compareRuns(baseline, candidate);

process.stdout.write(`baseline:  ${JSON.stringify(baseline.meta)}\n`);
process.stdout.write(`candidate: ${JSON.stringify(candidate.meta)}\n\n`);
for (const row of result.rows) {
  process.stdout.write(`${row}\n`);
}
for (const warning of result.warnings) {
  process.stdout.write(`WARN ${warning}\n`);
}
for (const failure of result.failures) {
  process.stdout.write(`FAIL ${failure}\n`);
}
process.stdout.write(result.failures.length === 0 ? "\nPASS\n" : "\nFAIL\n");
process.exit(result.failures.length === 0 ? 0 : 1);
