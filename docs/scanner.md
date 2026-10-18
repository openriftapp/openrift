# Card Scanner

The scanner at `/scan` identifies Riftbound cards through the phone or webcam camera and adds them to a collection. Recognition runs entirely in the browser: the server ships a set of models and a precomputed index of the catalogue, and every camera frame is processed on the device. Camera frames never leave the device, and there is no per-scan cost. Verification compares each candidate with its card image from the site, the same image the card browser shows, so scanning offline works only for cards whose images are already cached.

This document describes the pipeline that ships, why each stage exists, and how changes are measured. The models are trained separately and are not part of this repository; everything that runs them is.

## Goals

- **Never add a wrong card.** A missed card costs the user a tap. A wrong card silently corrupts a collection. Every stage that can be unsure is allowed to abstain, and an abstention falls back to asking the user.
- **Identify the printing.** Riftbound reprints one artwork across sets, languages, promos and stamped variants. The scanner resolves the exact printing when the image carries enough evidence, and offers a picker when it does not.
- **Fast on a phone.** The frame budget is set by mid-range phones.
- **New cards without new code.** A new set is picked up by an index rebuild.

## Architecture

```text
 Server (apps/api)                                    Browser (apps/web)
┌──────────────────────────────────────┐            ┌───────────────────────────────────────────────┐
│ Admin job  scan.rebuild_bank         │            │ Scan page (main thread)                       │
│  1. Active front renders per image   │            │  camera, guide, overlay, scan list, adds      │
│  2. Landscape renders turned left    │            │  placement watcher (tiny thumbnails)          │
│  3. Embed every render (encoder)     │            │  frame loop  scan-loop.ts                     │
│  4. Group renders by artwork         │            └──────────────────────┬────────────────────────┘
│  5. Write content-hashed files:      │                                   │ frames (transferred)
│     scan-bank-<hash>.bin   (fp16)    │                                   ▼
│     scan-labels-<hash>.json          │            ┌───────────────────────────────────────────────┐
└──────────────────┬───────────────────┘            │ Scan worker (Web Worker)                      │
                   │                                │  onnxruntime-web (WASM)                       │
                   ▼                                │   card detector · board detector · encoder    │
┌──────────────────────────────────────┐  manifest  │  embedding bank + labels                      │
│ GET /api/v1/scan/manifest            │──────────▶ │  scan session  packages/shared/src/scan/      │
│ /media/scan/*  (immutable, cached)   │   assets   │   detect → rectify → embed → verify → lock    │
└──────────────────────────────────────┘            │   → printing                                  │
                                                    └───────────────────────────────────────────────┘
```

The recognition code lives in `packages/shared/src/scan/` and has no browser dependencies. The same session runs in the browser's worker, in the API's bank build (preprocessing only), and in the offline bench under Bun. The bench therefore measures the code users run.

### What the browser downloads

| Asset           | Size (Oct 2026) | Contents                                                            |
| --------------- | --------------- | ------------------------------------------------------------------- |
| Card encoder    | 4.6 MB          | ONNX, 192 × 192 input, 256-float embedding                          |
| Card detector   | 1.9 MB          | ONNX, corner heatmap for the card in the guide                      |
| Board detector  | 2.0 MB          | ONNX, centre and corner heatmaps for every card in view             |
| Embedding bank  | 2.1 MB          | About 3,660 reference renders × 256 dimensions, fp16                |
| Labels          | 0.5 MB          | Name, collector code, language, card type and markers per reference |
| onnxruntime-web | 14 MB           | The SIMD WASM runtime                                               |

Reference renders for verification are the regular card images the rest of the site uses, fetched on demand and cached in memory (256 at most).

## The frame pipeline

The app has two modes. **Scan** processes frames continuously and adds a card once it is sure. **Tap** processes exactly one frame per tap. Both run the same pipeline:

```text
camera frame (848 px long side)
   │
   ▼
1. Find the card ─────── card detector in the guide window ──► outline ──► edge snap
   │                     nothing found: board detector outlines in the guide, then the guide itself
   ▼
2. Rectify ───────────── perspective unwarp to 384 × 528, focus check
   │
   ▼
3. Rank ──────────────── 256-d embedding, cosine distance to every reference ──► shortlist
   │
   ▼
4. Verify ────────────── patch correlation against each shortlisted render ──► winner or nothing
   │
   ▼
5. Lock ──────────────── agreeing frames add up to a lock
   │
   ▼
6. Printing ──────────── name band, then code strip, then stamp ──► printing or picker
```

