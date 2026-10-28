import type {
  MetaCatalogRow,
  MetaCatalogTriage,
  MetaSource,
  PlayloltcgCatalogRow,
  PlayriftboundCatalogRow,
  TopdeckCatalogRow,
} from "@openrift/shared/contracts/admin/meta-catalog";
import { formatDay, formatDayTime } from "@openrift/shared/format-date";
import type { MetaResultsState } from "@openrift/shared/meta-results";
import { mirrorResultsState } from "@openrift/shared/meta-results";
import { playriftboundFormatLabel } from "@openrift/shared/playriftbound-links";

import type { CatalogChipDisplay } from "@/features/meta/lib/meta-catalog-display";
import {
  catalogStatusDisplay,
  META_SOURCE_LABELS,
  playloltcgStatusDisplay,
  playriftboundTypeLabel,
} from "@/features/meta/lib/meta-catalog-display";

interface MirrorBadge extends CatalogChipDisplay {
  title?: string;
}

export interface MetaMirrorRow {
  source: MetaSource;
  key: string;
  name: string;
  sourceUrl: string;
  /** An instant, or a calendar day where the source publishes only a day. */
  startAt: string | null;
  startIsDay: boolean;
  venue: string | null;
  players: number | null;
  capacity: number | null;
  atSource: CatalogChipDisplay | null;
  badges: MirrorBadge[];
  triage: MetaCatalogTriage;
  metaEventId: string | null;
  results: MetaResultsState | null;
  resultsDetail: string[];
  nextCheckAt: string | null;
  collects: boolean;
  unmappedFormat: string | null;
}

function venueOf(...parts: (string | null)[]): string | null {
  const present = parts.filter((part): part is string => part !== null && part !== "");
  return present.length === 0 ? null : present.join(", ");
}

function started(startAt: string | null, isDay: boolean, now: Date): boolean {
  if (startAt === null) {
    return false;
  }
  return isDay
    ? startAt <= now.toISOString().slice(0, 10)
    : new Date(startAt).getTime() <= now.getTime();
}

function count(value: number, one: string, many: string): string {
  return `${value.toLocaleString()} ${value === 1 ? one : many}`;
}

function missingBadge(missingSince: string | null): MirrorBadge[] {
  return missingSince === null
    ? []
    : [{ label: "Gone from the source", variant: "destructive", title: formatDay(missingSince) }];
}

function stagedDetail(row: { stagedPlayerCount: number; stagedDeckCount: number }): string[] {
  return [
    count(row.stagedPlayerCount, "standing", "standings"),
    ...(row.stagedDeckCount > 0 ? [count(row.stagedDeckCount, "deck", "decks")] : []),
  ];
}

export function uvsgamesMirrorRow(
  row: MetaCatalogRow,
  formatLabels: Record<string, string>,
  now: Date,
): MetaMirrorRow {
  const missing: MirrorBadge[] =
    row.missingSince === null
      ? []
      : row.missingProbe === "found"
        ? [
            {
              label: "Only reachable by id",
              variant: "subtle",
              title: formatDayTime(row.missingSince),
            },
          ]
        : row.missingProbe === "absent"
          ? missingBadge(row.missingSince)
          : [
              {
                label: "Gone from the listing",
                variant: "outline",
                title: formatDayTime(row.missingSince),
              },
            ];
  const published = row.triage === "accepted";
  return {
    source: "uvsgames",
    key: row.externalId,
    name: row.name,
    sourceUrl: row.sourceUrl,
    startAt: row.startAt,
    startIsDay: false,
    venue: venueOf(row.storeName, row.location),
    players: row.playerCount,
    capacity: null,
    atSource: catalogStatusDisplay(row.displayStatus),
    badges: [
      ...(row.officialLabel === null
        ? []
        : [{ label: row.officialLabel, variant: "outline" as const, title: "Watched event type" }]),
      ...(row.mappedFormat === null
        ? [
            {
              label: `${row.eventFormat ?? "No format"}, unmapped`,
              variant: "warning" as const,
            },
          ]
        : [
            {
              label: formatLabels[row.mappedFormat] ?? row.mappedFormat,
              variant: "subtle" as const,
            },
          ]),
      ...(row.decklistStatus === "PUBLISHED"
        ? [{ label: "Decklists", variant: "subtle" as const }]
        : []),
      ...missing,
    ],
    triage: row.triage,
    metaEventId: row.metaEventId,
    results: published
      ? mirrorResultsState({
          started: started(row.startAt, false, now),
          hasResults: row.displayStatus === "complete",
          nextCheckAt: row.nextCheckAt,
        })
      : null,
    resultsDetail: published ? stagedDetail(row) : [],
    nextCheckAt: row.nextCheckAt,
    collects: true,
    unmappedFormat: row.mappedFormat === null ? (row.eventFormat ?? "") : null,
  };
}

