/** Session options for a clip replay: the app's own plans, with `--set path=value` overrides on the live session. */
import {
  DEFAULT_SCANNER_SETTINGS,
  scanSessionPlans,
} from "../../apps/web/src/features/scan/lib/scan-session.js";
import type { EmbedBank } from "../../packages/shared/src/scan/embed.js";
import { applySets, parseSets } from "../../packages/shared/src/scan/option-sets.js";
import type {
  EncoderGates,
  ScanSessionOptions,
} from "../../packages/shared/src/scan/session-options.js";
import {
  DEFAULT_SESSION_OPTIONS,
  gatesForBank,
} from "../../packages/shared/src/scan/session-options.js";
import { CANONICAL_BANK } from "./embed-bank";
import { hasFlag } from "./lib";

export interface BenchSessionOptions {
  gates: EncoderGates;
  live: Partial<ScanSessionOptions>;
  catchUp: Partial<ScanSessionOptions>;
}

export function benchSessionOptions(bank: EmbedBank): BenchSessionOptions {
  const gates = gatesForBank(bank);
  const plans = scanSessionPlans({
    mode: "single",
    candidatesToTry: DEFAULT_SCANNER_SETTINGS.candidatesToTry,
    slowDevice: hasFlag("--slow-device"),
    gates,
    canonical: CANONICAL_BANK,
  });
  return {
    gates,
    live: applySets(plans.live, DEFAULT_SESSION_OPTIONS, parseSets(process.argv)),
    catchUp: plans.catchUp,
  };
}