Each stage is described below with the constants that ship.

### 1. Finding the card

The user holds the card inside an on-screen guide: a card-shaped rectangle 70% of the frame height (at most 90% of its width), centred. The **card detector** sees a 224 × 320 window around the guide, 25% larger than it, and outputs a corner heatmap at stride 4 plus a "card present" score. When the score is at least 0.5, the four strongest heatmap peaks (at least 4 cells apart) become the card's corners.

**Edge snap** (`edge-snap.ts`) tightens the detector's corners: each side samples 24 points along its normal, moves to the strongest nearby image edge (search radius 4% of the side, at least 3 px), drops outliers, and refits; the corners become the intersections of the refitted sides. A tight outline matters for the later stages, which compare pixels at fixed card positions.

When the card detector finds nothing, the guide rectangle itself is tried as the outline. Ahead of it, the **board detector** (a 384 × 384 letterboxed view of the whole frame, centre heatmap plus per-centre corner offsets) may add up to two outlines centred in the guide: whole cards covering at least 30% of the guide, scored 0.5 or more, and either landscape or one of several cards in view. This is how a battlefield lying sideways is found. When the board detector adds nothing, it skips the next 7 frames.

### 2. Rectifying

Each outline is put into canonical order (clockwise, starting on a short side) and unwarped through a homography into a 384 × 528 portrait image. Whether the card is upside down, or a battlefield lying sideways, is left to the matcher.

Blurred crops are dropped before any model runs. The focus score is the variance of the Laplacian on the grey crop: below 12 the crop is skipped, and below 40 it may still be ranked but does not get the more expensive rotation search.

### 3. Ranking by embedding

The rectified card is resized to 192 × 192 and run through the **encoder**, a small network trained with an ArcFace objective to map every photo of one artwork close to that artwork's render and far from every other. Its output is a unit-length 256-float vector. The bank holds one vector per reference render, so ranking is one dot product per reference, about 3,660 per query.

Orientation is searched lazily:

- The first query uses the rotation the previous winner had, since a user scanning a stack holds every card the same way.
- If the nearest reference is within 0.42 cosine distance, the search stops there.
- Otherwise, if the crop's focus score is at least 40, the 180° turn is embedded as well. The bank stores landscape renders turned 90° left (the way players hold a battlefield), so portrait and landscape cards both only need the upright and upside-down pair.
- Up to 4 outlines are tried per frame, and trying stops at the first one within 0.42.

The output is a shortlist of the 2 nearest references.

### 4. Verifying

An embedding ranks; it cannot reject. A nearest neighbour always exists, and a card that is missing from the catalogue, half covered, or photographed at a bad angle still lands close to _something_. A scanner that trusts its top match therefore adds wrong cards whenever it is unsure. Verification is the stage that says no.

`aligned-verify.ts` compares the rectified card against each shortlisted reference render directly:

```text
rectified card              reference render
  40 × 56 grey                 40 × 56 grey
 ┌──┬──┬──┬──┐              ┌──┬──┬──┬──┐
 │  │  │  │  │   10×10 patch │  │  │  │  │   per patch: best normalised correlation
 ├──┼──┼──┼──┤   every 5 px  ├──┼──┼──┼──┤   within ±2 px of shift
 │  │  │  │  │   ◀────────▶  │  │  │  │  │
 ├──┼──┼──┼──┤               ├──┼──┼──┼──┤   flat patches (borders, glare) are skipped
 │  │  │  │  │               │  │  │  │  │
 └──┴──┴──┴──┘               └──┴──┴──┴──┘   score = median over textured patches
```

- Both images are reduced to 40 × 56 grey thumbnails.
- 10 × 10 patches at a 5 px stride are each correlated (zero-mean, normalised) at every shift within ±2 px, and the best shift counts. The shift absorbs the residual misalignment the outline leaves.
- Patches without texture on either side carry no evidence and are skipped. Glare and plain borders produce exactly these. At least a third of the patches must be textured, or the frame gives no score.
- The score is the median over patches, so a finger or a reflection over part of the card does not sink a correct match.

