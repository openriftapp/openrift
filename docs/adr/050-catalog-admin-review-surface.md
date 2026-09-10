---
status: accepted
date: 2026-09-10
---

# ADR-050: Catalog Admin Review Surface

## Context and Problem Statement

The admin card pages grew around the candidate import pipeline (ADR-008) and then absorbed user submissions (ADR-036), marketplace coverage, candidate printings and three tabs of unrelated data. An audit on 2026-09-10 found that accepting a submission never settles its `card_submissions` row (only the check and ignore verbs do), that the "unchecked" counts driving the review run exclude every provider not starred as favorite, so a contributor submission counts as zero by default, that corrections to existing cards have no badge or filter anywhere, and that six colour vocabularies explain themselves only through native tooltips. The maintainer cannot tell what needs a decision, and there is no visible yes / yes-with-edits / no.

How do we replace the review workflow and the card pages without a big-bang rewrite of a surface the maintainer uses daily?

## Decision Drivers

- The three verbs a reviewer needs (accept, accept some with edits, reject with a reason) must be visible controls, and accepting must settle the contributor's submission.
- Every visible source counts toward the review queue. Trust decides what may be applied in bulk, never what is counted.
- The side-by-side compare grid stays: with twenty sources, disagreement is the norm and curation across gallery, playloltcg and uploads is the main job.
- The old pages keep working until the new ones cover them, so the maintainer can switch per task.

## Considered Options

1. Rework the existing `features/admin` card pages in place.
2. A second surface under a new route prefix, built beside the old one and switched over when complete.
3. A separate standalone admin app.

## Decision Outcome

Chosen option: **a second surface beside the old one (option 2)**. New routes live under `/admin/catalog/…` (review inbox, cards, a card page with tabs, sources), new components under `features/catalog-admin/`, and only the new API procedures the old verbs cannot express. The database and the candidate staging model are unchanged. When the new surface covers a page, the old route redirects to it and its components are deleted.

Option 1 was rejected because every card-page component is shared between the list, the detail page and the printing groups; changing the review model in place would break the surface the maintainer needs while the replacement is unfinished. Option 3 was rejected because the admin layout, grants and the oRPC client are all reusable and a second app would duplicate them.

### Consequences

- Good, because the maintainer can compare the two surfaces on the same data and switch per task.
- Good, because the ledger, candidate tables and provider settings keep their columns; only labels and counting rules change, and only on the new surface until the swap.
- Bad, because two surfaces exist for a while and both need the section-grant allowlist maintained.
- Bad, because the compare grid is ported, not shared, so a fix in one grid does not reach the other until the swap.

### Confirmation

Route tests pin that a `card-review` grant holder reaches the new paths and no others. Service tests pin the settle rule: accepting with picks marks the candidate checked and resolves the ledger row in the same transaction, rejecting records the reason and ignores the candidate, and a submission whose every pick was unticked resolves as `not_applied`. The review-queue test seeds an unfavorited provider and asserts its rows are counted.

## Design

### Surfaces

- **Review** (`/admin/catalog/review`): one queue, oldest first. An item is either one pending contributor submission (kind new card, correction or image) or one (provider, name) group from any other visible source that still has unchecked rows. Contributors are the one special source; everything else is listed by its provider name.
- **Card page** (`/admin/catalog/cards/$slug?tab=…`): Overview (read-only render of the public page, printings strip, facts, sources), Attention (the review surface), Compare (the side-by-side grid), Card fields, Printings (each row expands to its details and its images; there is no card-level image), Marketplace, Bans & errata, History. Opened from Review, prev and next walk the queue; opened from Cards, they walk the filtered card list.
- **Draft card** (`/admin/catalog/drafts/$name`): a new-card proposal rendered as a card page with nothing live. "Create card with N printings" is one transaction.
- **Sources** (`/admin/catalog/sources`): provider settings under plain names. `is_hidden` reads "Show in review", `is_favorite` reads "Trusted", `helper_reviewable` reads "Helpers can review", sort order is drag order for compare columns.

### Verbs on a submission

- **Accept** applies the ticked changes (card fields, printing fields, ticked new printings, a proposed image), marks the candidate card and its printings checked, and resolves the ledger row in the same transaction: `accepted` when at least one change was applied, `not_applied` when every change was unticked. An edited incoming value counts as applied.
- **Reject** records a required reason (`duplicate`, `already_correct`, `unverified`, `not_a_card`, `bad_image`, `other`) and an optional message, then ignores the candidate, which resolves the row as `rejected`.
- **Message contributor** writes the message without settling anything, as today.

### Attention rules

Attention on a card lists contributor submissions, trusted sources with unchecked rows for this card (with their new printings inside), and nothing else. Disagreement between sources is not attention; it is visible on Compare. The review queue applies the same rule to non-contributor sources but counts every visible provider, trusted or not.

### Grants

The `card-review` section gains the `/admin/catalog` route prefix on the web and the new procedures' paths in the API allowlist. Provider scoping for grant holders is unchanged: the queue and the accept verbs filter to helper-reviewable providers.

## More Information

Builds on ADR-008 (candidate pipeline), ADR-036 (submissions and the outcome ledger), ADR-040 (section grants) and ADR-047 (Printing Desk, whose one-page-per-object layout the card page follows). The design canvas that settled the layout is linked from the maintainer's notes, not from the repository.
