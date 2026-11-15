import type { BenchArgvSpec } from "../../packages/shared/src/scan/bench-argv.js";

export interface ScanCli {
  spec: BenchArgvSpec;
  positionals: number;
  usage: string;
}

export const RUN_CLIPS_USAGE = `usage: SCAN_DETECTOR=card.onnx SCAN_BOARD_DETECTOR=board.onnx bun scripts/scan/run-clips.ts [flags]
selection:  --clip <name>  --split tune|holdout  --only-mode <label>
output:     --json <file>  --verbose  --trace  --attribute  --min-sightings <n>
scoring:    --language <code>|any  --no-art-groups  --no-illustration-groups
caches:     --force-bank  --refresh-printings
session:    --slow-device  --set <path>=<value> (repeatable)
replay:     --no-catch-up  --no-rearm  --no-skip-disturbed  --no-relock-guard  --drop-to <fps>  --all-frames
scripts/scan/README.md describes each flag.
`;

export const RUN_BOARDS_USAGE =
  "usage: SCAN_BOARD_DETECTOR=... bun scripts/scan/run-boards.ts [--max-side px] [--boards list.json] [--json out.json]\n";

export const SCAN_CLIS: Record<string, ScanCli> = {
  "run-clips": {
    spec: {
      values: [
        "--clip",
        "--split",
        "--only-mode",
        "--json",
        "--min-sightings",
        "--language",
        "--set",
        "--drop-to",
      ],
      flags: [
        "--verbose",
        "--trace",
        "--attribute",
        "--no-art-groups",
        "--no-illustration-groups",
        "--force-bank",
        "--refresh-printings",
        "--slow-device",
        "--no-catch-up",
        "--no-rearm",
        "--no-skip-disturbed",
        "--no-relock-guard",
        "--all-frames",
      ],
    },
    positionals: 0,
    usage: RUN_CLIPS_USAGE,
  },
  "run-boards": {
    spec: { values: ["--max-side", "--boards", "--json"], flags: [] },
    positionals: 0,
    usage: RUN_BOARDS_USAGE,
  },
  "compare-runs": {
    spec: { values: [], flags: [] },
    positionals: 2,
    usage: "usage: bun scripts/scan/compare-runs.ts baseline.json candidate.json\n",
  },
  "rescore-run": {
    spec: { values: ["--language"], flags: [] },
    positionals: 2,
    usage: "usage: bun scripts/scan/rescore-run.ts in.json out.json [--language EN|any]\n",
  },
  "import-clip": {
    spec: { values: ["--name", "--split", "--mode", "--meta"], flags: ["--negative", "--force"] },
    positionals: 1,
    usage:
      "usage: bun scripts/scan/import-clip.ts <video> --name <clip> --split tune|holdout [--mode single|sweep] [--meta file] [--negative] [--force]\n",
  },
  "extract-clips": {
    spec: { values: [], flags: ["--force"] },
    positionals: 0,
    usage: "usage: bun scripts/scan/extract-clips.ts [--force]\n",
  },
  "export-bench-pack": {
    spec: { values: [], flags: [] },
    positionals: 0,
    usage: "usage: bun scripts/scan/export-bench-pack.ts\n",
  },
  "outline-proposals": {
    spec: { values: [], flags: [] },
    positionals: 1,
    usage: "usage: SCAN_BOARD_DETECTOR=... bun scripts/scan/outline-proposals.ts frame-folder\n",
  },
  "sweep-outline-labels": {
    spec: { values: ["--every"], flags: [] },
    positionals: 1,
    usage:
      "usage: SCAN_BOARD_DETECTOR=... bun scripts/scan/sweep-outline-labels.ts out-dir [--every 5]\n",
  },
  "illustration-groups": {
    spec: { values: [], flags: [] },
    positionals: 1,
    usage: "usage: bun scripts/scan/illustration-groups.ts [out.json]\n",
  },
  "probe-placement": {
    spec: { values: ["--clip"], flags: ["--all"] },
    positionals: 0,
    usage: "usage: bun scripts/scan/probe-placement.ts [--clip name] [--all]\n",
  },
  "probe-disambiguation": {
    spec: { values: [], flags: [] },
    positionals: 0,
    usage: "usage: bun scripts/scan/probe-disambiguation.ts\n",
  },
};