A frame has a **winner** only when the best reference scores at least 0.6 and beats the best reference of any _other_ artwork by at least 0.15. When the margin is too small the frame is **refused**. A reference that fails to load (a network error, as opposed to a missing image) voids the frame if it could have changed the outcome, so a missing rival never lets a wrong winner through.

### 5. Locking

One frame is never enough. Each winner is recorded on a track for its artwork, and a track **locks** once its run of agreeing frames reaches weight 3:

- A frame's weight runs from 1 at a score of 0.6 to 2 at 0.95 and above. A clear, sharp view locks in two frames; a marginal one needs three.
- A run survives gaps of up to 6 frames, so a frame of motion blur mid-aim does not restart it.
- In Tap mode a single verified frame locks.

A lock vibrates the phone for 50 ms, plays a short sound where the browser allows it, and flies a thumbnail of the card into the scan list. Cards collect in that list and are added to a collection in one batch when the user confirms.

### 6. Resolving the printing

The bank groups references by **artwork**: the set, name and art variant, with every language and promo variant of that artwork in one group. The bank build merges two kinds of artwork that no image can tell apart, both only between cards of the same name and type. Near-identical renders reused across sets (basic runes, for example) merge when their embeddings lie within 0.05 cosine distance. Reprints that show the same illustration with a new crop or colour grading merge when their renders score 0.85 or more against each other with the verifier below. Within an artwork, the printing is a separate problem: an English and a French copy, or a regular and a promo copy, share the illustration and differ only in small regions of text.

Card text is compared as pixels, never read. The card font is licensed, so the scanner does not render or OCR it; it correlates regions of the photo against the same regions of each printing's reference render. Three regions are tried in order, each only among the printings the previous one could not separate:

| Stage | Region                                    | Separates                       | Min score | Min margin                        |
| ----- | ----------------------------------------- | ------------------------------- | --------- | --------------------------------- |
| Name  | Name band (position depends on card type) | Languages                       | 0.55      | 0.40                              |
| Code  | Collector-code strip, bottom left         | Sets, collector numbers, promos | 0.55      | 0.15                              |
| Stamp | Stamp area, bottom centre                 | Stamped variants of one code    | 0.55      | 0.15 (0.40 to pick a stamped one) |

Each stage runs a **tournament**: the winner must clear the minimum score and beat every distinguishable rival by the margin. Margins are computed on a difference mask, the pixels where the two rival renders disagree after aligning them to each other. Whole-band correlation does not work here: a wrong printing correlated 0.905 with a photo while the right one, misaligned by one pixel, scored 0.826. The mask compares only the pixels that tell the two apart.

A printing is accepted after two frames agree. After 8 attempts without agreement the scanner stops trying, and the card goes into the list with its artwork known and its printing left to the user's picker, which offers only that artwork's printings. Landscape battlefields have no printing bands yet and always use the picker when they have several printings.

## Orientation

- **Any rotation.** Quad canonicalisation puts the long axis vertical, and the embedding search covers the 180° pair. The previous winner's rotation is tried first, so a stack scanned the same way up pays for one rotation per frame.
- **Battlefields.** Landscape renders are stored turned 90° left in the bank and in the verifier's references, the same way the photo of a sideways battlefield unwarps.
- **Rotated camera buffers.** Some Android devices deliver the camera image rotated relative to the screen. Once two consecutive verified winners agree on a non-upright rotation, the frame grab pre-rotates every frame. Battlefield winners never trigger this, since a landscape reference always reports a quarter turn; letting them drive it once rotated the frame in an endless loop.

## Copies and stacks

Scanning several copies of one card is the common case: a playset, or a pile of commons. The scanner must count each copy once, and must not count one copy twice because the user held it a little long.

- **Empty guide.** After two frames in which the guide holds no recognisable card, every locked track re-arms, and the next copy can lock.
- **Placement watcher.** Cards dealt onto a pile never leave an empty guide. The page compares 16 × 22 thumbnails of the guide region on every camera frame, mean-subtracted so a change in exposure does not register as motion. Motion followed by 2 settled frames (and at least 3 disturbed ones) counts as a new card placed, and re-arms the tracks. A 0.5 s hold after placement keeps the next lock from reading the card as it lands.
- **Relock guard.** An artwork already in the list is added again only after the guide went properly empty, a different card was added in between, or a placement was seen. A shaky hand cannot produce any of these.
- **Catch-up.** When a placement is seen but no lock follows, its settled frame is kept (3 at most) and re-run once the guide is free. A strong result (score 75 or more, 30 points ahead of the runner-up) is added; anything weaker is shown to the user with the closest artworks to pick from.