export function playloltcgMirrorRow(row: PlayloltcgCatalogRow, now: Date): MetaMirrorRow {
  const published = row.triage === "accepted";
  return {
    source: "playloltcg",
    key: String(row.activityShopId),
    name: row.name,
    sourceUrl: row.sourceUrl,
    startAt: row.startAt,
    startIsDay: true,
    venue: venueOf(row.shopName, row.city),
    players: row.playerCount,
    capacity: null,
    atSource: playloltcgStatusDisplay(row.status) ?? null,
    badges: [
      ...(row.battleMode !== null && row.battleMode !== "1v1"
        ? [{ label: row.battleMode, variant: "subtle" as const }]
        : []),
      ...missingBadge(row.missingSince),
    ],
    triage: row.triage,
    metaEventId: row.metaEventId,
    results: published
      ? mirrorResultsState({
          started: started(row.startAt, true, now),
          hasResults: row.status === 5,
          nextCheckAt: row.nextCheckAt,
        })
      : null,
    resultsDetail: published ? stagedDetail(row) : [],
    nextCheckAt: row.nextCheckAt,
    collects: true,
    unmappedFormat: null,
  };
}

export function topdeckMirrorRow(row: TopdeckCatalogRow, now: Date): MetaMirrorRow {
  const published = row.triage === "accepted";
  const rival = row.rivalProvider;
  return {
    source: "topdeck",
    key: row.tid,
    name: row.name,
    sourceUrl: row.sourceUrl,
    startAt: row.startAt,
    startIsDay: false,
    venue: venueOf(row.city, row.country),
    players: row.playerCount,
    capacity: null,
    atSource: null,
    badges: [
      { label: row.format, variant: "subtle" },
      ...(row.isTeamEvent ? [{ label: "Teams", variant: "warning" as const }] : []),
      ...(row.topCut !== null && row.topCut > 0
        ? [{ label: `Top ${row.topCut}`, variant: "subtle" as const }]
        : []),
      ...(rival === null
        ? []
        : [
            {
              label: `Cited only, ${META_SOURCE_LABELS[rival as MetaSource] ?? rival} feeds standings`,
              variant: "neutral" as const,
            },
          ]),
      ...missingBadge(row.missingSince),
    ],
    triage: row.triage,
    metaEventId: row.metaEventId,
    results: published
      ? mirrorResultsState({
          started: started(row.startAt, false, now),
          hasResults: (row.playerCount ?? 0) > 0,
          nextCheckAt: null,
        })
      : null,
    resultsDetail: published ? stagedDetail(row) : [],
    nextCheckAt: null,
    collects: false,
    unmappedFormat: null,
  };
}

export function playriftboundMirrorRow(row: PlayriftboundCatalogRow, now: Date): MetaMirrorRow {
  const published = row.triage === "accepted";
  const type = playriftboundTypeLabel(row.tournamentType);
  const format = playriftboundFormatLabel(row.format);
  const open = (row.roundsPlayed ?? 0) - (row.roundsFinalized ?? 0);
  return {
    source: "playriftbound",
    key: row.tournamentId,
    name: row.name,
    sourceUrl: row.sourceUrl,
    startAt: row.startAt,
    startIsDay: false,
    venue: venueOf(row.organizerName, row.city),
    players: row.registeredCount,
    capacity: row.participantCapacity,
    atSource:
      row.roundCount === null && row.roundsPlayed === null
        ? null
        : {
            label: `Round ${row.roundsPlayed ?? 0}${row.roundCount === null ? "" : ` of ${row.roundCount}`}`,
            variant: "outline",
          },
    badges: [
      ...(type === null ? [] : [{ label: type, variant: "outline" as const }]),
      ...(format === null ? [] : [{ label: format, variant: "subtle" as const }]),
      ...(row.playerFormat !== null && row.playerFormat !== "ONE_V_ONE"
        ? [{ label: "Team", variant: "warning" as const, title: "Team events never auto-publish" }]
        : []),
      ...missingBadge(row.missingSince),
    ],
    triage: row.triage,
    metaEventId: row.metaEventId,
    results: published
      ? mirrorResultsState({
          started: started(row.startAt, false, now),
          hasResults: (row.roundsPlayed ?? 0) > 0,
          nextCheckAt: row.nextCheckAt,
        })
      : null,
    resultsDetail: published
      ? [
          count(row.stagedPlayerCount, "standing", "standings"),
          ...(row.stagedMatchCount > 0 ? [count(row.stagedMatchCount, "pairing", "pairings")] : []),
          ...(open > 0 ? [count(open, "round open", "rounds open")] : []),
        ]
      : [],
    nextCheckAt: row.nextCheckAt,
    collects: true,
    unmappedFormat: null,
  };
}
