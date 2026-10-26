import type { MissingImagePrinting } from "@openrift/shared/contracts/card-submissions";
import type { Kysely, Selectable } from "kysely";
import { sql } from "kysely";

import { primaryCardType } from "../../../db/helpers.js";
import type { Database } from "../../../db/tables.js";
import type {
  CardSubmissionKind,
  CardSubmissionReason,
  CardSubmissionStatus,
  CardSubmissionsTable,
} from "../../../db/tables/candidates.js";
import { buildPrintingLinkKey } from "../../../lib/printing-link-key.js";
import { joinFaceImage, listOwnedByUser } from "../../../repositories/query-helpers.js";
import { notHiddenSource, notIgnoredCard, notIgnoredPrinting } from "./candidate-cards-shared.js";

export type CardSubmissionRow = Selectable<CardSubmissionsTable>;

export interface PendingReviewQueueRow {
  id: string;
  kind: CardSubmissionKind;
  provider: string;
  cardName: string;
  normName: string;
  candidateCardId: string;
  submitterName: string | null;
  note: string | null;
  proposedDiff: string[];
  uncheckedPrintings: number;
  newPrintings: number;
  createdAt: Date;
}

interface LiveCardSnapshot {
  name: string;
  type: string;
  might: number | null;
  energy: number | null;
  power: number | null;
  mightBonus: number | null;
  tags: string[];
}

export interface LivePrintingSnapshot {
  key: string;
  shortCode: string;
  finish: string;
  markerSlugs: string[];
  rarity: string | null;
  artist: string | null;
  artVariant: string | null;
  size: string | null;
  isSigned: boolean;
  isOvernumbered: boolean;
  flavorText: string | null;
  printedRulesText: string | null;
  printedEffectText: string | null;
  printedName: string | null;
  language: string | null;
  hasImage: boolean;
}

/** The live side of the comparison; `card` is null for a new-card submission. */
export interface LiveSnapshot {
  card: LiveCardSnapshot | null;
  /**
   * Keyed by {@link buildPrintingLinkKey}, **not** by short code. One short code
   * covers every finish and language of a printing (a card with 4 languages ×
   * 2 finishes has 8 rows all reading `OGN-002`), so a short-code map collapses
   * them onto whichever row was written last and every proposed printing then
   * compares against an arbitrary sibling.
   */
  printings: Map<string, LivePrintingSnapshot>;
  printingsById: Map<string, LivePrintingSnapshot[]>;
}

/**
 * The durable outcome record for in-app card submissions. Separate from
 * `candidate_cards` because staging is disposable and a contributor's history
 * is not.
 */
