import type { CardType, MetaListStatus } from "@openrift/shared/types/enums";
import { afterAll, describe, expect, it } from "vitest";

import { createDbContext, insertCards } from "../../../test/integration-context.js";
import type { ChampionFacts } from "../lib/meta-chosen-champion.js";
import { inferGroup } from "../lib/meta-slot-inference.js";
import type { GroupDeck } from "../lib/meta-slot-inference.js";
import type { MetaDeckCardInput } from "./meta-decks.js";
import { metaInferencesRepo } from "./meta-inferences.js";
import { metaRepo } from "./meta.js";

const ctx = createDbContext(crypto.randomUUID());

const FORMAT = "constructed";
const createdEventIds: string[] = [];
const createdDeckIds: string[] = [];
const createdCardIds: string[] = [];

describe.skipIf(!ctx)("metaInferencesRepo (integration)", () => {
  const { db } = ctx!;
  const repo = metaInferencesRepo(db);
  const archive = metaRepo(db);

  let legend: string;
  let championA: string;
  let championB: string;
  let spell: string;
  let battlefields: string[];
  let partialDeckId: string;
  let fullDeckIds: string[];

  async function seedCard(name: string, type: CardType, tags: string[] = []): Promise<string> {
    const slug = `mti-${name.toLowerCase().replaceAll(" ", "-")}-${crypto.randomUUID().slice(0, 8)}`;
    const [card] = await insertCards(db, {
      name: `MTI ${name}`,
      slug,
      normName: slug,
      keywords: [],
      tags,
      types: [type],
    });
    createdCardIds.push(card!.id);
    return card!.id;
  }

  async function seedPlayer(
    eventId: string,
    rank: number,
    listStatus: Exclude<MetaListStatus, "none">,
    extra: MetaDeckCardInput[],
  ): Promise<string> {
    const created = await archive.createPlayer(
      {
        eventId,
        rank,
        rankIsTier: false,
        playerName: `MTI Player ${rank}`,
        wins: 5,
        losses: 1,
        draws: null,
        legendCardId: legend,
        championCardId: null,
        sourceIdentity: null,
        deck: {
          name: `MTI Deck ${rank}`,
          format: FORMAT,
          formatConfig: null,
          cards: [
            { cardId: legend, zone: "legend", quantity: 1, preferredPrintingId: null },
            { cardId: spell, zone: "main", quantity: 3, preferredPrintingId: null },
            ...extra,
          ],
          listStatus,
        },
      },
      `mti${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
    );
    createdDeckIds.push(created!.deckId!);
    return created!.deckId!;
  }

  const zone = (cardId: string, deckZone: string): MetaDeckCardInput => ({
    cardId,
    zone: deckZone as MetaDeckCardInput["zone"],
    quantity: 1,
    preferredPrintingId: null,
  });

  it("seeds a legend with three complete lists and one partial list", async () => {
    legend = await seedCard("Legend", "legend", ["MTI Hero"]);
    championA = await seedCard("Hero A", "unit", ["MTI Hero"]);
    championB = await seedCard("Hero B", "unit", ["MTI Hero"]);
    spell = await seedCard("Spell", "spell");
    battlefields = [
      await seedCard("Field One", "battlefield"),
      await seedCard("Field Two", "battlefield"),
      await seedCard("Field Three", "battlefield"),
    ];
    await db
      .insertInto("cardSuperTypes")
      .values([championA, championB].map((cardId) => ({ cardId, superTypeSlug: "champion" })))
      .execute();
    const event = await archive.createEvent({
      slug: `mti-event-${crypto.randomUUID().slice(0, 8)}`,
      name: "MTI Summoner Skirmish",
      eventDate: "2026-08-01",
      format: FORMAT,
      playerCount: 16,
      organizer: null,
      notes: null,
      country: null,
    });
    createdEventIds.push(event.id);

    const full = battlefields.map((cardId) => zone(cardId, "battlefield"));
    fullDeckIds = [
      await seedPlayer(event.id, 1, "full", [zone(championA, "champion"), ...full]),
      await seedPlayer(event.id, 2, "full", [zone(championA, "champion"), ...full]),
      await seedPlayer(event.id, 3, "full", [zone(championB, "champion"), ...full]),
    ];
    partialDeckId = await seedPlayer(event.id, 4, "partial", []);

    expect(fullDeckIds).toHaveLength(3);
  });

  it("reads the champion facts and the legend's group", async () => {
    const facts = await repo.championFacts();
    const byId = new Map(facts.map((row) => [row.id, row]));
    expect(byId.get(championA)?.isChampion).toBe(true);
    expect(byId.get(spell)?.isChampion).toBe(false);

    const groups = await repo.inferenceGroups();
    expect(groups).toContainEqual({ legendCardId: legend, format: FORMAT });
  });

  it("writes the guesses a recompute plans, then reads them back for the deck page", async () => {
    const rows = await repo.inferenceDecks(legend, FORMAT);
    const decks = new Map<string, GroupDeck>();
    for (const row of rows) {
      const deck = decks.get(row.deckId) ?? {
        deckId: row.deckId,
        partial: row.listStatus === "partial",
        main: new Map<string, number>(),
        championCardId: null,
        battlefieldCardIds: [],
      };
      if (row.zone === "main") {
        (deck.main as Map<string, number>).set(row.cardId, row.quantity);
      } else if (row.zone === "champion") {
        deck.championCardId = row.cardId;
      } else {
        deck.battlefieldCardIds = [...deck.battlefieldCardIds, row.cardId];
      }
      decks.set(row.deckId, deck);
    }
    const factRows = await repo.championFacts();
    const facts = new Map<string, ChampionFacts>(factRows.map((row) => [row.id, row]));

    const planned = inferGroup(legend, [...decks.values()], facts, 3);
    expect(planned.map((row) => row.deckId)).toEqual([partialDeckId]);

    await repo.replaceInferences(planned, []);
    const allStored = await repo.storedInferences();
    const stored = allStored.find((row) => row.deckId === partialDeckId);
    expect(stored?.championCardId).toBe(championA);
    expect(stored?.championAltCardId).toBeNull();
    expect(stored?.neighbours.filter((row) => row.zone === "champion")).toHaveLength(3);

    const forDeck = await repo.inferenceForDeck(partialDeckId);
    expect(forDeck?.neighbours[0]).toMatchObject({
      playerName: "MTI Player 1",
      eventName: "MTI Summoner Skirmish",
      championCardId: championA,
    });
  });

  it("shapes only the partial list, with its stored guesses", async () => {
    const shapes = await repo.listShapes([partialDeckId, fullDeckIds[0]!]);

    expect(shapes).toEqual([
      {
        deckId: partialDeckId,
        format: FORMAT,
        legend: 1,
        champion: 0,
        battlefield: 0,
        main: 3,
        runes: 0,
        battlefieldCardIds: [],
        guessedChampionCardId: championA,
        guessedChampionName: "MTI Hero A",
        guessedChampionAltName: null,
        guessedBattlefieldCardId: expect.any(String),
      },
    ]);
  });

  it("removes a list's guesses", async () => {
    await repo.replaceInferences([], [partialDeckId]);

    expect(await repo.inferenceForDeck(partialDeckId)).toBeUndefined();
  });
});

afterAll(async () => {
  if (!ctx) {
    return;
  }
  const { db } = ctx;
  await db.deleteFrom("metaEvents").where("id", "in", createdEventIds).execute();
  if (createdDeckIds.length > 0) {
    await db.deleteFrom("decks").where("id", "in", createdDeckIds).execute();
  }
  if (createdCardIds.length > 0) {
    await db.deleteFrom("cards").where("id", "in", createdCardIds).execute();
  }
});
