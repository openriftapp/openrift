---
status: accepted
date: 2026-11-10
---

# ADR-043: zod/mini on the Boot Path, Classic zod Everywhere Else

## Context and Problem Statement

Every non-lazy file under `apps/web/src/routes/` is loaded on the first page view, so anything it imports at value level lands in the static closure of the client entry. Most of them declare `validateSearch`, and the schemas behind it are built at module scope. The browser also fetches today's prices from the edge with the prices contract right after boot. That put classic zod, and the construction of every search schema, on the critical path.

Classic zod does not shrink when a file uses less of it. Its method-chaining API is not tree-shakeable, `zod/v4/classic/external.js` runs `config(en())` at module scope, and a classic schema built at module scope survives tree-shaking even when nothing reads it, because the bundler cannot prove the method chain pure. A shared module that the boot path imports for one constant therefore brings every classic schema in it along.

zod 4 ships `zod/mini`, a functional API built on the same `zod/v4/core`. It drops method chaining for top-level functions, so `s.optional().catch(undefined)` becomes `z.catch(z.optional(s), undefined)`. Its builders carry `@__NO_SIDE_EFFECTS__`, so an unused mini schema disappears from the bundle. About 150 non-test files import zod, most of them oRPC contracts in `packages/shared`.

## Considered Options

- Keep classic zod everywhere
- Migrate every zod module to zod/mini
- Migrate only the modules reachable from the client entry
- Keep classic zod and replace chained refinements with `.check()`

## Decision Outcome

We migrate every schema that a module statically reachable from the client entry builds, and leave the rest on classic. The bundle cost is per chunk, not per repo, so the boot-path win does not require the other contracts to move. Mini and classic build the same `zod/v4/core` instances and nest inside each other in both directions, and `z.infer` / `z.input` resolve identically across the two, so the boundary needs no adapter.

The migrated set:

- `apps/web/src/lib/lenient-param.ts`: `lenient(schema)`, the optional-and-drop-when-malformed wrapper every search param uses
- `apps/web/src/features/cards/lib/`: `search-schemas.ts`, `cards-search-schema.ts`
- `apps/web/src/features/decks/lib/`: `deck-list-search.ts`, `deck-editor-search.ts`
- `apps/web/src/features/meta/lib/`: `meta-paging.ts`, `meta-scope.ts`, `meta-deck-search.ts`, `meta-events-search.ts`, `meta-legends-search.ts`, `meta-standings-search.ts`
- `apps/web/src/features/stage/lib/presentation-queue-search.ts`
- `apps/web/src/features/admin/lib/`: `admin-job-runs-search.ts`, `admin-meta-search.ts`
- `apps/web/src/features/catalog-workspace/lib/workspace-search.ts`
- the ten non-lazy route files that build a schema inline: `stage.tsx`, `stage_.source.$token.tsx`, `groups_.join.tsx`, `cards_.$cardSlug.{-$printingSlug}.tsx`, `contribute_.card_.$cardSlug_.printing_.$printingId_.image.tsx`, `decks/compare.tsx`, `_authenticated/groups/$slug_.lists.$listId.tsx`, `_authenticated/admin/cards.tsx`, `_authenticated/admin/review.tsx`, `_authenticated/admin/workspace/printings.tsx`
- `packages/shared/src/types/`: `search.ts`, `pricing.ts`
- `packages/shared/src/share-image-params.ts`
- `packages/shared/src/contracts/prices.ts`

The boot path reads only constants from the catalog-workspace contract and only `isoDate` from `packages/shared/src/schemas.ts`. Those constants live in the zod-free leaf `packages/shared/src/workspace-kinds.ts`, and `meta-scope.ts` builds its own `z.iso.date()`, so both modules stay classic and off the boot path.

Measured on production builds of 2026-11-10, static closure of the client entry, with classic zod and with zod/mini on the boot path:

|                      | classic   | zod/mini      |
| -------------------- | --------- | ------------- |
| closure, minified    | 1555.5 KB | 1518.8 KB     |
| closure, gzipped     | 515.7 KB  | 505.5 KB      |
| zod chunks, minified | 97.6 KB   | about 61 KB   |
| zod chunks, gzipped  | 28.1 KB   | about 17.6 KB |