export function cardSubmissionsRepo(db: Kysely<Database>) {
  return {
    /**
     * Called inside the ingest transaction so a candidate row never exists
     * without its ledger row.
     */
    async insert(values: {
      userId: string;
      provider: string;
      externalId: string;
      candidateCardId: string;
      kind: CardSubmissionKind;
      cardName: string;
      cardSlug: string | null;
      note: string | null;
      proposedDiff: string[];
    }): Promise<string> {
      const row = await db
        .insertInto("cardSubmissions")
        .values(values)
        .returning("id")
        .executeTakeFirstOrThrow();
      return row.id;
    },

    // Returns up to `limit + 1` rows so the caller can detect a next page.
    listByUser(
      userId: string,
      options: { cursor?: string | null; limit: number },
    ): Promise<CardSubmissionRow[]> {
      return listOwnedByUser<CardSubmissionRow>(db, "cardSubmissions", userId, options);
    },

    async summaryForUser(userId: string): Promise<{ pending: number; accepted: number }> {
      const rows = await db
        .selectFrom("cardSubmissions")
        .select((eb) => ["status", eb.fn.countAll<string>().as("count")])
        .where("userId", "=", userId)
        .where("status", "in", ["pending", "accepted"])
        .groupBy("status")
        .execute();

      const counts = { pending: 0, accepted: 0 };
      for (const row of rows) {
        if (row.status === "pending" || row.status === "accepted") {
          counts[row.status] = Number(row.count);
        }
      }
      return counts;
    },

    /**
     * Resolve a submission from the candidate's natural key, which is all the
     * ignore path has to work with.
     */
    async getByExternalId(provider: string, externalId: string): Promise<CardSubmissionRow | null> {
      const row = await db
        .selectFrom("cardSubmissions")
        .selectAll()
        .where("provider", "=", provider)
        .where("externalId", "=", externalId)
        .executeTakeFirst();
      return row ?? null;
    },

    /**
     * The check verbs pass the candidates they just touched; most will be
     * scraped providers with no ledger row at all.
     */
    async pendingByCandidateCardIds(candidateCardIds: string[]): Promise<CardSubmissionRow[]> {
      if (candidateCardIds.length === 0) {
        return [];
      }
      const rows = await db
        .selectFrom("cardSubmissions")
        .selectAll()
        .where("candidateCardId", "in", candidateCardIds)
        .where("status", "=", "pending")
        .execute();
      return rows;
    },

    /**
     * Backs the bulk "check this whole provider" admin action, which settles
     * submissions without naming the candidates it touched.
     */
    async pendingByProvider(provider: string): Promise<CardSubmissionRow[]> {
      const rows = await db
        .selectFrom("cardSubmissions")
        .selectAll()
        .where("provider", "=", provider)
        .where("status", "=", "pending")
        .execute();
      return rows;
    },

    pendingReviewQueueRows(): Promise<PendingReviewQueueRow[]> {
      return db
        .selectFrom("cardSubmissions as cs")
        .innerJoin("candidateCards as cc", "cc.id", "cs.candidateCardId")
        .leftJoin("users as u", "u.id", "cc.submittedByUserId")
        .select([
          "cs.id",
          "cs.kind",
          "cs.provider",
          "cs.cardName",
          "cs.note",
          "cs.proposedDiff",
          "cs.createdAt",
          "cc.id as candidateCardId",
          "cc.normName",
          "u.name as submitterName",
          sql<number>`(
            select count(*) from candidate_printings cp
            where cp.candidate_card_id = cc.id
              and cp.checked_at is null
              and ${notIgnoredPrinting("cp", "cc")}
          )::int`.as("uncheckedPrintings"),
          sql<number>`(
            select count(*) from candidate_printings cp
            where cp.candidate_card_id = cc.id
              and cp.printing_id is null
              and ${notIgnoredPrinting("cp", "cc")}
          )::int`.as("newPrintings"),
        ])
        .where("cs.status", "=", "pending")
        .where(notIgnoredCard("cc"))
        .where(notHiddenSource("cc"))
        .execute();
    },

    async getById(id: string): Promise<CardSubmissionRow | null> {
      const row = await db
        .selectFrom("cardSubmissions")
        .selectAll()
        .where("id", "=", id)
        .executeTakeFirst();
      return row ?? null;
    },

    /**
     * Any status, not just pending: the admin's reply dialog has to show a
     * note already written on a settled submission.
     */
    async getByCandidateCardId(candidateCardId: string): Promise<CardSubmissionRow | null> {
      const row = await db
        .selectFrom("cardSubmissions")
        .selectAll()
        .where("candidateCardId", "=", candidateCardId)
        .executeTakeFirst();
      return row ?? null;
    },

    /**
     * Stamp an outcome. `resolvedAt` is required by a CHECK for any non-pending
     * status, so it is not optional here either.
     */
    async resolve(
      id: string,
      values: {
        status: Exclude<CardSubmissionStatus, "pending">;
        resolvedAt: Date;
        resolvedByUserId?: string | null;
        acceptedCardId?: string | null;
      },
    ): Promise<void> {
      await db
        .updateTable("cardSubmissions")
        .set({
          status: values.status,
          resolvedAt: values.resolvedAt,
          resolvedByUserId: values.resolvedByUserId ?? null,
          acceptedCardId: values.acceptedCardId ?? null,
        })
        .where("id", "=", id)
        .execute();
    },

    /**
     * Return a submission to the queue. Unignoring is the only path here, so a
     * misclick on reject is recoverable and the contributor's page follows.
     * Clears the accepted card but keeps any note the admin wrote.
     */
    async setCard(id: string, card: { name: string; slug: string }): Promise<void> {
      await db
        .updateTable("cardSubmissions")
        .set({ cardName: card.name, cardSlug: card.slug })
        .where("id", "=", id)
        .execute();
    },

    async reopen(id: string): Promise<void> {
      await db
        .updateTable("cardSubmissions")
        .set({ status: "pending", resolvedAt: null, acceptedCardId: null })
        .where("id", "=", id)
        .execute();
    },

    /**
     * Write the contributor-visible reason and note. Deliberately independent
     * of {@link resolve} so the admin can write it before or after the outcome
     * lands, and edit or clear it afterwards.
     */
    async setResolutionMessage(
      id: string,
      values: {
        reason: CardSubmissionReason | null;
        note: string | null;
        resolvedByUserId: string;
      },
    ): Promise<void> {
      await db
        .updateTable("cardSubmissions")
        .set({
          resolutionReason: values.reason,
          resolutionNote: values.note,
          resolvedByUserId: values.resolvedByUserId,
        })
        .where("id", "=", id)
        .execute();
    },

    /**
     * Checked live at review time, not the slug stored at submission (a new-card submission may now have a card).
     * Same two-step lookup as `resolveCardIdByName` in candidate-links.ts: `cards.normName` first, then `card_name_aliases`.
     */
    async liveCardByNormName(normName: string): Promise<{ id: string; slug: string } | null> {
      const direct = await db
        .selectFrom("cards")
        .select(["id", "slug"])
        .where("normName", "=", normName)
        .executeTakeFirst();
      if (direct) {
        return direct;
      }
      const aliased = await db
        .selectFrom("cardNameAliases as a")
        .innerJoin("cards as c", "c.id", "a.cardId")
        .select(["c.id", "c.slug"])
        .where("a.normName", "=", normName)
        .executeTakeFirst();
      return aliased ?? null;
    },

    /**
     * The live catalog values a submission is compared against, for both the
     * submit-time `proposed_diff` and the review-time recomputation.
     *
     * `cardId` is null for a submission that matched no card, in which case
     * only the printing lookup runs (by short code across the whole catalog),
     * so a new-card submission whose printings already exist elsewhere still
     * compares against them.
     */
    async liveSnapshot(
      cardId: string | null,
      lookup: { shortCodes: string[]; printingIds: string[] },
    ): Promise<{ snapshot: LiveSnapshot; cardSlug: string | null }> {
      const cardRow = cardId
        ? ((await db
            .selectFrom("cards")
            .select(["slug", "name", "might", "energy", "power", "mightBonus", "tags"])
            .select(primaryCardType("cards.id").as("type"))
            .where("id", "=", cardId)
            .executeTakeFirst()) ?? null)
        : null;
      const card = cardRow
        ? {
            name: cardRow.name,
            type: cardRow.type,
            might: cardRow.might,
            energy: cardRow.energy,
            power: cardRow.power,
            mightBonus: cardRow.mightBonus,
            tags: cardRow.tags,
          }
        : null;

      const printings = new Map<string, LivePrintingSnapshot>();
      const printingsById = new Map<string, LivePrintingSnapshot[]>();
      const { shortCodes, printingIds } = lookup;
      if (shortCodes.length > 0 || printingIds.length > 0) {
        const upperCodes = shortCodes.map((code) => code.toUpperCase());
        const rows = await joinFaceImage(db.selectFrom("printingSidesOrdered as p"), "p.faceId")
          .select([
            "p.printingId",
            "p.shortCode",
            "p.finish",
            "p.markerSlugs",
            "p.rarity",
            "p.artist",
            "p.artVariant",
            "p.size",
            "p.isSigned",
            "p.isOvernumbered",
            "p.flavorText",
            "p.printedRulesText",
            "p.printedEffectText",
            "p.printedName",
            "p.language",
            "imgf.rehostedUrl",
          ])
          .where((eb) =>
            eb.or([
              // Compared case-insensitively on both sides: source casing drifts
              // ("VEN-sp3" vs "VEN-SP3") and the link key already uppercases.
              sql<boolean>`upper(p.short_code) = ANY(${upperCodes})`,
              ...(printingIds.length > 0 ? [eb("p.printingId", "in", printingIds)] : []),
            ]),
          )
          .orderBy("p.position")
          .execute();
        const requestedIds = new Set(printingIds);
        for (const row of rows) {
          // Keyed by the full printing identity, not the short code: eight rows
          // can share one short code across finishes and languages, and keying
          // by it alone silently kept only the last.
          const key = buildPrintingLinkKey({
            shortCode: row.shortCode,
            finish: row.finish,
            markerSlugs: row.markerSlugs,
            language: row.language,
          });
          const side: LivePrintingSnapshot = {
            key,
            shortCode: row.shortCode,
            finish: row.finish,
            markerSlugs: row.markerSlugs,
            rarity: row.rarity,
            artist: row.artist,
            artVariant: row.artVariant,
            size: row.size,
            isSigned: row.isSigned,
            isOvernumbered: row.isOvernumbered,
            flavorText: row.flavorText,
            printedRulesText: row.printedRulesText,
            printedEffectText: row.printedEffectText,
            printedName: row.printedName,
            language: row.language,
            // "Has artwork the site can actually show", which is the thing an
            // image suggestion is offering to fix.
            hasImage: row.rehostedUrl !== null,
          };
          printings.set(key, side);
          if (requestedIds.has(row.printingId)) {
            printingsById.set(row.printingId, [...(printingsById.get(row.printingId) ?? []), side]);
          }
        }
      }

      return { snapshot: { card, printings, printingsById }, cardSlug: cardRow?.slug ?? null };
    },

    // Group collections drop out on their own: `collections.user_id` is null on them.
    async missingImagesForUser(userId: string): Promise<MissingImagePrinting[]> {
      const rows = await db
        .selectFrom("copies as cp")
        .innerJoin("collections as col", "col.id", "cp.collectionId")
        .innerJoin("printingSidesOrdered as p", "p.printingId", "cp.printingId")
        .innerJoin("cards as c", "c.id", "p.cardId")
        .innerJoin("sets as s", "s.id", "p.setId")
        .select((eb) => [
          "p.printingId",
          sql<1 | 2>`p.position`.as("side"),
          "p.faceId",
          "p.shortCode",
          "c.slug as cardSlug",
          "c.name as cardName",
          "s.slug as setSlug",
          "s.name as setName",
          "p.publicCode",
          "p.finish",
          "p.language",
          eb.fn.countAll<string>().as("copies"),
        ])
        .where("col.userId", "=", userId)
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("faceImages as pi")
                .select("pi.id")
                .whereRef("pi.faceId", "=", "p.faceId")
                .where("pi.isActive", "=", true),
            ),
          ),
        )
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("candidatePrintings as cnp")
                .innerJoin("cardSubmissions as cs", "cs.candidateCardId", "cnp.candidateCardId")
                .innerJoin("printings as pr", "pr.id", "cnp.printingId")
                .innerJoin("faces as f1", "f1.id", "pr.face1Id")
                .leftJoin("faces as f2", "f2.id", "pr.face2Id")
                .select("cnp.id")
                // Same side choice as `faceForShortCode` when the image is accepted.
                .where(
                  sql<boolean>`p.face_id = CASE WHEN upper(cnp.short_code) = upper(f2.short_code)
                    AND upper(cnp.short_code) <> upper(f1.short_code) THEN f2.id ELSE f1.id END`,
                )
                .where("cs.kind", "=", "image")
                .where("cs.status", "=", "pending"),
            ),
          ),
        )
        .groupBy([
          "p.printingId",
          "p.position",
          "p.faceId",
          "p.shortCode",
          "c.slug",
          "c.name",
          "s.slug",
          "s.name",
          "s.sortOrder",
          "p.publicCode",
          "p.finish",
          "p.language",
        ])
        .orderBy("s.sortOrder", "asc")
        .orderBy("p.publicCode", "asc")
        .execute();

      const byFace = new Map<string, MissingImagePrinting>();
      for (const { faceId, ...row } of rows) {
        const seen = byFace.get(faceId);
        if (seen) {
          seen.copies += Number(row.copies);
        } else {
          byFace.set(faceId, { ...row, copies: Number(row.copies) });
        }
      }
      return [...byFace.values()];
    },

    async candidatePrintingImageUrls(candidateCardId: string): Promise<string[]> {
      const rows = await db
        .selectFrom("candidatePrintings")
        .select("imageUrl")
        .where("candidateCardId", "=", candidateCardId)
        .where("imageUrl", "is not", null)
        .execute();
      return rows.map((row) => row.imageUrl as string);
    },

    async candidateImageUrlsInUse(imageUrls: string[]): Promise<Set<string>> {
      if (imageUrls.length === 0) {
        return new Set();
      }
      const rows = await db
        .selectFrom("candidatePrintings")
        .select("imageUrl")
        .where("imageUrl", "in", imageUrls)
        .execute();
      return new Set(rows.map((row) => row.imageUrl as string));
    },

    // Counts the submissions ledger, not `candidate_cards`: purging staging must not reset a user's daily cap.
    async countRecentByUser(userId: string, since: Date): Promise<number> {
      const row = await db
        .selectFrom("cardSubmissions")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("userId", "=", userId)
        .where("createdAt", ">=", since)
        .executeTakeFirst();
      return row ? Number(row.count) : 0;
    },
  };
}
