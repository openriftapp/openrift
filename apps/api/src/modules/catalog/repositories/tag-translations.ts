import type { Kysely } from "kysely";
import { sql } from "kysely";

import { foreignLanguageCandidate } from "../../../db/helpers.js";
import type { Database } from "../../../db/tables.js";

export interface TagTranslationRow {
  tag: string;
  language: string;
  label: string;
}

/** Maps a source's tag label in another language to the English tag printed on the card. */
export function tagTranslationsRepo(db: Kysely<Database>) {
  return {
    listAll(): Promise<TagTranslationRow[]> {
      return db
        .selectFrom("tagTranslations")
        .select(["tag", "language", "label"])
        .orderBy("language")
        .orderBy("tag")
        .orderBy("label")
        .execute();
    },

    async upsert(values: TagTranslationRow): Promise<void> {
      await db
        .insertInto("tagTranslations")
        .values(values)
        .onConflict((oc) =>
          oc.columns(["language", "label"]).doUpdateSet((eb) => ({ tag: eb.ref("excluded.tag") })),
        )
        .execute();
    },

    async remove(language: string, label: string): Promise<void> {
      await db
        .deleteFrom("tagTranslations")
        .where("language", "=", language)
        .where("label", "=", label)
        .execute();
    },

    /** Skips labels that already have a translation, so manual corrections survive. */
    async bulkInsert(rows: TagTranslationRow[]): Promise<number> {
      if (rows.length === 0) {
        return 0;
      }
      const result = await db
        .insertInto("tagTranslations")
        .values(rows)
        .onConflict((oc) => oc.columns(["language", "label"]).doNothing())
        .execute();
      const [first] = result;
      return first ? Number(first.numInsertedOrUpdatedRows ?? 0) : 0;
    },

    /** Label and tag at the same position, where a foreign row and its card have equally many tags. */
    async positionalPairs(): Promise<
      { language: string; label: string; tag: string; count: number }[]
    > {
      const rows = await sql<{ language: string; label: string; tag: string; count: number }>`
        select lang.language, cc.tags[i] as label, c.tags[i] as tag, count(*)::int as count
        from candidate_cards cc
        join card_name_aliases a on a.norm_name = cc.norm_name
        join cards c on c.id = a.card_id
        cross join lateral (
          select min(cp.language) as language
          from candidate_printings cp
          where cp.candidate_card_id = cc.id
        ) lang
        cross join lateral generate_subscripts(cc.tags, 1) i
        where ${foreignLanguageCandidate("cc")}
          and lang.language is not null
          and cardinality(cc.tags) = cardinality(c.tags)
        group by lang.language, cc.tags[i], c.tags[i]
      `.execute(db);
      return rows.rows;
    },

    async unmappedLabels(): Promise<{ language: string; label: string; cardCount: number }[]> {
      const rows = await sql<{ language: string; label: string; cardCount: number }>`
        select lang.language, raw.label, count(distinct cc.norm_name)::int as "cardCount"
        from candidate_cards cc
        cross join lateral (
          select min(cp.language) as language
          from candidate_printings cp
          where cp.candidate_card_id = cc.id
        ) lang
        cross join lateral unnest(cc.tags) raw(label)
        where ${foreignLanguageCandidate("cc")}
          and lang.language is not null
          and not exists (select 1 from tag_translations tt where tt.label = raw.label)
        group by lang.language, raw.label
        order by "cardCount" desc, raw.label
      `.execute(db);
      return rows.rows;
    },
  };
}
