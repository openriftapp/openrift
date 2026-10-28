---
status: accepted
date: 2026-10-28
---

# ADR-054: Scryfall-Style Card Search Syntax

## Context and Problem Statement

The card search box takes free text plus eight field prefixes (`n:`, `d:`, `k:`, `t:`, `a:`, `f:`, `ty:`, `id:`), parsed by `parseSearchTerms` in `packages/shared/src/filters-search.ts`. A prefix only narrows which text field a term matches. Everything structured (domain, energy, might, power, price, set, rarity, bans, errata, finishes) lives in `CardFilters` and is reachable only through the filter panel. Filtered views are shareable through URL params, but nobody can type "Fury units costing 3 or less under $20" into the box.

Scryfall's syntax is what TCG players already know, and other Riftbound tools adopt it. Four of our prefixes mean something else there: `t:` is type (ours: tags), `d:` is domain in the Riftbound adaptation (ours: card text), `f:` is format (ours: flavor text) and `id:` is color identity (ours: collector code). A query copied from another tool silently returns the wrong cards here.

Which query language does the search box speak, and how does it relate to the filter panel?

## Decision Drivers

- A query that works on another Riftbound tool returns the same cards here.
- Every panel filter is expressible as text, so a search is one line to type, share or bookmark.
- One implementation in `packages/shared` serves the web app, a future API search endpoint and the Discord bot.
- Old shared links keep working.

## Considered Options

1. **Extend the current prefixes**: add comparisons and new keys, keep today's letters.
2. **Scryfall syntax adapted to Riftbound**: standard keys where the concept exists, our own keys only for Riftbound concepts, renames where we collide.
3. **No text syntax**: keep structured search in the panel only.

## Decision Outcome

We adopt Scryfall's syntax adapted to Riftbound. It is the only option that meets the first driver, and the four renamed and three removed prefixes are a one-time cost that a legacy URL translator absorbs.

### Keys

Keys are case-insensitive. Text keys take `:`. Numeric and ordered keys take `:`, `=`, `!=`, `<`, `<=`, `>`, `>=`, and `:` on them means `=`.

| Key and aliases                   | Origin   | Values                                                                                                         | Maps to                                                     |
| --------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| bare words, `"quoted phrase"`     | Scryfall | text                                                                                                           | card name, printed name, alt names                          |
| `!"Exact Name"`                   | Scryfall | full name                                                                                                      | card name, exact after folding                              |
| `t:` `type:`                      | Scryfall | unit, spell, gear, rune, battlefield, legend, champion, signature, basic, token                                | `types` + `superTypes`                                      |
| `o:` `oracle:`                    | Scryfall | text                                                                                                           | rules and effect text, errata-corrected                     |
| `kw:` `keyword:`                  | Scryfall | keyword                                                                                                        | `keywords`                                                  |
| `d:` `domain:`                    | OpenRift | domain, or a comma list (`d<=fury,chaos`)                                                                      | `domains`; `<=` keeps cards within the list                 |
| `e` `energy`                      | OpenRift | number                                                                                                         | `energy`                                                    |
| `m` `might`                       | OpenRift | number                                                                                                         | `might`                                                     |
| `p` `power`                       | OpenRift | number                                                                                                         | `power`                                                     |
| `r:` `rarity:`                    | Scryfall | common, uncommon, rare, epic, showcase (ordered)                                                               | `rarities`                                                  |
| `s:` `set:`                       | Scryfall | set code                                                                                                       | `sets`                                                      |
| `cn:` `number:`                   | Scryfall | collector code; comparisons take a number                                                                      | `shortCode`, `publicCode`; `cn>=200` compares the digits    |
| `a:` `artist:`                    | Scryfall | text                                                                                                           | `printing.artist`                                           |
| `ft:` `flavor:`                   | Scryfall | text                                                                                                           | `printing.flavorText`                                       |
| `lang:`                           | Scryfall | language code                                                                                                  | `languages`                                                 |
| `f:` `format:` `legal:`           | Scryfall | format name (`constructed`)                                                                                    | deckable and not banned in that format (new)                |
| `banned:`                         | Scryfall | format name (`constructed`)                                                                                    | banned in that format (new)                                 |
| `usd`, `eur`                      | Scryfall | number                                                                                                         | TCGplayer, Cardmarket price (new)                           |
| `price`                           | OpenRift | number                                                                                                         | favorite-marketplace price                                  |
| `is:` / `not:`                    | Scryfall | foil, metal, metaldeluxe, altart, ultimate, signed, overnumbered, oversized, plain, promo, reprint, firstprint | finish, art, flags, size, `isStandard`, markers, print run  |
| `has:`                            | Scryfall | errata, image, marker, keyword, tag                                                                            | `hasErrata`, `hasNoImage`, `presence`                       |
| `otag:`                           | Scryfall | tag                                                                                                            | `tags`                                                      |
| `marker:`, `channel:`             | OpenRift | slug                                                                                                           | `markerSlugs`, `distributionChannelSlugs`                   |
| `ctag:`                           | OpenRift | slug                                                                                                           | `customTagSlugs` (collections and decks)                    |
| `owned`                           | OpenRift | number                                                                                                         | owned count (collections)                                   |
| `year`, `date`                    | Scryfall | year, `YYYY-MM-DD`                                                                                             | printed year, set release for the printing's language (new) |
| `order:`, `direction:`, `unique:` | Scryfall | sort option, asc/desc, cards/prints                                                                            | `sort`, `sortDir`, `view`                                   |
| `prefer:`                         | Scryfall | oldest, newest, usd-low, eur-low                                                                               | which printing represents a card                            |
| `in:`                             | Scryfall | set code or language code                                                                                      | card has a printing in that set or language                 |

