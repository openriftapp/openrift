import type {
  MetaCancellableJob,
  MetaCatalogTriage,
  MetaSource,
} from "@openrift/shared/contracts/admin/meta-catalog";
import type { META_CATALOG_DISPLAY_STATUSES } from "@openrift/shared/types/enums";

/** The tab a funnel stage or an alert opens, with its catalogue pre-filter. */
export interface MetaAdminTarget {
  tab?: "catalogue" | "review" | "public";
  triage?: MetaCatalogTriage;
  missing?: boolean;
  awaitingResults?: boolean;
  eventStatus?: (typeof META_CATALOG_DISPLAY_STATUSES)[number];
}

/** Every catalogue link must name its source; both sources render at once. */
export function catalogueSource(source: MetaSource): MetaSource | undefined {
  return source === "uvsgames" ? undefined : source;
}

const META_SYNC_TRIGGERS = [
  "runSync",
  "runBackfill",
  "restartBackfill",
  "runRecheck",
  "runIdSweep",
  "runAutoAccept",
  "runRetier",
  "runRepromote",
  "runPlayloltcgSync",
  "runPlayloltcgRecheck",
  "runPlayloltcgAutoAccept",
  "runPlayloltcgBackfill",
  "restartPlayloltcgBackfill",
  "runTopdeckSync",
  "runTopdeckAutoAccept",
  "runTopdeckBackfill",
  "restartTopdeckBackfill",
  "runPlayriftboundSync",
  "runPlayriftboundRecheck",
  "runPlayriftboundAutoAccept",
  "runPlayriftboundBackfill",
  "restartPlayriftboundBackfill",
] as const;

export type MetaSyncTrigger = (typeof META_SYNC_TRIGGERS)[number];

export interface TriggerEntry {
  trigger: MetaSyncTrigger;
  label: string;
  description: string;
  scheduleKey?: string;
  stop?: { job: MetaCancellableJob; label: string; description: string };
  confirm?: { title: string; body: (pending: number | null) => string; action: string };
}

const AUTO_ACCEPT_DESCRIPTION =
  "Runs the rule over every mirrored event still undecided. Only needed after changing the rule.";

const AUTO_ACCEPT_CONFIRM = {
  title: "Apply the auto-publish rule?",
  body: (pending: number | null) =>
    `The rule runs over ${pending === null ? "every undecided event" : `all ${pending.toLocaleString()} undecided events`}, and every match is published. Rejected events are left alone. Nothing unpublishes in bulk.`,
  action: "Apply the rule",
};

const ID_SWEEP_DESCRIPTION =
  "Asks the source about event ids the listing never returns, which is the only way to reach an unlisted or cancelled event. One request per id, so a run takes a bounded slice and the next one carries on.";

const ID_SWEEP_CONFIRM = {
  title: "Find unlisted events?",
  body: () =>
    "The sweep spends one request per id, up to 5,000 in a run, against a source the rest of the pipeline asks a few hundred times a week. Nothing is ever asked about twice, so stopping and continuing later costs nothing.",
  action: "Probe ids",
};

export const TRIGGER_GROUPS: Record<MetaSource, TriggerEntry[]> = {
  uvsgames: [
    {
      trigger: "runSync",
      label: "Refresh mirror",
      description: "Re-reads the last 7 days and everything upcoming into the mirror.",
      scheduleKey: "meta.uvsgames_sync",
    },
    {
      trigger: "runAutoAccept",
      label: "Apply auto-publish rule",
      description: AUTO_ACCEPT_DESCRIPTION,
      confirm: AUTO_ACCEPT_CONFIRM,
    },
    {
      trigger: "runRecheck",
      label: "Collect results",
      description:
        "Re-reads the last three days of the list, then fetches standings and decklists for published events whose next check is due, important ones first, for up to five minutes.",
      scheduleKey: "meta.uvsgames_recheck",
      stop: {
        job: "recheck",
        label: "Stop collecting results",
        description:
          "Stopping keeps every event it already collected, and the next run picks up the ones still due.",
      },
    },
    {
      trigger: "runIdSweep",
      label: "Find unlisted events",
      description: ID_SWEEP_DESCRIPTION,
      confirm: ID_SWEEP_CONFIRM,
      stop: {
        job: "id_sweep",
        label: "Stop finding unlisted events",
        description:
          "Stopping keeps every id it already probed, and the next run carries on with the rest.",
      },
    },
  ],
  playloltcg: [
    {
      trigger: "runPlayloltcgSync",
      label: "Refresh mirror",
      description: "Re-reads the last 7 days and everything upcoming into the mirror.",
      scheduleKey: "meta.playloltcg_sync",
    },
    {
      trigger: "runPlayloltcgAutoAccept",
      label: "Apply auto-publish rule",
      description: AUTO_ACCEPT_DESCRIPTION,
      confirm: AUTO_ACCEPT_CONFIRM,
    },
    {
      trigger: "runPlayloltcgRecheck",
      label: "Collect results",
      description:
        "Re-reads the last three days of the list, then fetches standings and decklists for published events whose next check is due, important ones first, for up to five minutes.",
      scheduleKey: "meta.playloltcg_recheck",
    },
  ],
  topdeck: [
    {
      trigger: "runTopdeckSync",
      label: "Refresh mirror",
      description:
        "Re-reads the last 30 days of each format. Standings and decklists come in the same pass, so there is no Collect results job.",
      scheduleKey: "meta.topdeck_sync",
    },
    {
      trigger: "runTopdeckAutoAccept",
      label: "Apply auto-publish rule",
      description: AUTO_ACCEPT_DESCRIPTION,
      confirm: AUTO_ACCEPT_CONFIRM,
    },
  ],
  playriftbound: [
    {
      trigger: "runPlayriftboundSync",
      label: "Refresh mirror",
      description:
        "Re-reads events around every known store, from 7 days back to 2 weeks ahead. Only stores Find stores has found are covered.",
      scheduleKey: "meta.playriftbound_sync",
    },
    {
      trigger: "runPlayriftboundAutoAccept",
      label: "Apply auto-publish rule",
      description: AUTO_ACCEPT_DESCRIPTION,
      confirm: AUTO_ACCEPT_CONFIRM,
    },
    {
      trigger: "runPlayriftboundRecheck",
      label: "Collect results",
      description:
        "Re-queues the events running now, then fetches standings and pairings for published events that changed, important ones first, for up to five minutes.",
      scheduleKey: "meta.playriftbound_recheck",
    },
  ],
};

