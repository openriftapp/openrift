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

We implement one review list of cards, with each card reviewed as a series of stops. A source upload or a contribution arrives per card, while per-entity queues split one source row across two screens and spread one card's work over three lists.

The surface lives under `/admin/workspace/` behind the `catalog-workspace` feature flag. With the flag off nothing changes. With it on, the old catalog pages stay in the sidebar as a fallback, and only the old Review count is hidden.

### Review

- Review is a segment of Cards. Cards has the segments All, Needs review, New images, Ready to create and Listings to map, and each segment is its own list of cards.
- Needs review lists every card with pending work: source differences on the card, its faces or its printings, new printings, new source images, uploads waiting for a decision, open contributions, and new cards. Contributions come first, then the longest wait.
- Sources switched off under "Show in review" never put a card in Review. Grant holders see the sources marked "Helpers can review".
- Listings to map lists cards with unmapped marketplace listings. Listings are mapped on the card and on the printing record.

### Card pass

- A card is reviewed as stops: the card itself, then each printing with pending work on the printing or on one of its faces. The card stop shows card field suggestions, contributions on card fields, one Printings list and the card's listings. In the Printings list a new printing sits after the existing printing it most resembles, and printings without pending work show only in the full grid.
- Each listed printing is one review stop. The printing page shows the images and face fields of the card's faces on it next to the printing fields, so face and printing suggestions are settled in one place. A face on several printings shows on each of them.
- A source suggestion is one button that applies the value. "Hide value" hides one value until the source reports another. "Dismiss all N" checks every remaining source row on the card, or on the printing or face page where it is pressed. "Checked" is stored per source row (`checked_at`), so a dismissal covers all fields of that row.
- A contribution shows on the field it concerns with the contributor's name and note. It is settled by Use, by Reject with a reply, by Mark as applied, or by moving it to another card. Dismissing never settles it, and the card stays in Review while one is open.
- A new printing is created from its row with the source's values. Linking it to an existing printing and ignoring it sit in the row's menu.
- An uploaded image waiting on a face is made the main image, kept as an extra, or deleted. Keeping sets `face_images.reviewed_at`, which takes it out of Review.
- A two-faced printing whose faces belong to two cards shows in the pass of each card. Each pass edits its own card's face.
- Keys work on every stop while a card is open from a segment: Enter and J go to the next stop, then to the next card in that segment. K goes back. D dismisses every source suggestion on the card, printing or face page that is open. A creates the first new printing that is ready, X ignores, Z undoes.

### Record areas

- Cards, Printings and Faces are tables with one record page each. A record page edits its own fields and shows the source suggestions for them. A printing record links to its card.
- Card fields are edited on the card. Face fields and images are edited on the face, and on a printing page for the faces it carries while they have pending work or the printing is a review stop. Size, channel, release dates and the pair of faces are edited on the printing.

### Grants

- `printing-desk`: the Printings table narrowed to promo printings and printings the holder created, with the faces on those printings. Uploads are stored inactive and wait in Review for an admin.
- `card-review`: Review and all three areas, Use on suggestions, creating cards and printings as the API allows. "Dismiss all N" is admin-only.
- `products`: the Products page, unchanged.

### API

- `GET /admin/v1/catalog/workspace/review` returns one row per card with its pending counts, sources, contribution flag and waiting time.
- "Dismiss all N" is one transactional write that checks the card's source rows and the listed printing source rows. Check, uncheck, hide and restore writes record admin events, so they show in the record history.
- `POST /admin/v1/cards/printing-images/{imageId}/keep` marks an inactive image as reviewed, and `POST /admin/v1/cards/printing-images/{imageId}/unkeep` clears that mark on an inactive image.
- Everything scoped to one card comes from the existing card detail, printing and image endpoints.

### Consequences

- Good, because a card is reviewed in one pass of stops from one list, and a source row is settled once.
- Good, because each field has one editor and each suggestion has one control.
- Good, because the sidebar carries one review count.
- Bad, because a dismissal works per source row, so it also marks that row's other fields as seen.
- Bad, because a card with many printings makes a long pass. Only faces and printings with pending work become stops.
- Bad, because two admin surfaces exist until the old pages are removed.

### Confirmation

The review presenter has unit tests for grouping by card, counting a printing reported by several sources once, leaving listings out and ordering. Integration tests cover the review endpoint per grant and the kept image leaving the queue. The set of rows a dismissal checks has a unit test covering a row that differs on face and printing fields, contributor rows and sources outside the holder's scope.
