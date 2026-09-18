---
status: accepted
date: 2026-09-19
---

# ADR-052: Tournament Decklists into the Meta Archive via UVS Games

## Context and Problem Statement

Shops run local events on UVS Games, the official locator, and some of them also host the same event on OpenRift for pairings and deck check. The Meta Archive (ADR-014) mirrors UVS Games standings, but local events almost never publish decklists there: in the mirror, over 99% of events sit at `decklist_status = SUBMISSIONS_OPEN`. The lists exist on OpenRift, in `deck_check_entries`, with a per-player publishing consent.

ADR-014 kept the archive and the tournament runner apart and deferred "promote-from-runner" to its own consent design. How does an organizer link a hosted tournament to its UVS Games event and send the decklists into the archive after the event, without the organizer or the runner becoming a source of standings?

## Decision Drivers

- UVS Games standings are official. A hosted tournament contributes decklists only.
- Nothing an organizer sends is public before an admin accepts it, the same rule user submissions follow.
- The player's consent decides. An organizer can override an unfinished deck check, never a missing consent.
- OpenRift has no reliable identity link between a participant and a UVS Games player. Names differ between the two systems.
- Reuse the overlay layer, the submission ledger and the review queue rather than add a parallel path.

## Considered Options

1. **Standings overlays keyed to the UVS Games standings row**, filed from a hosted tournament and reviewed like any other overlay.
2. **A new "tournament" archive source** whose standings come from the runner's rounds.
3. **One user submission per player**, sent through the existing submission form.

## Decision Outcome

We implement option 1.

**Link.** `tournaments.uvsgames_event_id` holds the numeric event id. The organizer pastes a locator link or the id in the tournament settings; a tournament in a friend group is offered the UVS Games events of the group's linked shops within 36 hours of its start. The tournament page links to the UVS Games event and, once the event is in the archive, to its archive page.

**Mirror on demand.** The send page reads the event through the same detail and deep-fetch code the id sweep and the recheck ladder use (`fetchUvsgamesEvent`). It mirrors the catalogue row and the results and accepts nothing into the archive. A second read within ten minutes is served from the mirror.

**Matching.** The organizer matches each participant to a UVS Games standings row by hand. A participant whose name is the same, after folding case and spacing, as exactly one standings row gets that row as a starting suggestion. The server refuses two lists for one row.

**Eligibility.** A list needs `allow_deck_publishing` and `allow_name_sharing`, because the archive prints it under the player's UVS Games name. A list whose deck check is `approved` or `checked` is ready. An `editable` or `submitted` list is shown as unfinished and goes only when the organizer ticks "Send anyway". A withdrawn list, a missing list and a missing consent are shown with the reason and cannot be sent. The player's sharing note says the archive only takes lists shared with a name.

**What a send writes.** Each list is a `meta_event_player_overlays` row with provider `tournament`, source key `playerSourceKey(<uvs id>, <standings identity>)`, and claims `cards` and `listStatus` only, plus a `meta_submissions` ledger row per list. The key makes a second send update a list that is still pending and skip one an admin already settled. Tournament lists do not count toward the per-user pending cap. Admins get one email per send.

- If the UVS Games event is already in the archive, each overlay anchors to the standings row whose `source_identity` is the matched identity.
- If it is not, the send writes one proposed event overlay keyed `(tournament, <uvs id>)` and hangs the lists off it. Accepting that proposal runs the catalogue accept for the mirrored event (so the UVS Games standings, recheck and source citation are exactly what a catalogue accept produces), drops the proposal's claims, adopts its lists and anchors each one to its row by identity. The proposal's key makes the tournament's lists one upload in the event's uploads panel, which can revert them together.

Option 2 would put a second, unofficial set of standings beside the official one and ask the admin to reconcile them per event. Option 3 is ten pending submissions at most per user and one review per player, each needing a player name and rank the organizer would retype from UVS Games.

### Consequences

- Good, because the archive's standings for a linked event stay exactly the mirrored UVS Games standings; a tournament can only add lists.
- Good, because review, rejection, revert, contributor credit and the thank-you email work unchanged, since every list is an ordinary overlay with a ledger row.
- Good, because a local event reaches the archive only when an admin accepts it, as with catalogue triage.
- Bad, because matching is manual and a wrong match files a list under the wrong player until an admin catches it.
- Bad, because a tournament with no UVS Games event cannot send lists. Proposing an event from the runner's own standings is not built.
- Neutral, because an organizer's read of an event costs the same handful of UVS Games requests a deep fetch does, bounded by the ten-minute reuse.

### Confirmation

- `apps/api/src/modules/meta/services/meta-tournament-lists.test.ts` covers the proposal, the live anchor, the re-send and the skip reasons.
- `apps/api/src/modules/meta/services/meta-overlay-review.test.ts` covers accepting a tournament's proposal through the catalogue path and the anchoring by identity.
- `apps/api/src/modules/tournaments/lib/archive-lists.test.ts` and `authenticated-tournament-archive-lists.test.ts` cover eligibility, the override and the route gate.

## More Information

- [ADR-014](014-meta-archive.md): the archive, its overlay layer and the UVS Games mirror.
- [ADR-033](033-unified-tournaments.md): hosted tournaments and deck check.