What remains is `zod/v4/core`. Tree-shaking works per module across the whole graph, and three lazy chunks that carry classic zod import the same core chunk as the boot path, so the boot path carries every core constructor that any chunk needs. A mini-only bundle of a representative search schema (object, string, number, boolean, array, enum, ISO date, uuid, coerce, record) measures 21 to 25 KB minified with rolldown 1.2.14.

### Consequences

- Good, because classic zod, its English locale and the construction of every unread classic schema are off the first page view.
- Good, because the contracts other than prices and the OpenAPI generator keep working unchanged. `@orpc/zod/zod4` reads `_zod.def` and `globalRegistry`, and TanStack Router validates through `~standard`, so both accept either dialect. The generated public, admin and developer OpenAPI documents are byte-identical whether the prices, pricing, search and share-image schemas are classic or mini.
- Neutral, because the prices contract writes its OpenAPI descriptions with `.register(z.globalRegistry, {...})`, since mini has no `.meta()`.
- Neutral, because `apps/api/src/app.ts` tests `err instanceof z.core.$ZodError`, which matches errors thrown by either dialect. A mini `.parse()` throws core `$ZodError`, which `z.ZodError` does not match.
- Bad, because the repo carries two zod dialects permanently. A line copied from a classic contract into a migrated file does not compile, and three behaviours differ silently:
  - A mini `z.transform` callback gets the parse payload, which has no `ctx.addIssue`. It pushes to `ctx.issues` instead.
  - Mini has no `z.preprocess`. `z.optional(z.pipe(z.transform(fn), schema))` parses identically, and the outer `z.optional` keeps the key optional in the input type, which route links rely on.
  - Mini configures no locale, so a mini-only chunk reports every issue as `"Invalid input"`. Search params drop malformed values through `lenient` and show no message. A migrated schema whose messages reach a user needs explicit messages or `z.config(en())`.
- Bad, because the set is defined by what the client entry reaches, which moves when a route is split differently or a boot module gains an import.
- Bad, because `z.catch(z.optional(z.array(z.string())), undefined)` reads inside-out. `lenient` hides the most common case.

### Confirmation

`apps/web/vite-plugins/boot-chunk-guard.ts` fails the client build when any module under `zod/v4/classic`, `zod/v4/locales` or `zod/v3` is rendered into a chunk statically reachable from the client entry, and prints the import path to that chunk.

## Pros and Cons of the Options

### Keep classic zod everywhere

- Good, because one dialect, no boundary to police, and no build assertion to maintain.
- Bad, because the classic library and every module-scope classic schema in a boot-path module stay on the first page view.

### Migrate every zod module to zod/mini

- Good, because one dialect again, with no boundary and no assertion needed, and the shared core chunk would shrink to what mini needs.
- Good, because the API server's schema construction gets the same speedup, though nothing there is latency-sensitive enough to care.
- Neutral, because it is mechanical rather than hard. Every classic method has a top-level mini equivalent, and `.shape` still works on mini objects.
- Bad, because it is thousands of call-site rewrites across the contracts for a saving the boot path mostly already has.
- Bad, because `.meta()` is used throughout the contracts for OpenAPI descriptions and each use becomes `.register(z.globalRegistry, {...})`.

### Migrate only the modules reachable from the client entry

- Good, because it takes classic zod off the boot path at a small fraction of the rewrite volume.
- Bad, because of the permanent two-dialect boundary and its decay risk, covered under Consequences.

### Keep classic zod and replace chained refinements with `.check()`

Chaining clones the schema on every call, so `.min(1).max(200).trim()` builds three instances where `.check(z.minLength(1), z.maxLength(200), z.trim())` builds one.

- Good, because it needs no new dependency surface, no boundary, and no assertion.
- Good, because it cuts schema construction by about 20% and composes with the chosen option.
- Bad, because it does nothing for bundle size, which is the larger half of the problem.

## More Information

- `z.ZodIssueCode` is undefined in mini. `z.NEVER` exists.
- The web, shared, API and bot packages typecheck against the migrated schemas.
- The search, paging, admin and workspace schemas under `features/*/lib`, the shared search, pricing and share-image schemas, and the prices contract's response and query schemas parse an input corpus identically in both dialects. The one difference is the issue code for an unknown `plStatus` on the admin meta tab, `invalid_value` where classic reported `custom`, and the route fails the same way. The inline route schemas are covered by their route tests, and the two `side` params were also compared against classic `z.preprocess`.
