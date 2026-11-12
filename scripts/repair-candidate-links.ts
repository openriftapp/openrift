/**
 * One-off repair of candidate links that predate card-scoped, size-strict linking.
 * Prints every class; `--apply` writes only the classes named by a flag.
 * Usage: bun --env-file=.env scripts/repair-candidate-links.ts [--relink-size] [--relink-wrong-card]
 *   [--relink-mismatches] [--pin-mismatches] [--pin-unresolved] [--pin <id,id,...>] [--apply]
 */

import { createDb } from "../apps/api/src/db/connect.js";
import { candidatePrintingLinksRepo } from "../apps/api/src/modules/candidates/repositories/candidate-cards-links.js";
import { ingestRepo } from "../apps/api/src/modules/candidates/repositories/ingest.js";
import {
  isPinnedLink,
  loadCandidateLinkIndex,
  resolveCardIdByName,
  resolvePrintingLink,
} from "../apps/api/src/modules/candidates/services/candidate-links.js";
import { USER_SUBMISSION_PROVIDER } from "../packages/shared/src/contracts/card-submissions.js";
import { resolveFinish } from "../packages/shared/src/printing-accept.js";
import { errorMessage } from "../packages/shared/src/strings.js";
import { requireEnv } from "./env.js";

type Kind = "size" | "wrong card" | "mismatch" | "unresolved";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const relinkKinds = new Set<Kind>([
  ...(args.includes("--relink-size") ? (["size"] as const) : []),
  ...(args.includes("--relink-wrong-card") ? (["wrong card"] as const) : []),
  ...(args.includes("--relink-mismatches") ? (["mismatch"] as const) : []),
]);
const pinMismatches = args.includes("--pin-mismatches");
const pinUnresolved = args.includes("--pin-unresolved");
const pinIndex = args.indexOf("--pin");
const pinIds = new Set(
  pinIndex === -1 ? [] : (args[pinIndex + 1] ?? "").split(",").filter((id) => id !== ""),
);

const { db } = createDb(requireEnv("DATABASE_URL"));

try {
  const ingest = ingestRepo(db);
  const [rows, keys, index] = await Promise.all([
    ingest.allLinkedCandidatePrintings(),
    ingest.allPrintingKeys(),
    loadCandidateLinkIndex(ingest),
  ]);
  const sidesByPrinting = Map.groupBy(keys, (key) => key.id);
  const label = (printingId: string | null): string => {
    if (printingId === null) {
      return "unlinked";
    }
    const sides = sidesByPrinting.get(printingId) ?? [];
    const codes = sides
      .map((side) => [side.shortCode, side.finish, ...side.markerSlugs].join(" "))
      .join(" // ");
    const first = sides[0];
    return first ? `${codes} ${first.language} ${first.size}` : printingId;
  };

  const plan: {
    kind: Kind;
    row: (typeof rows)[number];
    after: string | null;
    pin: boolean;
  }[] = [];
  for (const row of rows) {
    if (row.provider === USER_SUBMISSION_PROVIDER || isPinnedLink(index, row)) {
      continue;
    }
    const sides = sidesByPrinting.get(row.printingId) ?? [];
    const cardId = resolveCardIdByName(index, row.cardName);
    const finish = resolveFinish(row.finish, row.rarity);
    const after = resolvePrintingLink(index, { ...row, cardId });
    let kind: Kind | null = null;
    if (row.size !== null && sides.every((side) => side.size !== row.size)) {
      kind = "size";
    } else if (cardId !== null && sides.every((side) => side.cardId !== cardId)) {
      kind = "wrong card";
    } else if (
      (finish !== null && sides.every((side) => side.finish !== finish)) ||
      sides.every((side) => side.shortCode.toUpperCase() !== row.shortCode.toUpperCase())
    ) {
      kind = "mismatch";
    } else if (after !== row.printingId) {
      kind = "unresolved";
    }
    if (kind === null) {
      continue;
    }
    const pin =
      pinIds.has(row.id) ||
      (kind === "mismatch" && pinMismatches && after === null) ||
      (kind === "unresolved" && pinUnresolved && after === null);
    plan.push({ kind, row, after, pin });
  }

  const unknownPins = [...pinIds].filter((id) => !plan.some((entry) => entry.row.id === id));
  if (unknownPins.length > 0) {
    throw new Error(`--pin ids not in the plan: ${unknownPins.join(", ")}`);
  }

  const relinks = plan.filter(
    (entry) =>
      !entry.pin &&
      relinkKinds.has(entry.kind) &&
      entry.after !== entry.row.printingId &&
      (entry.kind !== "mismatch" || entry.after !== null),
  );
  const pins = plan.filter((entry) => entry.pin);

  for (const kind of ["size", "wrong card", "mismatch", "unresolved"] as const) {
    const entries = plan.filter((entry) => entry.kind === kind);
    const moved = entries.filter((entry) => entry.after !== entry.row.printingId);
    console.log(
      `\n${kind}: ${entries.length} row(s), ${moved.length} resolve away from their current link`,
    );
    for (const entry of entries) {
      const { row, after } = entry;
      let action = "report only";
      if (entry.pin) {
        action = "pin the current link";
      } else if (relinks.includes(entry)) {
        action = `relink -> ${label(after)}`;
      }
      console.log(
        `  ${row.id}  ${row.provider}  "${row.cardName}" ${row.shortCode} ${row.finish ?? "-"} ${row.language ?? "-"} ${row.size ?? "-"} [${row.markerSlugs.join(",")}]\n` +
          `    now: ${label(row.printingId)}\n` +
          `    resolves to: ${label(after)}\n` +
          `    action: ${action}`,
      );
    }
  }

  console.log(
    `\n${apply ? "Applying" : "Would apply"}: ${relinks.length} relink(s), ${pins.length} pin(s).`,
  );
  if (apply && relinks.length === 0 && pins.length === 0) {
    console.log("Nothing selected: pass a --relink-* or --pin-* flag to write.");
  }

  if (apply && relinks.length + pins.length > 0) {
    await db.transaction().execute(async (trx) => {
      const candidates = candidatePrintingLinksRepo(trx);
      for (const { row, after } of relinks) {
        await candidates.linkCandidatePrintings([row.id], after);
      }
      for (const { row } of pins) {
        await candidates.upsertPrintingLinkOverrides([row.id], row.printingId);
      }
    });
    console.log("Done.");
  }
} catch (error) {
  console.error(errorMessage(error));
  process.exitCode = 1;
} finally {
  await db.destroy();
}
