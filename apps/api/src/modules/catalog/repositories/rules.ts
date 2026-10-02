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
  return {
    /** Sorted by natural rule-number order in JS: `sort_order` is per-version and collides across versions. */
    async listLatest(kind: RuleKind, language: RuleLanguage) {
      const rows = await db
        .selectFrom("rules")
        .selectAll()
        .where("kind", "=", kind)
        .where("language", "=", language)
        .where("changeType", "!=", "removed")
        .where(
          "id",
          "in",
          db
            .selectFrom("rules as r2")
            .select("r2.id")
            .distinctOn("r2.ruleNumber")
            .where("r2.kind", "=", kind)
            .where("r2.language", "=", language)
            .orderBy("r2.ruleNumber")
            .orderBy("r2.version", "desc"),
        )
        .execute();
      return rows.toSorted((a, b) => compareRuleNumbers(a.ruleNumber, b.ruleNumber));
    },

    /**
     * Rows are sorted by natural rule-number order in JS — `sort_order` is
     * per-version and collides across versions, so it can't be used here.
     */
    async listAtVersion(kind: RuleKind, language: RuleLanguage, version: string) {
      const rows = await db
        .selectFrom("rules")
        .selectAll()
        .where("kind", "=", kind)
        .where("language", "=", language)
        .where("changeType", "!=", "removed")
        .where("version", "<=", version)
        .where(
          "id",
          "in",
          db
            .selectFrom("rules as r2")
            .select("r2.id")
            .distinctOn("r2.ruleNumber")
            .where("r2.kind", "=", kind)
            .where("r2.language", "=", language)
            .where("r2.version", "<=", version)
            .orderBy("r2.ruleNumber")
            .orderBy("r2.version", "desc"),
        )
        .execute();
      return rows.toSorted((a, b) => compareRuleNumbers(a.ruleNumber, b.ruleNumber));
    },

    /**
     * A translation's first version has no earlier text in its own language, so
     * its removed rules have nothing to show and are left out.
     */
    async listChangesAtVersion(kind: RuleKind, language: RuleLanguage, version: string) {
      const changeRows = await db
        .selectFrom("rules")
        .selectAll()
        .where("kind", "=", kind)
        .where("language", "=", language)
        .where("version", "=", version)
        .where("changeType", "!=", "unchanged")
        .orderBy("sortOrder")
        .execute();

      const ruleNumbersNeedingPrev = changeRows
        .filter((r) => r.changeType === "modified" || r.changeType === "removed")
        .map((r) => r.ruleNumber);

      const prevByNumber = new Map<string, string>();
      if (ruleNumbersNeedingPrev.length > 0) {
        const prevRows = await db
          .selectFrom("rules")
          .select(["ruleNumber", "content"])
          .where(
            "id",
            "in",
            db
              .selectFrom("rules as r3")
              .select("r3.id")
              .distinctOn("r3.ruleNumber")
              .where("r3.kind", "=", kind)
              .where("r3.language", "=", language)
              .where("r3.ruleNumber", "in", ruleNumbersNeedingPrev)
              .where("r3.version", "<", version)
              .orderBy("r3.ruleNumber")
              .orderBy("r3.version", "desc"),
          )
          .execute();
        for (const row of prevRows) {
          prevByNumber.set(row.ruleNumber, row.content);
        }
      }

      return {
        added: changeRows.filter((r) => r.changeType === "added").map((r) => r.ruleNumber),
        modified: changeRows.filter((r) => r.changeType === "modified").map((r) => r.ruleNumber),
        current: Object.fromEntries(
          changeRows
            .filter((r) => r.changeType !== "removed")
            .map((r) => [r.ruleNumber, r.content]),
        ),
        modifiedPrev: Object.fromEntries(
          changeRows
            .filter((r) => r.changeType === "modified" && prevByNumber.has(r.ruleNumber))
            .map((r) => [r.ruleNumber, prevByNumber.get(r.ruleNumber) ?? ""]),
        ),
        removed: changeRows
          .filter((r) => r.changeType === "removed" && prevByNumber.has(r.ruleNumber))
          .map((r) => ({ ...r, content: prevByNumber.get(r.ruleNumber) ?? "" })),
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

    createVersion(values: {
      kind: RuleKind;
      language: RuleLanguage;
      version: string;
      comments?: string | null;
      label?: string | null;
      documentVersion?: string | null;
    }) {
      return db
        .insertInto("ruleVersions")
        .values({
          kind: values.kind,
          language: values.language,
          version: values.version,
          comments: values.comments ?? null,
          label: values.label ?? null,
          documentVersion: values.documentVersion ?? null,
        })
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

    listChangeTypesAtVersion(kind: RuleKind, language: RuleLanguage, version: string) {
      return db
        .selectFrom("rules")
        .select(["ruleNumber", "changeType"])
        .where("kind", "=", kind)
        .where("language", "=", language)
        .where("version", "=", version)
        .execute();
    },

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