The Identify button bypasses all of these and runs a full search on the current frame, which is also how a user adds another copy of the card still in hand.

## Slow devices

On load, the worker times the encoder on a small batch. A device above 250 ms per image is treated as slow: the page runs in Tap mode and says why, the camera is capped at 30 fps, and the session tries one outline per frame.

On every device, five frames without a plausible match in Scan mode put the session into idle backoff: one outline, in the last winner's rotation only. The page also waits an extra 300 ms between frames when frames take longer than 400 ms. The first plausible ranking restores the full search.

## Runtime

- All three models run in onnxruntime-web's WASM backend inside a dedicated Web Worker, so the camera preview and the UI stay responsive. Frame buffers move to the worker as transferables.
- The runtime uses up to 4 threads when the page is cross-origin isolated, otherwise 1.
- Sessions are created with `graphOptimizationLevel: "basic"`. The full optimisation level made session creation several times slower without speeding up inference.
- The bank is a small binary container (`embed-format.ts`, magic `RFEB`, version 2) with fp16 vectors and a flag recording the landscape convention it was built with.
- Bank and label files are content-hashed and served with immutable caching. The manifest names the current pair, so a rebuild reaches clients on their next load.

## Adding new cards

The detectors find "a card" and know nothing about which one, so they need nothing for a new set. After a set lands in the catalogue:

1. An admin runs **Rebuild bank** (the `scan.rebuild_bank` job). It embeds every active front render, groups artworks, and writes a new bank and label file.
2. Clients pick up the new files through the manifest.

The encoder was trained on the artworks in the catalogue at the time, and embeds new artworks with the same weights. Verification checks every lock against the render itself, so a weaker ranking for unseen art costs recall, never correctness. When recall on a new set drops on the bench, the encoder is retrained.

## Measuring changes

Every change to the scanner is measured on recorded clips before it ships. The tooling is in `scripts/scan/` (see [its README](../scripts/scan/README.md)); the clips themselves are recordings of real cards and are not part of this repository.

- **Recording.** The admin page `/admin/scan` records a camera session together with a log of every frame the phone processed and every decision it made.
- **Truth.** Each clip has a hand-checked truth file: which cards, how many copies, and which printings.
- **Replay.** `run-clips.ts` replays each clip through the same session plans and the same frame loop (`apps/web/src/features/scan/lib/scan-loop.ts`) the app uses, on the frames the phone actually processed, and prints where the replay decided differently from the phone. The bench also runs board reads, which the app has switched off.
- **Gate.** `compare-runs.ts` fails a candidate that finds fewer cards or printings than the baseline on any clip, or that is more than 25% slower on a single-card clip.

The score that matters first is **wrong locks**. A change that finds more cards but adds one wrong card does not ship.

Results on the single-card clips as of October 2026: **114 of 116 cards found, 0 wrong**, at about 31 ms per frame on one desktop CPU core. Across all 240 cards in the clip set, including binder pages and multi-card sweeps the app does not run yet, 185 lock with 0 wrong. On an iPhone a frame took about 42 ms on 2026-10-04, about 20 ms of it in the card detector.

## Tried and dropped

These were built or measured, and lost. They are listed so they are not tried again without new evidence.

