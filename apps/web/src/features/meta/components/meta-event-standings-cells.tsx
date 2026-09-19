import type { MetaEventPlayer, MetaStandingsRow } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, ClockIcon } from "lucide-react";
import { Suspense } from "react";

import { RankBand } from "@/components/ui/rank-band";
import { TextLink } from "@/components/ui/text-link";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import {
  MetaEventDeckPreview,
  MetaEventDeckPreviewSkeleton,
} from "@/features/meta/components/meta-event-deck-preview";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { MetaRunStrip } from "@/features/meta/components/meta-run-strip";
import { useMetaPriceFormat } from "@/features/meta/hooks/use-meta-price-format";
import type { MetaDeckCost } from "@/features/meta/lib/meta-deck-collection";
import { finishBracketLabel, formatRank, formatRecord } from "@/features/meta/lib/meta-format";
import type { MetaPendingRowMark } from "@/features/meta/lib/meta-pending-submissions";
import { metaSubmitSearchForPlayer } from "@/features/meta/lib/meta-submit-link";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function RankCell({
  player,
  cutSize,
  className,
}: {
  player: MetaEventPlayer;
  cutSize: number | null;
  className?: string;
}) {
  return (
    <RankBand
      rank={player.rank}
      text={formatRank(player.rank, player.rankIsTier)}
      label={finishBracketLabel(player.rank, player.rankIsTier, cutSize)}
      filled={cutSize !== null && player.rank <= cutSize}
      className={className}
    />
  );
}

function MissingLine({ cost }: { cost: MetaDeckCost }) {
  const format = useMetaPriceFormat();
  if (cost.owned === undefined || cost.needed === 0) {
    return null;
  }
  if (cost.owned >= cost.needed) {
    return (
      <span className="text-border-accent text-xs font-medium">{m.meta_deck_buildable()}</span>
    );
  }
  if (cost.toComplete === undefined || cost.toComplete === 0) {
    return null;
  }
  return <span className="text-muted-foreground text-xs">{format(cost.toComplete)} missing</span>;
}

export function DeckValue({
  player,
  costs,
  className,
}: {
  player: MetaEventPlayer;
  costs: ReadonlyMap<string, MetaDeckCost> | undefined;
  className?: string;
}) {
  const format = useMetaPriceFormat();
  const cost = player.deckId === null ? undefined : costs?.get(player.deckId);
  if (cost === undefined) {
    return null;
  }
  return (
    <div className={cn("flex flex-col items-end gap-0.5 leading-tight tabular-nums", className)}>
      {cost.value !== undefined && <span>{format(cost.value)}</span>}
      <MissingLine cost={cost} />
    </div>
  );
}

export function LegendCell({ player }: { player: MetaEventPlayer }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <CardArtThumb
        imageId={player.legend?.imageId ?? player.champion?.imageId ?? null}
        domains={player.legend?.domains}
        loading="lazy"
        className="w-9"
      />
      <MetaIdentity
        name={player.legend?.name}
        slug={player.legend?.slug}
        archiveSlug={player.legend?.archiveSlug}
        domains={player.legend?.domains}
        layout="stacked"
      />
    </div>
  );
}

function RunStripLink({ player, slug }: { player: MetaStandingsRow; slug: string }) {
  const rounds = player.rounds;
  if (player.playerKey === null) {
    return <MetaRunStrip rounds={rounds} />;
  }
  return (
    <Link
      to="/meta/$slug/players/$key"
      params={{ slug, key: player.playerKey }}
      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
    >
      <MetaRunStrip rounds={rounds} />
      <ChevronRightIcon className="size-4" />
    </Link>
  );
}

export function RunCell({
  player,
  slug,
  layout = "stacked",
  className,
}: {
  player: MetaStandingsRow;
  slug: string;
  layout?: "stacked" | "inline";
  className?: string;
}) {
  const record = formatRecord(player.wins, player.losses, player.draws);
  const charted = player.rounds.length > 0;
  if (!charted && record === null) {
    return null;
  }
  return (
    <div
      className={cn(
        "flex",
        layout === "stacked"
          ? "flex-col items-start gap-1"
          : "flex-wrap items-center gap-x-2 gap-y-0.5",
        className,
      )}
    >
      {charted && <RunStripLink player={player} slug={slug} />}
      {record !== null && (
        <span className="text-muted-foreground text-xs tabular-nums">{record}</span>
      )}
    </div>
  );
}

export function DeckCell({
  player,
  slug,
  canSubmit,
  expanded,
  pending,
  className,
}: {
  player: MetaEventPlayer;
  slug: string;
  canSubmit: boolean;
  expanded: boolean;
  pending?: MetaPendingRowMark;
  className?: string;
}) {
  if (player.shareToken !== null) {
    return (
      <span
        className={cn(
          "text-muted-foreground inline-flex items-center gap-1 whitespace-nowrap",
          className,
        )}
      >
        {pending !== undefined && (
          <ClockIcon
            role="img"
            aria-label={
              pending.mine
                ? m.meta_pending_your_update_in_review()
                : m.meta_pending_update_in_review()
            }
            className="size-3.5 shrink-0"
          />
        )}
        {player.listStatus === "partial"
          ? m.meta_list_status_partial()
          : m.meta_standings_decklist()}
        <ChevronRightIcon
          className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-90")}
        />
      </span>
    );
  }
  if (pending?.mine) {
    return (
      <TextLink
        className={cn("whitespace-nowrap", className)}
        render={<Link to="/meta/submissions" />}
      >
        {m.meta_pending_yours_in_review()}
      </TextLink>
    );
  }
  if (pending !== undefined) {
    return (
      <span className={cn("text-muted-foreground whitespace-nowrap", className)}>
        {m.meta_pending_in_review()}
      </span>
    );
  }
  if (!canSubmit) {
    return null;
  }
  return (
    <TextLink
      className={cn("font-medium whitespace-nowrap", className)}
      render={
        <Link
          to="/meta/$slug/submit"
          params={{ slug }}
          search={metaSubmitSearchForPlayer({ ...player, playerId: player.id })}
        />
      }
    >
      + Add
    </TextLink>
  );
}

export function DeckPreview({ token }: { token: string }) {
  return (
    <Suspense fallback={<MetaEventDeckPreviewSkeleton />}>
      <MetaEventDeckPreview token={token} />
    </Suspense>
  );
}
