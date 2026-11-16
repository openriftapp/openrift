---
status: accepted
date: 2026-11-16
---

# ADR-056: Booster Packs as Products with Slots and Rates

## Context and Problem Statement

A card page's "Found in" row lists fixed-content products (`product_printings`, ADR-015) and distribution channels. Most printings come from booster packs, and nothing records that, so 7,894 main-set printings show no source at all. The pack opener (`packages/shared/src/pack-opener/`) knows about boosters only through hardcoded rates in `rates.ts` and a pool of marker-free printings, and shares nothing with the catalog. How do we record what booster packs contain and how often, so that card pages, a booster product page and the pack opener all state the same thing?

Riot publishes the pack layout for Origins, Unleashed, Vendetta and Radiance: 14 cards, as 7 Common, 3 Uncommon, 1 Foil (Common, Uncommon, Rare or Epic), 2 Rare or better and 1 Rune or Token, plus an informational insert that is not a card. The Unleashed and Vendetta overviews name what the Rare slots hold (Rare, Epic, Alt, Special Alt, Overnumber, Ultimate); the Origins article says only "Rare (or better)", and Spiritforged has no published list. Radiance is the one documented change: only one of its two Rare slots can hold premium printings, the other is Rare or Epic. Riot publishes rates only for Origins (Epic about 1 in 4 packs and about 6 per box of 24, alt art about 2 per box, Overnumbered about 1 in 3 boxes, Signature about 1 in 10 Overnumbered), for the Ultimate Rare in Unleashed (under 0.1% of packs) and Radiance (about 0.025%), and the statements that Vendetta's Crystal Rose and Radiance's special alt arts are about as common as their sets' alt arts. Packs never hold more than one Ultimate. How often the Foil slot holds a Rare or an Epic, and how often the Rune slot holds a token or an alt-art Rune, is not published for any set.

## Decision Drivers

- Card pages, the booster product page and the pack opener must show the same numbers.
- A number Riot did not publish is labelled as such wherever it appears.
- No hand-maintained list of booster printings. The catalog already records which printings come from products and events.
- A printing can come from a pack and from a fixed product. Commons in a Champion Deck are also in boosters.

## Considered Options

- Booster definitions in shared code, merged into the product pages
- Booster product rows in the database, slots and rates in shared code
- Booster products, slots and rates all in the database
- Link booster printings to a `booster` distribution channel

## Decision Outcome

We define booster packs in a typed constant in `packages/shared` and merge them into `/products`. One resolver in the same package turns a booster, a language and printings into pools and per-printing rates, and the API and the pack opener both run it. Rates change about once per set, so a release per set is cheap, and keeping boosters out of the database leaves nothing to keep in step: no product row, slug, filter language, editor, trigger or endpoint.

### Booster definitions

`BOOSTERS` maps a booster slug ("radiance-booster-pack") to:

- its set and its languages, each with `packsPerBox`, `boxesPerCase` and an optional basis cap. Origins and Spiritforged list EN, FR, KR, SC and TC, Unleashed and Vendetta EN, FR, KR and SC, Radiance EN and SC. The English box holds 24 packs and the case 6 boxes; the SC Origins box holds 12. We take 12 for every SC and TC box, 24 for KR, and 6 boxes per case everywhere. SC, TC and KR cap the basis at `estimate`, because Riot's figures do not cover those packs.
- a `layoutBasis`: `official` where Riot published the layout, `estimate` for Spiritforged.
- its slots, each with a slug, a slot count and outcomes. An outcome has a slug, a typed predicate over a printing, a rate per pack, an optional `bound: "max"`, a `fillsRest` flag (one per slot), a basis and an optional `cards`: only the slot's last `cards` cards can hold it.
- an `acknowledged` list of short code and language pairs the admin pool page stops listing, keyed by the language where the gap shows.

Basis is `official`, `estimate` (an Origins rate carried to another set, or a ratio Riot published) or `guess` (our number where Riot published none). Every outcome has a rate. A fill outcome has no rate of its own: it takes the slot count minus its siblings and the weakest basis among them. A sibling whose pool is empty has a rate of 0 and hands its share to the fill, on the card page, the product page and in the opener alike.

Slot, outcome and booster names reach the web as slugs and are rendered through translated messages.

### Pools

The resolver takes one input type, a printing with every face's types and super types, its size, markers and channels, and one adapter folds the `Printing` sides of the catalog response (API) or a set detail (web) into it. A printing's channel links carry `ancestorSlugs` next to `ancestorLabels`, so both can tell a channel under `booster`.