Every alias is Scryfall's own; no key keeps an old OpenRift prefix as an alias. Scryfall's `e:` set alias is left out because `e` is energy. A format value is the format's name, so `f:constructed`; its internal id (`standard`) also works. `f:` excludes cards that cannot go in a deck (tokens and type "other"). `pow` is not a key: Scryfall's power is a combat stat, which is might here, while Riftbound's power is a cost, so the Riftbound words win. Today's "Standard" printing filter (`isStandardPrinting`) becomes `is:plain`, and its panel chip is renamed "Plain", so it no longer reads like a format.

### Renames

| Today | Meaning today  | Moves to           | Prefix now means |
| ----- | -------------- | ------------------ | ---------------- |
| `d:`  | card text      | `o:` / `oracle:`   | domain           |
| `t:`  | tags           | `otag:`            | type             |
| `f:`  | flavor text    | `ft:` / `flavor:`  | format legality  |
| `id:` | collector code | `cn:` / `number:`  | unassigned       |
| `n:`  | name           | bare words         | removed          |
| `ty:` | type           | `t:` / `type:`     | removed          |
| `k:`  | keywords       | `kw:` / `keyword:` | removed          |

The query moves from the `search` URL param to `q`. `validateSearch` on /cards, /collections, /decks and /promos rewrites a legacy `search` value with the table above and redirects to `q`. Migration 349 rewrites the query text of saved list rules the same way.

### Semantics

- Bare words match card names only, as on Scryfall. Other text fields need their key (`o:`, `kw:`, `otag:`, `a:`, `ft:`, `t:`, `cn:`). A bare word shaped like a card number (`OGN-202`, `ogn202`, `PGN-123f`) also matches card numbers, so codes work without `cn:`. When a key-less query matches nothing, the empty grid offers the same words as a card text search (`o:`). There is no search scope menu, so a query returns the same cards for every viewer and through the API. The search box links to the help article from an icon in the field, and /developers has a query syntax section that links to it.
- Whitespace ANDs clauses. `or` and parentheses combine them: `(d:fury or d:chaos) t:unit`.
- A leading `-` negates a clause or group. `not:foil` equals `-is:foil`.
- `d:` takes one domain or a comma list. `d:fury,chaos` and `d>=fury,chaos` need both domains, `d=fury,chaos` exactly those, and `d<=fury,chaos` keeps cards that fit a Fury/Chaos deck, colorless cards included. Ticking two domains in the panel equals `d<=`.
- `cn:` matches the code as text; `cn>=200` compares its numeric part.
- `in:ogn` and `in:fr` match a card with any printing in that set or language and keep all its printings, where `s:` and `lang:` filter the printings shown. `is:reprint` marks printings in a later set than the card's first; `is:firstprint` is the opposite; `is:promo` means a printing with a marker.
- `prefer:` picks the printing that represents each card in the Cards view and in the API.
- Regular expressions are not supported, because a user-supplied pattern can stall the API.
- A card without a value for a stat never matches a comparison on it.
- `r>=rare` follows the rarity sort order.
- Text matching keeps `foldForSearch` and `squashForSearch`, so `cn:ogn001` matches `OGN-001`.
- An unknown key searches the whole token as a bare word and shows a warning. A malformed value (`e<=x`) matches nothing and shows an error.

