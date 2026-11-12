export const META_JOB_KINDS = [
  "meta.uvsgames_sync",
  "meta.uvsgames_backfill",
  "meta.uvsgames_recheck",
  "meta.uvsgames_id_sweep",
  "meta.uvsgames_event_fetch",
  "meta.uvsgames_auto_accept",
  "meta.playloltcg_sync",
  "meta.playloltcg_backfill",
  "meta.playloltcg_recheck",
  "meta.playloltcg_event_fetch",
  "meta.playloltcg_auto_accept",
  "meta.topdeck_sync",
  "meta.topdeck_backfill",
  "meta.topdeck_auto_accept",
  "meta.playriftbound_sync",
  "meta.playriftbound_backfill",
  "meta.playriftbound_recheck",
  "meta.playriftbound_event_fetch",
  "meta.playriftbound_auto_accept",
  "meta.retier",
  "meta.repromote",
] as const;

const SOURCE_KIND = /^meta\.(?<source>[a-z]+)_/u;

export function sourceJobKinds(kind: string): string[] {
  const source = SOURCE_KIND.exec(kind)?.groups?.source;
  if (source === undefined) {
    return [kind];
  }
  return META_JOB_KINDS.filter((candidate) => candidate.startsWith(`meta.${source}_`));
}
