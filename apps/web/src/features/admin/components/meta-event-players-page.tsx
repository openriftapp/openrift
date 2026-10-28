import { formatDay } from "@openrift/shared/format-date";
import { formatRankEnglish, formatRecord } from "@openrift/shared/meta-standings";
import { pluralize } from "@openrift/shared/strings";
import type { AdminMetaEvent, AdminMetaPlayer } from "@openrift/shared/types/api/meta";
import type { MetaPlayerOverlayField } from "@openrift/shared/types/enums";
import { ExternalLinkIcon, LockIcon, PencilIcon, PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Heading } from "@/components/heading";
import {
  PageTopBarBack,
  PageTopBarButton,
  PageTopBarPrimaryButton,
} from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import { MetaCrossSourcePanel } from "@/features/admin/components/meta-cross-source-panel";
import { MetaEventDialog } from "@/features/admin/components/meta-event-dialog";
import { MetaEventDriftPanel } from "@/features/admin/components/meta-event-drift-panel";
import {
  MetaEventCancelledBanner,
  MetaEventSourceStates,
} from "@/features/admin/components/meta-event-source-states";
import { MetaEventSourcesEditor } from "@/features/admin/components/meta-event-sources-editor";
import { MetaEventUploadsPanel } from "@/features/admin/components/meta-event-uploads-panel";
import { MetaPlayerDialog } from "@/features/admin/components/meta-player-dialog";
import { MetaPublicLinkButton } from "@/features/admin/components/meta-public-link";
import {
  useAdminMetaEvent,
  useAdminMetaEventPlayers,
  useDeleteMetaPlayer,
} from "@/features/admin/hooks/use-admin-meta";
import { useReleasePlayerOverlayField } from "@/features/admin/hooks/use-admin-meta-overlays";
import { RESULTS_DISPLAY } from "@/features/admin/lib/meta-mirror-view";
import { MetaListStatusBadge } from "@/features/meta/components/meta-list-status-badge";
import { MetaTierBadge } from "@/features/meta/components/meta-tier-badge";
import {
  formatRankRuns,
  metaPlayerClaimChips,
  recordSortValue,
  standingsGaps,
} from "@/features/meta/lib/meta-format";
import { useDeckFormatList } from "@/hooks/use-enums";

function PlayerCell({ row }: AdminCellSlotProps<AdminMetaPlayer>) {
  if (!row) {
    return null;
  }
  return <span className="font-medium">{row.playerName}</span>;
}

function FinishCell({ row }: AdminCellSlotProps<AdminMetaPlayer>) {
  if (!row) {
    return null;
  }
  return <span className="tabular-nums">{formatRankEnglish(row.rank, row.rankIsTier)}</span>;
}

function RecordCell({ row }: AdminCellSlotProps<AdminMetaPlayer>) {
  if (!row) {
    return null;
  }
  return (
    <span className="text-muted-foreground tabular-nums">
      {formatRecord(row.wins, row.losses, row.draws) ?? "Not given"}
    </span>
  );
}

function LegendCell({ row }: AdminCellSlotProps<AdminMetaPlayer>) {
  if (!row) {
    return null;
  }
  const pair = [row.legendName, row.championName].filter(Boolean).join(" / ");
  return <span className="text-muted-foreground">{pair === "" ? "Not given" : pair}</span>;
}

function DeckCell({ row }: AdminCellSlotProps<AdminMetaPlayer>) {
  if (!row) {
    return null;
  }
  if (row.listStatus === "none") {
    return <span className="text-muted-foreground text-sm">Standings only</span>;
  }
  return (
    <span className="flex items-center gap-1.5">
      {row.deckName}
      <span className="text-muted-foreground text-sm tabular-nums">{row.cardCount} cards</span>
      <MetaListStatusBadge listStatus={row.listStatus} />
    </span>
  );
}

function ClaimedFields({ player }: { player: AdminMetaPlayer }) {
  const release = useReleasePlayerOverlayField();
  const chips = metaPlayerClaimChips(player.claimedFields);

  async function handleRelease(field: MetaPlayerOverlayField): Promise<void> {
    try {
      await release.mutateAsync({ id: player.id, field });
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    toast.success("Released. The sources decide this again.");
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <span className="flex flex-wrap gap-1">
      {chips.map((chip) => (
        <Badge key={chip.field} variant="outline">
          <LockIcon className="size-3" />
          {chip.label}
          <ChipRemoveButton
            aria-label={`Hand ${chip.label} back to the sources`}
            disabled={release.isPending}
            onClick={() => {
              void handleRelease(chip.field);
            }}
          />
        </Badge>
      ))}
    </span>
  );
}

function ClaimedFieldsCell({ row }: AdminCellSlotProps<AdminMetaPlayer>) {
  if (!row) {
    return null;
  }
  return <ClaimedFields player={row} />;
}

const columns: AdminColumnDef<AdminMetaPlayer>[] = [
  { header: "Finish", width: "w-20", sortValue: (player) => player.rank, cell: <FinishCell /> },
  { header: "Player", sortValue: (player) => player.playerName, cell: <PlayerCell /> },
  {
    header: "Record",
    sortFirst: "desc",
    sortValue: (player) => recordSortValue(player.wins, player.losses),
    cell: <RecordCell />,
  },
  { header: "Legend", sortValue: (player) => player.legendName, cell: <LegendCell /> },
  { header: "Deck", sortValue: (player) => player.deckName, cell: <DeckCell /> },
  {
    header: "Claimed",
    sortValue: (player) => player.claimedFields.length,
    cell: <ClaimedFieldsCell />,
  },
];

function PlayerRowActions({
  row,
  onEdit,
}: AdminCellSlotProps<AdminMetaPlayer> & { onEdit: (player: AdminMetaPlayer) => void }) {
  if (!row) {
    return null;
  }
  return (
    <>
      {row.shareToken !== null && (
        <MetaPublicLinkButton
          href={`/meta/decks/${row.shareToken}`}
          label="View"
          ariaLabel={`Open ${row.playerName}'s archived deck`}
        />
      )}
      <Button variant="ghost" onClick={() => onEdit(row)}>
        Edit
      </Button>
    </>
  );
}

function StandingsCoverage({
  players,
  reported,
}: {
  players: readonly AdminMetaPlayer[];
  reported: number | null;
}) {
  const gaps = standingsGaps(players, reported);
  const held = players.length;
  const counts = reported !== null && reported !== held ? `${held} of ${reported}` : `${held}`;
  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-2">
      <span className="tabular-nums">
        {counts} {pluralize(held, "standing")}
      </span>
      {gaps.length > 0 && <Badge variant="warning">Missing {formatRankRuns(gaps)}</Badge>}
    </div>
  );
}

