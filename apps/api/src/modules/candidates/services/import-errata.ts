import type {
  ErrataAnnouncementInput,
  ErrataEntryRef,
  UploadErrataEntry,
  UploadErrataResponse,
} from "@openrift/shared/contracts/admin/card-mutations";

import type { Repos, Transact } from "../../../deps.js";
import type { CardErrataWrite } from "../../catalog/repositories/card-errata.js";
import { deriveKeywords } from "../../catalog/repositories/keywords.js";

type ErrataFields = Omit<CardErrataWrite, "announcementId"> & { announcement: string | null };

const ERRATA_FIELDS = [
  "announcement",
  "correctedRulesText",
  "correctedEffectText",
  "source",
  "sourceUrl",
  "effectiveDate",
] as const satisfies readonly (keyof ErrataFields)[];

function diffErrata(
  existing: ErrataFields,
  incoming: ErrataFields,
): { field: string; from: string | null; to: string | null }[] {
  const diffs: { field: string; from: string | null; to: string | null }[] = [];
  for (const field of ERRATA_FIELDS) {
    if (existing[field] !== incoming[field]) {
      diffs.push({ field, from: existing[field], to: incoming[field] });
    }
  }
  return diffs;
}

function matchesAllPrinted(
  entry: Pick<UploadErrataEntry, "correctedRulesText" | "correctedEffectText">,
  printings: { printedRulesText: string | null; printedEffectText: string | null }[],
): boolean {
  if (printings.length === 0) {
    return false;
  }
  return printings.every(
    (printing) =>
      (entry.correctedRulesText === null ||
        printing.printedRulesText === entry.correctedRulesText) &&
      (entry.correctedEffectText === null ||
        printing.printedEffectText === entry.correctedEffectText),
  );
}

/** A dry run creates nothing, so a new announcement has no id yet. */
async function resolveAnnouncements(
  errata: Pick<Repos["cardErrata"], "announcements" | "upsertAnnouncement">,
  announcements: ErrataAnnouncementInput[],
  dryRun: boolean,
  result: UploadErrataResponse,
): Promise<{ ids: Map<string, string>; names: Map<string, string> }> {
  const existingRows = await errata.announcements();
  const existingByName = new Map(existingRows.map((row) => [row.name, row]));
  const names = new Map(existingRows.map((row) => [row.id, row.name]));
  const ids = new Map<string, string>();
  const incomingByName = new Map<string, ErrataAnnouncementInput>();
  for (const announcement of announcements) {
    const seen = incomingByName.get(announcement.name);
    if (seen && (seen.publishedOn !== announcement.publishedOn || seen.url !== announcement.url)) {
      result.errors.push(
        `Announcement "${announcement.name}" is given with different dates or links`,
      );
    }
    incomingByName.set(announcement.name, announcement);
  }
  for (const announcement of incomingByName.values()) {
    const existing = existingByName.get(announcement.name);
    if (existing) {
      ids.set(announcement.name, existing.id);
      const fields = (["publishedOn", "url"] as const)
        .filter((field) => existing[field] !== announcement[field])
        .map((field) => ({ field, from: existing[field], to: announcement[field] }));
      if (fields.length === 0) {
        continue;
      }
      result.changedAnnouncements.push({ name: announcement.name, fields });
    } else {
      result.newAnnouncements.push(announcement.name);
    }
    if (!dryRun) {
      ids.set(announcement.name, await errata.upsertAnnouncement(announcement));
    }
  }
  return { ids, names };
}

/**
 * Entries whose corrected text already matches every printing's printed text
 * are flagged and skipped on apply; the errata display already hides those.
 */
export async function importErrata(
  transact: Transact,
  input: { entries: UploadErrataEntry[]; dryRun: boolean },
): Promise<UploadErrataResponse> {
  const { entries, dryRun } = input;

  const result: UploadErrataResponse = {
    dryRun,
    newCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    matchesPrintedCount: 0,
    errors: [],
    newEntries: [],
    updatedEntries: [],
    skippedMatchesPrinted: [],
    newAnnouncements: [],
    changedAnnouncements: [],
  };

  if (entries.length === 0) {
    return result;
  }

  await transact(async (trxRepos) => {
    const mut = trxRepos.catalogMutations;
    const errata = trxRepos.cardErrata;

    const uniqueSlugs = [...new Set(entries.map((entry) => entry.cardSlug))];
    const cards = await mut.getCardsBySlugs(uniqueSlugs);
    const cardBySlug = new Map(cards.map((card) => [card.slug, card]));
    const cardIds = cards.map((card) => card.id);

    const [existingErrata, printingTexts] = await Promise.all([
      errata.getByCardIds(cardIds),
      mut.getPrintingTextsByCardIds(cardIds),
    ]);

    const errataByCardId = new Map(existingErrata.map((row) => [row.cardId, row]));
    const { ids: announcementIds, names: announcementNames } = await resolveAnnouncements(
      errata,
      entries.flatMap((entry) => (entry.announcement ? [entry.announcement] : [])),
      dryRun,
      result,
    );
    const printingsByCardId = new Map<
      string,
      { printedRulesText: string | null; printedEffectText: string | null }[]
    >();
    for (const row of printingTexts) {
      const list = printingsByCardId.get(row.cardId) ?? [];
      list.push({
        printedRulesText: row.printedRulesText,
        printedEffectText: row.printedEffectText,
      });
      printingsByCardId.set(row.cardId, list);
    }

    const announcementNameSet = new Set([...announcementNames.values(), ...announcementIds.keys()]);

    for (const entry of entries) {
      const card = cardBySlug.get(entry.cardSlug);
      if (!card) {
        result.errors.push(`Unknown card slug: "${entry.cardSlug}"`);
        continue;
      }
      if (entry.source !== null && announcementNameSet.has(entry.source)) {
        result.errors.push(
          `"${entry.cardSlug}": source "${entry.source}" is an announcement, pass it as "announcement" instead`,
        );
        continue;
      }

      const ref: ErrataEntryRef = { cardSlug: card.slug, cardName: card.name };
      const printings = printingsByCardId.get(card.id) ?? [];

      if (matchesAllPrinted(entry, printings)) {
        result.matchesPrintedCount++;
        result.skippedMatchesPrinted.push(ref);
        continue;
      }

      const incoming: ErrataFields = {
        announcement: entry.announcement?.name ?? null,
        correctedRulesText: entry.correctedRulesText,
        correctedEffectText: entry.correctedEffectText,
        source: entry.source,
        sourceUrl: entry.sourceUrl,
        effectiveDate: entry.effectiveDate,
      };

      const existing = errataByCardId.get(card.id);
      if (existing) {
        const diffs = diffErrata(
          {
            ...existing,
            announcement:
              existing.announcementId === null
                ? null
                : (announcementNames.get(existing.announcementId) ?? existing.announcementId),
          },
          incoming,
        );
        if (diffs.length === 0) {
          result.unchangedCount++;
          continue;
        }
        result.updatedCount++;
        result.updatedEntries.push({ ...ref, fields: diffs });
      } else {
        result.newCount++;
        result.newEntries.push(ref);
      }

      if (dryRun) {
        continue;
      }

      const { announcement, ...fields } = incoming;
      await errata.upsert(card.id, {
        ...fields,
        announcementId: announcement === null ? null : (announcementIds.get(announcement) ?? null),
      });
      await mut.updateCardById(card.id, { keywords: deriveKeywords({ errata: entry, printings }) });
    }
  });

  return result;
}
