import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { isNewCardName, liveCardForNorm } from "../../../repositories/candidate-card-sql.js";
import { notHiddenSource, notIgnoredCard, notIgnoredPrinting } from "./candidate-cards-shared.js";
import type {
  CandidatePrintingComparison,
  ComparableCardValues,
  LivePrintingComparison,
} from "./candidate-comparison-sql.js";
import {
  candidateCardValues,
  candidatePrintingValues,
  candidateSideOfPrinting,
  liveCardValues,
  livePrintingValues,
} from "./candidate-comparison-sql.js";

export interface WorkspaceCardDifferenceRow {
  id: string;
  provider: string;
  createdAt: Date;
  cardSlug: string;
  cardName: string;
  candidate: ComparableCardValues;
  live: ComparableCardValues;
}

export interface WorkspaceDraftRow {
  id: string;
  provider: string;
  normName: string;
  name: string;
  createdAt: Date;
}

export interface WorkspaceLinkedPrintingRow {
  id: string;
  candidateCardId: string;
  provider: string;
  createdAt: Date;
  printedTotal: number | null;
  printingId: string;
  faceId: string;
  side: 1 | 2;
  cardSlug: string;
  cardName: string;
  printingLabel: string;
  faceShortCode: string;
  candidate: CandidatePrintingComparison;
  live: LivePrintingComparison;
}

export interface WorkspaceNewPrintingRow {
  id: string;
  candidateCardId: string;
  provider: string;
  createdAt: Date;
  cardSlug: string;
  cardName: string;
  shortCode: string;
  finish: string | null;
  rarity: string | null;
  language: string | null;
  size: string | null;
}

export interface WorkspaceInactiveImageRow {
  faceImageId: string | null;
  imageFileId: string;
  faceId: string;
  createdAt: Date;
  cardSlug: string;
  cardName: string;
  shortCode: string;
  printingIds: string[];
  isBack: boolean;
  rehostFailed: boolean;
}

const reviewableProvider = sql<boolean>`(
  cc.provider <> ${USER_SUBMISSION_PROVIDER}
  or exists (
    select 1 from card_submissions cs
    where cs.candidate_card_id = cc.id and cs.status = 'pending'
  )
)`;

const cardForCandidate = liveCardForNorm(sql.ref("cc.norm_name"));

