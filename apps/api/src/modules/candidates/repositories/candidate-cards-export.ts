import type { Kysely, Selectable } from "kysely";

import type { Database } from "../../../db/tables.js";
import type { CardsTable } from "../../../db/tables/catalog.js";
import type { PrintingSidesOrderedView } from "../../../db/tables/views.js";
import { joinFaceImage } from "../../../repositories/query-helpers.js";

export interface ExportPrintingRow extends PrintingSidesOrderedView {
  id: string;
  setSlug: string;
  setName: string;
  imageId: string | null;
  rehostedUrl: string | null;
  originalUrl: string | null;
}

export function candidateExportRepo(db: Kysely<Database>) {
  return {
    exportCards(): Promise<
      (Selectable<CardsTable> & { domains: string[]; superTypes: string[]; types: string[] })[]
    > {
      return db
        .selectFrom("cards")
        .innerJoin("mvCardAggregates as mca", "mca.cardId", "cards.id")
        .selectAll("cards")
        .select(["mca.domains", "mca.superTypes", "mca.types"])
        .orderBy("cards.name")
        .execute();
    },

    exportCardErrata(): Promise<
      { cardId: string; correctedRulesText: string | null; correctedEffectText: string | null }[]
    > {
      return db
        .selectFrom("cardErrata")
        .select(["cardId", "correctedRulesText", "correctedEffectText"])
        .execute();
    },

    exportPrintings(): Promise<ExportPrintingRow[]> {
      return joinFaceImage(
        db.selectFrom("printingSidesOrdered as p").innerJoin("sets", "sets.id", "p.setId"),
        "p.faceId",
      )
        .selectAll("p")
        .select([
          "p.printingId as id",
          "sets.slug as setSlug",
          "sets.name as setName",
          "pi.id as imageId",
          "imgf.rehostedUrl",
          "imgf.originalUrl",
        ])
        .orderBy("p.canonicalRank")
        .execute();
    },
  };
}