### Implementation

The parser turns the query into a tree of `and`, `or`, `not`, `clause` and `text` nodes with source spans. A key registry holds aliases, value kind and a matcher built from `filters-predicates.ts`; the help article and autocomplete read from it. A binder resolves enum values against the catalog. The evaluator is `(printing, ctx) => boolean`, where `ctx` carries the price lookup, the keyword reverse map and, on collection routes, owned counts and custom tags. All of it lives under `packages/shared/src/search-query/` and replaces `parseSearchTerms` and `searchPrefixFields`.

The query predicate ANDs with `CardFilters`. The panel does not mirror query clauses, and the query is not rewritten when the panel changes. The search bar shows each parsed clause as a read-only chip ("type is unit", "energy 3 or less"), so a contradiction between query and panel is visible. `computeFilterCounts` applies the query as a prefilter before counting each dimension. `order:`, `direction:` and `unique:` override the URL's sort and view while present.

The keys marked "new" read data the filters ignore today: `card.bans` with its `formatId`, `PriceLookup.get(printingId, marketplace)` for a fixed marketplace, and `Printing.setReleasedAt`, which the catalog join takes from the set's release in the printing's language. `/api/v1/init` lists the ban formats as `enums.formats` for autocomplete and validation. Deckability for `f:` uses the token super type and the `other` card type, which migration 349 marks well-known.

### Rollout

1. Parser, registry, evaluator and every key backed by an existing `CardFilters` dimension or text field. Renames, `q` and the legacy translator. Clause chips and errors. The "Plain" chip rename. Autocomplete, the "Search syntax" help article and a changelog entry ship with it.
2. Format legality, `usd`/`eur`, `year`/`date`, `order:`/`direction:`/`unique:`.
3. A public `GET /api/v1/search?q=` endpoint, and a Discord bot command, both on the shared evaluator. The endpoint returns one printing per card unless the query says `unique:prints`, in the `/api/v1/catalog` shape, about 100 per page with a cursor and total count, and no prices (clients use `/api/v1/prices`). `GET /api/v1/search/named?exact=|fuzzy=` returns one card with all its printings, and `GET /api/v1/search/random?q=` one random card, both in the same shape. It evaluates against the in-memory catalog the API already caches, so a query never reaches SQL. It caps query length and node count, and it refuses an unknown value outright, where the web only warns, because an API caller sees no chips. Like the other developer endpoints, it answers browser requests from any origin (`Access-Control-Allow-Origin: *`, without credentials).

### Consequences

- Good, because queries move between OpenRift, Scryfall habits and other Riftbound tools without translation.
- Good, because every panel filter becomes typeable and fits in one shareable `q` param.
- Good, because the API and the bot get search from the same code.
- Bad, because users who typed `d:`, `t:`, `f:` or `id:` by habit get different results, and `n:`, `ty:` and `k:` stop working. Clause chips and the unknown-key warning show it.
- Bad, because a plain-word search for rules text now finds nothing. The empty-result hint offers the `o:` search.
- Bad, because panel and query can contradict each other. The chips make it visible but do not resolve it.

### Confirmation

Unit tests in `packages/shared` cover the parser (precedence, quoting, negation, spans), the evaluator for every key, the binder's diagnostics and the legacy prefix translator. `search-schemas.test.ts` covers the `search` to `q` redirect, `search-suggestions.test.ts` and `search-bar.test.tsx` the autocomplete and chips, and `catalog-search.test.ts` and `public-search.test.ts` the API endpoint.

## Pros and Cons of the Options

### Extend the current prefixes

- Good, because nobody's prefix habits change.
- Bad, because `t:`, `d:`, `f:` and `id:` keep disagreeing with every other tool, and the disagreement grows with each key added.

### Scryfall syntax adapted to Riftbound

- Good, because players arrive knowing it.
- Neutral, because Riftbound-only concepts (domain, might, power, markers, channels) still need our own keys.
- Bad, because four prefixes change meaning and three are removed.

### No text syntax

- Good, because nothing changes.
- Bad, because structured search stays mouse-only, and the API and bot have no way to express it.
