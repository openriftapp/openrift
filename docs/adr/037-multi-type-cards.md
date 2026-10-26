---
status: accepted
date: 2026-07-07
---

# ADR-037: Multi-Type Card Data Model

## Context and Problem Statement

The newest Riftbound set introduces cards with more than one card type, starting with "Unit Gear". Today `cards.type` is a single `text NOT NULL` column with an FK to the `card_types` reference table, and the API contract exposes one `type` string per card. Filters, grouping, deck rules, playset limits, stats, and rendering all assume exactly one type per card. How do we store and expose multiple types so a Unit Gear behaves as both a Unit and a Gear everywhere it matters?

## Decision Drivers

- A Unit Gear must match both the "Unit" and the "Gear" filter, appear in both group-by-type buckets, and satisfy set-membership deck rules ("is this a Rune/Legend/Battlefield").
- Super types already solved the same problem: `card_super_types` join table, `super_types[]` in `mv_card_aggregates`, `overlaps` filter semantics, fan-out grouping. Types should reuse that groove rather than invent a second pattern.
- Dozens of read paths (repositories, mappers, list/trade/deck-check rows) select `cards.type` as a scalar, so the read paths have to move before the column can go.
- A card still needs exactly one home in ordered deck lists (Unit → Spell → Gear sections).

## Considered Options

1. **Composite slug in `card_types`** (a new `unit-gear` row, no schema change).
2. **Replace `cards.type` with a join table** (drop the scalar column entirely).
3. **Ordered join table plus retained scalar**: new `card_card_types (card_id, type_slug, position)`, `cards.type` kept and defined as the first type (`types[0]`).

## Decision Outcome

Chosen option: **replace `cards.type` with an ordered join table (option 2)**, because it gives correct set semantics everywhere they matter, keeps one source of truth for a card's types, and mirrors the proven `card_super_types` pattern.

Option 1 ships fastest but is wrong at the model level: filtering by "Gear" would not find Unit Gears, group-by-type puts them in neither existing bucket, and deck rules and playset checks would need to special-case every composite slug forever. Option 3 leaves the scalar read paths untouched but keeps two copies of the primary type that triggers must hold in sync, and the public contract carries a field that only repeats `types[0]`.

### Consequences

- Good, because filters, facets, grouping, search, and deck rules treat multi-type cards correctly with the same array semantics domains and super types already use.
- Good, because single-type cards (the entire existing catalogue) behave identically.
- Good, because the schema and shared-contract work can ship before the first Unit Gear is ingested.
- Bad, because a card and its junction rows must be written in one transaction. Deferred constraint triggers reject a card inserted without a junction row and any transaction that leaves a card with zero junction rows.
- Bad, because type-derived charts (deck stats, collection completion) double-count multi-type cards, so bars no longer sum to the deck or collection size. Accepted: domain breakdowns already behave this way.

### Confirmation

- Schema review in `docs/schema.sql`: `card_card_types` exists with `(card_id, type_slug, position)`, backfilled one row per card; `mv_card_aggregates` gains a `types[]` aggregate.
- Shared-package tests: a two-type fixture matches both type filters, appears in both group-by buckets, and trips set-membership deck rules and playset caps via either type.
- Ingesting a Unit Gear card produces `types = ["unit", "gear"]`, both filter facets counting it, and both glyphs rendered.

## Design Decisions

### Storage and contract

- `card_card_types (card_id, type_slug REFERENCES card_types(slug), position)`, unique on `(card_id, type_slug)` and `(card_id, position)`. Backfill one row per existing card at position 0. Migration template: the `card_super_types` normalization in migration 062.
- `mv_card_aggregates` gains `types[]` (ordered), next to `domains[]` and `super_types[]`.
- `cards` has no type column. `catalogCardResponseSchema` carries `types: string[]` (ordered, non-empty) and no single `type`.
- `candidate_cards.type` is replaced by `types text[]`, mirroring the existing `super_types text[]`; the contribute schema and `accept-gallery` promotion write the array.

### Semantics: full set vs. primary

Full type set (`types`) drives everything with a correctness or display meaning:

- Filters and facet counts (`filters.ts`): switch the type dimension from scalar `includes` to the `overlaps` form used by domains; the facet counter returns the full list.
- Group-by type (`group-by-field.ts`): fan-out form, one bucket per type, as super types and domains already do.
- Deck rules, zone inference, zone gating, playset size: every `cardType === X` check becomes `types.includes(X)`. A card is capped at 1 copy if any type is Legend or Battlefield.
- Search: the `ty:` prefix matches any type (it already ORs super types).
- Orientation: landscape if and only if `types` contains Battlefield.
- Rendering: one type glyph per entry in `types`, in order; the Gear cost-diamond frame applies when `types` contains Gear; the type line joins all labels in order ("Unit Gear").
- Stats breakdowns by type (deck stats, collection completion): fan-out like the domain breakdown, counting the card under each of its types.
- Admin `card_types` usage counts: via the join table.

Primary type (`types[0]`) has exactly one job: deck list sort order (`TYPE_GROUP_ORDER` bucketing), so a multi-type card appears once, sorted by its first type. SQL reads that need it use `primaryCardType` from `apps/api/src/db/helpers.ts`.

## Migration Shape

1. Create `card_card_types`, backfill from `cards.type`, extend `mv_card_aggregates`; regenerate `docs/schema.sql`.
2. Add `types[]` to the shared contract and thread it through catalog reads.
3. Convert the set-membership consumers listed above, each with tests covering a two-type fixture.
4. Convert rendering (glyphs, cost frame, type line, orientation).
5. Extend ingestion: `candidate_cards.types`, contribute schema, type-line parsing ("Unit Gear" → `["unit", "gear"]`), promotion write path.
6. Ingest the new set.
7. Move the remaining scalar reads to the junction table, then drop `cards.type` and `type` from the contract.

## More Information

- The `card_super_types` join table and its `overlaps`/fan-out consumers are the implementation template throughout.
