import { recordCapped } from "../../../../lib/json-coerce.js";

export interface MetaSyncResultBase {
  requests: number;
  rows: number;
  inserted: number;
  changed: number;
  unchanged: number;
  missing: number;
  autoAccepted: number;
  autoHeld: number;
  complete: boolean;
  coveredThrough: string | null;
  resumedFrom: string | null;
  cancelRequested: boolean;
  errors: string[];
}

export function emptyMetaSyncResult(): MetaSyncResultBase {
  return {
    requests: 0,
    rows: 0,
    inserted: 0,
    changed: 0,
    unchanged: 0,
    missing: 0,
    autoAccepted: 0,
    autoHeld: 0,
    complete: true,
    coveredThrough: null,
    resumedFrom: null,
    cancelRequested: false,
    errors: [],
  };
}

export function recordAutoAccept(
  result: MetaSyncResultBase,
  auto: { accepted: number; held?: number; errors: string[] },
): void {
  result.autoAccepted = auto.accepted;
  result.autoHeld = auto.held ?? 0;
  recordCapped(result.errors, auto.errors);
}
