---
status: proposed
date: 2026-11-23
---

# ADR-053: Catalog Workspace for Cards, Printings and Faces

## Context and Problem Statement

Since ADR-020 a printing is one or two faces, and a face can sit on several printings. The catalog admin still follows the older shape: Review is a queue of sources and submissions, Cards is a list plus a card page that edits card, face, printing, image and listing data, and Printing Desk is a separate area for promo contributors. Face data is edited in three places, image work is split between the card page and the printing page, and one source row can be settled from several screens.

How do we organize the catalog admin around cards, faces and printings so the daily review is one pass per card, every field has one editor, and the desk grant keeps working?

## Decision Drivers

- The daily review is the main job and must stay fast: keyboard, no back-and-forth navigation.
- A source row is settled once, in one place.
- Every field has one editor. Images belong to faces.
- Few controls per item. A reviewer reads the screen without learning a vocabulary.
- The old pages keep working until the new surface has been tried (ADR-050 built a replacement that turned out worse).

## Considered Options

1. **One queue per entity**: Cards, Printings and Faces each have Open and New queues beside their table, and every open item belongs to one of the three.
2. **Faces inside printings**: two areas, Cards and Printings, with faces as panels of a printing.
3. **One review queue of cards, three record areas**: Review lists cards with pending work, a card pass settles everything on the card, and Cards, Printings and Faces are plain tables with record pages.

## Decision Outcome

Chosen option: "One review queue of cards, three record areas", because a source upload or a contribution arrives per card, while per-entity queues split one source row across two screens and spread one card's work over three lists.

The surface lives under `/admin/workspace/` behind the `catalog-workspace` feature flag. With the flag off nothing changes.

### Review

- Review lists every card with pending work: source differences on the card, its faces or its printings, new printings, new source images, uploads waiting for a decision, open contributions, and new cards. Contributions come first, then the longest wait.
- Sources switched off under "Show in review" never put a card in Review. Grant holders see the sources marked "Helpers can review".
- Marketplace listings are not review items. They are mapped under Marketplaces.

### Card pass

- Opening a card from Review shows everything pending on it in one scroll: Card, New printings, Faces, Printings. Records without pending work collapse to one line.
- A source suggestion is one button that applies the value. "Dismiss N & next" checks every remaining source row on the card and opens the next card. "Checked" is stored per source row (`checked_at`), so a dismissal covers all fields of that row.
- A contribution shows on the field it concerns with the contributor's name and note. It is settled only by Use or by Reject with a reply. Dismissing never settles it, and the card stays in Review while one is open.
- A new printing is created from its row with the source's values. Linking it to an existing printing and ignoring it sit in the row's menu.
- An uploaded image waiting on a face is made the main image, kept as an extra, or deleted. Keeping sets `face_images.reviewed_at`, which takes it out of Review.
- A two-faced printing whose faces belong to two cards shows in the pass of each card. Each pass edits its own card's face.
- Keys: Enter dismisses and moves on, J and K move between cards, A creates the first new printing, Z undoes.

### Record areas

- Cards, Printings and Faces are tables with one record page each. A record page edits its own fields and shows no source suggestions. A record with pending work links to its card's pass.
- Card fields are edited on the card. Face fields and images are edited on the face. Size, channel, release dates and the pair of faces are edited on the printing.

### Grants

- `printing-desk`: the Printings table narrowed to promo printings and printings the holder created, with the faces on those printings. Uploads are stored inactive and wait in Review for an admin.
- `card-review`: Review and all three areas, Use on suggestions, creating cards and printings as the API allows. Dismissing is admin-only, so the primary action is Next for a holder.
- `products`: the Products page, unchanged.

### API

- `GET /admin/v1/catalog/workspace/review` returns one row per card with its pending counts, sources, contribution flag and waiting time.
- `POST /admin/v1/cards/printing-images/{imageId}/keep` marks an inactive image as reviewed.
- Everything scoped to one card comes from the existing card detail, printing and image endpoints.

### Consequences

- Good, because a card is reviewed in one pass from one list, and a source row is settled once.
- Good, because each field has one editor and each suggestion has one control.
- Good, because the sidebar carries one count.
- Bad, because a dismissal works per source row, so it also marks that row's other fields as seen.
- Bad, because a card with many printings makes a long pass. Collapsing records without pending work limits it.
- Bad, because two admin surfaces exist until the old pages are removed.

### Confirmation

The review presenter has unit tests for grouping by card, counting a printing reported by several sources once, leaving listings out and ordering. Integration tests cover the review endpoint per grant and the kept image leaving the queue. The set of rows a dismissal checks has a unit test covering a row that differs on face and printing fields, contributor rows and sources outside the holder's scope.
