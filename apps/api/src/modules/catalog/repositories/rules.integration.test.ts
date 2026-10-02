import { afterAll, describe, expect, it } from "vitest";

import { PRINTING_1 } from "../../../test/fixtures/constants.js";
import { createDbContext } from "../../../test/integration-context.js";
import { rulesRepo } from "./rules.js";

const ctx = createDbContext("a0000000-0044-4000-a000-000000000001");

describe.skipIf(!ctx)("rulesRepo (integration)", () => {
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by skipIf
  const { db } = ctx!;
  const repo = rulesRepo(db);

  const sharedVersion = "test-kind-0044-shared";
  const langVersion = "test-lang-0044-b";
  const langPrevVersion = "test-lang-0044-a";
  const koPrintingId = crypto.randomUUID();

  afterAll(async () => {
    await repo.deleteVersion("core", "en", sharedVersion);
    await repo.deleteVersion("tournament", "en", sharedVersion);
    for (const version of [langVersion, langPrevVersion]) {
      await repo.deleteVersion("core", "fr", version);
      await repo.deleteVersion("core", "en", version);
    }
    await db.deleteFrom("printings").where("id", "=", koPrintingId).execute();
    await db.deleteFrom("keywords").where("name", "=", "RULES-0044-Shield").execute();
  });

  it("createVersion + insertRules scopes rows by kind", async () => {
    await repo.createVersion({
      kind: "core",
      language: "en",
      version: sharedVersion,
    });
    await repo.createVersion({
      kind: "tournament",
      language: "en",
      version: sharedVersion,
    });

    await repo.insertRules([
      {
        kind: "core",
        language: "en",
        version: sharedVersion,
        ruleNumber: "100.1",
        sortOrder: 1,
        depth: 0,
        ruleType: "text",
        content: "Core rule body.",
        changeType: "added",
      },
      {
        kind: "tournament",
        language: "en",
        version: sharedVersion,
        ruleNumber: "100.1",
        sortOrder: 1,
        depth: 0,
        ruleType: "text",
        content: "Tournament rule body.",
        changeType: "added",
      },
    ]);

    const coreLatest = await repo.listLatest("core", "en");
    const coreSubset = coreLatest.filter((r) => r.version === sharedVersion);
    expect(coreSubset).toHaveLength(1);
    expect(coreSubset[0]!.content).toBe("Core rule body.");

    const tournamentLatest = await repo.listLatest("tournament", "en");
    const tournamentSubset = tournamentLatest.filter((r) => r.version === sharedVersion);
    expect(tournamentSubset).toHaveLength(1);
    expect(tournamentSubset[0]!.content).toBe("Tournament rule body.");
  });

  it("listAtVersion is kind-scoped", async () => {
    const coreRows = await repo.listAtVersion("core", "en", sharedVersion);
    const tournamentRows = await repo.listAtVersion("tournament", "en", sharedVersion);
    expect(coreRows.find((r) => r.version === sharedVersion)?.content).toBe("Core rule body.");
    expect(tournamentRows.find((r) => r.version === sharedVersion)?.content).toBe(
      "Tournament rule body.",
    );
  });

  it("getVersion requires kind, language and version", async () => {
    const core = await repo.getVersion("core", "en", sharedVersion);
    const tournament = await repo.getVersion("tournament", "en", sharedVersion);
    expect(core?.kind).toBe("core");
    expect(tournament?.kind).toBe("tournament");
  });

  it("listVersions filters by kind when provided", async () => {
    const coreVersions = await repo.listVersions("en", "core");
    const tournamentVersions = await repo.listVersions("en", "tournament");
    expect(coreVersions.some((v) => v.version === sharedVersion && v.kind === "core")).toBe(true);
    expect(
      tournamentVersions.some((v) => v.version === sharedVersion && v.kind === "tournament"),
    ).toBe(true);
    expect(coreVersions.every((v) => v.kind === "core")).toBe(true);
    expect(tournamentVersions.every((v) => v.kind === "tournament")).toBe(true);
  });

  it("deleteVersion only removes the specified kind", async () => {
    const tempVersion = "test-kind-0044-delete";
    await repo.createVersion({ kind: "core", language: "en", version: tempVersion });
    await repo.createVersion({ kind: "tournament", language: "en", version: tempVersion });

    await repo.deleteVersion("core", "en", tempVersion);

    expect(await repo.getVersion("core", "en", tempVersion)).toBeUndefined();
    expect(await repo.getVersion("tournament", "en", tempVersion)).toBeDefined();

    await repo.deleteVersion("tournament", "en", tempVersion);
  });

  it("keeps languages isolated", async () => {
    await repo.createVersion({ kind: "core", language: "en", version: langVersion });
    await repo.createVersion({ kind: "core", language: "fr", version: langVersion });
    const base = {
      kind: "core" as const,
      version: langVersion,
      ruleNumber: "900.1",
      sortOrder: 1,
      depth: 0,
      ruleType: "text" as const,
      changeType: "added" as const,
    };
    await repo.insertRules([
      { ...base, language: "en", content: "English body." },
      { ...base, language: "fr", content: "Corps francais." },
    ]);

    const en = await repo.listAtVersion("core", "en", langVersion);
    const fr = await repo.listAtVersion("core", "fr", langVersion);
    expect(en.filter((r) => r.version === langVersion).map((r) => r.content)).toEqual([
      "English body.",
    ]);
    expect(fr.filter((r) => r.version === langVersion).map((r) => r.content)).toEqual([
      "Corps francais.",
    ]);
    const frVersions = await repo.listVersions("fr", "core");
    expect(frVersions.some((v) => v.version === langVersion)).toBe(true);
    expect(await repo.getVersion("core", "ko", langVersion)).toBeUndefined();
    const everyVersion = await repo.listAllVersions("core");
    const all = everyVersion.filter((v) => v.version === langVersion);
    expect(all.map((v) => v.language)).toEqual(["en", "fr"]);
    const translations = await repo.listTranslations("core", langVersion);
    expect(translations.map((t) => t.language)).toEqual(["fr"]);
  });

  it("listChangesAtVersion skips unchanged rows and removed rules without text in the language", async () => {
    await repo.createVersion({ kind: "core", language: "en", version: langPrevVersion });
    await repo.insertRules(
      ["901.1", "901.2", "901.3"].map((ruleNumber, index) => ({
        kind: "core" as const,
        language: "en" as const,
        version: langPrevVersion,
        ruleNumber,
        sortOrder: index,
        depth: 0,
        ruleType: "text" as const,
        content: `Old ${ruleNumber}.`,
        changeType: "added" as const,
      })),
    );
    const next = (
      language: "en" | "fr",
      ruleNumber: string,
      changeType: "modified" | "removed" | "unchanged",
      sortOrder: number,
    ) => ({
      kind: "core" as const,
      language,
      version: langVersion,
      ruleNumber,
      sortOrder,
      depth: 0,
      ruleType: "text" as const,
      content: changeType === "removed" ? "" : `New ${ruleNumber}.`,
      changeType,
    });
    await repo.insertRules([
      next("fr", "901.1", "modified", 0),
      next("fr", "901.2", "removed", 1),
      next("fr", "901.3", "unchanged", 2),
    ]);

    const changes = await repo.listChangesAtVersion("core", "fr", langVersion);

    expect(changes.modified).toEqual(["901.1"]);
    expect(changes.added).toEqual(expect.not.arrayContaining(["901.3"]));
    expect(Object.keys(changes.current)).toContain("901.1");
    expect(Object.keys(changes.current)).not.toContain("901.3");
    expect(changes.modifiedPrev).toEqual({});
    expect(changes.removed).toEqual([]);
  });

  it("listKeywordLabels lists English names and the language's labels", async () => {
    await db
      .insertInto("keywords")
      .values({ name: "RULES-0044-Shield", color: "#cd346f", darkText: false, isWellKnown: false })
      .execute();
    await db
      .insertInto("keywordTranslations")
      .values({ keywordName: "RULES-0044-Shield", language: "FR", label: "RULES-0044-Bouclier" })
      .execute();

    const french = await repo.listKeywordLabels("fr");
    const korean = await repo.listKeywordLabels("ko");

    expect(french.filter((row) => row.name === "RULES-0044-Shield")).toEqual([
      { label: "RULES-0044-Shield", name: "RULES-0044-Shield", color: "#cd346f", darkText: false },
      {
        label: "RULES-0044-Bouclier",
        name: "RULES-0044-Shield",
        color: "#cd346f",
        darkText: false,
      },
    ]);
    expect(korean.filter((row) => row.name === "RULES-0044-Shield")).toHaveLength(1);
  });

  it("listCardNames returns printed names for a non-English language", async () => {
    const seedPrinting = await db
      .selectFrom("printings")
      .select(["cardId", "setId", "artist"])
      .where("id", "=", PRINTING_1.id)
      .executeTakeFirstOrThrow();
    const card = await db
      .selectFrom("cards")
      .select("slug")
      .where("id", "=", seedPrinting.cardId)
      .executeTakeFirstOrThrow();
    await db
      .insertInto("printings")
      .values({
        id: koPrintingId,
        cardId: seedPrinting.cardId,
        setId: seedPrinting.setId,
        artist: seedPrinting.artist,
        shortCode: "RK-0044",
        publicCode: "RK-0044/001",
        rarity: "common",
        artVariant: "normal",
        isSigned: false,
        finish: "normal",
        size: "standard",
        language: "KR",
        printedName: "룰 테스트 0044",
      })
      .execute();

    const ko = await repo.listCardNames("ko");

    expect(ko).toContainEqual({ name: "룰 테스트 0044", slug: card.slug });
    const en = await repo.listCardNames("en");
    expect(en.some((c) => c.name === "룰 테스트 0044")).toBe(false);
    expect(await repo.listCardNames("fr")).not.toContainEqual(
      expect.objectContaining({ name: "룰 테스트 0044" }),
    );
  });
});
