---
status: accepted
date: 2026-11-17
---

# ADR-057: Syncing Official Platform Events into Tournaments through the Browser Extension

## Context and Problem Statement

Organizers run official events on the official event platform (provider `playriftbound`), where players register and submit their decks. Some of them also want OpenRift's deck check for the same event. The platform has no export, no webhook and no public decklist query: deck text is readable only by the event's organizer, through the platform's own GraphQL with the organizer's session. ADR-025 made deck-check ingest push-only and kept event creation out of external hands.

How does an organizer get the players and decks of a platform event into an OpenRift tournament, and keep them current as players submit and edit?

## Decision Drivers

- OpenRift stores no credentials for another service and runs no job with someone else's session.
- The organizer confirms what lands in OpenRift and where.
- A second sync updates the same tournament and never undoes what a judge or player did on OpenRift.
- A sync never deletes anything a judge recorded.
- Player names and Riot IDs stay out of URLs and server logs.
- Reuse the deck-check ingest and its change detection.

## Considered Options

- The browser extension reads the event in the organizer's page and hands it to an OpenRift page that syncs it.
- The extension pushes straight to the ingest API with the host's key.
- OpenRift fetches the event server-side with credentials the organizer gives it.

## Decision Outcome

Chosen option: "The browser extension reads the event in the organizer's page and hands it to an OpenRift page that syncs it", because it is the only option that needs neither stored credentials nor a key in the browser, and the organizer reviews each sync.

The extension runs the reader in the page's own context on the organizer's event page, with the queries the platform itself uses. A player the platform reports as having a deck whose deck does not load stops the read, so a sync never mistakes a failed read for a missing list. The extension hands the result to `/tournaments/playriftbound-sync` through extension storage and `window.postMessage`. The organizer picks a tournament they manage, or creates one, and confirms. `POST /api/v1/tournaments/playriftbound/sync` links the tournament (`tournaments.playriftbound_event_id`) and syncs:

- Participants are keyed by `tournament_participants.external_id` = `playriftbound:<playerId>`. Players without a deck are seated too, so judges see who is missing a list. A claimed or closed participant keeps the identity OpenRift holds.
- A player who left the event, or whom the platform reports as dropped, drops through the regular drop service, so rounds, teammates and group walkovers follow. Nothing is deleted, and a sync never reactivates anyone: a judge's drop stands.
- A list goes through the ingest only when the platform's save time differs from `tournament_participants.source_deck_saved_at`, which only the sync writes. A judge's repair, withdrawal or deletion, and a resubmission on OpenRift, therefore stay until the player saves again on the platform.
- A seated player who already has a list entered on OpenRift keeps it; the platform's list does not create a second entry.
- New entries start with every sharing consent off, since the platform asks players for none.
- A tournament links to one event, and the link cannot change while synced players are in it. A completed or cancelled tournament takes no sync.
- Every pushed list passes the ingest entry schema first, so an oversized list fails the sync with its player's name.
- The ingest API rejects external ids with the `playriftbound:` prefix, so a provider push cannot write into a sync's entries.

This amends ADR-025's "pull or scraping" non-goal for this one case: the reading happens in the organizer's browser, on their click, with their session, and only the result reaches OpenRift.

### Consequences

- Good, because OpenRift holds no platform credentials and no server job reads the platform.
- Good, because a re-sync is safe at any time: lists unchanged at the source stay as OpenRift holds them, changed lists invalidate their checks through the existing diff.
- Good, because the payload never appears in a URL.
- Bad, because the platform's persisted query ids and response fields are undocumented, so a change there breaks the reader until the extension updates.
- Bad, because syncing needs the extension and a desktop browser; there is no automatic sync.
- Neutral, because pairings and results stay on the platform; the tournament holds the roster and decks for deck check.

### Confirmation

- `apps/api/src/modules/tournaments/routes/authenticated-tournament-playriftbound.integration.test.ts` covers linking, the roster, unchanged and replaced lists, lists kept from OpenRift, drops, closed accounts and the refusals.
- `apps/api/src/modules/tournaments/services/playriftbound-sync.test.ts` covers which lists a sync pushes.
- `apps/extension/src/lib/playriftbound-read.test.ts` covers the reader against fixture responses.

## Pros and Cons of the Options

### The extension pushes straight to the ingest API with the host's key

- Good, because one click syncs without leaving the event page.
- Bad, because the host's key lives in the browser.
- Bad, because there is no review step and no place to pick or create the tournament.

### OpenRift fetches the event server-side with credentials the organizer gives it

- Good, because it could sync on a schedule.
- Bad, because OpenRift would store and use another service's session for a user.

## More Information

- [ADR-025](025-deck-check-for-judges.md): deck check and the ingest contract.
- [ADR-033](033-unified-tournaments.md): tournaments, hosts and participants.
- `docs/extension.md`, section "Official event platform sync".
