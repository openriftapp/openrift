import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE meta_deck_inferences (
      deck_id uuid PRIMARY KEY REFERENCES decks(id) ON DELETE CASCADE,
      champion_card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
      champion_alt_card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
      champion_unsure boolean NOT NULL DEFAULT false,
      battlefield_card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
      battlefield_also_card_ids uuid[] NOT NULL DEFAULT '{}',
      computed_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT chk_meta_deck_inferences_some_guess
        CHECK (champion_card_id IS NOT NULL OR battlefield_card_id IS NOT NULL),
      CONSTRAINT chk_meta_deck_inferences_unsure_needs_champion
        CHECK (NOT champion_unsure OR champion_card_id IS NOT NULL),
      CONSTRAINT chk_meta_deck_inferences_alt_needs_champion
        CHECK (champion_alt_card_id IS NULL
          OR (champion_card_id IS NOT NULL AND champion_alt_card_id <> champion_card_id)),
      CONSTRAINT chk_meta_deck_inferences_also_needs_battlefield
        CHECK (cardinality(battlefield_also_card_ids) = 0 OR battlefield_card_id IS NOT NULL)
    )
  `.execute(db);

  await sql`
    CREATE TABLE meta_deck_inference_neighbours (
      deck_id uuid NOT NULL REFERENCES meta_deck_inferences(deck_id) ON DELETE CASCADE,
      zone text NOT NULL CONSTRAINT chk_meta_deck_inference_neighbours_zone
        CHECK (zone IN ('champion', 'battlefield')),
      position smallint NOT NULL CONSTRAINT chk_meta_deck_inference_neighbours_position
        CHECK (position >= 0),
      neighbour_deck_id uuid NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      shared smallint NOT NULL CONSTRAINT chk_meta_deck_inference_neighbours_shared
        CHECK (shared > 0),
      PRIMARY KEY (deck_id, zone, position)
    )
  `.execute(db);
  await sql`
    CREATE INDEX idx_meta_deck_inference_neighbours_neighbour
      ON meta_deck_inference_neighbours (neighbour_deck_id)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`DROP TABLE meta_deck_inference_neighbours`.execute(db);
  await sql`DROP TABLE meta_deck_inferences`.execute(db);
}
