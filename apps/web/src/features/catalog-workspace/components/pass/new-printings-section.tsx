import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import { countNoun, pluralize } from "@openrift/shared/strings";
import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
  CandidatePrintingResponse,
} from "@openrift/shared/types/api/admin";
import { Link } from "@tanstack/react-router";
import { EllipsisVerticalIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { useLinkCandidatePrintings } from "@/features/admin/hooks/use-admin-card-mutations";
import { useIgnoreCandidatePrinting } from "@/features/admin/hooks/use-ignored-candidates";
import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import { PRINTING_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";
import { EMPTY_VALUE_TEXT, formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { imagesOnSide } from "@/features/admin/lib/printing-side-images";
import { ContributionActions } from "@/features/catalog-workspace/components/pass/pass-parts";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
import { ignoredPrintingUndo } from "@/features/catalog-workspace/hooks/candidate-undo";
import { cardRecordScope } from "@/features/catalog-workspace/hooks/use-card-record-actions";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type { NewPrintingGroup } from "@/features/catalog-workspace/lib/card-pass";
import { passContributor } from "@/features/catalog-workspace/lib/card-pass";
import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";
import { providerOf } from "@/features/catalog-workspace/lib/face-suggestion-rows";
import type { PrintingMatches } from "@/features/catalog-workspace/lib/printing-matches";
import { closestPrintings } from "@/features/catalog-workspace/lib/printing-matches";
import { providerName } from "@/features/catalog-workspace/lib/review-cards";
import { combinedUndo, ignoredUndoText } from "@/features/catalog-workspace/lib/workspace-undo";
import { cn } from "@/lib/utils";

interface NewPrintingRow {
  group: NewPrintingGroup;
  draft: CreationDraft | null;
  ready: boolean;
}

function ContributorLine({
  name,
  note,
  pending,
  onMarkApplied,
  onReject,
  onMove,
}: {
  name: string;
  note: string | null;
  pending: boolean;
  onMarkApplied: () => void;
  onReject: () => void;
  onMove?: () => void;
}) {
  return (
    <div className="bg-violet-soft mt-1 flex flex-wrap items-center gap-2 rounded-md px-2 py-1 text-sm">
      <span className="min-w-0 flex-1 break-words">
        <span className="font-medium">{name}</span> proposes this printing
        {note !== null && note.trim() !== "" && <>: &ldquo;{note}&rdquo;</>}
      </span>
      <ContributionActions
        pending={pending}
        onMarkApplied={onMarkApplied}
        onReject={onReject}
        onMove={onMove}
      />
    </div>
  );
}

const SHOWN_MATCHES = 2;

function ClosestPrintings({
  detail,
  lead,
  found,
  labels,
  landscape,
  pending,
  onLink,
}: {
  detail: AdminCardDetailResponse;
  lead: CandidatePrintingResponse;
  found: PrintingMatches<AdminPrintingResponse>;
  labels: PrintingValueLabels;
  landscape: boolean;
  pending: boolean;
  onLink?: (printingId: string) => void;
}) {
  const code = formatPrintingCode(lead.shortCode);
  const language = lead.language ?? "";
  const others =
    found.sameCodeOtherLanguages > 0
      ? ` ${countNoun(found.sameCodeOtherLanguages, "printing")} in other languages ${pluralize(found.sameCodeOtherLanguages, "shares", "share")} the code.`
      : "";
  if (found.matches.length === 0) {
    return (
      <p className="text-success text-sm">
        No {language} printing with code {code} exists yet.{others}
      </p>
    );
  }
  const hidden = found.matches.length - SHOWN_MATCHES;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Closest existing printings, same code and language
      </p>
      {found.matches.slice(0, SHOWN_MATCHES).map(({ printing, differs }, index) => {
        const image = imagesOnSide(detail.printingImages, printing).find(
          (candidate) => candidate.isActive,
        );
        const title = [
          printing.language,
          formatPrintingCode(printing.shortCode),
          formatCatalogFieldValue("finish", printing.finish, labels),
          formatCatalogFieldValue("artVariant", printing.artVariant, labels),
          printing.markerSlugs.length > 0
            ? formatCatalogFieldValue("markerSlugs", printing.markerSlugs, labels)
            : null,
        ].filter((part) => part !== null && part !== EMPTY_VALUE_TEXT);
        return (
          <div
            key={printing.id}
            className={cn(
              "bg-muted/30 flex flex-wrap items-center gap-3 rounded-md border px-2 py-1.5",
              index === 0 && differs.length === 0 && "border-primary",
            )}
          >
            <PrintingImageBox
              url={image === undefined ? null : printingImageDisplayUrl(image)}
              alt="Existing printing"
              className="w-9 shrink-0"
              landscape={landscape}
            />
            <div className="min-w-0 flex-1">
              <p className="break-words">{title.join(" · ")}</p>
              <p className="text-muted-foreground text-sm break-words">
                {differs.length === 0
                  ? "Nothing the source states differs."
                  : `Differs: ${differs
                      .map(
                        (field) =>
                          `${PRINTING_FIELD_LABELS[field]} (${formatCatalogFieldValue(field, printing[field], labels)})`,
                      )
                      .join(", ")}`}
              </p>
            </div>
            {onLink && (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => onLink(printing.id)}
              >
                It is this one
              </Button>
            )}
          </div>
        );
      })}
      {(hidden > 0 || others !== "") && (
        <p className="text-muted-foreground text-sm">
          {hidden > 0 &&
            `${hidden} more ${language} ${pluralize(hidden, "printing shares", "printings share")} this code.`}
          {others}
        </p>
      )}
    </div>
  );
}

export function NewPrintingsSection({
  cardSlug,
  detail,
  rows,
  isAdmin,
  landscape,
  labels,
  submissions,
  creating,
  onCreate,
  onReject,
  onMove,
  onMarkApplied,
}: {
  cardSlug: string;
  detail: AdminCardDetailResponse;
  rows: readonly NewPrintingRow[];
  isAdmin: boolean;
  landscape: boolean;
  labels: PrintingValueLabels;
  submissions: readonly AttentionSubmission[];
  creating: boolean;
  onCreate: (drafts: CreationDraft[]) => void;
  onReject: (candidateCardId: string, kindLabel: string) => void;
  onMove?: (candidateCardId: string) => void;
  onMarkApplied: (candidateCardId: string) => void;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const scope = cardRecordScope(cardSlug);
  const link = useLinkCandidatePrintings(scope);
  const ignore = useIgnoreCandidatePrinting(scope);
  const { announce } = useWorkspaceUndo();

  const ready = rows.flatMap((row) => (row.ready && row.draft !== null ? [row.draft] : []));
  const existing = [...new Map(detail.printings.map((row) => [row.id, row])).values()].toSorted(
    (a, b) => a.canonicalRank - b.canonicalRank,
  );
  const pending = creating || link.isPending || ignore.isPending;

  async function ignoreGroup(signal: AbortSignal, group: NewPrintingGroup) {
    const ignored = group.candidates.map((candidate) => ({
      provider: providerOf(detail, candidate.candidateCardId),
      externalId: candidate.externalId,
      finish: candidate.finish,
    }));
    for (const entry of ignored) {
      await ignore.mutateAsync(entry, { signal });
    }
    const code = formatPrintingCode(group.candidates[0]?.shortCode ?? "");
    announce(
      combinedUndo(
        ignoredUndoText({ what: code, record: detail.displayName }),
        ignored.map((entry) => ignoredPrintingUndo(entry, detail.displayName)),
      ),
    );
  }

  return (
    <RecordSection
      title="New printings"
      actions={
        ready.length > 1 && (
          <Button size="sm" disabled={pending} onClick={() => onCreate(ready)}>
            Create all
          </Button>
        )
      }
    >
      <div className="flex flex-col">
        {rows.map(({ group, draft, ready: creatable }) => {
          const [lead] = group.candidates;
          if (lead === undefined) {
            return null;
          }
          const contributorId = group.candidates.find(
            (candidate) =>
              providerOf(detail, candidate.candidateCardId) === USER_SUBMISSION_PROVIDER,
          )?.candidateCardId;
          const summary = [
            formatPrintingCode(lead.publicCode ?? lead.shortCode),
            formatCatalogFieldValue("artVariant", lead.artVariant, labels),
            formatCatalogFieldValue("finish", lead.finish, labels),
            lead.language,
            formatCatalogFieldValue("rarity", lead.rarity, labels),
          ].filter((part) => part !== EMPTY_VALUE_TEXT);
          const details = [
            formatCatalogFieldValue("size", lead.size, labels),
            lead.distributionChannelSlugs.length > 0
              ? formatCatalogFieldValue(
                  "distributionChannelSlugs",
                  lead.distributionChannelSlugs,
                  labels,
                )
              : null,
            `from ${group.providers.map((provider) => providerName(provider)).join(", ")}`,
          ].filter((part) => part !== null && part !== EMPTY_VALUE_TEXT);
          return (
            <div key={group.key} className="flex flex-col gap-2 border-t py-2 first:border-t-0">
              <div className="flex items-center gap-3">
                <PrintingImageBox
                  url={lead.imageUrl}
                  alt={`${providerName(group.providers[0] ?? "")} scan`}
                  href={lead.imageUrl ?? undefined}
                  className="w-12 shrink-0"
                  landscape={landscape}
                />
                <div className="min-w-0 flex-1">
                  <p className="break-words">{summary.join(" · ")}</p>
                  <p className="text-muted-foreground text-sm break-words">{details.join(" · ")}</p>
                  {contributorId !== undefined && (
                    <ContributorLine
                      {...passContributor(detail, submissions, contributorId)}
                      pending={pending}
                      onReject={() => onReject(contributorId, "New printing")}
                      onMove={onMove && (() => onMove(contributorId))}
                      onMarkApplied={() => onMarkApplied(contributorId)}
                    />
                  )}
                </div>
                {isAdmin && (existing.length > 0 || !group.hasContributor) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={pending}
                          aria-label="More for this printing"
                        />
                      }
                    >
                      <EllipsisVerticalIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {existing.length > 0 && (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            It is an existing printing…
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            {existing.map((printing) => (
                              <DropdownMenuItem
                                key={printing.id}
                                onClick={() =>
                                  void queueWrite((signal) =>
                                    link.mutateAsync(
                                      {
                                        candidatePrintingIds: group.candidates.map(
                                          (candidate) => candidate.id,
                                        ),
                                        printingId: printing.id,
                                      },
                                      { signal },
                                    ),
                                  )
                                }
                              >
                                {printing.expectedPrintingId}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      )}
                      {!group.hasContributor && (
                        <DropdownMenuItem
                          onClick={() => void queueWrite((signal) => ignoreGroup(signal, group))}
                        >
                          Ignore
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {creatable && draft !== null ? (
                  <Button size="sm" disabled={pending} onClick={() => onCreate([draft])}>
                    Create
                  </Button>
                ) : (
                  <Link
                    to="/admin/workspace/printings/new/$candidatePrintingId"
                    params={{ candidatePrintingId: lead.id }}
                    className={buttonVariants({ size: "sm" })}
                  >
                    Review and create
                  </Link>
                )}
              </div>
              <ClosestPrintings
                detail={detail}
                lead={lead}
                found={closestPrintings(lead, existing)}
                labels={labels}
                landscape={landscape}
                pending={pending}
                onLink={
                  isAdmin
                    ? (printingId) =>
                        void queueWrite((signal) =>
                          link.mutateAsync(
                            {
                              candidatePrintingIds: group.candidates.map(
                                (candidate) => candidate.id,
                              ),
                              printingId,
                            },
                            { signal },
                          ),
                        )
                    : undefined
                }
              />
            </div>
          );
        })}
      </div>
    </RecordSection>
  );
}
