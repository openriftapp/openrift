import { formatDay } from "@openrift/shared/format-date";
import { pluralize } from "@openrift/shared/strings";
import type { MetaOverlayQueueRow } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";
import { CheckIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MetaEventCorrectionCard } from "@/features/admin/components/meta-event-correction-card";
import { MetaPublicLinkButton } from "@/features/admin/components/meta-public-link";
import {
  DismissSourceKey,
  EventMatches,
  OverlayChanges,
} from "@/features/admin/components/meta-review-overlay-detail";
import {
  MetaReviewPlayerRow,
  PLAYER_ROW_COLUMNS,
} from "@/features/admin/components/meta-review-player-row";
import {
  useAcceptMetaEventOverlay,
  useAcceptMetaPlayerOverlays,
  useRejectMetaOverlay,
} from "@/features/admin/hooks/use-admin-meta-overlays";
import { ADMIN_TABLE_CLASS } from "@/features/admin/lib/admin-table-styles";
import type { MetaReviewGroup } from "@/features/meta/lib/meta-review-queue";
import { bulkAcceptItems, triageOverlay } from "@/features/meta/lib/meta-review-queue";
import { sourceProviderDisplay } from "@/features/meta/lib/meta-source-review";

const READY_PREVIEW = 5;

function EventOverlayCard({ overlay }: { overlay: MetaOverlayQueueRow }) {
  const accept = useAcceptMetaEventOverlay();
  const reject = useRejectMetaOverlay();
  const busy = accept.isPending || reject.isPending;
  const isProposal = overlay.metaEventId === null;
  const provider = sourceProviderDisplay(overlay.provider ?? "usersubmission");

  async function runAccept(metaEventId: string | null): Promise<void> {
    try {
      await accept.mutateAsync({ id: overlay.id, metaEventId });
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    toast.success(metaEventId === null && isProposal ? "Published as a new event" : "Applied");
  }

  async function decline(): Promise<void> {
    try {
      await reject.mutateAsync({ kind: "event", id: overlay.id });
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    toast.success("Rejected");
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{isProposal ? "New event" : "Event change"}</Badge>
        <Badge variant={provider.variant}>{provider.label}</Badge>
        {overlay.submissionNote !== null && (
          <span className="text-muted-foreground text-sm italic">{overlay.submissionNote}</span>
        )}
      </div>
      <OverlayChanges changes={overlay.changes} />
      {isProposal && (
        <EventMatches
          overlayId={overlay.id}
          busy={busy}
          onAcceptInto={(metaEventId) => {
            void runAccept(metaEventId);
          }}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {isProposal ? (
          <ConfirmActionButton
            title="Publish as a new event?"
            description="If this tournament is already published, it ends up on the archive twice. Merge it into the published event instead."
            confirmLabel="Publish as new"
            onConfirm={() => runAccept(null)}
            disabled={busy}
            trigger={<Button variant="ghost" size="sm" />}
          >
            <CheckIcon />
            Publish as a new event
          </ConfirmActionButton>
        ) : (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              void runAccept(null);
            }}
          >
            <CheckIcon />
            Apply
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            void decline();
          }}
        >
          <XIcon />
          Reject
        </Button>
        <DismissSourceKey overlay={overlay} />
      </div>
    </div>
  );
}

function BulkAcceptButton({ group }: { group: MetaReviewGroup }) {
  const acceptAll = useAcceptMetaPlayerOverlays();
  const items = bulkAcceptItems(group.players);
  if (items.length === 0) {
    return null;
  }

  async function run(): Promise<void> {
    const result = await acceptAll.mutateAsync({ items });
    toast.success(`Applied ${result.accepted} ${pluralize(result.accepted, "row")}`);
  }

  return (
    <ConfirmActionButton
      title={`Apply ${items.length} ready ${pluralize(items.length, "row")}?`}
      description="Each one matches a standings row and every card name is known."
      confirmLabel={`Apply ${items.length}`}
      onConfirm={run}
      disabled={acceptAll.isPending}
      trigger={<Button size="sm" />}
    >
      <CheckIcon />
      Apply {items.length} ready
    </ConfirmActionButton>
  );
}

function visibleRows(players: MetaOverlayQueueRow[], showAll: boolean): MetaOverlayQueueRow[] {
  if (showAll) {
    return players;
  }
  const visible: MetaOverlayQueueRow[] = [];
  let readySeen = 0;
  for (const row of players) {
    if (triageOverlay(row) === "ready") {
      readySeen += 1;
      if (readySeen > READY_PREVIEW) {
        continue;
      }
    }
    visible.push(row);
  }
  return visible;
}

function PlayerRows({ players }: { players: MetaOverlayQueueRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = visibleRows(players, showAll);
  const hidden = players.length - visible.length;

  return (
    <Table className={ADMIN_TABLE_CLASS}>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">Finish</TableHead>
          <TableHead>Player</TableHead>
          <TableHead>Standings row</TableHead>
          <TableHead className="w-32">Decklist</TableHead>
          <TableHead className="w-28">Waiting since</TableHead>
          <TableHead className="w-56 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visible.map((row) => (
          <MetaReviewPlayerRow key={row.id} overlay={row} />
        ))}
        {hidden > 0 && (
          <TableRow>
            <TableCell colSpan={PLAYER_ROW_COLUMNS}>
              <span className="flex flex-wrap items-center gap-2">
                <Button
                  variant="link"
                  size="sm"
                  className="px-0"
                  onClick={() => {
                    setShowAll(true);
                  }}
                >
                  Show {hidden} more
                </Button>
                <span className="text-muted-foreground">all ready to apply</span>
              </span>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export function MetaReviewEventGroup({ group }: { group: MetaReviewGroup }) {
  const [expanded, setExpanded] = useState(true);
  const rows = group.players.length;

  return (
    <Card className="gap-0 p-0">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <ExpandToggle
          expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${group.name}`}
          onClick={() => {
            setExpanded((open) => !open);
          }}
        >
          <span className="font-medium">{group.name}</span>
        </ExpandToggle>
        {group.eventDate !== null && (
          <span className="text-muted-foreground text-sm tabular-nums">
            {formatDay(group.eventDate)}
          </span>
        )}
        {group.format !== null && <Badge variant="outline">{group.format}</Badge>}
        {group.providers.map((provider) => {
          const display = sourceProviderDisplay(provider);
          return (
            <Badge key={provider} variant={display.variant}>
              {display.label}
            </Badge>
          );
        })}
        <span className="text-muted-foreground text-sm">
          {rows > 0 && `${rows} standings ${pluralize(rows, "row")}`}
          {rows > 0 && group.corrections.length > 0 && " · "}
          {group.corrections.length > 0 &&
            `${group.corrections.length} ${pluralize(group.corrections.length, "correction")}`}
        </span>
        <span className="flex items-center gap-1.5">
          {group.counts.ready > 0 && (
            <Badge variant="success">{group.counts.ready} ready to apply</Badge>
          )}
          {group.counts.needsRow > 0 && (
            <Badge variant="warning">
              {group.counts.needsRow} {pluralize(group.counts.needsRow, "needs", "need")} a
              standings row
            </Badge>
          )}
          {group.counts.unmatched > 0 && (
            <Badge variant="destructive">{group.counts.unmatched} with unknown cards</Badge>
          )}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <BulkAcceptButton group={group} />
          {group.metaEventId !== null && (
            <Link
              to="/admin/meta/$eventId"
              params={{ eventId: group.metaEventId }}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Open event
            </Link>
          )}
          {group.slug !== null && (
            <MetaPublicLinkButton
              href={`/meta/${group.slug}`}
              label={group.slug}
              ariaLabel={`Open ${group.name} on the public archive`}
              mono
            />
          )}
        </span>
      </div>

      {expanded && (
        <div>
          {(group.proposal !== null ||
            group.eventPatches.length > 0 ||
            group.corrections.length > 0) && (
            <div className="space-y-2 p-4">
              {group.proposal !== null && <EventOverlayCard overlay={group.proposal} />}
              {group.eventPatches.map((overlay) => (
                <EventOverlayCard key={overlay.id} overlay={overlay} />
              ))}
              {group.corrections.map((correction) => (
                <MetaEventCorrectionCard key={correction.submission.id} correction={correction} />
              ))}
            </div>
          )}
          {group.players.length > 0 && <PlayerRows players={group.players} />}
        </div>
      )}
    </Card>
  );
}
