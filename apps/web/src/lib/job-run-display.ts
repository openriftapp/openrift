import { formatDayTime } from "@openrift/shared/format-date";

const SUMMARY_LIMIT = 6;

const BUDGET_COUNTER = "requests";

interface CoverageNote {
  text: string | null;
  namesSkipped: boolean;
}

function coverageNote(result: Record<string, unknown> | null): CoverageNote {
  if (result === null || result.complete !== false || result.cancelRequested === true) {
    return { text: null, namesSkipped: false };
  }
  const skipped = typeof result.skipped === "number" ? result.skipped : 0;
  if (skipped === 0) {
    return { text: "incomplete", namesSkipped: false };
  }
  return { text: `incomplete, ${skipped.toLocaleString()} skipped`, namesSkipped: true };
}

function until(label: string, value: unknown): string {
  return typeof value === "string" && formatDayTime(value) !== ""
    ? `${label} until ${formatDayTime(value)}`
    : label;
}

function stopNotes(result: Record<string, unknown>, running: boolean): string[] {
  const notes: string[] = [];
  if (result.blocked === true) {
    notes.push(until("blocked", result.blockedUntil));
  }
  if (typeof result.pausedUntil === "string") {
    notes.push(until("paused", result.pausedUntil));
  } else if (result.backedOff === true) {
    notes.push("backed off");
  }
  if (result.cancelRequested === true) {
    notes.push(running ? "stopping" : "cancelled");
  }
  return notes;
}

export function runStopNote(
  result: Record<string, unknown> | null,
  options: { running?: boolean } = {},
): string | null {
  const notes = result === null ? [] : stopNotes(result, options.running === true);
  return notes.length === 0 ? null : notes.join(" · ");
}

export function summarizeRunResult(
  result: Record<string, unknown> | null,
  options: { running?: boolean } = {},
): string {
  if (result === null) {
    return "";
  }
  const note =
    options.running === true ? { text: null, namesSkipped: false } : coverageNote(result);
  const counters: [string, number][] = [];
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "number" && !(note.namesSkipped && key === "skipped")) {
      counters.push([key, value]);
    }
  }
  const budget = counters.filter(([key]) => key === BUDGET_COUNTER);
  const rest = counters.filter(([key]) => key !== BUDGET_COUNTER);
  return [
    ...stopNotes(result, options.running === true),
    ...(note.text === null ? [] : [note.text]),
    ...[...budget, ...rest]
      .slice(0, SUMMARY_LIMIT)
      .map(([key, value]) => `${value.toLocaleString()} ${key}`),
  ].join(" · ");
}
