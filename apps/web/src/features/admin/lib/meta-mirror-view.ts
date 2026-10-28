import type {
  MetaCatalogTriage,
  MetaSource,
  MetaSyncBucketFilter,
  MetaSyncSettings,
  MetaSyncStatus,
} from "@openrift/shared/contracts/admin/meta-catalog";
import type { MetaResultsState } from "@openrift/shared/meta-results";

import type { CatalogChipDisplay } from "@/features/meta/lib/meta-catalog-display";

export const RESULTS_DISPLAY: Record<MetaResultsState, CatalogChipDisplay> = {
  notStarted: { label: "Not started", variant: "outline" },
  collecting: { label: "Collecting results", variant: "info" },
  final: { label: "Final", variant: "success" },
  noResults: { label: "No results", variant: "neutral" },
};

/** The counts the rail shows: a list's own when a filter narrows it, else the sync status's. */
export interface MirrorCounts {
  needsDecision: number;
  passingNoResults: number;
  skippedUpcoming: number;
  skippedPast: number;
  notStarted: number;
  collecting: number;
  final: number;
  noResults: number;
  undecided: number;
  published: number;
  rejected: number;
  total: number;
}

export function mirrorCountsFromStatus(status: MetaSyncStatus): MirrorCounts {
  const { catalog, counts } = status;
  return {
    needsDecision: catalog.needsDecision,
    passingNoResults: catalog.passingNoResults,
    skippedUpcoming: catalog.skippedUpcoming,
    skippedPast: catalog.skippedPast,
    notStarted: catalog.notStarted,
    collecting: catalog.collecting,
    final: catalog.final,
    noResults: catalog.noResults,
    undecided: counts.new,
    published: counts.accepted,
    rejected: counts.dismissed,
    total: catalog.total,
  };
}

type MirrorTriage = MetaCatalogTriage | "any";

export interface MirrorView {
  triage: MirrorTriage;
  bucket?: MetaSyncBucketFilter;
}

export interface MirrorRailItem {
  id: string;
  label: string;
  count: number | null;
  view: MirrorView;
  description: string;
}

export interface MirrorRailGroup {
  item: MirrorRailItem;
  children: MirrorRailItem[];
}

const BUCKET_TRIAGE: Record<MetaSyncBucketFilter, MetaCatalogTriage> = {
  needsDecision: "new",
  passingNoResults: "new",
  skippedUpcoming: "new",
  skippedPast: "new",
  notStarted: "accepted",
  collecting: "accepted",
  final: "accepted",
  noResults: "accepted",
};

const BUCKET_LABELS: Record<MetaSyncBucketFilter, string> = {
  needsDecision: "Needs a decision",
  passingNoResults: "Pass the rule, no results",
  skippedUpcoming: "Skipped, not started",
  skippedPast: "Skipped, past",
  notStarted: "Not started",
  collecting: "Collecting results",
  final: "Final",
  noResults: "No results",
};

const BUCKET_DESCRIPTIONS: Record<MetaSyncBucketFilter, string> = {
  needsDecision: "Past and undecided. They pass the auto-publish rule and have results.",
  passingNoResults: "Past and undecided. They pass the rule, but the source recorded no results.",
  skippedUpcoming: "Undecided and not started. Judged again on every refresh until they start.",
  skippedPast: "Past and undecided. They do not pass the auto-publish rule.",
  notStarted: "Published. Results are first collected when each one starts.",
  collecting: "Published and started. Checked again while standings can still change.",
  final: "Published. Standings collected, no more checks.",
  noResults: "Published and started. The source recorded no results.",
};

function bucketItem(
  bucket: MetaSyncBucketFilter,
  counts: MirrorCounts,
  collects: boolean,
): MirrorRailItem {
  return {
    id: bucket,
    label: BUCKET_LABELS[bucket],
    count: bucket === "collecting" && !collects ? null : counts[bucket],
    view: { triage: BUCKET_TRIAGE[bucket], bucket },
    description: BUCKET_DESCRIPTIONS[bucket],
  };
}

