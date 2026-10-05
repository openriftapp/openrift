# Scan bench scripts

Offline tools for the card scanner. They replay recorded clips and photos through the same shared session code the browser runs, score the result against hand-checked truth files, and compare runs. Each script is run with `bun` from the repository root. Clips, truth files and detector models live outside this repo. The scripts expect them under `data/image-recognition-test/`.

## Setup

The scripts read the card catalogue and printings from the local dev database through `docker exec openrift-db-1` on first use and cache them. Reference renders come from `media/cards/` (the `-400w.webp` derivatives).

| Variable              | Used by                                                                | Meaning                                                                             |
| --------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `SCAN_DETECTOR`       | `run-clips`                                                            | Path to the card detector ONNX file.                                                |
| `SCAN_BOARD_DETECTOR` | `run-clips`, `run-boards`, `outline-proposals`, `sweep-outline-labels` | Path to the board detector ONNX file.                                               |
| `SCAN_ENCODER`        | everything that embeds                                                 | Path to an encoder ONNX file. Defaults to `models/mobileclip-s0/vision_model.onnx`. |
| `SCAN_EMBED_SIZE`     | everything that embeds                                                 | Encoder input side in pixels. Defaults to the shared `EMBED_IMAGE_SIZE`.            |
| `SCAN_CANONICAL_BANK` | everything that embeds                                                 | `1` builds the bank with landscape renders turned to portrait, as the server does.  |

`run-clips` needs both detector variables and exits without them.

The embedding bank is built on first use and cached per encoder, size and canonical setting.

## Data layout

Paths are relative to `data/image-recognition-test/`.

| Path                         | Contents                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `recordings/<clip>.mp4`      | The archived clip at constant 30 fps, plus `<clip>.recording.json` from the phone. |
| `clips/full/<clip>/NNNN.jpg` | Extracted frames, a cache of the recording.                                        |
| `truth/<clip>.json`          | The clip's truth file: split, mode label, cards, copies and printings.             |
| `boards/boards.json`         | Still photos for `run-boards`, each paired with a truth file.                      |
| `models/`                    | The default encoder.                                                               |
| `cache/`                     | Catalogue, printings, embedding banks and illustration groups.                     |
| `device-runs/`               | Results the device bench on `/admin/scan-bench` posts through the dev server.      |

## Workflow

1. `import-clip.ts <video> --name <clip> --split tune|holdout [--mode single|sweep] [--negative] [--force] [--meta file]` archives a clip recorded on `/admin/scan`, extracts its frames and drafts an unreviewed truth file from the phone's locks. Repeated locks of one artwork become copies. The clip imports as `sweep` when the session reported sweeping for at least half of the recorded frames, else as `single`; `--mode` overrides. Check every card, then set `reviewed`.
2. `extract-clips.ts [--force]` rebuilds the frames of every archived recording.
3. `run-clips.ts` replays the clips and scores them. Pass `--json out.json` to save a run.
4. `compare-runs.ts baseline.json candidate.json` exits non-zero when the candidate regresses on any clip.
5. `rescore-run.ts in.json out.json [--language EN|any]` scores a saved run against the current truth files and printings without replaying frames.
6. `export-bench-pack.ts` publishes the clips under `media/scan-bench/` for the device bench on `/admin/scan-bench`.

Two more workflow scripts work on photos:

- `run-boards.ts [--max-side px] [--boards list.json] [--json out.json]` reads every card in each board photo and scores the names.
- `outline-proposals.ts <frame-folder>` pre-draws card outlines for the outline-labels admin page and writes `proposals.json` into the folder.

## run-clips flags

`run-clips` builds its sessions from the scanner's own plans in `apps/web/src/features/scan/lib/scan-session.ts`. Every clip replays through the same plan, whatever its truth file's mode label. Only `--slow-device` and `--set` change that plan.

Selection and output:

| Flag                     | Effect                                                             |
| ------------------------ | ------------------------------------------------------------------ |
| `--clip <name>`          | Replay one clip.                                                   |
| `--split tune\|holdout`  | Replay one split.                                                  |
| `--only-mode <label>`    | Replay clips whose truth file has this mode label.                 |
| `--json <file>`          | Write the run for `compare-runs` and `rescore-run`.                |
| `--language <code>\|any` | The app's card language setting for printing choice. Default `EN`. |
| `--verbose`              | Also print sightings and tracks that never locked.                 |
| `--trace`                | Print one line per processed frame.                                |
| `--attribute`            | Explain each missed card by the stage that lost it.                |
| `--min-sightings <n>`    | Sightings a card needs to show under `--verbose`. Default 4.       |

Bank and catalogue:

| Flag                       | Effect                                             |
| -------------------------- | -------------------------------------------------- |
| `--force-bank`             | Rebuild the cached embedding bank.                 |
| `--refresh-printings`      | Re-read printings from the database.               |
| `--no-art-groups`          | Score without any artwork grouping.                |
| `--no-illustration-groups` | Skip grouping reprints that share an illustration. |

Session plan:

| Flag                   | Effect                                                    |
| ---------------------- | --------------------------------------------------------- |
| `--slow-device`        | Use the plan the app picks for a slow device.             |
| `--set <path>=<value>` | Override one option of the live session. Repeat for more. |

`<path>` is a dotted path into `ScanSessionOptions` in `packages/shared/src/scan/session-options.ts`. A value is a number (`Infinity` included), `true`, `false` or `null`. `null` restores the option's default, also inside a group. An option without a default is removed. An unknown path or a value of the wrong type stops the run. The catch-up session always runs the shipped catch-up plan.

```bash
bun scripts/scan/run-clips.ts --set accept.lockRun=4 --set topK=6
bun scripts/scan/run-clips.ts --set sweep=false --json no-sweep.json
```

App behaviour around the session:

| Flag                  | Effect                                                              |
| --------------------- | ------------------------------------------------------------------- |
| `--no-catch-up`       | Skip the second look at placements that went unlocked.              |
| `--no-rearm`          | Do not re-arm the session on a confirmed placement.                 |
| `--no-skip-disturbed` | Process frames while a card is still moving into place.             |
| `--no-relock-guard`   | Allow a repeat lock of one artwork with no card placed in between.  |
| `--drop-to <fps>`     | Process at most this many frames per second, as a slow device does. |

Board reads are counted, not replayed: `run-clips` reports when the several-cards trigger would read the board, and `run-boards` covers board reads on photos.

## Probes

One-off analysis tools. They print numbers for tuning a single gate and are not part of the workflow.

- `probe-placement.ts [--clip name] [--all]` prints every settle event of the placement detector.
- `probe-disambiguation.ts` measures printing disambiguation margins over the catalogue.
- `illustration-groups.ts [out.json]` prints every pair of one card's artworks with the score the bank build groups them by. Run it under Node, not Bun, because Bun with sharp corrupts webp decodes.

`sweep-outline-labels.ts <out-dir> [--every 5]` is for detector training only. It proposes card outlines on sweep clips and writes the rest as ignore regions.
