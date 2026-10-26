import type {
  WORKSPACE_RECORD_FILTERS,
  WorkspaceImageState,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import type { Expression, Kysely, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { containsPattern } from "../../../lib/like-pattern.js";
import {
  imageUrlWithOriginal,
  joinFaceImage,
  keysetCursorPredicate,
} from "../../../repositories/query-helpers.js";

interface WorkspaceRecordBaseDbRow {
  id: string;
  cardSlug: string;
  cardName: string;
  setName: string;
  shortCode: string;
  language: string;
  finish: string;
  imageUrl: string | null;
  updatedAt: Date;
}

export interface WorkspacePrintingRecordDbRow extends WorkspaceRecordBaseDbRow {
  faceCount: number;
  publicCode: string;
  isDoubleSided: boolean;
  imageCount: number;
  markers: string[];
  channelLabel: string | null;
  status: "announced" | "released" | null;
}

export interface WorkspaceFaceRecordDbRow extends WorkspaceRecordBaseDbRow {
  printingCount: number;
  artist: string;
  rarity: string;
  artVariant: string;
  imageState: WorkspaceImageState;
}

export type WorkspacePrintingRecordFilter = (typeof WORKSPACE_RECORD_FILTERS)["printing"][number];
export type WorkspaceFaceRecordFilter = (typeof WORKSPACE_RECORD_FILTERS)["face"][number];

interface WorkspaceRecordsQuery<F> {
  q?: string;
  filter?: F;
  limit: number;
  cursor?: string;
  printingIds?: readonly string[];
  mineIds?: readonly string[];
}

export interface WorkspaceRecordsPage<R> {
  rows: R[];
  total: number;
}

export interface WorkspaceUploadEventRow {
  provider: string;
  uploadedAt: Date;
  counts: Record<string, unknown> | null;
}

export interface WorkspaceEventRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string | null;
  cardSlug: string | null;
  createdAt: Date;
}

const printingIsPromo = sql<SqlBool>`(
  exists (
    select 1 from faces mf
    where mf.id in (p.face1_id, p.face2_id) and cardinality(mf.marker_slugs) > 0
  )
  or exists (select 1 from printing_distribution_channels pdc2 where pdc2.printing_id = p.id)
)`;

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
  select count(*)::int from printings pc where f.id in (pc.face1_id, pc.face2_id)
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
    case "double-sided": {
      return sql<SqlBool>`p.face2_id is not null`;
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
      return sql<SqlBool>`${facePrintingCount} > 1`;
    }
  }
}

