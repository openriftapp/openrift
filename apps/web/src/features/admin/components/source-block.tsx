import type {
  AdminCardDetailResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";
import type { ReactNode } from "react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { AttentionChangeList } from "@/features/admin/components/attention-change-list";
import { MissingFieldsDialog } from "@/features/admin/components/missing-fields-dialog";
import { PrintingTargetMenu } from "@/features/admin/components/printing-target-menu";
import {
  useAcceptPrintingGroup,
  useCheckAllCandidatePrintings,
  useCheckCandidateCard,
  useLinkCandidatePrintings,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type {
  AttentionSourceBlock,
  AttentionSourceEntry,
} from "@/features/admin/lib/attention-items";
import {
  unlinkedCandidatesForSource,
  unlinkedGroupCandidates,
} from "@/features/admin/lib/candidate-groups";
import type {
  PrintingFieldOverrides,
  RequiredPrintingField,
} from "@/features/admin/lib/printing-fields";
import {
  buildPrintingFieldsFromCandidate,
  candidateRowSummary,
  missingPrintingFields,
} from "@/features/admin/lib/printing-fields";
import { printingBlockTitle } from "@/features/admin/lib/printing-summary";

interface PendingAdd {
  candidate: CandidatePrintingResponse;
  missing: RequiredPrintingField[];
}

function CandidateThumb({ url, alt }: { url: string; alt: string }) {
  return (
    <span className="bg-muted/30 aspect-card inline-flex w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border">
      <ImgWithFallback
        src={url}
        alt={alt}
        className="size-full object-contain"
        fallback={<span className="text-muted-foreground text-2xs">None</span>}
      />
    </span>
  );
}

function summaryText(changedFields: number, newPrintings: number): string {
  const parts: string[] = [];
  if (changedFields > 0) {
    parts.push(`${changedFields} differ`);
  }
  if (newPrintings > 0) {
    parts.push(`${newPrintings} new printing${newPrintings === 1 ? "" : "s"}`);
  }
  return parts.length === 0 ? "nothing differs" : parts.join(" · ");
}

interface SourceBlockProps {
  detail: AdminCardDetailResponse;
  block: AttentionSourceBlock;
  cardSlug: string;
  compareAction: ReactNode;
  renderUnlinked?: (candidateCardId: string) => ReactNode;
}

export function SourceBlock({
  detail,
  block,
  cardSlug,
  compareAction,
  renderUnlinked,
}: SourceBlockProps) {
  const scope = [adminKeys.cards.detail(cardSlug), adminKeys.reviewQueue];
  const checkCard = useCheckCandidateCard(scope);
  const checkPrintings = useCheckAllCandidatePrintings(scope);
  const acceptPrintingGroup = useAcceptPrintingGroup(scope);
  const linkCandidatePrintings = useLinkCandidatePrintings(scope);
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);

  const isPending = checkCard.isPending || checkPrintings.isPending;
  const cardId = detail.card?.id;
  const isSingle = block.entries.length === 1;
  const candidateCardIds = new Set(block.candidateCardIds);
  const uncheckedPrintingIds = detail.candidatePrintings
    .filter(
      (candidate) =>
        candidateCardIds.has(candidate.candidateCardId) && candidate.checkedAt === null,
    )
    .map((candidate) => candidate.id);
  const printingTargets = detail.printings.map((printing) => ({
    id: printing.id,
    label: printingBlockTitle(printing),
  }));

  async function markChecked() {
    const jobs: Promise<unknown>[] = block.candidateCardIds.map((id) => checkCard.mutateAsync(id));
    if (uncheckedPrintingIds.length > 0) {
      jobs.push(checkPrintings.mutateAsync({ extraIds: uncheckedPrintingIds }));
    }
    try {
      await Promise.all(jobs);
    } catch {
      // Reported by the global mutation error toast.
    }
  }

  function addPrinting(candidate: CandidatePrintingResponse, overrides?: PrintingFieldOverrides) {
    if (cardId === undefined) {
      return;
    }
    acceptPrintingGroup.mutate({
      cardId,
      printingFields: buildPrintingFieldsFromCandidate(candidate, overrides),
      candidatePrintingIds: unlinkedGroupCandidates(detail, candidate.id).map((entry) => entry.id),
    });
  }

  function linkCandidate(candidate: CandidatePrintingResponse, printingId: string) {
    linkCandidatePrintings.mutate({
      candidatePrintingIds: unlinkedGroupCandidates(detail, candidate.id).map((entry) => entry.id),
      printingId,
    });
  }

  function startAdd(candidate: CandidatePrintingResponse) {
    const missing = missingPrintingFields(buildPrintingFieldsFromCandidate(candidate));
    if (missing.length === 0) {
      addPrinting(candidate);
      return;
    }
    setPendingAdd({ candidate, missing });
  }

  function entryBody(entry: AttentionSourceEntry) {
    const unlinked = unlinkedCandidatesForSource(detail, entry.candidateCardId);
    if (entry.groups.length === 0 && unlinked.length === 0) {
      return isSingle ? (
        <p className="text-muted-foreground px-2 py-1 text-sm">Nothing differs.</p>
      ) : null;
    }
    return (
      <>
        {entry.groups.length > 0 && <AttentionChangeList groups={entry.groups} readOnly />}
        {unlinked.length > 0 &&
          (renderUnlinked === undefined ? (
            <ul className="flex flex-col">
              {unlinked.map((candidate) => (
                <li
                  key={candidate.id}
                  className="hover:bg-muted/50 flex items-center gap-3 rounded-md px-2 py-1.5"
                >
                  {candidate.imageUrl !== null && (
                    <CandidateThumb url={candidate.imageUrl} alt={candidate.shortCode} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{candidate.shortCode}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {candidateRowSummary(candidate)}
                    </span>
                  </span>
                  <Button
                    size="xs"
                    disabled={cardId === undefined || acceptPrintingGroup.isPending}
                    onClick={() => startAdd(candidate)}
                  >
                    Add printing
                  </Button>
                  <PrintingTargetMenu
                    label="Link to existing…"
                    targets={printingTargets}
                    onPick={(printingId) => linkCandidate(candidate, printingId)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            renderUnlinked(entry.candidateCardId)
          ))}
      </>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-md border">
        <div className="bg-muted flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
          <Badge variant="warning">Unchecked</Badge>
          <span className="font-medium">
            {block.provider} (trusted) has unchecked values for this card
          </span>
          <span className="text-muted-foreground">
            {isSingle
              ? summaryText(block.changedFields, block.newPrintings)
              : `${block.entries.length} sources · ${summaryText(block.changedFields, block.newPrintings)}`}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" disabled={isPending} onClick={() => void markChecked()}>
              {isSingle ? "Mark checked" : "Mark all checked"}
            </Button>
            {compareAction}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t p-3">
          {block.entries.map((entry) => (
            <div key={entry.candidateCardId}>
              {!isSingle && (
                <div className="text-muted-foreground flex items-center gap-2 px-2 text-xs font-medium">
                  <span className="min-w-0 truncate">{entry.label}</span>
                  <span className="shrink-0">
                    {summaryText(entry.changedFields, entry.newPrintings)}
                  </span>
                </div>
              )}
              {entryBody(entry)}
            </div>
          ))}
        </div>
      </div>

      <MissingFieldsDialog
        open={pendingAdd !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAdd(null);
          }
        }}
        sourceLabel={block.provider}
        missing={pendingAdd?.missing ?? []}
        onConfirm={(overrides) => {
          const candidate = pendingAdd?.candidate;
          setPendingAdd(null);
          if (candidate !== undefined) {
            addPrinting(candidate, overrides);
          }
        }}
      />
    </>
  );
}
