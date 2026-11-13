import { readFileSync } from "node:fs";

import { createDb } from "../apps/api/src/db/connect.js";
import { cardErrataRepo } from "../apps/api/src/modules/catalog/repositories/card-errata.js";
/**
 * Imports one language's errata announcement: the printed text onto that language's
 * faces and the corrected text as `card_errata` rows. Prints the plan; `--apply` writes it
 * in one transaction. A face that already has other printed text is never overwritten.
 *
 * Usage: bun --env-file=.env scripts/import-language-errata.ts <list.json> [--apply]
 */
import { errorMessage } from "../packages/shared/src/strings.js";
import { requireEnv } from "./env.js";

interface LanguageErrataList {
  language: string;
  announcement: { name: string; publishedOn: string; url: string };
  cards: {
    cardSlug: string;
    faces: string[];
    printedRulesText: string;
    correctedRulesText: string;
  }[];
}

const args = process.argv.slice(2);
const file = args[0];
if (!file) {
  console.error(
    "Usage: bun --env-file=.env scripts/import-language-errata.ts <list.json> [--apply]",
  );
  process.exit(1);
}
const apply = args.includes("--apply");

const list = JSON.parse(readFileSync(file, "utf-8")) as LanguageErrataList;
const { db } = createDb(requireEnv("DATABASE_URL"));

try {
  const { language, announcement } = list;
  const errors: string[] = [];

  const knownLanguage = await db
    .selectFrom("languages")
    .select("code")
    .where("code", "=", language)
    .executeTakeFirst();
  if (!knownLanguage) {
    errors.push(`Unknown language "${language}"`);
  }

  const slugs = list.cards.map((entry) => entry.cardSlug);
  const cards = await db
    .selectFrom("cards")
    .select(["id", "slug"])
    .where("slug", "in", slugs)
    .execute();
  const cardBySlug = new Map(cards.map((card) => [card.slug, card.id]));
  const cardIds = cards.map((card) => card.id);

  const [faces, errataRows, existingAnnouncement] = await Promise.all([
    db
      .selectFrom("faces")
      .select(["id", "cardId", "shortCode", "printedRulesText"])
      .where("cardId", "in", cardIds)
      .where("language", "=", language)
      .execute(),
    db
      .selectFrom("cardErrata")
      .select(["cardId", "correctedRulesText", "correctedEffectText", "announcementId"])
      .where("cardId", "in", cardIds)
      .where("language", "=", language)
      .execute(),
    db
      .selectFrom("errataAnnouncements")
      .select(["id", "publishedOn", "url"])
      .where("name", "=", announcement.name)
      .executeTakeFirst(),
  ]);
  const facesByCard = Map.groupBy(faces, (face) => face.cardId);
  const errataByCard = new Map(errataRows.map((row) => [row.cardId, row]));

  if (existingAnnouncement) {
    const changed =
      existingAnnouncement.publishedOn !== announcement.publishedOn ||
      existingAnnouncement.url !== announcement.url;
    console.log(`Announcement "${announcement.name}": ${changed ? "update" : "unchanged"}`);
  } else {
    console.log(`Announcement "${announcement.name}": new`);
  }

  const faceWrites: { id: string; text: string }[] = [];
  const errataWrites: { cardId: string; correctedRulesText: string }[] = [];
  const counts = {
    errataNew: 0,
    errataUpdated: 0,
    errataUnchanged: 0,
    faceSet: 0,
    faceUnchanged: 0,
  };

  for (const entry of list.cards) {
    const cardId = cardBySlug.get(entry.cardSlug);
    if (!cardId) {
      errors.push(`Unknown card slug "${entry.cardSlug}"`);
      continue;
    }

    const existing = errataByCard.get(cardId);
    let errataAction = "new";
    if (existing) {
      const same =
        existing.correctedRulesText === entry.correctedRulesText &&
        existing.correctedEffectText === null &&
        existing.announcementId === existingAnnouncement?.id;
      errataAction = same ? "unchanged" : "update";
    }
    if (errataAction === "new") {
      counts.errataNew++;
    } else if (errataAction === "update") {
      counts.errataUpdated++;
    } else {
      counts.errataUnchanged++;
    }
    if (errataAction !== "unchanged") {
      errataWrites.push({ cardId, correctedRulesText: entry.correctedRulesText });
    }

    const cardFaces = facesByCard.get(cardId) ?? [];
    const faceNotes: string[] = [];
    for (const shortCode of entry.faces) {
      const matching = cardFaces.filter((face) => face.shortCode === shortCode);
      if (matching.length === 0) {
        errors.push(`"${entry.cardSlug}": no ${language} face ${shortCode}`);
      }
      for (const face of matching) {
        if (face.printedRulesText === entry.printedRulesText) {
          counts.faceUnchanged++;
        } else if (face.printedRulesText === null) {
          counts.faceSet++;
          faceWrites.push({ id: face.id, text: entry.printedRulesText });
          faceNotes.push(shortCode);
        } else {
          errors.push(`"${entry.cardSlug}": ${shortCode} already has other printed text`);
        }
      }
    }
    console.log(
      `${entry.cardSlug}: errata ${errataAction}; printed text ${faceNotes.length > 0 ? `on ${faceNotes.join(", ")}` : "unchanged"}`,
    );
  }

  console.log(
    `${apply ? "Writing" : "Would write"}: ${counts.errataNew} new, ${counts.errataUpdated} updated, ${counts.errataUnchanged} unchanged errata; printed text on ${counts.faceSet} face(s), ${counts.faceUnchanged} already set.`,
  );
  for (const error of errors) {
    console.error(`Error: ${error}`);
  }
  if (errors.length > 0) {
    throw new Error(`${errors.length} error(s), nothing written`);
  }

  if (apply) {
    await db.transaction().execute(async (trx) => {
      const errata = cardErrataRepo(trx);
      const announcementId = await errata.upsertAnnouncement(announcement);
      for (const write of errataWrites) {
        await errata.upsert(write.cardId, language, {
          announcementId,
          correctedRulesText: write.correctedRulesText,
          correctedEffectText: null,
          source: null,
          sourceUrl: null,
          effectiveDate: null,
        });
      }
      for (const write of faceWrites) {
        await trx
          .updateTable("faces")
          .set({ printedRulesText: write.text })
          .where("id", "=", write.id)
          .where("printedRulesText", "is", null)
          .execute();
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