For a booster and a language, an outcome's pool is the printings of the booster's set in that language with `size = 'standard'` that match its predicate. Predicates check types and super types on every face, so a token stays a token when its first face is a buff (VEN-T01, RAD-T04). Outcomes inside a slot must not overlap, so each predicate excludes its siblings: alt art excludes Overnumbered, Overnumbered excludes Ultimate.

Printings with a marker or a distribution channel are left out, with one exception. A printing whose channel sits under the `booster` channel joins the pack of its own set and language, markers or not, in the outcome its predicate matches, and shares that outcome's rate. It stays on the promos page through its channel. Today these are the KR signed Nine-Tailed Fox (OGN-303a), a 13th Korean Signed Overnumbered, and two SC tokens, Bird (UNL-T02) and the alt-art Shadow Clone (VEN-T05). The admin pool page lists them, and leaves them out of the short codes missing in other languages.

A booster in a language shows odds and opens only when every fill pool has printings. Spiritforged in TC has no Runes, so it has neither.

A read-only admin page (`/admin/booster-pools`) runs the resolver and lists main-set printings that no outcome, marker, channel or product reaches, in-slot overlaps, and short codes present in one language's slot pool and missing from another's, minus the `acknowledged` list. It reads product membership from `GET /api/admin/v1/products/printing-ids`.

### Rates

- Origins uses Riot's figures. "Epic about 1 in 4 packs" is read as 0.25 Epics per pack, which matches about 6 per box. The Epic outcome in the Rare slots carries that rate. The Foil slot's upgrade to Epic is a separate `guess` on top, so a pack averages 0.26 Epics, which community box counts of about 27% per pack support.
- Premium printings sit in the Rare slots in every set. For Origins and Spiritforged that reads "Rare (or better)" the way the later overviews spell it out. Spiritforged, Unleashed and Vendetta copy the Origins slots, with `estimate` rates.
- Radiance keeps the two Rare slots. Epic stays at 0.25 per pack across both, and its premium outcomes have `cards: 1`, so only the second Rare card can hold one.
- The Ultimate Rare is an outcome of the Rare slots. Radiance's 0.025% is `official`. Unleashed's "under 0.1%" is `official` with `bound: "max"`, shown as "at most 1 in 1,000 packs" and simulated at the bound. Both Ultimate outcomes have `cards: 1`, so a pack holds one at most. No Radiance printing is catalogued as Ultimate yet, so its outcome shows as not available.
- Vendetta (6 per language) and Radiance (5 per language) have "SP" showcase printings that are neither alt art, Overnumbered nor signed. They are Vendetta's Crystal Rose cards and Radiance's special alt arts, at the alt-art rate, as `estimate` in both.
- Where Riot published nothing, we set a `guess`: Foil slot upgrade to Rare 1 in 25 packs, upgrade to Epic 1 in 100, token 70% of packs, alt-art Rune 5%, Rune the remaining 25%, rounded from our own openings of about 2.5 Radiance cases and applied to every set. The Foil slot weights Commons and Uncommons by pool size, which is also a guess.
- Other counts from community box openings are not used. They come from samples of 90 to 330 packs, mostly from boxes sent to content creators.

Origins, English:

| Slot               | Outcome                 | Predicate                                                   | Pool | Rate                  | Basis    |
| ------------------ | ----------------------- | ----------------------------------------------------------- | ---- | --------------------- | -------- |
| Common × 7         | Common                  | common, normal finish, normal art, no Rune or token face    | 78   | 7 per pack            | official |
| Uncommon × 3       | Uncommon                | uncommon, normal finish, normal art, no Rune or token face  | 84   | 3 per pack            | official |
| Foil × 1           | Upgrade to Epic         | epic, foil, normal art, not Overnumbered                    | 42   | 1 in 100 packs        | guess    |
|                    | Upgrade to Rare         | rare, foil, normal art, not Overnumbered                    | 84   | 1 in 25 packs         | guess    |
|                    | Foil Common or Uncommon | common or uncommon, foil, normal art, no Rune or token face | 162  | fills the rest (0.95) | guess    |
| Rare or better × 2 | Signed Overnumbered     | Overnumbered, signed                                        | 12   | 1 in 720 packs        | official |
|                    | Overnumbered            | Overnumbered, not signed, not Ultimate                      | 12   | 1 in 80 packs         | official |
|                    | Alt art                 | alt art, not Overnumbered, no Rune or token face            | 24   | 1 in 12 packs         | official |
|                    | Epic                    | epic, foil, normal art, not Overnumbered                    | 42   | 1 in 4 packs          | official |
|                    | Rare                    | rare, foil, normal art, not Overnumbered                    | 84   | fills the rest (1.65) | official |
| Rune or Token × 1  | Alt-art Rune            | Rune face, alt art                                          | 6    | 1 in 20 packs         | guess    |
|                    | Token                   | token face, not signed                                      | 4    | 0.7 per pack          | guess    |
|                    | Rune                    | Rune face, normal art, normal finish                        | 6    | fills the rest (0.25) | guess    |

