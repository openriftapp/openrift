import type { ActivityAction, CardType } from "@openrift/shared/types/enums";
import type { Kysely, Selectable } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { FacesTable } from "../../../db/tables/catalog.js";
import type { CollectionEventsTable } from "../../../db/tables/collections.js";
import {
  imageId,
  joinFaceImage,
  keysetCursorPredicate,
  withFace1,
} from "../../../repositories/query-helpers.js";

type CollectionEventRow = Pick<
  Selectable<CollectionEventsTable>,
  | "id"
  | "action"
  | "copyId"
  | "printingId"
  | "fromCollectionId"
  | "fromCollectionName"
  | "toCollectionId"
  | "toCollectionName"
  | "createdAt"
> &
  Pick<Selectable<FacesTable>, "shortCode" | "rarity"> & {
    imageId: string | null;
    cardName: string;
    cardTypes: CardType[];
    cardSuperTypes: string[];
    tags: string[];
  };

export function collectionEventsRepo(db: Kysely<Database>) {
  return {
    listForUser(userId: string, limit: number, cursor?: string): Promise<CollectionEventRow[]> {
      let query = joinFaceImage(
        withFace1(
          db
            .selectFrom("collectionEvents as ce")
            .innerJoin("printings as p", "p.id", "ce.printingId"),
        )
          .innerJoin("cards as card", "card.id", "pf.cardId")
          .innerJoin("mvCardAggregates as mca", "mca.cardId", "card.id"),
        "pf.id",
      )
        .select([
          "ce.id",
          "ce.action",
          "ce.copyId",
          "ce.printingId",
          "ce.fromCollectionId",
          "ce.fromCollectionName",
          "ce.toCollectionId",
          "ce.toCollectionName",
          "ce.createdAt",
          imageId("imgf").as("imageId"),
          "pf.shortCode",
          "pf.rarity",
          "card.name as cardName",
          "mca.types as cardTypes",
          "mca.superTypes as cardSuperTypes",
          "card.tags as tags",
        ])
        .where("ce.userId", "=", userId)
        .orderBy("ce.createdAt", "desc")
        .orderBy("ce.id", "desc")
        .limit(limit + 1);
      if (cursor) {
        query = query.where(
          keysetCursorPredicate(cursor, {
            timeColumn: "ce.createdAt",
            idColumn: "ce.id",
            idDirection: "desc",
          }),
        );
      }
      return query.execute();
    },

    async insert(
      items: {
        userId: string;
        action: ActivityAction;
        printingId: string;
        copyId: string | null;
        fromCollectionId: string | null;
        fromCollectionName: string | null;
        toCollectionId: string | null;
        toCollectionName: string | null;
      }[],
    ): Promise<void> {
      if (items.length === 0) {
        return;
      }
      await db.insertInto("collectionEvents").values(items).execute();
    },
  };
}