export const BACKFILL_TRIGGERS_BY_SOURCE: Record<
  MetaSource,
  Record<"idle" | "resumable", TriggerEntry[]>
> = {
  uvsgames: {
    idle: [
      {
        trigger: "runBackfill",
        label: "Mirror full history",
        description:
          "Reads every event the source has listed, resuming where the last run stopped.",
      },
    ],
    resumable: [
      {
        trigger: "runBackfill",
        label: "Mirror full history: continue",
        description: "Picks up where the last one stopped.",
      },
      {
        trigger: "restartBackfill",
        label: "Mirror full history: from scratch",
        description: "Starts again from the oldest event, ignoring the resume point.",
      },
    ],
  },
  playloltcg: {
    idle: [
      {
        trigger: "runPlayloltcgBackfill",
        label: "Mirror full history",
        description:
          "Reads every event the source has listed, resuming where the last run stopped.",
      },
    ],
    resumable: [
      {
        trigger: "runPlayloltcgBackfill",
        label: "Mirror full history: continue",
        description: "Picks up where the last one stopped.",
      },
      {
        trigger: "restartPlayloltcgBackfill",
        label: "Mirror full history: from scratch",
        description: "Starts again from the oldest event, ignoring the resume point.",
      },
    ],
  },
  topdeck: {
    idle: [
      {
        trigger: "runTopdeckBackfill",
        label: "Mirror full history",
        description:
          "Reads every event the source has listed, resuming where the last run stopped.",
      },
    ],
    resumable: [
      {
        trigger: "runTopdeckBackfill",
        label: "Mirror full history: continue",
        description: "Picks up where the last one stopped.",
      },
      {
        trigger: "restartTopdeckBackfill",
        label: "Mirror full history: from scratch",
        description: "Starts again from the oldest event, ignoring the resume point.",
      },
    ],
  },
  playriftbound: {
    idle: [
      {
        trigger: "runPlayriftboundBackfill",
        label: "Find stores",
        description:
          "Searches the whole map for stores with events, so Refresh mirror knows where to look. About 10,000 searches.",
      },
    ],
    resumable: [
      {
        trigger: "runPlayriftboundBackfill",
        label: "Find stores: continue",
        description: "Picks up at the area the last one stopped at.",
      },
      {
        trigger: "restartPlayriftboundBackfill",
        label: "Find stores: from scratch",
        description: "Starts again from the first area, ignoring the resume point.",
      },
    ],
  },
};

export const JOB_KIND_PREFIX: Record<MetaSource, string> = {
  uvsgames: "meta.uvsgames_",
  playloltcg: "meta.playloltcg_",
  topdeck: "meta.topdeck_",
  playriftbound: "meta.playriftbound_",
};

export const BACKFILL_KIND: Record<MetaSource, string> = {
  uvsgames: "meta.uvsgames_backfill",
  playloltcg: "meta.playloltcg_backfill",
  topdeck: "meta.topdeck_backfill",
  playriftbound: "meta.playriftbound_backfill",
};

export const ARCHIVE_TRIGGERS: TriggerEntry[] = [
  {
    trigger: "runRetier",
    label: "Reapply tier rules",
    description:
      "Applies the current template mappings to every published event. Run it after editing tier mappings in Templates & formats.",
  },
  {
    trigger: "runRepromote",
    label: "Rebuild published events",
    description:
      "Rewrites every published event from its mirrored source data and accepted overlays. Takes several minutes.",
    confirm: {
      title: "Rebuild every published event?",
      body: () =>
        "Every published event is rewritten from its mirrored source data and accepted overlays. Nothing a reviewer accepted is lost. The pass takes several minutes.",
      action: "Rebuild",
    },
  },
];

export const ARCHIVE_KIND_BY_TRIGGER: Partial<Record<MetaSyncTrigger, string>> = {
  runRetier: "meta.retier",
  runRepromote: "meta.repromote",
};