const EVENT_COLUMNS = [
  "ae.id",
  "ae.action",
  "ae.entityType",
  "ae.entityId",
  "ae.entityLabel",
  "ae.cardSlug",
  "ae.createdAt",
] as const;

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
      if (query.filter !== undefined) {
        base = base.where(printingFilterPredicate(query.filter, query.mineIds ?? []));
      }
      let page = joinFaceImage(base, "f.id")
        .innerJoin("sets as s", "s.id", "f.setId")
        .select([
          "p.id",
          "c.slug as cardSlug",
          "c.name as cardName",
          "s.name as setName",
          "f.shortCode",
          "f.publicCode",
          "f.language",
          "f.finish",
          imageUrlWithOriginal("imgf").as("imageUrl"),
          sql<number>`case when p.face2_id is null then 1 else 2 end`.as("faceCount"),
          sql<boolean>`p.face2_id is not null`.as("isDoubleSided"),
          printingImageCount.as("imageCount"),
          printingMarkers.as("markers"),
          printingChannelLabel.as("channelLabel"),
          printingStatus.as("status"),
          "p.updatedAt",
        ])
        .orderBy("p.updatedAt", "desc")
        .orderBy("p.id", "desc")
        .limit(query.limit + 1);
      if (query.cursor !== undefined) {
        page = page.where(
          keysetCursorPredicate(query.cursor, {
            timeColumn: "p.updatedAt",
            idColumn: "p.id",
            idDirection: "desc",
          }),
        );
      }
      const [rows, count] = await Promise.all([
        page.execute(),
        base.select(sql<number>`count(*)::int`.as("total")).executeTakeFirstOrThrow(),
      ]);
      return { rows, total: count.total };
    },

    async listFaceRecords(
      query: WorkspaceRecordsQuery<WorkspaceFaceRecordFilter>,
    ): Promise<WorkspaceRecordsPage<WorkspaceFaceRecordDbRow>> {
      if (query.printingIds?.length === 0) {
        return { rows: [], total: 0 };
      }
      let base = db.selectFrom("faces as f").innerJoin("cards as c", "c.id", "f.cardId");
      if (query.printingIds !== undefined) {
        base = base.where(sql<SqlBool>`f.id in (
          select unnest(array[pr.face1_id, pr.face2_id]) from printings pr
          where pr.id = any(${[...query.printingIds]}::uuid[])
        )`);
      }
      if (query.q !== undefined) {
        base = base.where(searchPredicate(query.q));
      }
      if (query.filter !== undefined) {
        base = base.where(faceFilterPredicate(query.filter));
      }
      let page = joinFaceImage(base, "f.id")
        .innerJoin("sets as s", "s.id", "f.setId")
        .select([
          "f.id",
          "c.slug as cardSlug",
          "c.name as cardName",
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
        .orderBy("f.updatedAt", "desc")
        .orderBy("f.id", "desc")
        .limit(query.limit + 1);
      if (query.cursor !== undefined) {
        page = page.where(
          keysetCursorPredicate(query.cursor, {
            timeColumn: "f.updatedAt",
            idColumn: "f.id",
            idDirection: "desc",
          }),
        );
      }
      const [rows, count] = await Promise.all([
        page.execute(),
        base.select(sql<number>`count(*)::int`.as("total")).executeTakeFirstOrThrow(),
      ]);
      return { rows, total: count.total };
    },

    async latestUploads(): Promise<WorkspaceUploadEventRow[]> {
      const rows = await sql<WorkspaceUploadEventRow>`
        select distinct on (ae.entity_id)
          ae.entity_id as provider,
          ae.created_at as "uploadedAt",
          ae.new_values as counts
        from admin_events ae
        where ae.action = 'candidates.upload'
          and ae.entity_id is not null
          and exists (select 1 from candidate_cards cc where cc.provider = ae.entity_id)
          and not exists (
            select 1 from provider_settings ps
            where ps.provider = ae.entity_id and ps.is_hidden
          )
        order by ae.entity_id, ae.created_at desc
      `.execute(db);
      return rows.rows;
    },

    eventsByActorSince(
      actorUserId: string,
      since: Date,
      limit: number,
    ): Promise<WorkspaceEventRow[]> {
      return db
        .selectFrom("adminEvents as ae")
        .select(EVENT_COLUMNS)
        .where("ae.actorUserId", "=", actorUserId)
        .where("ae.createdAt", ">=", since)
        .where(sql<SqlBool>`date_trunc('milliseconds', ae.created_at) >= ${since}`)
        .orderBy("ae.createdAt", "desc")
        .orderBy("ae.id", "desc")
        .limit(limit)
        .execute();
    },

    eventsOnPrintings(
      printingIds: readonly string[],
      faceIds: readonly string[],
      limit: number,
      actorUserId?: string,
    ): Promise<WorkspaceEventRow[]> {
      let query = db.selectFrom("adminEvents as ae").select(EVENT_COLUMNS);
      if (actorUserId !== undefined) {
        query = query.where("ae.actorUserId", "=", actorUserId);
      }
      return query
        .where(sql<SqlBool>`(
          (ae.entity_type = 'printing' and ae.entity_id = any(${[...printingIds]}::text[]))
          or (ae.entity_type = 'image' and (
            ae.new_values ->> 'printingId' = any(${[...printingIds]}::text[])
            or ae.entity_id in (
              select fi.id::text from face_images fi
              where fi.face_id = any(${[...faceIds]}::uuid[])
            )
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

    /** Must agree with `deskPrintingScope`. */
    async anyInDeskScope(printingIds: readonly string[], actorUserId: string): Promise<boolean> {
      if (printingIds.length === 0) {
        return false;
      }
      const row = await db
        .selectFrom("printings as p")
        .select("p.id")
        .where("p.id", "in", [...printingIds])
        .where(
          sql<SqlBool>`(${printingIsPromo} or exists (
            select 1 from admin_events ce
            where ce.actor_user_id = ${actorUserId} and ce.action = 'printing.create'
              and ce.entity_type = 'printing' and ce.entity_id = p.id::text
          ))`,
        )
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
  };
}
