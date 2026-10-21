import type { Kysely, SqlBool } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { containsPattern } from "../../../lib/like-pattern.js";
import {
  imageUrlWithOriginal,
  joinFaceImage,
  keysetCursorPredicate,
} from "../../../repositories/query-helpers.js";

export interface WorkspaceRecordDbRow {
  id: string;
  cardSlug: string;
  cardName: string;
  setName: string;
  shortCode: string;
  language: string;
  finish: string;
  imageUrl: string | null;
  count: number;
  updatedAt: Date;
}

interface WorkspaceRecordsQuery {
  q?: string;
  limit: number;
  cursor?: string;
  printingIds?: readonly string[];
}

export function workspaceRecordsRepo(db: Kysely<Database>) {
  return {
    listPrintingRecords(query: WorkspaceRecordsQuery): Promise<WorkspaceRecordDbRow[]> {
      if (query.printingIds?.length === 0) {
        return Promise.resolve([]);
      }
      let qb = joinFaceImage(
        db.selectFrom("printings as p").innerJoin("faces as f", "f.id", "p.face1Id"),
        "f.id",
      )
        .innerJoin("cards as c", "c.id", "f.cardId")
        .innerJoin("sets as s", "s.id", "f.setId")
        .select([
          "p.id",
          "c.slug as cardSlug",
          "c.name as cardName",
          "s.name as setName",
          "f.shortCode",
          "f.language",
          "f.finish",
          imageUrlWithOriginal("imgf").as("imageUrl"),
          sql<number>`case when p.face2_id is null then 1 else 2 end`.as("count"),
          "p.updatedAt",
        ])
        .orderBy("p.updatedAt", "desc")
        .orderBy("p.id", "desc")
        .limit(query.limit + 1);
      if (query.printingIds !== undefined) {
        qb = qb.where("p.id", "in", [...query.printingIds]);
      }
      if (query.q !== undefined) {
        const pattern = containsPattern(query.q);
        qb = qb.where((eb) =>
          eb.or([
            eb("c.name", "ilike", pattern),
            eb("f.shortCode", "ilike", pattern),
            eb("f.publicCode", "ilike", pattern),
          ]),
        );
      }
      if (query.cursor !== undefined) {
        qb = qb.where(
          keysetCursorPredicate(query.cursor, {
            timeColumn: "p.updatedAt",
            idColumn: "p.id",
            idDirection: "desc",
          }),
        );
      }
      return qb.execute();
    },

    listFaceRecords(query: WorkspaceRecordsQuery): Promise<WorkspaceRecordDbRow[]> {
      if (query.printingIds?.length === 0) {
        return Promise.resolve([]);
      }
      let qb = joinFaceImage(db.selectFrom("faces as f"), "f.id")
        .innerJoin("cards as c", "c.id", "f.cardId")
        .innerJoin("sets as s", "s.id", "f.setId")
        .select([
          "f.id",
          "c.slug as cardSlug",
          "c.name as cardName",
          "s.name as setName",
          "f.shortCode",
          "f.language",
          "f.finish",
          imageUrlWithOriginal("imgf").as("imageUrl"),
          sql<number>`(
            select count(*)::int from printings pc where f.id in (pc.face1_id, pc.face2_id)
          )`.as("count"),
          "f.updatedAt",
        ])
        .orderBy("f.updatedAt", "desc")
        .orderBy("f.id", "desc")
        .limit(query.limit + 1);
      if (query.printingIds !== undefined) {
        qb = qb.where(sql<SqlBool>`f.id in (
          select unnest(array[pr.face1_id, pr.face2_id]) from printings pr
          where pr.id = any(${[...query.printingIds]}::uuid[])
        )`);
      }
      if (query.q !== undefined) {
        const pattern = containsPattern(query.q);
        qb = qb.where((eb) =>
          eb.or([
            eb("c.name", "ilike", pattern),
            eb("f.shortCode", "ilike", pattern),
            eb("f.publicCode", "ilike", pattern),
          ]),
        );
      }
      if (query.cursor !== undefined) {
        qb = qb.where(
          keysetCursorPredicate(query.cursor, {
            timeColumn: "f.updatedAt",
            idColumn: "f.id",
            idDirection: "desc",
          }),
        );
      }
      return qb.execute();
    },
  };
}
