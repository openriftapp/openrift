import { compareRuleNumbers } from "@openrift/shared/rules";
import type {
  RuleChangeType,
  RuleKind,
  RuleLanguage,
  RuleType,
} from "@openrift/shared/types/api/rules";
import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "../../../db/tables.js";
import { rowBatches } from "../../../lib/bind-batches.js";
import { imageId } from "../../../repositories/query-helpers.js";

const PRINTING_LANGUAGE: Record<Exclude<RuleLanguage, "en">, string> = {
  fr: "FR",
  ko: "KR",
  "zh-Hans": "SC",
};

export function rulesRepo(db: Kysely<Database>) {
  async function previousVersion(kind: RuleKind, language: RuleLanguage, version: string) {
    const row = await db
      .selectFrom("ruleVersions")
      .select((eb) => eb.fn.max("version").as("version"))
      .where("kind", "=", kind)
      .where("language", "=", language)
      .where("version", "<", version)
      .executeTakeFirst();
    return row?.version ?? undefined;
  }

  return {
    async listLatest(kind: RuleKind, language: RuleLanguage) {
      const rows = await db
        .selectFrom("rules")
        .selectAll()
        .where("kind", "=", kind)
        .where("language", "=", language)
        .where("version", "=", (eb) =>
          eb
            .selectFrom("ruleVersions")
            .select((inner) => inner.fn.max("version").as("version"))
            .where("kind", "=", kind)
            .where("language", "=", language),
        )
        .execute();
      return rows.toSorted((a, b) => compareRuleNumbers(a.ruleNumber, b.ruleNumber));
    },

    async listAtVersion(kind: RuleKind, language: RuleLanguage, version: string) {
      const rows = await db
        .selectFrom("rules")
        .selectAll()
        .where("kind", "=", kind)
        .where("language", "=", language)
        .where("version", "=", (eb) =>
          eb
            .selectFrom("ruleVersions")
            .select((inner) => inner.fn.max("version").as("version"))
            .where("kind", "=", kind)
            .where("language", "=", language)
            .where("version", "<=", version),
        )
        .execute();
      return rows.toSorted((a, b) => compareRuleNumbers(a.ruleNumber, b.ruleNumber));
    },

    /**
     * Changes against the language's previous version. A translation's first
     * version has no earlier text in its own language, so nothing shows as removed.
     */
    async listChangesAtVersion(kind: RuleKind, language: RuleLanguage, version: string) {
      const stored = await db
        .selectFrom("ruleVersions")
        .select("version")
        .where("kind", "=", kind)
        .where("language", "=", language)
        .where("version", "=", version)
        .executeTakeFirst();
      if (!stored) {
        return { added: [], modified: [], current: {}, modifiedPrev: {}, removed: [] };
      }
      const changeRows = await db
        .selectFrom("rules")
        .selectAll()
        .where("kind", "=", kind)
        .where("language", "=", language)
        .where("version", "=", version)
        .where("changeType", "in", ["added", "modified"])
        .orderBy("sortOrder")
        .execute();
      const previous = await previousVersion(kind, language, version);
      const modifiedNumbers = changeRows
        .filter((r) => r.changeType === "modified")
        .map((r) => r.ruleNumber);

      const prevByNumber = new Map<string, string>();
      if (previous !== undefined && modifiedNumbers.length > 0) {
        const prevRows = await db
          .selectFrom("rules")
          .select(["ruleNumber", "content"])
          .where("kind", "=", kind)
          .where("language", "=", language)
          .where("version", "=", previous)
          .where("ruleNumber", "in", modifiedNumbers)
          .execute();
        for (const row of prevRows) {
          prevByNumber.set(row.ruleNumber, row.content);
        }
      }

      const removedRows =
        previous === undefined
          ? []
          : await db
              .selectFrom("rules as p")
              .selectAll("p")
              .where("p.kind", "=", kind)
              .where("p.language", "=", language)
              .where("p.version", "=", previous)
              .where(({ not, exists, selectFrom }) =>
                not(
                  exists(
                    selectFrom("rules as c")
                      .select("c.id")
                      .where("c.kind", "=", kind)
                      .where("c.language", "=", language)
                      .where("c.version", "=", version)
                      .whereRef("c.ruleNumber", "=", "p.ruleNumber"),
                  ),
                ),
              )
              .orderBy("p.sortOrder")
              .execute();

      return {
        added: changeRows.filter((r) => r.changeType === "added").map((r) => r.ruleNumber),
        modified: modifiedNumbers,
        current: Object.fromEntries(changeRows.map((r) => [r.ruleNumber, r.content])),
        modifiedPrev: Object.fromEntries(
          modifiedNumbers
            .filter((ruleNumber) => prevByNumber.has(ruleNumber))
            .map((ruleNumber) => [ruleNumber, prevByNumber.get(ruleNumber) ?? ""]),
        ),
        removed: removedRows.map((r) => ({ ...r, version, changeType: "removed" as const })),
      };
    },

    async listKeywordLabels(language: RuleLanguage) {
      const keywords = await db
        .selectFrom("keywords")
        .leftJoin("keywordTranslations", (join) =>
          join
            .onRef("keywordTranslations.keywordName", "=", "keywords.name")
            .on(
              "keywordTranslations.language",
              "=",
              language === "en" ? "EN" : PRINTING_LANGUAGE[language],
            ),
        )
        .select([
          "keywords.name",
          "keywords.color",
          "keywords.darkText",
          "keywordTranslations.label",
        ])
        .execute();
      return keywords.flatMap(({ name, color, darkText, label }) => [
        { label: name, name, color, darkText },
        ...(label === null ? [] : [{ label, name, color, darkText }]),
      ]);
    },

    listCardImages(slugs: readonly string[], language: RuleLanguage) {
      const printingLanguage = language === "en" ? "EN" : PRINTING_LANGUAGE[language];
      return db
        .selectFrom("cards")
        .innerJoin("mvCardAggregates as mca", "mca.cardId", "cards.id")
        .innerJoinLateral(
          (eb) =>
            eb
              .selectFrom("printingsOrdered as po")
              .innerJoin("printingImages as pi", (join) =>
                join
                  .onRef("pi.printingId", "=", "po.id")
                  .on("pi.face", "=", "front")
                  .on("pi.isActive", "=", true),
              )
              .innerJoin("imageFiles as ci", "ci.id", "pi.imageFileId")
              .select(imageId("ci").as("imageId"))
              .whereRef("po.cardId", "=", "cards.id")
              .where("ci.rehostedUrl", "is not", null)
              .where("po.language", "in", [printingLanguage, "EN"])
              .orderBy(sql`po.language = ${printingLanguage}`, "desc")
              .orderBy("po.canonicalRank")
              .orderBy("po.id")
              .limit(1)
              .as("p"),
          (join) => join.onTrue(),
        )
        .select(["cards.slug", "p.imageId", "mca.types"])
        .where("cards.slug", "in", [...slugs])
        .execute();
    },

    listCardNames(language: RuleLanguage) {
      if (language === "en") {
        return db.selectFrom("cards").select(["name", "slug"]).execute();
      }
      return db
        .selectFrom("printings")
        .innerJoin("cards", "cards.id", "printings.cardId")
        .select(["printings.printedName as name", "cards.slug"])
        .distinctOn("printings.printedName")
        .where("printings.language", "=", PRINTING_LANGUAGE[language])
        .where("printings.printedName", "is not", null)
        .orderBy("printings.printedName")
        .orderBy("cards.slug")
        .$narrowType<{ name: string }>()
        .execute();
    },

    listVersions(language: RuleLanguage, kind?: RuleKind) {
      let query = db.selectFrom("ruleVersions").selectAll().where("language", "=", language);
      if (kind) {
        query = query.where("kind", "=", kind);
      }
      return query.orderBy("version", "asc").execute();
    },

    listAllVersions(kind?: RuleKind) {
      let query = db.selectFrom("ruleVersions").selectAll();
      if (kind) {
        query = query.where("kind", "=", kind);
      }
      return query.orderBy("version", "asc").orderBy("language", "asc").execute();
    },

    /** Creates the version, or on an existing one stamps `importedAt` and sets the details that are not `undefined`. */
    upsertVersion(
      key: { kind: RuleKind; language: RuleLanguage; version: string },
      details: { comments?: string | null; label?: string | null; documentVersion?: string | null },
    ) {
      const set = Object.fromEntries(
        Object.entries(details).filter(([, value]) => value !== undefined),
      );
      return db
        .insertInto("ruleVersions")
        .values({
          ...key,
          comments: details.comments ?? null,
          label: details.label ?? null,
          documentVersion: details.documentVersion ?? null,
        })
        .onConflict((oc) =>
          oc
            .columns(["kind", "language", "version"])
            .doUpdateSet({ ...set, importedAt: new Date() }),
        )
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async insertRules(
      rules: {
        kind: RuleKind;
        language: RuleLanguage;
        version: string;
        ruleNumber: string;
        sortOrder: number;
        depth: number;
        ruleType: RuleType;
        content: string;
        changeType: RuleChangeType;
      }[],
    ) {
      if (rules.length === 0) {
        return 0;
      }
      let inserted = 0;
      for (const batch of rowBatches(rules)) {
        const result = await db.insertInto("rules").values(batch).execute();
        inserted += result.reduce((sum, row) => sum + Number(row.numInsertedOrUpdatedRows ?? 0), 0);
      }
      return inserted;
    },

    deleteRules(kind: RuleKind, language: RuleLanguage, version: string) {
      return db
        .deleteFrom("rules")
        .where("kind", "=", kind)
        .where("language", "=", language)
        .where("version", "=", version)
        .execute();
    },

    listSnapshot(kind: RuleKind, language: RuleLanguage, version: string) {
      return db
        .selectFrom("rules")
        .select(["ruleNumber", "ruleType", "content", "depth", "sortOrder", "changeType"])
        .where("kind", "=", kind)
        .where("language", "=", language)
        .where("version", "=", version)
        .orderBy("sortOrder")
        .execute();
    },

    async setChangeType(
      kind: RuleKind,
      language: RuleLanguage,
      version: string,
      changeType: RuleChangeType,
      ruleNumbers: readonly string[],
    ) {
      if (ruleNumbers.length === 0) {
        return;
      }
      await db
        .updateTable("rules")
        .set({ changeType })
        .where("kind", "=", kind)
        .where("language", "=", language)
        .where("version", "=", version)
        .where("ruleNumber", "in", [...ruleNumbers])
        .execute();
    },

    previousVersion,

    getVersion(kind: RuleKind, language: RuleLanguage, version: string) {
      return db
        .selectFrom("ruleVersions")
        .selectAll()
        .where("kind", "=", kind)
        .where("language", "=", language)
        .where("version", "=", version)
        .executeTakeFirst();
    },

    listTranslations(kind: RuleKind, version: string) {
      return db
        .selectFrom("ruleVersions")
        .select("language")
        .where("kind", "=", kind)
        .where("version", "=", version)
        .where("language", "!=", "en")
        .execute();
    },

    updateDetails(
      kind: RuleKind,
      language: RuleLanguage,
      version: string,
      details: { comments: string | null; label: string | null; documentVersion: string | null },
    ) {
      return db
        .updateTable("ruleVersions")
        .set(details)
        .where("kind", "=", kind)
        .where("language", "=", language)
        .where("version", "=", version)
        .returningAll()
        .executeTakeFirst();
    },

    deleteVersion(kind: RuleKind, language: RuleLanguage, version: string) {
      return db
        .deleteFrom("ruleVersions")
        .where("kind", "=", kind)
        .where("language", "=", language)
        .where("version", "=", version)
        .execute();
    },
  };
}