/** `collects` is false for a source whose refresh carries the results, which never collects. */
export function mirrorRail(counts: MirrorCounts, collects: boolean): MirrorRailGroup[] {
  const item = (bucket: MetaSyncBucketFilter) => bucketItem(bucket, counts, collects);
  return [
    {
      item: {
        id: "new",
        label: "Undecided",
        count: counts.undecided,
        view: { triage: "new" },
        description: "Neither published nor rejected.",
      },
      children: [
        item("needsDecision"),
        item("passingNoResults"),
        item("skippedUpcoming"),
        item("skippedPast"),
      ],
    },
    {
      item: {
        id: "accepted",
        label: "Published",
        count: counts.published,
        view: { triage: "accepted" },
        description: "On the public archive.",
      },
      children: [item("notStarted"), item("collecting"), item("final"), item("noResults")],
    },
    {
      item: {
        id: "dismissed",
        label: "Rejected",
        count: counts.rejected,
        view: { triage: "dismissed" },
        description: "Turned down by hand. Refresh mirror never offers them again.",
      },
      children: [],
    },
    {
      item: {
        id: "any",
        label: "All events",
        count: counts.total,
        view: { triage: "any" },
        description: "Every event as the source last listed it.",
      },
      children: [],
    },
  ];
}

/** An untouched Mirror opens on the events waiting for a decision. */
export function mirrorViewFromSearch(search: {
  triage?: MirrorTriage;
  bucket?: MetaSyncBucketFilter;
}): MirrorView {
  if (search.bucket !== undefined) {
    return { triage: BUCKET_TRIAGE[search.bucket], bucket: search.bucket };
  }
  if (search.triage !== undefined) {
    return { triage: search.triage };
  }
  return { triage: "new", bucket: "needsDecision" };
}

export function mirrorViewId(view: MirrorView): string {
  return view.bucket ?? view.triage;
}

export function findRailItem(
  groups: MirrorRailGroup[],
  view: MirrorView,
): MirrorRailItem | undefined {
  const id = mirrorViewId(view);
  return groups
    .flatMap((group) => [group.item, ...group.children])
    .find((entry) => entry.id === id);
}

/** The view's own URL params: a bucket implies its triage, so only one of them is written. */
export function mirrorViewSearch(view: MirrorView): {
  triage?: MirrorTriage;
  bucket?: MetaSyncBucketFilter;
} {
  return view.bucket === undefined
    ? { triage: view.triage, bucket: undefined }
    : { triage: undefined, bucket: view.bucket };
}

function joinOr(parts: string[]): string {
  return new Intl.ListFormat("en", { type: "disjunction" }).format(parts);
}

/** The rule a source's undecided events are judged by, built from the stored settings. */
export function autoPublishRuleSentence(
  source: MetaSource,
  settings: Pick<
    MetaSyncSettings,
    "autoAcceptMinPlayers" | "autoAcceptOfficial" | "autoAcceptNotable"
  >,
): string {
  const min = settings.autoAcceptMinPlayers;
  if (source === "uvsgames") {
    const parts = [
      ...(min === null ? [] : [`${min}+ players`]),
      ...(settings.autoAcceptOfficial ? ["a watched event type"] : []),
      ...(settings.autoAcceptNotable ? ["a notable name"] : []),
    ];
    return parts.length === 0
      ? "Auto-publish is off."
      : `Auto-publish: ${joinOr(parts)}, with a mapped format. Cancelled events never publish.`;
  }
  if (min === null) {
    return "Auto-publish is off.";
  }
  switch (source) {
    case "playloltcg": {
      return `Auto-publish: ${min}+ players.`;
    }
    case "topdeck": {
      return `Auto-publish: ${min}+ players, solo events only.`;
    }
    case "playriftbound": {
      return `Auto-publish: ${min}+ registrations, solo events only.`;
    }
  }
}