export function workspaceQueueRepo(db: Kysely<Database>) {
  return {
    async uncheckedCardDifferences(): Promise<WorkspaceCardDifferenceRow[]> {
      const rows = await sql<WorkspaceCardDifferenceRow>`
        select
          cc.id,
          cc.provider,
          cc.created_at as "createdAt",
          live_card.slug as "cardSlug",
          live_card.name as "cardName",
          ${candidateCardValues} as candidate,
          ${liveCardValues} as live
        from candidate_cards cc
        join lateral (${cardForCandidate}) live_card on true
        join cards c on c.id = live_card.id
        join mv_card_aggregates mca on mca.card_id = c.id
        where cc.checked_at is null
          and cc.provider <> ${USER_SUBMISSION_PROVIDER}
          and ${notIgnoredCard("cc")}
          and ${notHiddenSource("cc")}
      `.execute(db);
      return rows.rows;
    },

    async newCardDrafts(): Promise<WorkspaceDraftRow[]> {
      const rows = await sql<WorkspaceDraftRow>`
        select cc.id, cc.provider, cc.norm_name as "normName", cc.name, cc.created_at as "createdAt"
        from candidate_cards cc
        where ${isNewCardName(sql.ref("cc.norm_name"))}
          and ${reviewableProvider}
          and ${notIgnoredCard("cc")}
          and ${notHiddenSource("cc")}
      `.execute(db);
      return rows.rows;
    },

    async uncheckedLinkedPrintings(): Promise<WorkspaceLinkedPrintingRow[]> {
      const rows = await sql<WorkspaceLinkedPrintingRow>`
        select
          cp.id,
          cp.candidate_card_id as "candidateCardId",
          cc.provider,
          cp.created_at as "createdAt",
          s.printed_total as "printedTotal",
          pr.id as "printingId",
          p.id as "faceId",
          case when p.id = pr.face1_id then 1 else 2 end as side,
          fc.slug as "cardSlug",
          fc.name as "cardName",
          concat_ws(' ', f1.short_code, f1.finish, f1.language) as "printingLabel",
          p.short_code as "faceShortCode",
          ${candidatePrintingValues} as candidate,
          ${livePrintingValues} as live
        from candidate_printings cp
        join candidate_cards cc on cc.id = cp.candidate_card_id
        join printings pr on pr.id = cp.printing_id
        join faces f1 on f1.id = pr.face1_id
        ${candidateSideOfPrinting}
        join cards fc on fc.id = p.card_id
        join sets s on s.id = p.set_id
        where cp.checked_at is null
          and ${reviewableProvider}
          and ${notIgnoredCard("cc")}
          and ${notIgnoredPrinting("cp", "cc")}
          and ${notHiddenSource("cc")}
      `.execute(db);
      return rows.rows;
    },

    async newCandidatePrintings(): Promise<WorkspaceNewPrintingRow[]> {
      const rows = await sql<WorkspaceNewPrintingRow>`
        select
          cp.id,
          cp.candidate_card_id as "candidateCardId",
          cc.provider,
          cp.created_at as "createdAt",
          live_card.slug as "cardSlug",
          live_card.name as "cardName",
          cp.short_code as "shortCode",
          cp.finish,
          cp.rarity,
          cp.language,
          cp.size
        from candidate_printings cp
        join candidate_cards cc on cc.id = cp.candidate_card_id
        join lateral (${cardForCandidate}) live_card on true
        where cp.printing_id is null
          and ${reviewableProvider}
          and ${notIgnoredCard("cc")}
          and ${notIgnoredPrinting("cp", "cc")}
          and ${notHiddenSource("cc")}
      `.execute(db);
      return rows.rows;
    },

    async inactiveFaceImages(): Promise<WorkspaceInactiveImageRow[]> {
      const rows = await sql<WorkspaceInactiveImageRow>`
        select
          fi.id as "faceImageId",
          fi.image_file_id as "imageFileId",
          f.id as "faceId",
          fi.created_at as "createdAt",
          c.slug as "cardSlug",
          c.name as "cardName",
          f.short_code as "shortCode",
          array_agg(pr.id order by pr.id) as "printingIds",
          coalesce(bool_and(pr.face2_id = f.id), false) as "isBack",
          fi.activate_when_rehosted as "rehostFailed"
        from face_images fi
        join faces f on f.id = fi.face_id
        join cards c on c.id = f.card_id
        join printings pr on f.id in (pr.face1_id, pr.face2_id)
        where not fi.is_active
          and (
            not fi.activate_when_rehosted
            or exists (
              select 1 from image_rehost_failures rf where rf.image_file_id = fi.image_file_id
            )
          )
        group by fi.id, f.id, c.slug, c.name
        union all
        select
          null::uuid as "faceImageId",
          rf.image_file_id as "imageFileId",
          f.id as "faceId",
          rf.last_attempt_at as "createdAt",
          c.slug as "cardSlug",
          c.name as "cardName",
          f.short_code as "shortCode",
          array_agg(pr.id order by pr.id) as "printingIds",
          coalesce(bool_and(pr.face2_id = f.id), false) as "isBack",
          true as "rehostFailed"
        from faces f
        join image_rehost_failures rf on rf.image_file_id = f.fallback_image_file_id
        join cards c on c.id = f.card_id
        join printings pr on f.id in (pr.face1_id, pr.face2_id)
        where not exists (select 1 from public_image_files pif where pif.id = rf.image_file_id)
        group by rf.image_file_id, rf.last_attempt_at, f.id, c.slug, c.name
      `.execute(db);
      return rows.rows;
    },

    async countAdminEventsSince(actorUserId: string, since: Date): Promise<number> {
      const row = await db
        .selectFrom("adminEvents")
        .select((eb) => eb.fn.countAll<string>().as("count"))
        .where("actorUserId", "=", actorUserId)
        .where(sql<Date>`date_trunc('milliseconds', ${sql.ref("createdAt")})`, ">=", since)
        .executeTakeFirstOrThrow();
      return Number(row.count);
    },
  };
}
