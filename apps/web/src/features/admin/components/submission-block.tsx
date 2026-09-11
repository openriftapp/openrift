import type {
  AcceptSubmissionResponse,
  ReviewQueueItem,
} from "@openrift/shared/contracts/admin/catalog-review";
import { formatRelativeTime } from "@openrift/shared/format-date";
import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import { useHotkey } from "@tanstack/react-hotkeys";
import { CheckIcon, MessageSquareIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Kbd } from "@/components/ui/kbd";
import { AttentionChangeList } from "@/features/admin/components/attention-change-list";
import { RejectSubmissionDialog } from "@/features/admin/components/reject-submission-dialog";
import { SendNoteDialog } from "@/features/admin/components/send-note-dialog";
import { useLinkCandidatePrintings } from "@/features/admin/hooks/use-admin-card-mutations";
import type { SettleScope } from "@/features/admin/hooks/use-catalog-review";
import { settleKeys, useAcceptSubmission } from "@/features/admin/hooks/use-catalog-review";
import type { AttentionGroup, AttentionSubmission } from "@/features/admin/lib/attention-items";
import {
  buildAcceptSubmissionInput,
  printingGroupTickKeys,
  submissionTickKeys,
} from "@/features/admin/lib/build-accept-input";
import {
  linkedGroupCandidateIds,
  unlinkedGroupCandidates,
} from "@/features/admin/lib/candidate-groups";
import { printingBlockTitle } from "@/features/admin/lib/printing-summary";

interface SettledRow {
  key: string;
  label: string;
  applied: boolean;
}

interface SettledResult {
  applied: number;
  total: number;
  rows: SettledRow[];
}

function summaryRows(
  submission: AttentionSubmission,
  includedKeys: ReadonlySet<string>,
): SettledRow[] {
  return submission.groups.flatMap((group) =>
    group.kind === "new-printing"
      ? [
          {
            key: group.key,
            label: group.printingLabel ?? group.title,
            applied: includedKeys.has(group.key),
          },
        ]
      : group.changes.map((change) => ({
          key: change.key,
          label: `${group.title} · ${change.label}`,
          applied: includedKeys.has(change.key),
        })),
  );
}

