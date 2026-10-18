---
status: accepted
date: 2026-10-18
---

# ADR-020: Double-Sided Token Data Model

## Context and Problem Statement

Riftbound's tokens are double-sided physical cards with a gameplay-meaningful card on each side, for example a Recruit with a Buff on the back, or a Bird with a Brush on the back. Any token can sit on either side, and which combinations exist varies from set to set. This breaks the implicit 1:1 relationship between `cards` and `printings` that the current schema relies on: a printing today belongs to exactly one card, and the back image (if any) is treated as decoration, not as a different card.

We need a data model that:

1. Lets each side of a double-sided physical card be a first-class card (browsable, searchable, ownable in the user's "I own N Gold" sense).
2. Keeps ownership, price, and trade-list semantics anchored to the physical piece of cardboard (one physical card → one unit of ownership, one price).
3. Doesn't break the existing user-facing vocabulary (cards = gameplay identity, printings = physical product).
4. Aggregates cleanly when the same logical card appears on multiple physical printings: owned counts and printing lists must sum across every product the card is on.

### Current data (2026-10-18)

Catalog figures are from production's `/api/v1/catalog`. Ownership, marketplace mappings and candidates are from the 2026-10-01 production dump.

The catalog stores every token side as its own single-sided printing. 39 printings record a pairing in their free-text `comment`; the regular tokens record none, though every one of them has a reverse.

| Physical card                | Sides (collector code, finish)                                      | Languages |
| ---------------------------- | ------------------------------------------------------------------- | --------- |
| UNL Bird // Brush            | UNL-T02-P normal, UNL-T03-P foil                                    | EN, SC    |
| VEN Shadow Clone // Tentacle | VEN-T05-P foil, VEN-T06-P (stored foil, comment says never foil)    | EN, SC    |
| SGN bundle, five printings   | T01+T05, T01+T03, T02+T07, T02+T08, T04+T06; T04/T05/T07 never foil | EN, SC    |
| OGN Buff // Recruit promo    | OGN (Buff), OGN-271a (Recruit)                                      | SC        |
| SFD Buff // Gold promo       | SFD (Buff), SFD-T03a (Gold)                                         | SC        |
| OGN Buff // Buff promo       | one printing, a Buff on both sides                                  | EN        |
| Regular tokens, every set    | each token with another token on the reverse; combinations vary     | all       |

Facts the model has to hold:

- **One printed side on several physical cards.** SGN-T01 Bird sits opposite both T05 Gold and T03 Brush; SGN-T02 Bird opposite both T07 and T08 Sprite. A recurring side is printed identically, collector code included, on every printing it is on. Which sides recur is set-specific data.
- **The same card on both sides.** The OGN Buff // Buff promo.
- **Sides differ in finish.** UNL Bird is normal, its Brush side foil. The SGN reverse-only arts are never foil.
- **Marketplaces list one product per physical card**, named "Bird // Sprite", "Buff // Recruit" or by one side alone ("Gold"). Each listing is currently mapped onto one side's printing (17 variant rows). A "Bird Buff" listing is mapped to UNL-T02-P, the Bird // Brush promo.
- **Candidate sources pair sides in the name**, for example "Bird // Brush" with codes "PROMO-T01 // T05", and the regular tokens as "Recruit // Buff", "Mech // Buff", "Baron Pit // Buff", plus `-T01G` "Mech // Gold" variants absent from the catalog.
- **Users track each side separately.** 85 copies and 121 collection events sit on the 39 commented printings. Of 12 users owning the VEN pair, 5 own equal counts and 6 only one side (32 Shadow Clone vs 9 Tentacle copies). Of 9 users owning the UNL pair, 4 are equal and 4 own one side. Across all 126 token printings, each of which is one side of a physical card, users hold 2271 copies.
- **No stored back images.** 5504 `printing_images` rows, all `front`.

## Decision Drivers

- The physical card is one indivisible unit for ownership, price, and trade. Both sides move together.
- Each side has its own short_code, public_code, art, artist, printed text, language, rarity, finish, and signed-or-not, all of which can differ between the two sides of the same physical card.
- One printed side can appear on several physical cards. An edit to that side must reach every printing it is on.
- The model must not record claims the physical product does not make. A double-sided token has no front: neither side is privileged by the rules or by the object itself, so the schema must not force an arbitrary front/back assignment.
- Invariants should be enforceable as plain database constraints. `uq_printings_identity` and `uq_printings_variant` are plain unique indexes today; their guarantees must survive the restructure.
- Users already understand "cards" (gameplay) vs. "printings" (physical). Adding a third user-facing term would be a regression.
- Avoid widespread renames of existing tables, API routes, types, and slugs unless the rename actively pays for itself.

## Considered Options

### Model shape

1. **Add `back_card_id` to `printings`.** Smallest change. Each printing still belongs to one card, but may optionally point to a second card for the other side.
2. **Two paired printings linked by `paired_printing_id`.** Keep one printing per card, add a symmetric pair link, and teach the collection write path that owning one implies owning the other.
3. **A `faces` layer joined many-to-many via `printing_faces`.** Split `printings` into a thin physical aggregator plus per-side `faces` rows; one face row can be shared between printings.
4. **A `faces` layer as plain children of `printings`.** Each face belongs to exactly one printing (`faces.printing_id`). No sharing.
5. **Shared `faces` referenced by two columns on `printings`.** A face is a printed side identity; a printing references `face1_id` and an optional `face2_id`.

### Naming (assuming a faces layer)

A. **Rename `printings` → `printing_faces`; introduce a new `printings` = physical card.** Forces a massive rename across types, repos, routes, slugs, and tests.
B. **Keep `printings`; introduce `physical_printings` (with `physical_printing_faces`).** Minimal renaming, but the more important entity gets the longer, compound name.
C. **Keep `printings`; introduce `print_units`.** Short and abstract. "print" vs "printing" is one letter apart and gets misgrepped.
D. **Keep `printings` (narrowed schema); introduce `faces` as internal-only.** Names match the existing user-facing vocabulary; "face" never surfaces to users.

## Decision Outcome

**Model shape: shared faces referenced by two columns (option 5).** A face is one printed side, identified by its printed attributes; a printing is one piece of cardboard with one or two faces. The catalog already holds sides printed on several physical cards (SGN-T01 and SGN-T02 Bird), and any token side can recur across a set's printings, so sharing has to be supported, and option 4 would duplicate those sides and break the identity indexes. Option 5 shares faces with plain indexes on both levels: face identity on `faces`, "no two printings with the same sides" as `UNIQUE (face1_id, face2_id, size)` on `printings`. Option 3 shares too, but its printing-level uniqueness sits behind a join where no index reaches.

**Card links through the faces.** A printing's cards are the cards of its faces. No table stores them separately; tables that name a card and a printing reference each on its own.

**Slugs: one per printing.** `printings.slug` is unique across the catalog and valid under the path of each card on the printing.

**No front/back.** `face1_id` and `face2_id` mean display order and nothing else. `face1` is the side whose printed collector code sorts first, derivable from the product with no human judgment.

**Naming: keep `printings`, introduce `faces` as an internal-only term (option D).** OpenRift already uses `cards` and `printings` precisely in the UI: cards are the gameplay-level identity, printings are the physical thing users own and see. The narrowing of the `printings` table matches the meaning users already attach to the word. `faces` never appears in user copy, and neither do "front" or "back".

### Consequences

- Good, because user-facing vocabulary is unchanged and the cards-vs-printings distinction users already understand is preserved.
- Good, because a side printed on several physical cards exists once: one row, one set of images, one edit.
- Good, because both identity indexes port to `faces` as plain unique indexes, and printing identity is a plain unique index on `printings`.
- Good, because the model has no derived tables: a printing's cards are read from its faces.
- Good, because existing printing URLs carry over unchanged: no current slug is shared by two cards, so the per-card slugs are already unique across the catalog.
- Good, because attributes live at their correct level: gameplay properties on `cards`, printed-side properties on `faces`, physical-product properties on `printings`, ownership on `copies`.
- Bad, because a face is shared mutable state: an edit to SGN-T01 Bird changes two physical cards. Intended, but the admin pages must show every printing a face is on.
- Bad, because a trigger on `deck_cards`, not a foreign key, guarantees that a deck slot's preferred printing shows the slot's card.
- Bad, because "faces of a printing" reads two columns, so queries union or join twice.
- Bad, because `printings` keeps its name but most of its columns move down to `faces`: developers with the old mental model will reach for `printings.short_code` and find it gone.
- Bad, because the client dataset shape changes to one entry per printing side, and any surface that counts printings must count distinct `printing_id`.

### Confirmation

- Schema review against `docs/schema.sql` after the migration: `printings` reduced to the physical-product set plus `face1_id`/`face2_id`; `faces` holds the printed-side set and both identity indexes; `printings.slug` is unique; markers live only in `faces.marker_slugs`; `printing_images` renamed to `face_images` keyed by `face_id`.
- Repository-level audit: no callsite reads moved columns from `printings` directly.
- User-facing copy audit: "face", "front", and "back" appear in no user-visible string for this feature; pairing copy is neutral ("double-sided, with Bird").
- Functional check: importing SGN T01+T05 and T01+T03 yields three faces and two printings sharing the Bird face; the owned Bird count sums copies of both printings; a Buff // Buff copy counts once for Buff.

## Design Decisions

### The layers

```
cards  ←  faces  ←  printings  ←  copies
              (face1_id, face2_id)
```

- **`cards`** (existing, unchanged): abstract gameplay identity. One row per card name. Holds gameplay properties.
- **`faces`** (new): one printed side. Points to exactly one card (`card_id`). Can be referenced by any number of printings.
- **`printings`** (existing, schema thinned): the physical piece of cardboard. References one or two faces. Unit of ownership, price, and trade.
- **`copies`** (existing, unchanged): one row per physical card a user owns. References `printing_id`. Ownership semantics unchanged.

### Attribute placement

| Table       | Columns                                                                                                                                                                                                                                                                                |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cards`     | (unchanged)                                                                                                                                                                                                                                                                            |
| `faces`     | card_id, set_id, short_code, public_code, art_variant, artist, printed_name, printed_rules_text, printed_effect_text, flavor_text, language, rarity, printed_year, finish, is_signed, is_overnumbered, marker_slugs, fallback_art_mode, fallback_image_file_id, comment, → face_images |
| `printings` | face1_id, face2_id, slug, size, released_at, release_precision, announced_at, comment                                                                                                                                                                                                  |
| `copies`    | (unchanged)                                                                                                                                                                                                                                                                            |

Everything printed on a side moves to `faces`: set, codes, art, artist, printed text, language, rarity, year, finish, signed and overnumbered status, markers, and the fallback-art choice. The set is part of the printed collector code (every printing's set matches its code prefix), so a printing with an SGN side and an OGN side has one face in each set. Rarity is printed via a symbol on each side; language and printed year are per side too.

`printings` keeps the physical product: size and release dates. Which product a printing shipped in stays in `product_printings` and `printing_distribution_channels`. `comment` exists on both levels: `faces.comment` for side notes (art, "never foil"), `printings.comment` for notes about the physical card. Prices live in `marketplace_product_prices` via `marketplace_product_variants`, both keyed per physical printing, and are untouched.

A printing has no stored finish. Where a physical finish is needed (marketplace variant matching, prices), it is foil if any face is foil.

### Display order, not front/back

A double-sided token has no front. Neither the rules nor the physical object privileges a side, so any front/back assignment would store an arbitrary decision as if it were a fact. The face columns therefore mean display order only:

- `face1` is the side whose printed collector code sorts first, ties broken by face id. A `BEFORE INSERT OR UPDATE` trigger on `printings` puts the two face columns in this order, so a pair has one column order and the printing identity index sees it once.
- Single-sided printings have `face2_id` null.
- The display name of a double-sided printing joins both card names in display order with " // " ("Bird // Gold").
- User copy describes the pairing neutrally: a card's printings list annotates a double-sided entry as "double-sided, with Bird", never "back of Bird".

### Shared faces

SGN-T01 Bird is one printed side on two physical cards, and any token side can recur the same way. Sharing is therefore the model, not an optimization:

- One face row per printed side. Every printing it is on references it.
- Editing a face edits every printing it is on. The admin face panel lists those printings.
- Deleting a face referenced by any printing is refused by the FKs.

### Identity constraints

Today `uq_printings_identity` is `UNIQUE NULLS NOT DISTINCT (card_id, short_code, finish, marker_slugs, language, size)` and `uq_printings_variant` is `UNIQUE (short_code, art_variant, is_signed, is_overnumbered, marker_slugs, rarity, finish, language, size)`, both on `printings`. Other work (ADR-015) leans on "finish is part of a printing's identity".

Both port to `faces` without `size`. Since a shared side is one face row, they hold for SGN-T01 and every other recurring side. Printing identity becomes `UNIQUE NULLS NOT DISTINCT (face1_id, face2_id, size)` on `printings`.

`size` stays on `printings`. If an oversized variant ever shares every printed attribute with a standard side, it shares the face, and the printing index tells the two products apart by `size`.

### Card links and slugs

A printing's cards are the distinct cards of `face1` and `face2` (Buff // Buff has one). "Every printing of Bird" is `faces` where `card_id` is Bird, joined to `printings` on `face1_id` or `face2_id`; both columns are indexed. `uq_printings_id_card` and the composite FKs onto it go away.

Printing URLs stay `/cards/$cardSlug/$printingSlug`:

- `printings.slug` is `UNIQUE` across the catalog and replaces `uq_printings_card_slug`. A double-sided printing has one slug, valid under each of its cards: P2 Bird // Gold is `/cards/bird/<slug>` and `/cards/gold/<slug>`.
- The route resolves the slug to a printing and checks that the card is on one of its faces. Any other combination, an unknown slug included, 301s to the bare card page, as an unknown slug does now.
- `printings_set_slug` generates the slug on insert and again when a printing's faces change. The base joins language, the faces' collector codes in display order, physical finish, markers and size (`en-unl-t02-unl-t05-normal-standard` for a double-sided printing, today's form for a single-sided one), with the existing `-2` suffix on collision.
- Printing URLs are not canonical (the canonical URL and the sitemap use the bare card page), so a slug that goes away costs a redirect, not a search listing.

### Image storage

`printing_images` is renamed to `face_images` and re-keyed to `face_id`. The `face` text column (`'front' | 'back'`) goes away: the face row is the discriminator, and current data holds no back-face images (5504 front rows, zero back, 2026-10-18). A shared face's images appear on every printing it is on. Foil and non-foil are separate faces with their own `face_images` rows; when they share a scan they may point at the same `image_file_id`.

### Client dataset shape

ADR-009 ships the catalog to the browser and filters client-side, today as one entry per printing carrying the printed attributes. That shape becomes one entry per printing side:

- A single-sided printing produces exactly today's entry.
- A double-sided printing produces two entries, each carrying its face's printed attributes plus the pairing (the shared `printing_id`, the paired card's name, its display position, and the printing slug).
- An entry has no `id`. It carries `printingId`, `side` (1 or 2), `faceId` and, when double-sided, `otherSide` (the other side's card and image). Lookups by printing id answer with side 1, list keys use the side key (`<printingId>` or `<printingId>:2`), and a lookup that knows the card picks the side showing it.
- On the wire the catalog map stays keyed by printing id. The value holds side 1 and nests side 2 as `side2` with only its printed attributes; `faceId` is omitted when it equals the printing id, which holds for every printing created as single-sided, so single-sided printings cost no extra bytes. Endpoints that return arrays send one element per side with `otherSide` filled in by the server.
- Filters (language, rarity, finish, ...) keep operating per entry unchanged, and both sides become searchable, which is requirement 1.
- Owned counts key on `printing_id`, so both entries of one printing show the same count. Any surface that counts printings, copies or value (stats, totals, "N printings" badges, collection value) must count distinct `printing_id`, not entries.

### Thumbnails

A card's thumbnail is the image of its face on whichever printing the existing printing-selection rules pick. Display order never enters the choice.

### Materialized views

- `mv_printing_foil_twins` stays per printing: a non-foil printing has a foil twin when a foil printing of the same size has faces that match its faces in every identity attribute except finish.
- `mv_printing_sides_canonical_rank` ranks printing sides, keyed by `(printing_id, position)`, using that side's face for the printed sort keys, its set included.
- `mv_daily_printing_prices` and `mv_latest_printing_prices` stay per printing.

The view `printing_sides_ordered` replaces `printings_ordered`. It has one row per printing side: the printing's columns, the side's `position` (1 or 2), its face's columns, `canonical_rank` and `has_foil_twin`. Per-card reads ("every printing of Bird", canonical printing, thumbnails) go through it. Per-printing reads join `printings` to `faces` on `face1_id`.

### User-facing vocabulary

Unchanged. Users continue to see:

- **"card"** = gameplay identity (`cards` row).
- **"printing"** = physical product (`printings` row).
- **"copy"** = an instance they own (`copies` row).
- **"face"**, **"front"**, **"back"** = never appear in user copy.

What changes for users:

- Card detail pages list every printing the card is on, with double-sided entries annotated with their pairing.
- Printing detail pages for double-sided tokens render both sides side-by-side or with a flip toggle.
- Aggregate counts ("how many Birds do I own") include every physical card with a Bird side.

### Admin UI changes

- **Cards list page**: unchanged.
- **Card detail page**: the printings list annotates double-sided printings with their pairing.
- **Add printing flow**: the form creates the printing's own side and can pick an existing side, by its code, as the second. Single-sided printings look as before. Picking an existing face is how a recurring side is reused. A second side that does not exist yet is added as a printing of its card first.
- **Printing detail page**: for two-faced printings, renders both sides with their own face-edit panels. Each panel lists the other printings that share the face.
- **Printing Desk (ADR-047) and the card admin pages**: edit printed attributes per face and physical attributes per printing.
- **Candidate review queue**: `candidate_printings` keeps one row per source product. "Add double-sided" accepts a candidate as a printing whose other side is an existing side picked by its code, which is how a candidate named "Bird // Gold" is accepted.

## Pros and Cons of the Options

### Option 1: `back_card_id` on `printings`

- Good, because the migration is trivial (one nullable column) and renames nothing.
- Bad, because the second card has no printing of its own, so searching it, computing its owned count, or showing it in the card list requires a permanently different code path.
- Bad, because the second side's printed attributes (code, finish, art) have nowhere to live.

### Option 2: Paired printings via `paired_printing_id`

- Good, because each card keeps its own searchable, ownable printing row, and the migration is small. It is also how the catalog models the 39 commented pairs today, minus the link.
- Bad, because the two printing rows for one physical card duplicate every physical field (size, release dates, price linkage), risking drift.
- Bad, because the collection write path must enforce "owning one implies owning the other" in application code. The current data shows users tracking one side only.
- Bad, because a side on several physical cards needs one printing per card anyway, each duplicating that side.

### Option 3: `faces` layer with `printing_faces` join

- Good, because shared sides exist once, as in option 5.
- Bad, because "no two printings with the same face set" is an aggregate condition that no index can express.
- Bad, because every read path pays the join.

### Option 4: `faces` as children of `printings`

- Good, because a face belongs to one printing, so there is no shared mutable state.
- Bad, because shared sides (SGN-T01, SGN-T02 and any other recurring side) become duplicate rows, and the ported identity indexes reject them.
- Bad, because editing a shared side means finding and editing every duplicate.

### Option 5: shared `faces` with two columns on `printings` (chosen)

- Good, because shared sides exist once and every identity rule is a plain index.
- Bad, because the faces of a printing are read from two columns.

### Naming sub-options

The chosen sub-option (D, keep `printings`, add `faces` as internal-only) matches the existing vocabulary at no rename cost: no existing API routes, slugs, types, or fixtures change name, only column placement.

Option A (rename `printings` → `printing_faces`, new `printings` = physical) comes at very high rename cost across the entire codebase, including URL slugs that are user-visible.

Option B (`physical_printings`) was rejected because the more important entity (the unit of ownership) shouldn't have the longer, awkward compound name.

Option C (`print_units`) was rejected because "print" vs "printing" is one letter apart and would be misread, misgrepped, and mistyped indefinitely.

## Schema

Summary of migration 337. The full DDL is in `docs/schema.sql`.

```
cards            (unchanged)
faces            id, card_id, set_id, short_code, public_code, art_variant,
                 artist,
                 printed_name, printed_rules_text, printed_effect_text,
                 flavor_text, language, rarity, printed_year, finish,
                 is_signed, is_overnumbered, marker_slugs, fallback_art_mode,
                 fallback_image_file_id, comment, created_at, updated_at
                 UNIQUE NULLS NOT DISTINCT (card_id, short_code, finish,
                                            marker_slugs, language)
                 UNIQUE (short_code, art_variant, is_signed, is_overnumbered,
                         marker_slugs, rarity, finish, language)
printings        id, face1_id NOT NULL → faces, face2_id → faces,
                 slug, size, released_at, release_precision, announced_at,
                 comment, created_at, updated_at
                 UNIQUE NULLS NOT DISTINCT (face1_id, face2_id, size)
                 INDEX (face1_id), INDEX (face2_id)
face_images      (renamed from printing_images) id, face_id, is_active,
                 image_file_id, created_at, updated_at
copies           (unchanged)
```

Constraints worth specifying at schema time:

- `printings.slug` is `UNIQUE`.
- `faces (id, card_id)` is `UNIQUE`, as the FK target of a deck cover's `(cover_face_id, cover_card_id)`. It arrives with the cover column.
- `faces.marker_slugs` holds markers sorted and deduplicated. A trigger rejects unknown slugs, deleting a marker in use is refused, and a marker slug rename rewrites the arrays.
- The face check constraints (`chk_printings_*` on printed columns and fallback art) move with their columns.
- `face_images` unique indexes mirror today's `printing_images` indexes, keyed by `face_id`, minus the dropped `face` column.

## Migration shape

Three separate changes. The schema migration is mechanical and changes no behaviour. The double-sided features make the code handle two sides. The pair merge is a data migration that needs curated input.

### Schema migration

1. Create `faces` and `face_images`.
2. Backfill: one face per existing printing with the moved columns, `face1_id` pointing at it, its `printing_images` rows re-keyed to `face_images` (current data holds zero back images, so the mapping is 1:1). Printings whose printed attributes are identical share one face (the standard and oversized printing of a battlefield). `printing_markers` is dropped, and `faces.marker_slugs` carries the markers.
3. Drop `fk_deck_cards_printing_card` and `fk_decks_cover_printing_card` (the write paths check the pair); drop `card_id` from `loans` and `card_trades`; drop `deck_check_entry_cards.resolved_printing_id`; drop `uq_printings_id_card`, and replace `uq_printings_card_slug` with `UNIQUE (slug)`.
4. Port the identity indexes and the two printed-attribute materialized views.
5. Drop migrated columns from `printings`; drop `printing_images`.
6. Update repositories (`apps/api/src/modules/*/repositories/`), server functions, route handlers and `packages/shared` types to read through `faces`.
7. Regenerate `docs/schema.sql` (`bun db:schema`).

After this every printing has one face, so the catalog payload and every page behave as before.

### Double-sided features

1. The catalog payload and every array endpoint switch to one entry per printing side, as described under Client dataset shape.
2. `decks.cover_printing_id` becomes `cover_face_id`, backfilled from the face of the cover printing that shows the cover card. `(cover_face_id, cover_card_id)` references `faces (id, card_id)`.
3. A `deck_cards` trigger rejects a preferred printing that does not show the slot's card on a face.
4. `printings_set_slug` regenerates the slug when a printing's faces change.
5. Matching goes through both faces: trade matching, list moves, owned counts per card and collection completion count a double-sided copy for the card on each side, and once for a card on both sides.
6. Card pages annotate double-sided printings, and the card page links to the other side.
7. The Printing Desk and the candidate queue create double-sided printings by picking an existing side as the second side. The desk edits each side in its own panel and lists the other printings that show it.

### Pair merge

Input: a curated list of physical printings per set, each naming its two sides by today's single-sided printings. The 39 commented printings and the candidate sources' " // " names are the starting point; the regular-token combinations vary by set and are assigned by the catalog maintainer.

The list also gives every existing single-sided token printing exactly one **home**, the physical printing its copies and references move to:

- A side printing that the list puts on one physical printing has that printing as its home.
- A side printing that the list puts on several (SGN-T01 Bird) gets a home chosen by the maintainer, by default the physical printing that marketplaces sell under that side's name.

Per set, in one transaction:

1. Create the faces and the two-faced printings. A side on several printings reuses one face.
2. Each merged printing gets its slug from `printings_set_slug`.
3. Move every copy of each side printing to its home, with collection events recorded. The copies of both sides of a pair add up.
4. Move each side printing's `marketplace_product_variants` to its home, unless the list maps the listing to another printing. Drop duplicates when both sides map to the same product, and re-check the foil/non-foil match against the derived physical finish.
5. Re-key every other reference to a side printing (collection events, list entries, deck-slot preferences, trade suggestion dismissals) to its home.
6. Delete the side printings. Their URLs 301 to the card pages.

Owners of copies that came from a side on several printings get a notice: the copies sit on the default printing and can be moved to the right one.

Afterwards every printing is a physical card that exists, and no single-sided token printing remains.

### Adjacent tables

Every `printing_id` consumer in today's schema:

- **Stay per-physical, keyed on `printing_id`, untouched:** `copies`, `collection_events`, `list_entries`, `product_printings`, `marketplace_product_variants` (and through it `marketplace_product_prices`, `marketplace_product_card_overrides`), `printing_link_overrides`, `printing_sources`, `printing_distribution_channels`, `printing_events`, `printing_citations`, `cardmarket_sync_state`, `trade_suggestion_dismissals`, `meta_event_player_overlay_cards.preferred_printing_id`.
- **Card and printing as separate FKs:** `deck_cards`. The card is the slot (legality, copy limits, missing counts); the printing is the user's optional preferred version, which drives the slot's price and splits a slot by version. `card_id → cards` and `preferred_printing_id → printings` stay; the composite `fk_deck_cards_printing_card` goes. A trigger on `deck_cards` rejects a preferred printing without the slot's card on a face, and `use-deck-ownership.ts` already falls back to the default printing when the preferred one is not among the card's printings.
- **Printing replaced by a face:** `decks.cover_printing_id` becomes `cover_face_id`. The cover is an image, and a face determines both its art and its card. `(cover_face_id, cover_card_id)` references `faces (id, card_id)`; a null face means the card's default art.
- **Printing dropped, computed at read time:** `deck_check_entry_cards.resolved_printing_id`. Nobody chooses it: card resolution stores the card's canonical printing as a thumbnail. The legend fan and the meta archive handoff (`authenticated-tournament-archive-lists.ts`, which passes it on as the preferred printing) look up the canonical printing of `resolved_card_id` when they read.
- **Per-physical, `card_id` dropped:** `loans`, `card_trades`. Their `card_id` is copied from `printings.card_id` when the row is written. A Bird // Gold printing is both a Bird and a Gold, so one stored card undercounts it. Borrowed counts per card (`borrowedCountByCard`) and trade matching against card wants (`friend-group-matches-view.ts`, keyed on the supply printing's card) go through the printing's faces. The wish a trade fulfils stays reachable through `receiver_wish_entry_id`.
- **Per-face:** markers are printed on a side, so they are `faces.marker_slugs`. `printing_markers` and `recompute_printing_marker_slugs` go away.
- **Follow their column to `faces`:** `art_variants` is the lookup table behind `art_variant`, so its FK moves with the column.
- **Unaffected:** `card_errata` is keyed on `card_id`, and `candidate_printings` and `ignored_candidate_printings` keep their shape (see Admin UI changes).

## More Information

- ADR-005 (Collection Tracking Data Model) defines `copies` and the event-based ownership ledger that this change must remain compatible with. No changes to `copies` semantics are required; the pair merge writes collection events for every moved copy.
- The decision to keep `printings` as the table name is conditional on the user-facing vocabulary staying as it is today.
