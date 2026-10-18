import type { Kysely } from "kysely";

import type { Database } from "../../../db/tables.js";
import { imageId, joinFaceImage, withFace1 } from "../../../repositories/query-helpers.js";

const MAX_RETRIES = 5;

export interface EnrichedPrintingEvent {
  id: string;
  printingId: string;
  createdAt: Date;
  cardName: string | null;
  cardSlug: string | null;
  setName: string | null;
  shortCode: string | null;
  rarity: string | null;
  rarityLabel: string | null;
  finish: string | null;
  finishLabel: string | null;
  artist: string | null;
  language: string | null;
  languageName: string | null;
  frontImageId: string | null;
}

type PrintingEventStatus = "pending" | "sent" | "failed";

interface AdminPrintingEvent extends EnrichedPrintingEvent {
  status: PrintingEventStatus;
  retryCount: number;
}

export function printingEventsRepo(db: Kysely<Database>) {
  return {
    async recordNew(printingId: string): Promise<void> {
      await db
        .insertInto("printingEvents")
        .values({ printingId, status: "pending", retryCount: 0 })
        .execute();
    },

    async listPending(): Promise<EnrichedPrintingEvent[]> {
      return await joinFaceImage(
        withFace1(
          db
            .selectFrom("printingEvents as pe")
            .innerJoin("printings as p", "p.id", "pe.printingId"),
        )
          .innerJoin("cards as c", "c.id", "pf.cardId")
          .innerJoin("sets as s", "s.id", "pf.setId")
          .leftJoin("finishes as fi", "fi.slug", "pf.finish")
          .leftJoin("rarities as r", "r.slug", "pf.rarity")
          .leftJoin("languages as lng", "lng.code", "pf.language"),
        "pf.id",
      )
        .select([
          "pe.id",
          "pe.printingId",
          "pe.createdAt",
          "c.name as cardName",
          "c.slug as cardSlug",
          "s.name as setName",
          "pf.shortCode",
          "pf.rarity",
          "r.label as rarityLabel",
          "pf.finish",
          "fi.label as finishLabel",
          "pf.artist",
          "pf.language",
          "lng.name as languageName",
          imageId("imgf").as("frontImageId"),
        ])
        .where("pe.status", "=", "pending")
        .orderBy("pe.createdAt", "asc")
        .execute();
    },

    async listByStatus(statuses: PrintingEventStatus[]): Promise<AdminPrintingEvent[]> {
      if (statuses.length === 0) {
        return [];
      }
      return await joinFaceImage(
        withFace1(
          db
            .selectFrom("printingEvents as pe")
            .innerJoin("printings as p", "p.id", "pe.printingId"),
        )
          .innerJoin("cards as c", "c.id", "pf.cardId")
          .innerJoin("sets as s", "s.id", "pf.setId")
          .leftJoin("finishes as fi", "fi.slug", "pf.finish")
          .leftJoin("rarities as r", "r.slug", "pf.rarity")
          .leftJoin("languages as lng", "lng.code", "pf.language"),
        "pf.id",
      )
        .select([
          "pe.id",
          "pe.printingId",
          "pe.createdAt",
          "pe.status",
          "pe.retryCount",
          "c.name as cardName",
          "c.slug as cardSlug",
          "s.name as setName",
          "pf.shortCode",
          "pf.rarity",
          "r.label as rarityLabel",
          "pf.finish",
          "fi.label as finishLabel",
          "pf.artist",
          "pf.language",
          "lng.name as languageName",
          imageId("imgf").as("frontImageId"),
        ])
        .where("pe.status", "in", statuses)
        .orderBy("pe.createdAt", "desc")
        .execute();
    },

    async retryFailed(ids: string[]): Promise<void> {
      if (ids.length === 0) {
        return;
      }
      await db
        .updateTable("printingEvents")
        .set({ status: "pending", retryCount: 0 })
        .where("id", "in", ids)
        .execute();
    },

    async markSent(ids: string[]): Promise<void> {
      if (ids.length === 0) {
        return;
      }
      await db
        .updateTable("printingEvents")
        .set({ status: "sent" })
        .where("id", "in", ids)
        .execute();
    },

    async markRetry(ids: string[]): Promise<void> {
      if (ids.length === 0) {
        return;
      }
      await db
        .updateTable("printingEvents")
        .set((eb) => ({
          retryCount: eb("retryCount", "+", 1),
        }))
        .where("id", "in", ids)
        .execute();

      await db
        .updateTable("printingEvents")
        .set({ status: "failed" })
        .where("id", "in", ids)
        .where("retryCount", ">=", MAX_RETRIES)
        .execute();
    },
  };
}
