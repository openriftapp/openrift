import { formatPrintingCode } from "@openrift/shared/printing-code";
import { countNoun } from "@openrift/shared/strings";
import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { AdminPrintingMatrix } from "@/features/admin/components/admin-printing-matrix";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import type { PrintingValueLabels } from "@/features/admin/lib/field-value-text";
import { formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { imagesOnSide } from "@/features/admin/lib/printing-side-images";
import { faceHeading } from "@/features/catalog-workspace/components/pass/field-text";
import type { NewPrintingRow } from "@/features/catalog-workspace/components/pass/new-printing-item";
import { NewPrintingItem } from "@/features/catalog-workspace/components/pass/new-printing-item";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
import { stopNavigation } from "@/features/catalog-workspace/components/record/review-stop-bar";
import type { CardPassModel, PassRow } from "@/features/catalog-workspace/lib/card-pass";
import { placeNewPrintings } from "@/features/catalog-workspace/lib/card-pass";
import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";
import type { ReviewTrail } from "@/features/catalog-workspace/lib/review-stops";
import { variantExtras } from "@/features/catalog-workspace/lib/variant-facts";

export function PrintingsSection({
  cardSlug,
  detail,
  pass,
  newRows,
  trail,
  showAll,
  onToggleAll,
  isAdmin,
  landscape,
  labels,
  submissions,
  substituteFailures,
  creating,
  onCreate,
  onReject,
  onMove,
  onMarkApplied,
  onOpenPrinting,
}: {
  cardSlug: string;
  detail: AdminCardDetailResponse;
  pass: CardPassModel;
  newRows: readonly NewPrintingRow[];
  trail: ReviewTrail;
  showAll: boolean;
  onToggleAll: () => void;
  isAdmin: boolean;
  landscape: boolean;
  labels: PrintingValueLabels;
  submissions: readonly AttentionSubmission[];
  substituteFailures: number;
  creating: boolean;
  onCreate: (drafts: CreationDraft[]) => void;
  onReject: (candidateCardId: string, kindLabel: string) => void;
  onMove?: (candidateCardId: string) => void;
  onMarkApplied: (candidateCardId: string) => void;
  onOpenPrinting: (printingId: string) => void;
}) {
  const pendingRows = pass.rows.filter((row) => row.pending);
  const shownIds = new Set(pendingRows.map((row) => row.entry.printing.id));
  const newAfter = placeNewPrintings(detail, pendingRows, newRows).after;
  const ready = newRows.flatMap((row) => (row.ready && row.draft !== null ? [row.draft] : []));
  const total = pass.rows.length;
  const substituteFaces = pass.faces.filter(({ face }) => face.fallbackImageFileId !== null);

  const newItems = (rows: readonly NewPrintingRow[] | undefined) =>
    rows?.map((row) => (
      <NewPrintingItem
        key={row.group.key}
        cardSlug={cardSlug}
        detail={detail}
        row={row}
        isAdmin={isAdmin}
        landscape={landscape}
        labels={labels}
        submissions={submissions}
        creating={creating}
        onCreate={onCreate}
        onReject={onReject}
        onMove={onMove}
        onMarkApplied={onMarkApplied}
      />
    ));

  const counts = [
    total === 0 ? null : `${pendingRows.length} of ${total} need review`,
    newRows.length === 0 ? null : `${newRows.length} new`,
  ].filter((part) => part !== null);

  return (
    <RecordSection
      title="Printings"
      titleAction={
        <span className="flex flex-wrap items-center gap-x-3">
          {counts.length > 0 && (
            <span className="text-muted-foreground text-sm">{counts.join(", ")}</span>
          )}
          {total > 0 && (
            <Button variant="link" size="xs" onClick={onToggleAll}>
              {showAll ? "Hide all" : `Show all ${total}`}
            </Button>
          )}
        </span>
      }
      actions={
        <>
          {ready.length > 1 && (
            <Button size="sm" disabled={creating} onClick={() => onCreate(ready)}>
              Create all
            </Button>
          )}
          {isAdmin && (
            <Link
              to="/admin/workspace/printings/create"
              search={{ card: cardSlug }}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              New printing
            </Link>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {total === 0 && newRows.length === 0 && (
          <p className="text-muted-foreground">No printings yet.</p>
        )}
        {substituteFailures > 0 && (
          <p className="text-muted-foreground">
            {countNoun(substituteFailures, "substitute image")} failed to rehost. Pick another on
            the face that uses it:{" "}
            {substituteFaces.map(({ face }) => (
              <TextLink
                key={face.faceId}
                className="mr-2"
                render={
                  <Link
                    to="/admin/workspace/faces/$cardSlug/$faceId"
                    params={{ cardSlug, faceId: face.faceId }}
                  />
                }
              >
                {faceHeading(face, labels)}
              </TextLink>
            ))}
          </p>
        )}
        {newItems(newAfter.get(null))}
        {pendingRows.map((row, index) => {
          const printing = row.entry.printing;
          const previous = pendingRows[index - 1]?.entry.printing;
          return (
            <Fragment key={printing.id}>
              {previous?.setId !== printing.setId && (
                <p className="text-muted-foreground pt-1 text-xs font-medium tracking-wide uppercase">
                  {printing.setName ?? printing.setSlug}
                </p>
              )}
              <PrintingLine
                row={row}
                detail={detail}
                trail={trail}
                labels={labels}
                landscape={landscape}
              />
              {newItems(newAfter.get(printing.id))}
            </Fragment>
          );
        })}
        {total > 0 && !showAll && pendingRows.length === 0 && newRows.length === 0 && (
          <p className="text-muted-foreground">No printing has pending work.</p>
        )}
        {showAll && total > 0 && (
          <AdminPrintingMatrix
            detail={detail}
            printings={pass.rows.map((row) => row.entry.printing)}
            highlightedIds={shownIds}
            landscape={landscape}
            onOpen={onOpenPrinting}
          />
        )}
      </div>
    </RecordSection>
  );
}

function uniqueLabels(suggestions: readonly { label: string }[]): string[] {
  return [...new Set(suggestions.map((suggestion) => suggestion.label))];
}

function PrintingLine({
  row,
  detail,
  trail,
  labels,
  landscape,
}: {
  row: PassRow;
  detail: AdminCardDetailResponse;
  trail: ReviewTrail;
  labels: PrintingValueLabels;
  landscape: boolean;
}) {
  const printing = row.entry.printing;
  const codes = [
    ...row.faces.map((entry) => formatPrintingCode(entry.face.publicCode)),
    ...(printing.otherFace === null ? [] : [formatPrintingCode(printing.otherFace.publicCode)]),
  ];
  const title = [
    codes.join(" // "),
    printing.language,
    formatCatalogFieldValue("finish", printing.finish, labels),
    ...variantExtras(printing, labels),
  ].join(" · ");
  const faceFields = uniqueLabels(row.faces.flatMap((entry) => entry.model.suggestions));
  const printingFields = uniqueLabels(row.entry.model.suggestions);
  const images = row.faces.reduce(
    (sum, entry) =>
      sum + entry.model.sourceImages.length + entry.uploads.length + entry.failedRehosts.length,
    0,
  );
  const image = imagesOnSide(detail.printingImages, printing).find((entry) => entry.isActive);

  return (
    <div className="hover:bg-muted/50 relative flex items-center gap-3 rounded-lg border px-3 py-2">
      <PrintingImageBox
        url={image === undefined ? null : printingImageDisplayUrl(image)}
        alt=""
        className="w-8 shrink-0"
        landscape={landscape}
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <TextLink
          variant="inherit"
          className="font-medium after:absolute after:inset-0"
          render={
            <Link {...stopNavigation({ kind: "printing", printingId: printing.id }, trail)} />
          }
        >
          {title}
        </TextLink>
        <ChipGroup label="Face" items={faceFields} variant="neutral" />
        <ChipGroup label="Printing" items={printingFields} variant="outline" />
        {images > 0 && <Badge variant="info">{countNoun(images, "image")}</Badge>}
      </div>
      <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
    </div>
  );
}

function ChipGroup({
  label,
  items,
  variant,
}: {
  label: string;
  items: readonly string[];
  variant: "neutral" | "outline";
}): ReactNode {
  if (items.length === 0) {
    return null;
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      {items.map((item) => (
        <Badge key={item} variant={variant}>
          {item}
        </Badge>
      ))}
    </span>
  );
}