- **OCR and perceptual hashes.** The first scanner read the card name and compared image hashes. Replayed on the clips, it named the right card in 0 to 10% of frames and kept naming wrong cards. Reading text also runs into the font licence.
- **A general-purpose image encoder** (MobileCLIP-S0, 512 dimensions). Worked, but took about 100 ms per image on an iPhone and 920 ms on a 2016 Android phone. The trained encoder takes about 5 ms and 55 ms, and ranks well enough for a 2-deep shortlist where MobileCLIP needed 8. The bank format and distance gates still support it (`gatesForEmbedDim`).
- **An int8 MobileCLIP.** Slower than fp32 in the WASM runtime (80 vs 58 ms per image), and its embeddings drifted far from the fp32 ones (cosine 0.44).
- **Keypoint matching (ORB) for verification**, and OpenCV with it. It needed a 3.3 MB WASM library, cost 0.5 to 2 s per frame on old phones, and dropped below its match floor on low-texture cards whenever glare or blur hit a frame. Patch correlation on rectified thumbnails replaced it, and OpenCV left the app.
- **Classical rectangle fitting** for finding the card. It only searched rectangles up to about the frame's short side, so a close-up card got an outline of its printed inner frame. Replaced by the learned detectors.
- **Whole-band correlation for printings.** See the 0.905 vs 0.826 example above.
- **Small colour fingerprints** (a downscaled colour grid per card, compared by cosine similarity). Measured as a matcher on the same clips, they cannot reject: wrong matches scored 0.81 to 0.99 and right ones 0.90 to 0.99, so no threshold separates them.

## Built, not enabled

The engine can read several cards at once. Two paths exist and are tested in the bench, but are switched off in the app (`enterSweeps` and `boardReads` in `apps/web/src/features/scan/lib/scan-session.ts`):

- **Sweeps.** When the board detector sees two or more cards and the camera is moving, the session reads every card in view and tracks where each counted card lies on the table, using whole-frame shift estimation, so a card the camera returns to is not counted again.
- **Board reads.** When the camera holds still over several cards, one full-resolution still is tiled through the board detector and every outline is verified and resolved on its own.

Both work on recordings. On a phone, tracked positions drift and a detector dropout makes the next read count every card again. They stay off until that is fixed.

## Known gaps

- Cards far from the camera (well under half the guide) are not found. This is a detector limit.
- Stacked and overlapping cards are best effort.
- Landscape battlefields have no printing resolution and use the picker.
- Two printings with the same artwork, code and stamp area (some judge and event promos) can only be told apart in the picker.

## Code map

| Path                                                         | Contents                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `packages/shared/src/scan/session.ts`                        | The per-frame pipeline                                              |
| `packages/shared/src/scan/session-options.ts`                | Guide geometry, distance gates per encoder, focus floors            |
| `packages/shared/src/scan/card-detector.ts`                  | Card detector input window and heatmap decoding                     |
| `packages/shared/src/scan/board-detector.ts`                 | Board detector letterbox and decoding                               |
| `packages/shared/src/scan/edge-snap.ts`                      | Outline refinement onto image edges                                 |
| `packages/shared/src/scan/unwarp.ts`, `geometry.ts`          | Quad ordering, homography, rectification                            |
| `packages/shared/src/scan/embed.ts`, `embed-format.ts`       | Encoder preprocessing, rotation search, bank ranking, bank file     |
| `packages/shared/src/scan/aligned-verify.ts`                 | Patch-correlation verification                                      |
| `packages/shared/src/scan/accept.ts`                         | Frame winners, weighted runs, locks, re-arming                      |
| `packages/shared/src/scan/disambiguate.ts`                   | Printing regions, difference masks, tournaments                     |
| `packages/shared/src/scan/printing-lock.ts`                  | Printing votes across frames                                        |
| `packages/shared/src/scan/art-groups.ts`                     | Artwork grouping for the bank                                       |
| `packages/shared/src/scan/placement.ts`                      | Placement watcher                                                   |
| `packages/shared/src/scan/sweep.ts`                          | Board-detector fallback in the guide; sweep entry (off in the app)  |
| `packages/shared/src/scan/frame-shift.ts`, `table-places.ts` | Camera shift between frames, positions of counted cards             |
| `packages/shared/src/scan/board.ts`                          | Board reads from one still (off in the app)                         |
| `apps/web/src/workers/scan-worker.ts`                        | The worker hosting models and sessions                              |
| `apps/web/src/features/scan/lib/scan-session.ts`             | Modes and the session plans the app runs                            |
| `apps/web/src/features/scan/lib/scan-loop.ts`                | What the app does with each frame's outcome (shared with the bench) |
| `apps/web/src/features/scan/hooks/use-card-scanner.ts`       | Camera, frame scheduling, mode switching                            |
| `apps/api/src/modules/scan/services/scan-bank.ts`            | Bank rebuild job                                                    |
| `scripts/scan/`                                              | Offline bench and clip tooling                                      |
