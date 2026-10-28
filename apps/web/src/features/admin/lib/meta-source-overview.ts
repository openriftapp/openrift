import type { MetaSource, MetaSyncStatus } from "@openrift/shared/contracts/admin/meta-catalog";

import type { TriggerEntry } from "@/features/admin/lib/meta-admin-triggers";
import { BACKFILL_KIND, TRIGGER_GROUPS } from "@/features/admin/lib/meta-admin-triggers";

export type MetaRun = MetaSyncStatus["runs"][number];

export type MetaTone = "ok" | "warn" | "bad" | "running" | "off";

export interface MetaRunCell {
  tone: MetaTone;
  at: string | null;
  detail: string;
}

const REFRESH_STALE_MS = 26 * 60 * 60 * 1000;

const OVERDUE_LIMIT_MS = 2 * 60 * 60 * 1000;

export function refreshKind(source: MetaSource): string {
  return `meta.${source}_sync`;
}

/** `null` for a source whose mirror refresh carries the results itself. */
export function collectKind(source: MetaSource): string | null {
  return (
    TRIGGER_GROUPS[source].find((entry) => entry.scheduleKey?.endsWith("_recheck"))?.scheduleKey ??
    null
  );
}

export function newestRun(runs: readonly MetaRun[]): MetaRun | undefined {
  let newest: MetaRun | undefined;
  for (const run of runs) {
    if (newest === undefined || run.startedAt > newest.startedAt) {
      newest = run;
    }
  }
  return newest;
}

export function latestRun(runs: readonly MetaRun[], kind: string): MetaRun | undefined {
  return newestRun(runs.filter((run) => run.kind === kind));
}

const JOB_LABELS: [suffix: string, label: string][] = [
  ["_sync", "Refresh mirror"],
  ["_recheck", "Collect results"],
  ["_event_fetch", "Collect results for one event"],
  ["_auto_accept", "Apply auto-publish rule"],
  ["_id_sweep", "Find unlisted events"],
];

export function metaJobLabel(kind: string): string {
  if (kind === BACKFILL_KIND.playriftbound) {
    return "Find stores";
  }
  if (kind.endsWith("_backfill")) {
    return "Mirror full history";
  }
  return JOB_LABELS.find(([suffix]) => kind.endsWith(suffix))?.[1] ?? kind;
}

function numberOf(result: Record<string, unknown> | null, key: string): number {
  const value = result?.[key];
  return typeof value === "number" ? value : 0;
}

function errorsOf(result: Record<string, unknown> | null): string[] {
  const errors = result?.errors;
  return Array.isArray(errors) ? errors.filter((error) => typeof error === "string") : [];
}

function unfinished(run: MetaRun): MetaRunCell | null {
  if (run.status === "running") {
    return { tone: "running", at: run.startedAt, detail: "running" };
  }
  if (run.status === "failed") {
    return { tone: "bad", at: run.startedAt, detail: run.errorMessage ?? "failed" };
  }
  return null;
}

export function refreshCell(run: MetaRun | undefined, scheduled: boolean, now: Date): MetaRunCell {
  if (run === undefined) {
    return scheduled
      ? { tone: "warn", at: null, detail: "never ran" }
      : { tone: "off", at: null, detail: "not scheduled" };
  }
  const open = unfinished(run);
  if (open !== null) {
    return open;
  }
  const { result } = run;
  const errors = errorsOf(result);
  const inserted = numberOf(result, "inserted");
  const published = numberOf(result, "autoAccepted");
  if (numberOf(result, "rows") === 0 && errors.length > 0) {
    return { tone: "warn", at: run.startedAt, detail: errors[0] ?? "" };
  }
  const parts = [`${inserted.toLocaleString()} new`];
  if (published > 0) {
    parts.push(`${published.toLocaleString()} published`);
  }
  if (errors.length > 0) {
    parts.push(`${errors.length.toLocaleString()} ${errors.length === 1 ? "error" : "errors"}`);
  }
  const stale = scheduled && now.getTime() - new Date(run.startedAt).getTime() > REFRESH_STALE_MS;
  return {
    tone: stale ? "bad" : errors.length > 0 ? "warn" : "ok",
    at: run.startedAt,
    detail: stale ? "last run over a day ago" : parts.join(" · "),
  };
}

export function collectDetail(run: MetaRun): MetaRunCell {
  const open = unfinished(run);
  if (open !== null) {
    return open;
  }
  const { result } = run;
  const errors = errorsOf(result);
  if (result?.blocked === true || result?.backedOff === true) {
    return { tone: "warn", at: run.startedAt, detail: "the source refused requests" };
  }
  const fetched = numberOf(result, "fetched");
  const players = numberOf(result, "players");
  const detail =
    fetched > 0
      ? `${fetched.toLocaleString()} ${fetched === 1 ? "event" : "events"}, ${players.toLocaleString()} players`
      : numberOf(result, "due") === 0
        ? "nothing due"
        : "nothing new";
  return {
    tone: errors.length > 0 ? "warn" : "ok",
    at: run.startedAt,
    detail:
      errors.length > 0
        ? `${detail} · ${errors.length.toLocaleString()} ${errors.length === 1 ? "error" : "errors"}`
        : detail,
  };
}

export interface MetaOverdue {
  count: number;
  oldestAt: string | null;
  behind: boolean;
}

export function overdueOf(catalog: MetaSyncStatus["catalog"], now: Date): MetaOverdue {
  const behind =
    catalog.oldestDueAt !== null &&
    now.getTime() - new Date(catalog.oldestDueAt).getTime() > OVERDUE_LIMIT_MS;
  return { count: catalog.dueRecheck, oldestAt: catalog.oldestDueAt, behind };
}

export function sourceTone(
  alertIds: readonly string[],
  runs: readonly MetaRun[],
  source: MetaSource,
): MetaTone {
  if (alertIds.includes("failed-runs")) {
    return "bad";
  }
  if (alertIds.length > 0) {
    return "warn";
  }
  return latestRun(runs, BACKFILL_KIND[source])?.status === "running" ? "running" : "ok";
}

export function autoPublishRuleText(settings: {
  autoAcceptMinPlayers: number | null;
  autoAcceptOfficial: boolean;
  autoAcceptNotable: boolean;
}): string {
  const parts = [
    ...(settings.autoAcceptMinPlayers === null
      ? []
      : [`${settings.autoAcceptMinPlayers}+ players, all sources`]),
    ...(settings.autoAcceptOfficial ? ["watched event types (UVS Games)"] : []),
    ...(settings.autoAcceptNotable ? ["notable names (UVS Games)"] : []),
  ];
  return parts.length === 0 ? "Auto-publish is off" : `Auto-publish rule: ${parts.join(" · ")}`;
}

export function triggerKind(source: MetaSource, entry: TriggerEntry): string {
  if (entry.scheduleKey !== undefined) {
    return entry.scheduleKey;
  }
  if (entry.trigger.endsWith("AutoAccept")) {
    return `meta.${source}_auto_accept`;
  }
  if (entry.trigger === "runIdSweep") {
    return "meta.uvsgames_id_sweep";
  }
  return BACKFILL_KIND[source];
}
