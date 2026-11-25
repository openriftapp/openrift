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

import { Badge } from "@/components/ui/badge";
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
import { SectionHeading } from "@/components/ui/section-heading";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import { PRINTING_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";
import { EMPTY_VALUE_TEXT, formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { imagesOnSide } from "@/features/admin/lib/printing-side-images";
import { providerOf } from "@/features/admin/lib/source-compare";
import { ContributionActions } from "@/features/catalog-workspace/components/pass/pass-parts";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import { useIgnorePrintingGroup } from "@/features/catalog-workspace/hooks/use-ignore-printing-group";
import { useLinkToExisting } from "@/features/catalog-workspace/hooks/use-link-to-existing";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type { NewPrintingGroup } from "@/features/catalog-workspace/lib/card-pass";
import { passContributor, uniquePrintingsByRank } from "@/features/catalog-workspace/lib/card-pass";
import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";
import type { PrintingMatches } from "@/features/catalog-workspace/lib/printing-matches";
import { closestPrintings } from "@/features/catalog-workspace/lib/printing-matches";
import { cardRecordScope } from "@/features/catalog-workspace/lib/record-scopes";
import { providerName } from "@/features/catalog-workspace/lib/review-cards";
import type { ReviewTrail } from "@/features/catalog-workspace/lib/review-stops";
import { cn } from "@/lib/utils";

export interface NewPrintingRow {
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
  onLink?: (printing: AdminPrintingResponse) => void;
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
      <SectionHeading as="h4" size="sm">
        Closest existing printings, same code and language
      </SectionHeading>
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
                onClick={() => onLink(printing)}
              >
                Link to existing
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

export function NewPrintingItem({
  cardSlug,
  detail,
  row,
  acceptKey,
  trail,
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
  row: NewPrintingRow;
  acceptKey?: string;
  trail: ReviewTrail;
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
  const link = useLinkToExisting(scope, detail.displayName);
  const ignore = useIgnorePrintingGroup(scope);

  const existing = uniquePrintingsByRank(detail.printings);
  const pending = creating || link.pending || ignore.pending;
  const linkGroup = (group: NewPrintingGroup, printing: AdminPrintingResponse) =>
    void queueWrite((signal) =>
      link.run(
        signal,
        group.candidates.map((candidate) => candidate.id),
        { id: printing.id, label: printing.expectedPrintingId },
      ),
    );

  async function ignoreGroup(signal: AbortSignal, group: NewPrintingGroup) {
    await ignore.run(signal, detail, group.candidates);
  }

  const { group, draft, ready: creatable } = row;
  const [lead] = group.candidates;
  if (lead === undefined) {
    return null;
  }
  const contributorId = group.candidates.find(
    (candidate) => providerOf(detail, candidate.candidateCardId) === USER_SUBMISSION_PROVIDER,
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
      ? formatCatalogFieldValue("distributionChannelSlugs", lead.distributionChannelSlugs, labels)
      : null,
    `from ${group.providers.map((provider) => providerName(provider)).join(", ")}`,
  ].filter((part) => part !== null && part !== EMPTY_VALUE_TEXT);
  return (
    <div className="border-warning flex flex-col gap-2 rounded-lg border px-3 py-2">
      <div className="flex items-center gap-3">
        <PrintingImageBox
          url={lead.imageUrl}
          alt={`${providerName(group.providers[0] ?? "")} scan`}
          href={lead.imageUrl ?? undefined}
          className="w-12 shrink-0"
          landscape={landscape}
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 break-words">
            <Badge variant="warning">New</Badge>
            {summary.join(" · ")}
          </p>
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
                  <DropdownMenuSubTrigger>Link to existing…</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {existing.map((printing) => (
                      <DropdownMenuItem
                        key={printing.id}
                        onClick={() => linkGroup(group, printing)}
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
          <Button size="sm" disabled={pending} pending={creating} onClick={() => onCreate([draft])}>
            Create
            {group.key === acceptKey && <Kbd>A</Kbd>}
          </Button>
        ) : (
          <Link
            to="/admin/workspace/printings/new/$candidatePrintingId"
            params={{ candidatePrintingId: lead.id }}
            state={{ workspaceReview: trail }}
            className={buttonVariants({ size: "sm" })}
          >
            Open
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
        onLink={isAdmin ? (printing) => linkGroup(group, printing) : undefined}
      />
    </div>
  );
}
