---
status: accepted
date: 2026-09-16
---

# ADR-051: Client Stores for Private Deck and Collection Pages

## Context and Problem Statement

Card browsing already runs from a catalog the browser keeps, so a filter or a page change costs no request. The private pages do not. Collections, copies, decks, deck cards and deck folders each went through a TanStack Query server function, every mutation invalidated a query key and refetched the list it had just changed, and a new row carried a temporary id until the server answered with the real one. The deck page fetched a detail endpoint even though the list it came from already held most of the same fields.

Those pages are behind auth, so the SSR pass that pays for itself on card and share pages buys nothing here: no crawler sees them, and the render blocks first paint on a round trip the browser could have skipped. Meanwhile a list refetch landing while a multi-chunk write was in flight could resurrect rows the write had just removed.

How do we let private pages read from the browser, give each entity one write path instead of one per mutation site, and make a write survive a refetch that lands mid-flight?

## Decision Drivers

- Speed is the product goal. A private page should render from data already in the browser.
- One write path per entity. A mutation site should not carry its own cache-patching code.
- A create must be replay-safe, so the client names the id rather than reconciling a temporary one.
- A list fetch that lands while a write is in flight must not undo the write.
- No service worker and no PWA. Offline reads come from the data layer, not from a cache proxy.
- `@tanstack/react-db` must stay out of the entry chunk, which every page pays for.

## Considered Options

1. **TanStack DB query collections**: each entity becomes a collection backed by its list endpoint, with `onInsert` / `onUpdate` / `onDelete` handlers as the single write path, and pages read through live queries.
2. **Keep React Query and hand-write optimistic updates**: every mutation site patches the cache it affects and rolls back on failure.
3. **A service worker cache**: keep the current fetching and serve repeat reads from a cache the worker owns.

## Decision Outcome

We implement option 1. Copies, collections, decks, deck cards and deck folders are query collections created per `(queryClient, userId)`. Route loaders preload them, private deck and collection routes drop to `ssr: false`, and pages read through `useLiveQuery` / `useLiveSuspenseQuery`. Every write goes through one module per entity that maps a transaction's mutations onto the bulk endpoints and returns `{ refetch: false }`, because the handler has already written the store. Creates carry a client-generated UUIDv7, and the API treats a repeated id from the same owner as the original create instead of a conflict.

Option 2 is where the code already was. It spreads the same reconciliation over every call site and still leaves temporary ids and refetch races to each site's own care. Option 3 was rejected on the project's standing no-service-worker position, and it would cache responses rather than give the page a queryable local store.

Browser-local decks move onto the same substrate: a `localStorage`-backed collection replaces the persisted Zustand store, and their ids lose the `local:` prefix.

### Consequences

- Good, because a private page renders from the store with no request on navigation, and a deck page assembles its detail from the decks and deck-cards stores instead of fetching one.
- Good, because each entity has exactly one write path, so a new mutation site inherits optimism, rollback and invalidation by writing to the collection.
- Good, because a client-named id is stable from the moment the row appears, so a link, a follow-up write or a retry all address the same deck.
- Good, because a browser-local deck keeps its uuid when the owner claims it into an account, so a bookmark made while signed out still resolves afterwards.
- Bad, because a private route that renders only on the client shows its shell before its data, where SSR previously delivered markup. The loader preloads the stores to keep that window short.
- Bad, because "is this deck local?" is now a store lookup rather than a property of the id string, so every branch that asks depends on the local store being preloaded. Route loaders await it.
- Bad, because a deck summary now carries description, links, odds config and share state, making the list payload larger so the deck page needs no second request.
- Bad, because the deck cards of every deck load eagerly as one collection, which is a larger first read than one deck's cards.
- Neutral, because deck plans stay on TanStack Query. They are read on one page and have no cross-page consumer.
- Neutral, because public share pages keep SSR. They are exactly the pages a crawler does see.

### Confirmation

Unit tests cover the write paths (`copies-write`, `collections-write`, `decks-write`), the collection wiring and the hooks that read them. `refetch-race.test.ts` pins the watcher: a fetch landing during a write triggers exactly one follow-up refetch, and a write with no competing fetch triggers none. `local-decks-collection.test.ts` pins the legacy migration, including that a `local:` blob is re-keyed onto the uuid it wrapped and that the old key is left in place, and that a write made before anything read the store keeps the decks already stored. `authenticated-decks.test.ts` pins that the deck-cards delta reads the touched deck ids only after the rows. On the API side, the create routes have tests for a replayed id returning the caller's existing row and for a foreign id returning 409.

## Design

### Stores

One collection per entity, created lazily per `(queryClient, userId)` and marked orphaned when the user changes:

| Collection     | Endpoint            | Key                                           |
| -------------- | ------------------- | --------------------------------------------- |
| `copies`       | `GET /copies`       | copy id                                       |
| `collections`  | `GET /collections`  | collection id                                 |
| `decks`        | `GET /decks`        | deck id                                       |
| `deck-cards`   | `GET /deck-cards`   | deck id, card id, zone, preferred printing id |
| `deck-folders` | `GET /deck-folders` | folder id                                     |

`GET /api/v1/deck-cards` is new: it returns every deck card of the signed-in user in one read, which is what lets the deck page, the variant rail, the deck box and the compare page all resolve cards without a per-deck request.