### Card page and product surfaces

"Found in" lists booster entries first, one line per slot a printing can come from, each with its own badge: "Origins Booster Pack › Rare or better · 1 in 7 boxes" for an Epic. The booster name links its product page in the printing's language. Half a card per box or more reads "≈ 2.2 per box"; rarer reads "1 in N boxes", the same rule per pack and per case. A badge shows Official, Estimate or Best guess. Expanding the rate shows the outcome rate, the pool size, and per-pack, per-box and per-case figures.

The card detail contract gains flat rows next to `products`: `boosters: [{ printingId, booster, slot, outcome, outcomePerPack, bound, poolSize, basis, packsPerBox, boxesPerCase }]`, one per printing and outcome. The response stays one cached document for all languages. `/products` lists the boosters in their own group, covered by the English pack's alt arts that `GET /products` returns per booster, and `/products/$slug` for a booster shows its slots, outcomes, rates and pools, with a language switch. Next to each rate it shows the outcome's share of its slot, so a slot's outcomes add up to 100%.

### Pack opener

The opener runs the resolver over the set's catalog data it already loads and offers only languages that can open. For each slot in a pack it rolls the slot's outcomes by rate divided by slot count, the fill takes the remainder, and it picks a printing evenly from that pool, never one already in the pack. A rolled outcome with an empty pool hands its slot to the fill. Each Rare slot rolls on its own, so outside Radiance a pack can hold two premium printings.

This replaces `rates.ts`, `buildPool`, `isPoolOpenable` and the marker filter. Compared with them, premium printings sit in a Rare slot, Epics average 0.25 per pack (0.27 before), unsigned Overnumbered is 1 in 80 packs (1 in 72 before), the Foil slot has no Epic and no 70/25 split, foil normal-art Runes are gone (none exist), token printings with a buff face count as tokens, and alt-art Runes sit in the Rune slot. Alt-art Runes are `rarity = showcase, finish = foil`, so `buildPool` files them under alt art (Origins pool 30 instead of 24) and never applies the alt-art Rune rate.

### Consequences

- Good, because card pages, the product page and the opener run one resolver over one rate table.
- Good, because pools need no maintenance: giving a printing a marker or a channel removes it from every pack.
- Good, because there is no schema change.
- Bad, because a promo with neither marker nor channel lands in a pack pool. The admin pool page surfaces it, and the fix is the missing link.
- Bad, because a contributor with the Printing Desk grant who adds a channel to a main-set printing removes it from pack pools. The desk edit form shows the printing's booster odds now and after saving, and warns when a change takes it out of every pack.
- Bad, because a rate correction needs a release.
- Bad, because sets after Origins show Origins numbers as estimates until Riot publishes their own, and the guesses may be far off.
- Bad, because per-printing odds assume every printing in an outcome is equally likely.

### Confirmation

Unit tests run the resolver over fixture printings, one per row of the Origins table plus an oversized Uncommon, a Nexus Night foil, an Arcane Box Set alt art, a buff-faced token, an SC token under a booster channel, an alt-art Overnumbered, and a language with an empty Rune pool. A second set of unit tests checks the sampler's long-run frequencies against the rates.

## Pros and Cons of the Options

### Booster definitions in shared code, merged into the product pages

- Good, because predicates are typed code that the API and the opener share.
- Bad, because `/products` merges two sources.

### Booster product rows in the database, slots and rates in shared code

- Good, because boosters are ordinary products.
- Bad, because the row holds nothing the constant lacks, and the constant would be keyed by a slug that admins can rename (ADR-015).
- Bad, because product surfaces assume contents (card counts, cover printings, snapshot from a list) that a booster has none of.

### Booster products, slots and rates all in the database

Slots and outcomes as tables with jsonb filters, edited in admin.

- Good, because a rate correction is an admin edit.
- Bad, because it needs four tables, a filter language with a CHECK, an editor, catalog version triggers on each table and an endpoint for the opener.

### Link booster printings to a `booster` distribution channel

One child channel per set and region under `booster`, backfilled by a script, with odds hints in `distribution_note`.

- Good, because the card page, admin and promos page already render channels.
- Bad, because rates would be free text, so the pack opener could not use them.
- Bad, because every new set needs a backfill of thousands of links.

## More Information

This extends ADR-015's product pages to a second kind of product without adding a kind column. Packs inside fixed products (the Vendetta Showdown Deck holds 2) are not modelled.
