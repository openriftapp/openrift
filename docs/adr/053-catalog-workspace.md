---
status: proposed
date: 2026-10-21
---

# ADR-053: Catalog Workspace for Cards, Printings and Faces

## Context and Problem Statement

Since ADR-020 a printing is one or two faces, and a face can sit on several printings. The catalog admin still follows the older shape: Review is a queue of sources and submissions, Cards is a list plus a card page whose "Fields & faces" section stacks a transposed source spreadsheet per face, and Printing Desk is a separate area for promo contributors. Face data is edited in three places, image work is split between the card page and the printing page, and the daily review means jumping between Review and a long card page.

How do we organize the catalog admin around cards, faces and printings so the daily review is one pass per record, each open item has one place, and the desk grant keeps working?

## Decision Drivers

- The daily review is the main job and must stay fast: keyboard, no back-and-forth navigation.
- Every open item has exactly one owner, so counts add up and nothing is decided twice.
- Images belong to faces.
- Today's functions stay reachable, including the ones behind menus.
- The old pages keep working until the new surface has been tried (ADR-050 built a replacement that turned out worse).

## Considered Options

1. **List page and detail page per entity**: Cards, Printings and Faces each get a table and a full detail page.
2. **Split view per entity**: list on the left, record on the right, for every view.
3. **Hybrid**: split view for the Open and New queues, full-width tables for All, one record component for both.

## Decision Outcome

Chosen option: "Hybrid", because the queues need the list beside the record to walk through them, while browsing thousands of printings needs table columns and bulk actions.

The new surface lives under `/admin/workspace/` behind the `catalog-workspace` feature flag. With the flag off nothing changes.

### Ownership

- Cards: card-field differences, contributor proposals on card fields, new-card drafts (New).
- Faces: face-field differences and images (new source images, contributor and desk uploads). Which candidate field is a face field follows `isPrintingLevelField` in `packages/shared/src/printing-field-level.ts`.
- Printings: printing-level field differences, new printings from sources (New), suggested marketplace listings, unmatched listings (New).

Images are edited only on the face. Other records show them read-only with a link to the face.

### Lists and records

- Each list has Open, New and All, then type filters, sort, source and reason filters. The queue header shows decisions, oldest age and done today.
- Source differences show inline under each field as suggestions with Discard and Use. Contributor proposals show Reject, Use and Reply. A per-source strip shows "matches" or the number of differences. "Compare all sources" opens the existing source grid.
- Discard checks that source's candidate row, because "checked" is stored per row (`checked_at`). A per-field discard would need a migration and is left out. The label says what happens: "Discard" when that source has one difference on the record, "Discard 2 from Provider B" when it has more, and Enter's banner names the sources it checks.
- Keys: J and K move, Enter discards the remaining source suggestions and opens the next item, A accepts a new record, S moves the item to the end, X ignores, Z undoes, number keys use the nth suggestion. Enter never settles a contributor item and never creates a record. For grant holders who cannot check, Enter is plain Next.
- One creation panel serves new cards, new printings from sources and manual printings: faces (new or existing), images, printing fields, and a duplicate check.

### Grants

- `printing-desk`: Printings (Added by me, All promos) and the faces reached from a printing. Edits any promo printing and anything it created, plus the fields of faces on those printings. Uploads are always stored inactive and appear in the Faces queue for an admin to activate.
- `card-review`: all three queues, Use and Discard, accepting new cards and printings as the API allows today. Queues respect "Helpers can review" on sources.
- `products`: the Products page, unchanged.

### API

- `GET /admin/v1/catalog/workspace/queue` returns open items with owner, owner id, reason, source and age, plus per-owner counts, oldest age and the caller's decisions today.
- `GET /admin/v1/catalog/workspace/records?kind=printing|face` returns lean rows for the All tables.
- Everything scoped to one card comes from the existing card detail, printing and image endpoints. No migration.

### Consequences

- Good, because a card, a face or a printing is reviewed in one pass from one list.
- Good, because counts add up across the sidebar, the dashboard and the lists.
- Good, because the desk grant keeps today's edit rights and gains a review path for its uploads.
- Bad, because Discard works per source row, so discarding one field marks the source's other fields on that record as seen.
- Bad, because a deliberately kept extra image stays an open item until it is activated or deleted. A `face_images.reviewed_at` column would fix that.
- Bad, because two admin surfaces exist until the old pages are removed.

### Confirmation

The queue presenter has unit tests for owner assignment, including a double-sided printing whose faces belong to different cards. Integration tests cover the queue endpoint per grant. The sidebar and route guard tests cover the flag on and off.
