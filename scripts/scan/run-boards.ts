/* oxlint-disable import/no-nodejs-modules -- standalone CLI tooling, never bundled */
/**
 * Board-photo bench: identifies every card in each still photo listed in
 * data/image-recognition-test/boards/boards.json and scores card names
 * against the labelled clip each photo belongs to.
 *
 * Usage: SCAN_BOARD_DETECTOR=... bun scripts/scan/run-boards.ts [--max-side px] [--boards list.json] [--json out.json]
 */
import fs from "node:fs";
import path from "node:path";

import type { BoardCard } from "../../packages/shared/src/scan/board.js";
import { boardOptionsFor, readBoard } from "../../packages/shared/src/scan/board.js";
import { gatesForBank } from "../../packages/shared/src/scan/session-options.js";
import { createBoardDetector } from "./board-model";
import { applyArtGroups, loadCatalog } from "./catalog";
import { CANONICAL_BANK, EMBED_SIZE, loadEmbedBank, nodeEmbedder } from "./embed-bank";
import {
  DATA_DIR,
  argValue,
  listReferenceImages,
  loadClipTruth,
  loadImage,
  positiveIntArg,
} from "./lib";

const BOARDS_DIR = path.join(DATA_DIR, "boards");

const detectorFile = process.env.SCAN_BOARD_DETECTOR;
if (!detectorFile) {
  process.stderr.write(
    "usage: SCAN_BOARD_DETECTOR=... bun scripts/scan/run-boards.ts [--max-side px] [--boards list.json] [--json out.json]\n",
  );
  process.exit(2);
}

async function main(modelFile: string): Promise<void> {
  const jsonOut = argValue("--json");
  const maxSide = positiveIntArg("--max-side");
  const catalog = loadCatalog();
  const bank = await loadEmbedBank();
  const groupOf = await applyArtGroups(catalog, bank);
  const gates = gatesForBank(bank);
  const references = new Map(listReferenceImages().map((entry) => [entry.key, entry.file]));
  const detect = createBoardDetector(modelFile);
  const boardsFile = argValue("--boards") ?? path.join(BOARDS_DIR, "boards.json");
  const boards = JSON.parse(fs.readFileSync(boardsFile, "utf-8")) as {
    photo: string;
    truth: string;
  }[];

  const totals = {
    boards: 0,
    expected: 0,
    found: 0,
    pickerFound: 0,
    wrong: 0,
    extra: 0,
    asked: 0,
    ms: 0,
  };
  const results: unknown[] = [];
  for (const board of boards) {
    const truth = loadClipTruth(board.truth);
    if (!truth) {
      continue;
    }
    const file = path.resolve(BOARDS_DIR, board.photo);
    const startedAt = performance.now();
    const photo = await loadImage(file, { maxSide, rotate: true });
    const deps = {
      embedder: nodeEmbedder,
      bank,
      embedImageSize: EMBED_SIZE,
      artKeyOf: (key: string) => catalog.get(key)?.artKey ?? key,
      fetchReference: async (key: string) => {
        const reference = references.get(key);
        return reference ? await loadImage(reference) : null;
      },
    };
    const cards: BoardCard[] = await readBoard(
      photo,
      detect,
      deps,
      boardOptionsFor(gates, CANONICAL_BANK),
    );
    const ms = performance.now() - startedAt;

    const wanted = new Map<string, number>();
    for (const card of truth.cards) {
      wanted.set(card.name, (wanted.get(card.name) ?? 0) + (card.copies ?? 1));
    }
    const expected = [...wanted.values()].reduce((sum, count) => sum + count, 0);
    const nameOf = (key: string) => catalog.get(key)?.name ?? "?";
    const seen = new Map<string, number>();
    let wrong = 0;
    let extra = 0;
    for (const card of cards.filter((entry) => entry.confident)) {
      const name = nameOf(card.key);
      seen.set(name, (seen.get(name) ?? 0) + 1);
      if (!wanted.has(name)) {
        wrong++;
      } else if ((seen.get(name) ?? 0) > (wanted.get(name) ?? 0)) {
        extra++;
      }
    }
    const found = [...wanted].reduce(
      (sum, [name, count]) => sum + Math.min(count, seen.get(name) ?? 0),
      0,
    );
    const open = new Map(
      [...wanted].map(([name, count]) => [name, Math.max(0, count - (seen.get(name) ?? 0))]),
    );
    const asked = cards.filter((entry) => !entry.confident);
    let pickerFound = 0;
    for (const card of asked) {
      const name = [card.key, ...card.alternatives]
        .map((key) => nameOf(key))
        .find((entry) => (open.get(entry) ?? 0) > 0);
      if (name !== undefined) {
        open.set(name, (open.get(name) ?? 0) - 1);
        pickerFound++;
      }
    }
    const missed = [...open].flatMap(([name, count]) => Array.from({ length: count }, () => name));
    totals.boards++;
    totals.expected += expected;
    totals.found += found;
    totals.pickerFound += pickerFound;
    totals.wrong += wrong;
    totals.extra += extra;
    totals.asked += asked.length;
    totals.ms += ms;
    process.stdout.write(
      `${board.photo} (${board.truth}): found ${found}/${expected}, wrong ${wrong}, extra ${extra}, ` +
        `picker ${asked.length} (${pickerFound} recover a missing card), ${(ms / 1000).toFixed(1)}s\n`,
    );
    for (const card of cards) {
      if (card.confident && !wanted.has(nameOf(card.key))) {
        process.stdout.write(
          `    WRONG ${nameOf(card.key)} [${catalog.get(card.key)?.publicCode}] score ${card.score.toFixed(2)} vs ${card.rivalScore.toFixed(2)}, distance ${card.distance.toFixed(2)}\n`,
        );
      }
    }
    if (missed.length > 0) {
      process.stdout.write(`    missed: ${missed.join(", ")}\n`);
    }
    results.push({
      board: board.photo,
      truth: board.truth,
      found,
      pickerFound,
      expected,
      wrong,
      extra,
      ms,
      cards,
    });
  }
  process.stdout.write(
    `\nTOTAL found ${totals.found}/${totals.expected}, wrong ${totals.wrong}, extra ${totals.extra}, ` +
      `picker ${totals.asked} (${totals.pickerFound} recover a missing card), ` +
      `mean ${(totals.ms / Math.max(1, totals.boards) / 1000).toFixed(1)}s over ${totals.boards} scored photos\n`,
  );
  if (jsonOut) {
    fs.writeFileSync(
      jsonOut,
      `${JSON.stringify({ detector: path.basename(modelFile), groups: groupOf.size, results }, null, 1)}\n`,
    );
  }
}

await main(detectorFile);