function SettledCard({ settled }: { settled: SettledResult }) {
  return (
    <div className="border-success overflow-hidden rounded-md border">
      <div className="space-y-3 p-3">
        <p className="flex items-center gap-2 font-medium">
          <CheckIcon className="text-success size-4" />
          Accepted {settled.applied} of {settled.total} changes
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {settled.rows.map((row) => (
            <li key={row.key}>
              <Badge variant={row.applied ? "success" : "muted"}>
                {row.label} {row.applied ? "applied" : "not applied"}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BlockHeader({
  submission,
  kindLabel,
  total,
  who,
  queueItem,
}: {
  submission: AttentionSubmission;
  kindLabel: string;
  total: number;
  who: string;
  queueItem: ReviewQueueItem | undefined;
}) {
  return (
    <div className="bg-muted flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
      <Badge variant={submission.kind === "image" ? "info" : "warning"}>{kindLabel}</Badge>
      <span className="font-medium">
        {total} change{total === 1 ? "" : "s"} from {who}
      </span>
      {queueItem && (
        <span className="text-muted-foreground text-xs">
          {formatRelativeTime(queueItem.createdAt)}
        </span>
      )}
    </div>
  );
}

interface SubmissionBlockProps {
  detail: AdminCardDetailResponse;
  submission: AttentionSubmission;
  scope: SettleScope;
  queueItem: ReviewQueueItem | undefined;
  onSettled?: () => void;
  onOpenNewPrinting?: (candidatePrintingId: string) => void;
  blockedNewPrintings?: ReadonlyMap<string, string>;
}

export function SubmissionBlock({
  detail,
  submission,
  scope,
  queueItem,
  onSettled,
  onOpenNewPrinting,
  blockedNewPrintings,
}: SubmissionBlockProps) {
  const acceptSubmission = useAcceptSubmission(scope);
  const linkCandidatePrintings = useLinkCandidatePrintings(
    settleKeys(submission.candidateCardId, scope),
  );
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(() => new Set());
  const [edits, setEdits] = useState<ReadonlyMap<string, unknown>>(() => new Map());
  const [settled, setSettled] = useState<SettledResult | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [replying, setReplying] = useState(false);

  const printingTargets = detail.printings.map((printing) => ({
    id: printing.id,
    label: printingBlockTitle(printing),
  }));

  // A blocked printing is off the ledger: it can be neither ticked nor counted.
  const blockedKeys = new Set(
    [...(blockedNewPrintings?.keys() ?? [])].map((id) => `new-printing:${id}`),
  );
  const tickKeys = submissionTickKeys(submission).filter((key) => !blockedKeys.has(key));
  const ticked = new Set(tickKeys.filter((key) => !unticked.has(key)));
  const total = tickKeys.length;
  const kindLabel = submission.kind === "image" ? "Image" : "Correction";
  const who = submission.submitterName ?? "a contributor";

  // oxlint-disable-next-line no-empty-function -- default no-op until the effect below installs the real handler
  const acceptRef = useRef<() => void>(() => {});
  useHotkey("Mod+Enter", () => acceptRef.current(), {
    enabled: settled === null && !acceptSubmission.isPending,
  });

  function linkGroup(group: AttentionGroup, printingId: string) {
    const candidate = group.candidate;
    if (candidate === null) {
      return;
    }
    linkCandidatePrintings.mutate({
      candidatePrintingIds: unlinkedGroupCandidates(detail, candidate.id).map((entry) => entry.id),
      printingId,
    });
    setUnticked((prev) => new Set(prev).add(group.key));
  }

  function moveGroup(group: AttentionGroup, printingId: string) {
    const from = group.printingId;
    if (from === null) {
      return;
    }
    const candidatePrintingIds = linkedGroupCandidateIds(detail, submission.candidateCardId, from);
    if (candidatePrintingIds.length === 0) {
      return;
    }
    linkCandidatePrintings.mutate({ candidatePrintingIds, printingId });
    const retick = new Set(printingGroupTickKeys(submission, from));
    setUnticked((prev) => new Set([...prev].filter((key) => !retick.has(key))));
  }

  async function runAccept() {
    const { input, includedKeys } = buildAcceptSubmissionInput(submission, { ticked, edits });
    let result: AcceptSubmissionResponse;
    try {
      result = await acceptSubmission.mutateAsync(input);
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    const reasons = new Map(
      result.skipped.map((entry) => [`new-printing:${entry.candidatePrintingId}`, entry.reason]),
    );
    const rows = summaryRows(submission, includedKeys).map((row) => {
      const reason = reasons.get(row.key);
      return reason === undefined
        ? row
        : { ...row, label: `${row.label} (${reason})`, applied: false };
    });
    setSettled({ applied: result.applied, total, rows });
    onSettled?.();
  }

  useEffect(() => {
    acceptRef.current = () => void runAccept();
  });

  if (settled) {
    return <SettledCard settled={settled} />;
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border">
        <BlockHeader
          submission={submission}
          kindLabel={kindLabel}
          total={total}
          who={who}
          queueItem={queueItem}
        />

        <div className="space-y-3 border-t p-3">
          {submission.note && (
            <Callout className="text-sm">
              <p className="text-muted-foreground mb-1 text-xs">Their note</p>
              <p className="whitespace-pre-wrap">{submission.note}</p>
            </Callout>
          )}

          <AttentionChangeList
            groups={submission.groups}
            ticked={ticked}
            edits={edits}
            onToggle={(key) =>
              setUnticked((prev) => {
                const next = new Set(prev);
                if (next.has(key)) {
                  next.delete(key);
                } else {
                  next.add(key);
                }
                return next;
              })
            }
            onEdit={(key, value) => setEdits((prev) => new Map([...prev, [key, value]]))}
            printingTargets={printingTargets}
            onLinkGroup={printingTargets.length > 0 ? linkGroup : undefined}
            onMoveGroup={printingTargets.length > 1 ? moveGroup : undefined}
            onOpenNewPrinting={onOpenNewPrinting}
            blockedNewPrintings={blockedNewPrintings}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="ghost"
              title="Writes a message the contributor sees. Nothing is accepted or rejected."
              onClick={() => setReplying(true)}
            >
              <MessageSquareIcon />
              Send a note
              <span className="text-muted-foreground">(no decision)</span>
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={() => setRejecting(true)}>
              Reject
            </Button>
            <p className="text-muted-foreground min-w-0 flex-1 text-xs">
              Accepting applies the ticked rows, marks this source checked and tells {who} what
              happened.
            </p>
            <Button disabled={acceptSubmission.isPending} onClick={() => void runAccept()}>
              {ticked.size === 0 ? "Mark as not applied" : `Accept ${ticked.size} of ${total}`}
              <Kbd className="bg-background/20 pointer-events-none ml-1.5 leading-none text-inherit opacity-60">
                Ctrl ↵
              </Kbd>
            </Button>
          </div>
        </div>
      </div>

      <RejectSubmissionDialog
        candidateCardId={rejecting ? submission.candidateCardId : null}
        submitterName={submission.submitterName}
        kindLabel={kindLabel}
        scope={scope}
        onOpenChange={(open) => {
          if (!open) {
            setRejecting(false);
          }
        }}
        onRejected={onSettled}
      />
      <SendNoteDialog
        candidateCardId={replying ? submission.candidateCardId : null}
        submitterName={submission.submitterName}
        onOpenChange={(open) => {
          if (!open) {
            setReplying(false);
          }
        }}
      />
    </>
  );
}
