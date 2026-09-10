import type {
  AdminCardDetailResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import {
  useAcceptPrintingGroup,
  useCheckAllCandidatePrintings,
  useCheckCandidateCard,
  useLinkCandidatePrintings,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { CompareMissingFieldsDialog } from "@/features/catalog-admin/components/compare-missing-fields-dialog";
import { PrintingTargetMenu } from "@/features/catalog-admin/components/printing-target-menu";
import {
  unlinkedCandidatesForSource,
  unlinkedGroupCandidates,
} from "@/features/catalog-admin/lib/candidate-groups";
import { catalogAdminKeys } from "@/features/catalog-admin/lib/catalog-admin-query-keys";
import type { PrintingFieldOverrides } from "@/features/catalog-admin/lib/compare-actions";
import { printingBlockTitle } from "@/features/catalog-admin/lib/compare-rows";
import type { RequiredPrintingField } from "@/features/catalog-admin/lib/printing-fields";
import {
  buildPrintingFieldsFromCandidate,
  candidateRowSummary,
  missingPrintingFields,
} from "@/features/catalog-admin/lib/printing-fields";

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

interface SourceBlockProps {
  detail: AdminCardDetailResponse;
  provider: string;
  candidateCardId: string;
  changedFields: number;
  newPrintings: number;
  cardSlug: string;
}

export function SourceBlock({
  detail,
  provider,
  candidateCardId,
  changedFields,
  newPrintings,
  cardSlug,
}: SourceBlockProps) {
  const scope = [adminKeys.cards.detail(cardSlug), catalogAdminKeys.reviewQueue];
  const checkCard = useCheckCandidateCard(scope);
  const checkPrintings = useCheckAllCandidatePrintings(scope);
  const acceptPrintingGroup = useAcceptPrintingGroup(scope);
  const linkCandidatePrintings = useLinkCandidatePrintings(scope);
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);

  const isPending = checkCard.isPending || checkPrintings.isPending;
  const cardId = detail.card?.id;
  const unlinked = unlinkedCandidatesForSource(detail, candidateCardId);
  const uncheckedPrintingIds = detail.candidatePrintings
    .filter(
      (candidate) => candidate.candidateCardId === candidateCardId && candidate.checkedAt === null,
    )
    .map((candidate) => candidate.id);
  const printingTargets = detail.printings.map((printing) => ({
    id: printing.id,
    label: printingBlockTitle(printing),
  }));

  async function markChecked() {
    const jobs: Promise<unknown>[] = [checkCard.mutateAsync(candidateCardId)];
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

  return (
    <>
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="warning">Unchecked</Badge>
            <span className="font-medium">
              {provider} (trusted) has unchecked values for this card
            </span>
            <span className="text-muted-foreground text-sm">
              {changedFields} differ · {newPrintings} new printing{newPrintings === 1 ? "" : "s"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" disabled={isPending} onClick={() => void markChecked()}>
                Mark checked
              </Button>
              <Button
                variant="ghost"
                render={
                  <Link
                    to="/admin/catalog/cards/$cardSlug"
                    params={{ cardSlug }}
                    search={{ tab: "compare" }}
                  />
                }
              >
                Compare &rarr;
              </Button>
            </div>
          </div>

          {unlinked.length > 0 && (
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
          )}
        </CardContent>
      </Card>

      <CompareMissingFieldsDialog
        open={pendingAdd !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAdd(null);
          }
        }}
        sourceLabel={provider}
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
