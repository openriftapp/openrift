# Data Layer

PostgreSQL database managed by Kysely migrations in `apps/api/src/db/migrations/`.

`docs/schema.sql` is the schema: a `pg_dump --schema-only` snapshot of a fresh migrate, regenerated with `bun db:schema`. Read it for tables, columns, constraints and indexes. This document holds the naming rules and the design notes the snapshot cannot express. The Kysely row types live in `apps/api/src/db/tables/`, one file per area, and are assembled in `apps/api/src/db/tables.ts`.

## Naming Conventions

| Element            | Convention                                                  | Example                               |
| ------------------ | ----------------------------------------------------------- | ------------------------------------- |
| Tables             | `snake_case`, plural                                        | `cards`, `deck_cards`                 |
| Columns            | `snake_case`                                                | `short_code`, `set_id`                |
| Primary key column | `id`, uuid (uuidv7)                                         | `id uuid default uuidv7()`            |
| Foreign key column | `{referenced_table_singular}_id`                            | `card_id`, `user_id`                  |
| User reference     | `{role}_user_id` when the role needs a name                 | `created_by_user_id`, `host_user_id`  |
| Lookup tables      | `slug` primary key, `label`, `sort_order`                   | `deck_formats`, `ban_formats`         |
| Lookup reference   | bare name or `{name}_id`, holding the slug                  | `decks.format`, `card_bans.format_id` |
| Ordering column    | `sort_order`                                                | `card_domains.sort_order`             |
| Timestamps         | `timestamptz`, `_at` suffix                                 | `created_at`, `expires_at`            |
| Monetary values    | integer cents, `_cents` suffix                              | `market_cents`, `low_cents`           |
| Boolean columns    | predicate prefix: `is_`, `has_`, `can_`, `needs_`, `allow_` | `is_signed`, `has_regions`            |
| Slugs              | URL-safe identifier, unique                                 | `slug text not null unique`           |

Constraints, indexes and triggers carry a prefix that says what they are, then the table, then the columns or the rule:

| Object       | Name                    | Example                    |
| ------------ | ----------------------- | -------------------------- |
| Primary key  | `pk_{table}`            | `pk_cards`                 |
| Foreign key  | `fk_{table}_{columns}`  | `fk_copies_printing_id`    |
| Unique       | `uq_{table}_{columns}`  | `uq_cards_slug`            |
| Check        | `chk_{table}_{rule}`    | `chk_cards_name_not_empty` |
| Index        | `idx_{table}_{columns}` | `idx_printings_set_id`     |
| Unique index | `uq_{table}_{columns}`  | `uq_face_images_active`    |
| Trigger      | `trg_{table}_{action}`  | `trg_cards_norm_name`      |

A trigger that runs a shared function on many tables keeps the function's name on each of them (`trg_set_updated_at`). Table names are written out in full, never abbreviated. Postgres truncates identifiers at 63 characters, so shorten the rule part when a name would run over.

Postgres names an unnamed constraint with its own suffix style (`cards_pkey`, `cards_slug_key`, `copies_printing_id_fkey`). Every constraint in a migration is therefore named explicitly, including primary keys and inline `REFERENCES`.

`apps/api/src/db/schema-conventions.test.ts` checks the prefixes, the boolean rule and the ordering column name against `docs/schema.sql`. Three boolean columns on the auth tables keep the auth library's names (see [Auth Tables](#auth-tables)), and `rank_is_tier` on the two meta player tables keeps its name because `rankIsTier` is also a value stored in `claimed_fields`. Both exemptions are listed in that test.

PostgreSQL folds unquoted identifiers to lowercase, so `snake_case` avoids quoting. Plural table names are used throughout, including join tables. Core tables use `uuidv7()` primary keys for sortable, globally unique ids. Auth tables use text ids.

### Column names and API field names

`CamelCasePlugin` maps a column to its camelCase property (`is_sidebar_hidden` to `isSidebarHidden`). The fields of an API response are a separate contract defined in `packages/shared`, and several keep an older name than their column (`sidebarHidden`, `darkText`, `regionsEnabled`). The repository or presenter does the mapping, with a select alias (`"isWatched as watched"`) or an explicit object. Renaming a column never renames a response field.

An object passed to `.values()` or `.set()` through a variable or a spread is not checked for unknown keys by TypeScript, and an unknown key fails only at runtime. Build those objects with the column property names, or pass an object literal.

## Design notes

### `set_releases`

One row per (set, language). An absent row means the set is not announced in that language.

There is no stored `released` flag. A set counts as released in a language once
the period its date describes has finished, derived by `isReleased` in
`packages/shared/src/set-release.ts`. A null date means announced with no date
yet, which always reads as unreleased — anything actually on shelves can be
dated to at least its year. A CHECK keeps `released_at` on the first day of its
period so the period-end maths and the display formatter never have to guess.

### Marketplace 3-level hierarchy

The marketplace domain is modelled in three levels:

1. **`marketplace_groups`** — the marketplace's own "set" concept (a group or expansion id)
2. **`marketplace_products`** — one row per upstream **SKU**: an `(external_id, finish, language)` of a listing. The finish/language dimension lives here, not on the variant.
3. **`marketplace_product_prices`** — time-series price observations, hanging off a product (one price stream per SKU).

`marketplace_product_variants` sits beside that hierarchy rather than inside it: it is a bare many-to-many mapping from a product SKU to one of our `printings`, carrying no SKU axes of its own.

On a marketplace that prices finishes separately, a listing that sells in both foil and normal is two `marketplace_products` rows sharing an `external_id`, each with its own price stream, and each mapped by a variant row to the matching printing. On a marketplace that pools languages, a listing that covers every language of a card is one product row with `language` NULL, mapped by several variant rows to each language's printing.

## Auth Tables

`users`, `sessions`, `accounts`, `verifications` and `api_keys` are managed by [better-auth](https://www.better-auth.com/). `apps/api/src/auth.ts` maps its field names to `snake_case` columns. The library owns the names of its own columns, so `users.email_verified`, `api_keys.enabled` and `api_keys.rate_limit_enabled` do not follow the boolean prefix rule. Columns OpenRift adds to `users` do, and are declared there as `additionalFields` with an explicit `fieldName`.

## Catalog Refresh

Card data is ingested via JSON upload through the admin API (`POST /api/admin/candidates/upload`). External scripts produce JSON files conforming to `candidateUploadSchema`, which are uploaded through the admin UI or API directly. See `docs/adr/008-supplemental-card-import.md` for design rationale.

- JSON payload contains a `provider` label and an array of `candidates`, each with card metadata and printings
- Validated against `uploadCandidatesSchema` (defined in the shared contract `packages/shared/src/contracts/admin/card-mutations.ts`)
- Ingested by `ingestCandidates()` which matches by `(provider, short_code)` or `(provider, name)`, inserting new records or updating changed ones
- New candidate cards are staged with `checked_at = null` until reviewed in the admin UI
- All operations are transactional per-card
