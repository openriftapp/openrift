/* oxlint-disable import/no-nodejs-modules -- standalone CLI tooling, never bundled */
/**
 * Re-scores a saved `run-clips.ts --json` (or device bench) result against the
 * current truth labels and printing catalogue, without replaying any frames.
 *
 * Usage: bun scripts/scan/rescore-run.ts in.json out.json [--language EN|any]
 */
import fs from "node:fs";

import { groupTruth, scoreClip } from "../../packages/shared/src/scan/bench-score.js";
import { appPrintingIndex, languageSetting, scoreAppLocks } from "./app-outcome";
import { applyArtGroups, loadCatalog } from "./catalog";
import { loadEmbedBank } from "./embed-bank";
import { loadClipTruth, loadRun } from "./lib";

const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) {
  process.stderr.write(
    "usage: bun scripts/scan/rescore-run.ts in.json out.json [--language EN|any]\n",
  );
  process.exit(2);
}
const language = languageSetting();

const catalog = loadCatalog();
const groupOf = await applyArtGroups(catalog, await loadEmbedBank());
const index = appPrintingIndex(catalog);

const run = loadRun(inFile);
const rescored: typeof run.clips = [];
for (const clip of run.clips) {
  const labels = loadClipTruth(clip.clip);
  if (!labels) {
    process.stderr.write(`WARN ${clip.clip}: no truth.json, dropped from the output\n`);
    continue;
  }
  rescored.push(clip);
  const truth = groupTruth(labels, groupOf);
  const grouped = clip.locks.map((lock) => ({
    ...lock,
    artKey: groupOf.get(lock.artKey) ?? lock.artKey,
  }));
  const { locks, score } = scoreClip(truth, grouped, (key) => catalog.get(key));
  clip.locks = locks;
  clip.score = score;
  clip.reviewed = truth.reviewed;
  clip.app = scoreAppLocks(truth, locks, catalog, index, language);
  const app = clip.app;
  process.stdout.write(
    `${clip.clip.padEnd(36)} found ${score.found}/${score.expected}  ` +
      `wrong ${score.wrongCards + score.wrongPrintings}  added ${app.auto - app.autoWrong} right, ` +
      `${app.autoWrong} wrong  picker ${app.picker} (${app.pickerMissing} missing)\n`,
  );
}
run.clips = rescored;
run.meta = { ...run.meta, rescoredAt: new Date().toISOString(), language: language ?? "any" };
fs.writeFileSync(outFile, `${JSON.stringify(run, null, 2)}\n`);
