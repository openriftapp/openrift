import type {
  WORKSPACE_RECORD_FILTERS,
  WorkspaceImageState,
  WorkspaceRecordSort,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import type { Expression, Kysely, SqlBool } from "kysely";
import { sql } from "kysely";

import { primaryCardTypeSql } from "../../../db/helpers.js";
import type { Database } from "../../../db/tables.js";
import { containsPattern } from "../../../lib/like-pattern.js";
import {
  printingCreatedBy,
  printingInDeskScope,
  printingIsPromo,
} from "../../../repositories/printing-promo-sql.js";
import { imageUrlWithOriginal, joinAdminFaceImage } from "../../../repositories/query-helpers.js";

interface WorkspaceRecordBaseDbRow {
  id: string;
  cardSlug: string;
  cardName: string;
  cardType: string;
  setName: string;
  shortCode: string;
  language: string;
  finish: string;
  rarity: string;
  imageUrl: string | null;
  updatedAt: Date;
}

export interface WorkspacePrintingRecordDbRow extends WorkspaceRecordBaseDbRow {
  faceCount: number;
  publicCode: string;
  isDoubleSided: boolean;
  otherFace: { cardName: string; cardType: string; imageUrl: string | null } | null;
  imageCount: number;
  markers: string[];
  channelLabel: string | null;
  status: "announced" | "released" | null;
}

export interface WorkspaceFaceRecordDbRow extends WorkspaceRecordBaseDbRow {
  printingCount: number;
  artist: string;
  artVariant: string;
  imageState: WorkspaceImageState;
}

export type WorkspacePrintingRecordFilter = (typeof WORKSPACE_RECORD_FILTERS)["printing"][number];
export type WorkspaceFaceRecordFilter = Exclude<
  (typeof WORKSPACE_RECORD_FILTERS)["face"][number],
  "needs-review"
>;

interface WorkspaceRecordsQuery<F> {
  q?: string;
  filter?: F;
  limit: number;
  offset: number;
  setSlug?: string;
  sort?: { key: WorkspaceRecordSort; direction: "asc" | "desc" };
  printingIds?: readonly string[];
  mineIds?: readonly string[];
  faceIds?: readonly string[];
}

export interface WorkspaceRecordsPage<R> {
  rows: R[];
  total: number;
}

export interface WorkspaceEventRow {
  id: string;
  actorUserId: string;
  actorName: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  cardSlug: string | null;
  createdAt: Date;
}

const printingImageCount = sql<number>`(
  select count(*)::int from face_images pi2 where pi2.face_id in (p.face1_id, p.face2_id)
)`;

const printingMarkers = sql<string[]>`(
  select coalesce(array_agg(m.label order by m.sort_order, m.label), '{}')
  from markers m
  where m.slug = any(f.marker_slugs || coalesce(
    (select f2.marker_slugs from faces f2 where f2.id = p.face2_id), '{}'
  ))
)`;

const printingChannelLabel = sql<string | null>`(
  select coalesce(parent.label || ' › ', '') || dc.label
  from printing_distribution_channels pdc
  join distribution_channels dc on dc.id = pdc.channel_id
  left join distribution_channels parent on parent.id = dc.parent_id
  where pdc.printing_id = p.id
  order by dc.sort_order, dc.label
  limit 1
)`;

const printingStatus = sql<"announced" | "released" | null>`case
  when p.released_at <= current_date then 'released'
  when p.announced_at is not null or p.released_at is not null then 'announced'
end`;

const printingOtherFace = sql<WorkspacePrintingRecordDbRow["otherFace"]>`(
  select jsonb_build_object(
    'cardName', c2.name,
    'cardType', ${primaryCardTypeSql("c2.id")},
    'imageUrl', (
      select coalesce(i2.rehosted_url, i2.original_url)
      from face_images fi2
      join image_files i2 on i2.id = fi2.image_file_id
      where fi2.face_id = f2.id and fi2.is_active
      limit 1
    )
  )
  from faces f2
  join cards c2 on c2.id = f2.card_id
  where f2.id = p.face2_id
)`;

/** The catalog's own printing order: language, set, code, markers, finish, size. */
const printingCanonicalRank = sql<number>`(
  select r.canonical_rank from mv_printing_sides_canonical_rank r
  where r.printing_id = p.id and r.position = 1
)`;

const faceCanonicalRank = sql<number>`least(
  (
    select min(r.canonical_rank)
    from printings rp
    join mv_printing_sides_canonical_rank r on r.printing_id = rp.id and r.position = 1
    where rp.face1_id = f.id
  ),
  (
    select min(r.canonical_rank)
    from printings rp
    join mv_printing_sides_canonical_rank r on r.printing_id = rp.id and r.position = 2
    where rp.face2_id = f.id
  )
)`;

/** For an unfiltered list only; a filtered one ranks its few rows through `faceCanonicalRank`. */
const faceCanonicalRanks = sql<{ faceId: string; canonicalRank: number }>`(
  select sides.face_id, min(sides.canonical_rank) as canonical_rank
  from (
    select rp.face1_id as face_id, r.canonical_rank
    from printings rp
    join mv_printing_sides_canonical_rank r on r.printing_id = rp.id and r.position = 1
    union all
    select rp.face2_id, r.canonical_rank
    from printings rp
    join mv_printing_sides_canonical_rank r on r.printing_id = rp.id and r.position = 2
  ) sides
  group by sides.face_id
)`;

const faceHasOwnImage = sql<SqlBool>`exists (
  select 1 from face_images oi where oi.face_id = f.id and oi.is_active
)`;

const faceHasSubstitute = sql<SqlBool>`(
  f.fallback_art_mode = 'pinned'
  or (f.fallback_art_mode = 'auto' and exists (
    select 1 from faces sf
    join face_images si on si.face_id = sf.id and si.is_active
    where sf.card_id = f.card_id and sf.id <> f.id and sf.language in (f.language, 'EN')
  ))
)`;

const faceImageState = sql<WorkspaceImageState>`case
  when ${faceHasOwnImage} then 'own'
  when ${faceHasSubstitute} then 'substitute'
  else 'none'
end`;

const facePrintingCount = sql<number>`(
  (select count(*)::int from printings pc where pc.face1_id = f.id)
  + (select count(*)::int from printings pc where pc.face2_id = f.id)
)`;

const sharedFaceIds = sql`(
  select shared.face_id
  from (
    select face1_id as face_id from printings
    union all
    select face2_id from printings where face2_id is not null
  ) shared
  group by shared.face_id
  having count(*) > 1
)`;

function searchPredicate(q: string) {
  const pattern = containsPattern(q);
  return sql<SqlBool>`(c.name ilike ${pattern} or f.short_code ilike ${pattern} or f.public_code ilike ${pattern})`;
}

function printingFilterPredicate(
  filter: WorkspacePrintingRecordFilter,
  mineIds: readonly string[],
): Expression<SqlBool> {
  switch (filter) {
    case "promo": {
      return printingIsPromo;
    }
    case "no-image": {
      return sql<SqlBool>`(
        not exists (select 1 from face_images ni1 where ni1.face_id = p.face1_id)
        and (p.face2_id is null
          or not exists (select 1 from face_images ni2 where ni2.face_id = p.face2_id))
      )`;
    }
    case "mine": {
      return sql<SqlBool>`p.id = any(${[...mineIds]}::uuid[])`;
    }
  }
}

function faceFilterPredicate(filter: WorkspaceFaceRecordFilter): Expression<SqlBool> {
  switch (filter) {
    case "no-image": {
      return sql<SqlBool>`not ${faceHasOwnImage} and not ${faceHasSubstitute}`;
    }
    case "substitute": {
      return sql<SqlBool>`not ${faceHasOwnImage} and ${faceHasSubstitute}`;
    }
    case "shared": {
      return sql<SqlBool>`f.id in ${sharedFaceIds}`;
    }
  }
}

const EVENT_COLUMNS = [
  "ae.id",
  "ae.actorUserId",
  "u.name as actorName",
  "ae.oldValues",
  "ae.newValues",
  "ae.action",
  "ae.entityType",
  "ae.entityId",
  "ae.entityLabel",
  "ae.cardSlug",
  "ae.createdAt",
] as const;

function sortColumn(key: WorkspaceRecordSort, updatedColumn: string): string {
  switch (key) {
    case "name": {
      return "c.name";
    }
    case "code": {
      return "f.shortCode";
    }
    case "finish": {
      return "f.finish";
    }
    case "language": {
      return "f.language";
    }
    case "updated": {
      return updatedColumn;
    }
  }
}

function inSet(setSlug: string): Expression<SqlBool> {
  return sql<SqlBool>`f.set_id = (select st.id from sets st where st.slug = ${setSlug})`;
}

export function workspaceRecordsRepo(db: Kysely<Database>) {
  return {
    async listPrintingRecords(
      query: WorkspaceRecordsQuery<WorkspacePrintingRecordFilter>,
    ): Promise<WorkspaceRecordsPage<WorkspacePrintingRecordDbRow>> {
      if (query.printingIds?.length === 0 || (query.filter === "mine" && !query.mineIds?.length)) {
        return { rows: [], total: 0 };
      }
      let base = db
        .selectFrom("printings as p")
        .innerJoin("faces as f", "f.id", "p.face1Id")
        .innerJoin("cards as c", "c.id", "f.cardId");
      if (query.printingIds !== undefined) {
        base = base.where("p.id", "in", [...query.printingIds]);
      }
      if (query.q !== undefined) {
        base = base.where(searchPredicate(query.q));
      }
      if (query.setSlug !== undefined) {
        base = base.where(inSet(query.setSlug));
      }
      if (query.filter !== undefined) {
        base = base.where(printingFilterPredicate(query.filter, query.mineIds ?? []));
      }
      let page = joinAdminFaceImage(base, "f.id")
        .innerJoin("sets as s", "s.id", "f.setId")
        .select([
          "p.id",
          "c.slug as cardSlug",
          "c.name as cardName",
          primaryCardTypeSql("c.id").as("cardType"),
          "s.name as setName",
          "f.shortCode",
          "f.publicCode",
          "f.language",
          "f.finish",
          "f.rarity",
          imageUrlWithOriginal("imgf").as("imageUrl"),
          sql<number>`case when p.face2_id is null then 1 else 2 end`.as("faceCount"),
          sql<boolean>`p.face2_id is not null`.as("isDoubleSided"),
          printingOtherFace.as("otherFace"),
          printingImageCount.as("imageCount"),
          printingMarkers.as("markers"),
          printingChannelLabel.as("channelLabel"),
          printingStatus.as("status"),
          "p.updatedAt",
        ])
        .limit(query.limit + 1);
      page = (
        query.sort === undefined
          ? page.orderBy(printingCanonicalRank, "asc")
          : page.orderBy(sql.ref(sortColumn(query.sort.key, "p.updatedAt")), query.sort.direction)
      )
        .orderBy("p.id", "desc")
        .offset(query.offset);
      const [rows, count] = await Promise.all([
        page.execute(),
        base.select(sql<number>`count(*)::int`.as("total")).executeTakeFirstOrThrow(),
      ]);
      return { rows, total: count.total };
    },

    async listFaceRecords(
      query: WorkspaceRecordsQuery<WorkspaceFaceRecordFilter>,
    ): Promise<WorkspaceRecordsPage<WorkspaceFaceRecordDbRow>> {
      if (query.printingIds?.length === 0 || query.faceIds?.length === 0) {
        return { rows: [], total: 0 };
      }
      const rankAll =
        query.sort === undefined &&
        query.faceIds === undefined &&
        query.printingIds === undefined &&
        query.q === undefined &&
        query.setSlug === undefined &&
        query.filter === undefined;
      let base = db.selectFrom("faces as f").innerJoin("cards as c", "c.id", "f.cardId");
      if (query.faceIds !== undefined) {
        base = base.where("f.id", "in", [...query.faceIds]);
      }
      if (query.printingIds !== undefined) {
        base = base.where(sql<SqlBool>`f.id in (
          select unnest(array[pr.face1_id, pr.face2_id]) from printings pr
          where pr.id = any(${[...query.printingIds]}::uuid[])
        )`);
      }
      if (query.q !== undefined) {
        base = base.where(searchPredicate(query.q));
      }
      if (query.setSlug !== undefined) {
        base = base.where(inSet(query.setSlug));
      }
      if (query.filter !== undefined) {
        base = base.where(faceFilterPredicate(query.filter));
      }
      let page = joinAdminFaceImage(base, "f.id")
        .innerJoin("sets as s", "s.id", "f.setId")
        .$if(rankAll, (qb) =>
          qb.leftJoin(faceCanonicalRanks.as("fr"), (join) => join.onRef("fr.faceId", "=", "f.id")),
        )
        .select([
          "f.id",
          "c.slug as cardSlug",
          "c.name as cardName",
          primaryCardTypeSql("c.id").as("cardType"),
          "s.name as setName",
          "f.shortCode",
          "f.language",
          "f.finish",
          "f.artist",
          "f.rarity",
          "f.artVariant",
          imageUrlWithOriginal("imgf").as("imageUrl"),
          facePrintingCount.as("printingCount"),
          faceImageState.as("imageState"),
          "f.updatedAt",
        ])
        .limit(query.limit + 1);
      page = (
        query.sort === undefined
          ? page.orderBy(rankAll ? sql`fr.canonical_rank` : faceCanonicalRank, "asc")
          : page.orderBy(sql.ref(sortColumn(query.sort.key, "f.updatedAt")), query.sort.direction)
      )
        .orderBy("f.id", "desc")
        .offset(query.offset);
      const [rows, count] = await Promise.all([
        page.execute(),
        base.select(sql<number>`count(*)::int`.as("total")).executeTakeFirstOrThrow(),
      ]);
      return { rows, total: count.total };
    },

    eventsOnPrintings(
      printingIds: readonly string[],
      faceIds: readonly string[],
      limit: number,
      actorUserId?: string,
    ): Promise<WorkspaceEventRow[]> {
      const printings = [...printingIds];
      const faces = [...faceIds];
      const sourceIds = sql`(
        select lcp.id::text from candidate_printings lcp
        where lcp.printing_id = any(${printings}::uuid[])
      )`;
      const sourceCardIds = sql`(
        select lcp.candidate_card_id::text from candidate_printings lcp
        where lcp.printing_id = any(${printings}::uuid[])
      )`;
      let query = db
        .selectFrom("adminEvents as ae")
        .leftJoin("users as u", "u.id", "ae.actorUserId")
        .select(EVENT_COLUMNS);
      if (actorUserId !== undefined) {
        query = query.where("ae.actorUserId", "=", actorUserId);
      }
      return query
        .where(sql<SqlBool>`(
          (ae.entity_type = 'printing' and ae.entity_id = any(${printings}::text[]))
          or (ae.entity_type = 'image' and (
            ae.new_values ->> 'printingId' = any(${printings}::text[])
            or ae.old_values ->> 'printingId' = any(${printings}::text[])
            or ae.entity_id = any(array(
              select fi.id::text from face_images fi where fi.face_id = any(${faces}::uuid[])
              union all
              select fi.image_file_id::text from face_images fi
              where fi.face_id = any(${faces}::uuid[])
            ))
          ))
          or (ae.entity_type = 'candidate-printing' and (
            ae.entity_id = any(array${sourceIds})
            or ae.new_values -> 'candidatePrintingIds' ?| array${sourceIds}
          ))
          or (ae.entity_type = 'candidate-card' and (
            ae.entity_id = any(array${sourceCardIds})
            or ae.new_values -> 'candidateCardIds' ?| array${sourceCardIds}
          ))
        )`)
        .orderBy("ae.createdAt", "desc")
        .orderBy("ae.id", "desc")
        .limit(limit)
        .execute();
    },

    async printingFaceIds(printingId: string): Promise<string[] | null> {
      const row = await db
        .selectFrom("printings")
        .select(["face1Id", "face2Id"])
        .where("id", "=", printingId)
        .executeTakeFirst();
      if (row === undefined) {
        return null;
      }
      return row.face2Id === null ? [row.face1Id] : [row.face1Id, row.face2Id];
    },

    async facePrintingIds(faceId: string): Promise<string[]> {
      const rows = await db
        .selectFrom("printings")
        .select("id")
        .where((eb) => eb.or([eb("face1Id", "=", faceId), eb("face2Id", "=", faceId)]))
        .execute();
      return rows.map((row) => row.id);
    },

    async deskScope(actorUserId: string): Promise<{ promoIds: string[]; createdIds: string[] }> {
      const rows = await db
        .selectFrom("printings as p")
        .select([
          "p.id",
          printingIsPromo.as("isPromo"),
          printingCreatedBy(actorUserId).as("isCreated"),
        ])
        .where(printingInDeskScope(actorUserId))
        .execute();
      return {
        promoIds: rows.filter((row) => row.isPromo).map((row) => row.id),
        createdIds: rows.filter((row) => row.isCreated).map((row) => row.id),
      };
    },

    async anyInDeskScope(printingIds: readonly string[], actorUserId: string): Promise<boolean> {
      if (printingIds.length === 0) {
        return false;
      }
      const row = await db
        .selectFrom("printings as p")
        .select("p.id")
        .where("p.id", "in", [...printingIds])
        .where(printingInDeskScope(actorUserId))
        .limit(1)
        .executeTakeFirst();
      return row !== undefined;
    },

    async faceExists(faceId: string): Promise<boolean> {
      const row = await db
        .selectFrom("faces")
        .select("id")
        .where("id", "=", faceId)
        .executeTakeFirst();
      return row !== undefined;
    },

    async cardImages(): Promise<{ cardSlug: string; cardType: string; imageUrl: string }[]> {
      const rows = await sql<{ cardSlug: string; cardType: string; imageUrl: string }>`
        select distinct on (c.slug)
          c.slug as "cardSlug",
          ${primaryCardTypeSql("c.id")} as "cardType",
          coalesce(i.rehosted_url, i.original_url) as "imageUrl"
        from cards c
        join faces f on f.card_id = c.id
        join face_images fi on fi.face_id = f.id and fi.is_active
        join image_files i on i.id = fi.image_file_id
        where coalesce(i.rehosted_url, i.original_url) is not null
        order by c.slug, (f.language <> 'EN'), f.short_code
      `.execute(db);
      return rows.rows;
    },
  };
}