Route loaders import the store modules dynamically, so `@tanstack/react-db` stays out of the entry chunk and loads with the area that uses it.

A deck route whose store lacks the deck reads both deck stores once more before it reports not found. Variants, clones and decks made on another device reach the server outside the store's write path, and the mutations that create them await the store's refetch before their caller navigates.

Both stores keep an index on the columns the live queries filter by (`collectionId` and `printingId` for copies, `deckId` for deck cards), because the query builder scans the whole store for each new live query otherwise and the pages mount one per row.

Every collection carries a ten minute `staleTime` and the same `gcTime`. Without the first, the default of zero refetches every mounted collection in full on each window focus and reconnect, which for copies means walking every cursor page. The second is the query cache's retention, not the collection's: `queryCollectionOptions` destructures `gcTime` out of the config and into the observer options, so it never reaches `createCollection`, and a collection is still dropped five minutes after its last subscriber detaches. What it buys is that the rows stay in the query cache, and a restarted sync reads them back before fetching, so returning to an area inside the window costs no request. The window bounds only staleness from another device: a write in this tab writes through to the store and invalidates the keys it touches, so it never waits on the timer.

### Who writes synced state

The adapter's own model is one writer: a handler persists, the collection refetches, and the fetch result is the only thing that writes synced rows. Direct writes (`writeUpsert` and friends with `{ refetch: false }`) are a documented escape hatch "for large datasets where refetching everything is too expensive", and they add a second writer, so we take them only where the read is expensive.

Collections and deck folders are one small request each. They use the adapter's model unchanged: the handlers return nothing and the awaited refetch is the only writer. Copies and deck cards keep direct writes, because refetching either after every edit is the cost those writes exist to avoid. A direct write needs a sync session, so a write path starts the store's sync first when nothing has subscribed it yet; a mutation alone does not.

On both paths, a completed transaction's rows stay visible until a sync commit touches their keys, so a read right after an awaited write sees the written value. Only the refetch or the direct write moves the server's row into the synced store.

### Incremental reads

Copies and deck cards are the two reads worth not repeating, so both accept a watermark and return only what changed since it. The other three stay full reads: they are one small request each.

Copies sends `since`, a transaction id, and gets back the rows whose `updated_xid` is at or past it, plus the ids deleted since. Access is the one change no stamp records: a group joined since the watermark holds copies stamped long before it, and a group left writes no tombstone. The reader compares the reachable collections against those of its previous read, takes a full read when the set grew or was unknown, and drops the rows of collections it lost. Deletions need their own channel because a dispose hard-deletes the row. `copy_deletions` records every removal through an `AFTER DELETE` trigger on `copies` rather than through the repositories, because the bulk wipe deletes by subquery with no id list to write tombstones from. A cascade deletes the collection before its copies, so that trigger can no longer read the owner; a `BEFORE DELETE` trigger on `collections` records its copies' tombstones first, while the owner is still readable. Tombstones are pruned on a schedule, so a watermark older than the retention window is refused and the reader takes a full list instead.

Deck cards key on the deck, not the card. The response carries every card of each deck whose `updated_xid` is at or past the watermark, plus the ids of those decks, so a deck emptied since the watermark is recognisable from its id alone. The reader replaces those decks wholesale and keeps the rest.

The watermark is the server's, taken before the read so a write landing mid-read is resent rather than skipped, and a capped copies page reports its last row's timestamp so the next delta resumes instead of skipping the remainder. Both `queryFn`s merge the delta onto the rows already cached and return the complete set, because an eager collection treats every result as complete collection state.

### One write path

Each entity has a `*-write.ts` module holding the only code that talks to its endpoints. A collection's `onInsert`, `onUpdate` and `onDelete` all call it, so a transaction that mixes kinds is one call. The handlers return `{ refetch: false }`: the handler has already written the store, and a refetch would only re-fetch what it just wrote. Writes that touch many rows are chunked, and a chunk that fails rolls its own rows back.

### Client ids and replay

Creates send a UUIDv7 the client generated. The repositories insert with `onConflict(id).doNothing()` and then read the row back: if it belongs to the caller, the create returns it, which makes a retried or replayed create idempotent. An id that belongs to someone else returns 409 CONFLICT.

### The refetch race

`watchForRefetchRace(queryClient, queryKey)` subscribes to the query cache for the duration of a write and counts only real fetches, not the store's own write-backs, which reach the cache as manual successes. If a fetch landed while the write was in flight, the watcher restarts it afterwards, so the store ends on server state that includes the write instead of the snapshot that was in flight when it started.

### Browser-local decks

Decks built without an account live in a `localStorage` collection keyed by a bare uuid. On first preload, a one-time migration reads the old `openrift-local-decks` blob, sanitizes it and re-keys each deck onto the uuid its `local:` id wrapped, then inserts the rows. The old key is left in place so a rollback still finds its decks. `/decks/$deckId` redirects a `local:` bookmark to the bare id, and a deck is local when the local store holds it.

## More Information

Out of scope, deliberately:

- Deck plans, which stay on TanStack Query.
- Public share pages and card pages, which keep SSR because crawlers read them.
- Any service worker or PWA offline layer.

Related: ADR-035 (anonymous deck builder), ADR-046 (layered module layout).