type DialogState = { mode: "create" } | { mode: "edit"; player: AdminMetaPlayer } | null;

function EventFacts({ event, formatLabel }: { event: AdminMetaEvent; formatLabel: string }) {
  const results = RESULTS_DISPLAY[event.results];
  const facts = [
    ["Date", formatDay(event.eventDate)],
    ["Format", formatLabel],
    ["Players", event.playerCount === null ? "Not given" : event.playerCount.toLocaleString()],
    ["Organizer", event.organizer ?? "Not given"],
  ] as const;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="success">Published</Badge>
        <Badge variant={results.variant}>{results.label}</Badge>
        <MetaTierBadge tier={event.tier} />
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {facts.map(([term, value]) => (
          <div key={term} className="flex gap-1.5">
            <dt className="text-muted-foreground">{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <Heading level={2}>{title}</Heading>
      {children}
    </section>
  );
}

export function MetaEventPlayersPage({ eventId }: { eventId: string }) {
  const { data: event } = useAdminMetaEvent(eventId);
  const { data } = useAdminMetaEventPlayers(eventId);
  const deletePlayer = useDeleteMetaPlayer();
  const { labels: formatLabels } = useDeckFormatList();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [editing, setEditing] = useState(false);
  const mirrored = event.sources.filter((source) => source.provider !== null).length;

  return (
    <>
      <AdminPageTopBar
        title={event.name}
        back={
          <PageTopBarBack
            to="/admin/meta"
            search={{ tab: "public" }}
            aria-label="Back to published events"
          />
        }
        actions={
          <>
            <a
              href={`/meta/${event.slug}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${event.name} in the public archive`}
              className={buttonVariants({ variant: "ghost" })}
            >
              <span className="hidden sm:inline">Public page</span>
              <ExternalLinkIcon />
            </a>
            <PageTopBarButton aria-label="Edit details" onClick={() => setEditing(true)}>
              <PencilIcon />
              <span className="hidden sm:inline">Edit details</span>
            </PageTopBarButton>
            <PageTopBarPrimaryButton
              aria-label="Add player"
              onClick={() => setDialog({ mode: "create" })}
            >
              <PlusIcon />
              <span className="hidden sm:inline">Add player</span>
            </PageTopBarPrimaryButton>
          </>
        }
      />

      <div className="space-y-10 pt-3">
        <EventFacts event={event} formatLabel={formatLabels[event.format] ?? event.format} />
        <MetaEventCancelledBanner event={event} />

        <Section title="Sources">
          <MetaEventSourceStates eventId={eventId} />
          <MetaEventSourcesEditor eventId={eventId} />
        </Section>

        <Section title="Field values">
          <MetaEventDriftPanel metaEventId={eventId} enabled />
        </Section>

        <Section title="Standings">
          <AdminTable
            columns={columns}
            data={data.players}
            getRowKey={(player) => player.id}
            defaultSort={{ column: "Finish", direction: "asc" }}
            emptyText="No standings yet."
            toolbar={<StandingsCoverage players={data.players} reported={event.playerCount} />}
            actions={<PlayerRowActions onEdit={(player) => setDialog({ mode: "edit", player })} />}
            delete={{
              onDelete: (player) => deletePlayer.mutateAsync({ id: player.id, eventId }),
              confirm: (player) => ({
                title: `Delete ${player.playerName}?`,
                description:
                  player.listStatus === "none"
                    ? `${player.playerName}'s standings row is removed from the archive. This cannot be undone.`
                    : `${player.playerName}'s standings row, their archived deck, and its permalink are removed from the archive. This cannot be undone.`,
              }),
            }}
          />
        </Section>

        {mirrored > 1 && (
          <Section title="Cross-source players">
            <MetaCrossSourcePanel metaEventId={eventId} enabled />
          </Section>
        )}

        <MetaEventUploadsPanel eventId={eventId} />
      </div>

      {editing && <MetaEventDialog event={event} onClose={() => setEditing(false)} />}

      {dialog && (
        <MetaPlayerDialog
          eventId={eventId}
          eventFormat={event.format}
          player={dialog.mode === "edit" ? dialog.player : undefined}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
