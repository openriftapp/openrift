# Scan bench scripts

Offline tools for the card scanner. They replay recorded clips and photos through the same shared session code the browser runs, score the result against hand-checked truth files, and compare runs. Each script is run with `bun` from the repository root. Clips, truth files and detector models live outside this repo. The scripts expect them under `data/image-recognition-test/`. [docs/scanner.md](../../docs/scanner.md) describes the pipeline they measure.

## Setup

On every run the scripts read the reference set from the local dev database (`DATABASE_URL` from `.env`, which must point at a local host) through the API's `scanReferences`, the query the server's bank build uses: active, rehosted front renders, one row per image. Printings come through `docker exec openrift-db-1` and are cached until `--refresh-printings`. Reference renders come from `media/cards/` (the `-400w.webp` derivatives).

Without variables the scripts run the engine the API serves: the encoder, card detector and board detector under `media/scan/`, named by the API's own `SCAN_ENCODER_FILE`, `SCAN_DETECTOR_FILE` and `SCAN_BOARD_DETECTOR_FILE` (read from `.env`), with the encoder's input size read from the model and a canonical bank. The variables below override that for an A/B run.

| Variable              | Used by                                                                | Meaning                                                                                 |
| --------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `SCAN_DETECTOR`       | `run-clips`                                                            | Path to a card detector ONNX file.                                                      |
| `SCAN_BOARD_DETECTOR` | `run-clips`, `run-boards`, `outline-proposals`, `sweep-outline-labels` | Path to a board detector ONNX file.                                                     |
| `SCAN_ENCODER`        | everything that embeds                                                 | Path to an encoder ONNX file, for example MobileCLIP under `models/mobileclip-s0/`.     |
| `SCAN_EMBED_SIZE`     | everything that embeds                                                 | Encoder input side in pixels; overrides the size the model declares.                    |
| `SCAN_CANONICAL_BANK` | everything that embeds                                                 | `0` builds a native bank (landscape renders not turned), for natively trained encoders. |

`run-clips` exits when no card or board detector is configured.

The embedding bank is built on first use and cached per encoder, size, canonical setting and reference set, so a catalogue change builds a new bank.

## Data layout

Paths are relative to `data/image-recognition-test/`.

| Path                         | Contents                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `recordings/<clip>.mp4`      | The archived clip at constant 30 fps, plus `<clip>.recording.json` from the phone. |
| `recordings/<clip>.full.mp4` | The same clip at camera resolution, for stills a tap reads.                        |
| `clips/full/<clip>/NNNN.jpg` | Extracted frames, a cache of the recording.                                        |
| `truth/<clip>.json`          | The clip's truth file: split, mode label, cards, copies and printings.             |
| `boards/boards.json`         | Still photos for `run-boards`, each paired with a truth file.                      |
| `models/`                    | The default encoder.                                                               |
| `cache/`                     | Catalogue, printings, embedding banks and illustration groups.                     |
| `device-runs/`               | Results the device bench on `/admin/scan-bench` posts through the dev server.      |

## Workflow

1. `import-clip.ts <video> --name <clip> --split tune|holdout [--mode single|sweep] [--negative] [--force] [--meta file]` archives a clip recorded on `/admin/scan`, extracts its frames and drafts an unreviewed truth file from the phone's locks. Repeated locks of one artwork become copies. The clip imports as `single` unless `--mode sweep` is passed. Check every card, then set `reviewed`.
2. `extract-clips.ts [--force]` rebuilds the frames of every archived recording.
3. `run-clips.ts` replays the clips and scores them. Pass `--json out.json` to save a run.
4. `compare-runs.ts baseline.json candidate.json` exits non-zero when the candidate regresses on any clip.
5. `rescore-run.ts in.json out.json [--language EN|any]` scores a saved run against the current truth files and printings without replaying frames.
6. `export-bench-pack.ts` publishes the clips under `media/scan-bench/` for the device bench on `/admin/scan-bench`.

Two more workflow scripts work on photos:

- `run-boards.ts [--max-side px] [--boards list.json] [--json out.json]` reads every card in each board photo and scores the names.
- `outline-proposals.ts <frame-folder>` pre-draws card outlines for the outline-labels admin page and writes `proposals.json` into the folder.

Every script here rejects an unknown flag, a stray argument and a flag without its value with exit status 2, and prints its usage for `--help`.

## run-clips flags

`run-clips` builds its sessions from the scanner's own plans in `apps/web/src/features/scan/lib/scan-session.ts` and drives them with the app's own frame loop (`apps/web/src/features/scan/lib/scan-loop.ts`). Every clip replays through the same plan, whatever its truth file's mode label. Only `--slow-device` and `--set` change that plan.

A recording made on `/admin/scan` restarts the scanner when recording starts and logs every frame the phone processed. `run-clips` then processes the same frames and prints where the phone and the replay decided differently (`phone vs bench`). `--all-frames` processes every frame instead.

Selection and output:

| Flag                     | Effect                                                             |
| ------------------------ | ------------------------------------------------------------------ |
| `--help`, `-h`           | Print the usage and exit before any model or data loads.           |
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

`<path>` is a dotted path into `ScanSessionOptions` in `packages/shared/src/scan/session-options.ts`. A value is a number (`Infinity` included), `true`, `false` or `null`. `null` restores the engine default from `DEFAULT_SESSION_OPTIONS` (the shipped ArcFace values), also inside a group. An option without a default is removed. An unknown path or a value of the wrong type stops the run. The catch-up session always runs the shipped catch-up plan.

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
| `--all-frames`        | Process every frame, not the frames the recording logged.           |

A tap in Tap mode reads every card on the full-resolution still. `run-clips` replays the automatic Scan mode only. `run-boards` covers tap reads, on photos or on stills extracted from `.full.mp4` recordings (`--boards list.json`).

## Probes

One-off analysis tools. They print numbers for tuning a single gate and are not part of the workflow.

- `probe-placement.ts [--clip name] [--all]` prints every settle event of the placement detector.
- `probe-disambiguation.ts` measures printing disambiguation margins over the catalogue.
- `illustration-groups.ts [out.json]` prints every pair of one card's artworks with the score the bank build groups them by. Run it under Node, not Bun, because Bun with sharp corrupts webp decodes.

`sweep-outline-labels.ts <out-dir> [--every 5]` is for detector training only. It proposes card outlines on sweep clips and writes the rest as ignore regions.
