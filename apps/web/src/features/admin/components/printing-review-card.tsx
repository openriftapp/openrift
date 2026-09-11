import { isAcceptPrintingField } from "@openrift/shared/contracts/admin/card-mutations";
import { enumLabel } from "@openrift/shared/enum-label";
import type {
  AdminPrintingImageResponse,
  AdminPrintingResponse,
  CandidateCardResponse,
  CandidatePrintingResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";
import { Link } from "@tanstack/react-router";
import {
  CheckCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  QuoteIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  CandidatePrintingFieldKey,
  FieldDef,
} from "@/features/admin/components/candidate-field-defs";
import { CandidateSpreadsheet } from "@/features/admin/components/candidate-spreadsheet";
import {
  buildPrintingNormalizer,
  findDerivedArtPrinting,
} from "@/features/admin/components/card-detail-shared";
import { PrintingCitationsEditor } from "@/features/admin/components/printing-citations-editor";
import { PrintingIdLabel } from "@/features/admin/components/printing-id-label";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import type { SiblingImage } from "@/features/admin/components/printing-image-switcher";
import { PrintingImageSwitcher } from "@/features/admin/components/printing-image-switcher";
import { PrintingSourceActions } from "@/features/admin/components/printing-source-actions";
import { PrintingSourceImageCell } from "@/features/admin/components/printing-source-image-cell";
import {
  useAcceptPrintingField,
  useCheckAllCandidatePrintings,
  useCheckCandidatePrinting,
  useCopyCandidatePrinting,
  useDeleteCandidatePrinting,
  useDeletePrinting,
  useLinkCandidatePrintings,
  useUncheckCandidatePrinting,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useAdminPrintingCitations } from "@/features/admin/hooks/use-admin-printing-citations";
import { useIgnoreCandidatePrinting } from "@/features/admin/hooks/use-ignored-candidates";
import { toastFieldAccepted } from "@/features/admin/lib/accept-undo";
import { getProviderLabel } from "@/features/admin/lib/candidate-rows";
import type { SourceSubmitter } from "@/features/admin/lib/candidate-submitter";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { printingKindLabel } from "@/features/admin/lib/printing-summary";
import {
  getStoredCollapsedPrintings,
  useAdminCardFoldStore,
} from "@/features/admin/stores/admin-card-fold-store";
import { useEnumOrders } from "@/hooks/use-enums";
import { useMarkers } from "@/hooks/use-markers";
import { getFilterIconPath } from "@/lib/icons";

interface PrintingSourceColumnActionsProps {
  row?: CandidateCardResponse | CandidatePrintingResponse;
  targets: { id: string; label: string }[];
  sourceLabels: Record<string, string>;
  onAssign: (input: { candidatePrintingIds: string[]; printingId: string | null }) => void;
  onCopy: (input: { id: string; printingId: string }) => void;
  onIgnore: (input: { provider: string; externalId: string; finish: string | null }) => void;
  onDelete: (id: string) => void;
}

function PrintingSourceColumnActions({
  row,
  targets,
  sourceLabels,
  onAssign,
  onCopy,
  onIgnore,
  onDelete,
}: PrintingSourceColumnActionsProps) {
  if (!row) {
    return null;
  }
  const printingRow = row as CandidatePrintingResponse;
  return (
    <PrintingSourceActions
      targets={targets}
      onAssign={(pid) => onAssign({ candidatePrintingIds: [row.id], printingId: pid })}
      onCopy={(pid) => onCopy({ id: row.id, printingId: pid })}
      onUnassign={() => onAssign({ candidatePrintingIds: [row.id], printingId: null })}
      onIgnore={() =>
        onIgnore({
          provider: sourceLabels[printingRow.candidateCardId] ?? "",
          externalId: row.externalId,
          finish: printingRow.finish,
        })
      }
      onDelete={() => onDelete(row.id)}
    />
  );
}

interface PrintingReviewCardProps {
  printing: AdminPrintingResponse;
  cardId: string;
  printings: AdminPrintingResponse[];
  candidatePrintings: CandidatePrintingResponse[];
  printingImages: AdminPrintingImageResponse[];
  sourceLabels: Record<string, string>;
  sourceNames: Record<string, string>;
  /** Keyed by candidate card id; printing rows resolve theirs via their parent. */
  sourceSubmitters: Record<string, SourceSubmitter>;
  providerSettings: ProviderSettingResponse[];
  printingSourceFields: FieldDef<CandidatePrintingFieldKey>[];
  setTotals: Record<string, number>;
  costKeywords: readonly string[];
  invalidates: readonly (readonly unknown[])[];
  /** True only for the card's first printing, so a card never renders every row expanded. */
  defaultExpanded: boolean;
  /** Card-review grant holders only accept fields; triage and delete stay full-admin. */
  isAdmin: boolean;
  /** Driven by the printings header, so every row folds the same way. */
  agreedFieldsFolded: boolean;
  onAgreedFieldsFoldedChange: (folded: boolean) => void;
}

/**
 * The row owns its own mutations and reads its own fold slice so the detail
 * page's `.map()` closes over nothing that changes per render.
 */
export function PrintingReviewCard({
  printing,
  cardId,
  printings,
  candidatePrintings,
  printingImages,
  sourceLabels,
  sourceNames,
  sourceSubmitters,
  providerSettings,
  printingSourceFields,
  setTotals,
  costKeywords,
  invalidates,
  defaultExpanded,
  isAdmin,
  agreedFieldsFolded,
  onAgreedFieldsFoldedChange,
}: PrintingReviewCardProps) {
  const printingId = printing.id;
  const printingLabel = printing.expectedPrintingId;

  const isExpanded = useAdminCardFoldStore((state) => {
    const collapsed = getStoredCollapsedPrintings(state, cardId);
    return collapsed === undefined ? defaultExpanded : !collapsed.has(printingId);
  });
  const togglePrintingFold = useAdminCardFoldStore((state) => state.togglePrinting);

  const checkAllCandidatePrintings = useCheckAllCandidatePrintings(invalidates);
  const checkPrintingSource = useCheckCandidatePrinting(invalidates);
  const uncheckPrintingSource = useUncheckCandidatePrinting(invalidates);
  const acceptPrintingField = useAcceptPrintingField(invalidates);
  const linkPrintingSources = useLinkCandidatePrintings(invalidates);
  const copyPrintingSource = useCopyCandidatePrinting(invalidates);
  const deletePrintingSource = useDeleteCandidatePrinting(invalidates);
  const deletePrintingMutation = useDeletePrinting(invalidates);
  const ignorePrintingSource = useIgnoreCandidatePrinting();
  const { labels } = useEnumOrders();
  const { data: markersData } = useMarkers();
  const { data: citationsData } = useAdminPrintingCitations(printingId);
  const [addingCitation, setAddingCitation] = useState(false);
  const hasCitations = (citationsData?.citations.length ?? 0) > 0;

  const allSources = candidatePrintings.filter((ps) => ps.printingId === printingId);
  const ownImages = printingImages.filter((pi) => pi.printingId === printingId);
  const activeImage = ownImages.find((pi) => pi.isActive);
  const ownImageUrls = new Set(ownImages.map((image) => image.originalUrl));
  const thumbnailUrl = activeImage ? printingImageDisplayUrl(activeImage) : null;
  const summaryLabels = {
    rarities: labels.rarities,
    finishes: labels.finishes,
    artVariants: labels.artVariants,
    markers: Object.fromEntries(markersData.markers.map((marker) => [marker.slug, marker.label])),
  };
  const setAndFinish = [
    printing.setName ?? printing.setSlug,
    enumLabel(labels.finishes, printing.finish),
  ].join(" · ");
  const rarityIcon = getFilterIconPath("rarities", printing.rarity);
  const printingWithImage = {
    ...printing,
    imageUrl: activeImage?.originalUrl ?? null,
  };

  const uncheckedSources = allSources.filter((ps) => !ps.checkedAt);

  // One entry per underlying image file: the pin stores the file, so a scan shared
  // across printings would otherwise offer the same pin twice.
  const siblingImages: SiblingImage[] = [];
  const seenImageFiles = new Set<string>();
  for (const image of printingImages) {
    if (image.printingId === printingId || seenImageFiles.has(image.imageFileId)) {
      continue;
    }
    seenImageFiles.add(image.imageFileId);
    const owner = printings.find((p) => p.id === image.printingId);
    siblingImages.push({
      imageFileId: image.imageFileId,
      printingLabel: owner?.expectedPrintingId ?? image.printingId,
    });
  }

  const derivedArtPrinting = findDerivedArtPrinting(printing, printings, printingImages);

  return (
    <div data-printing-id={printingId}>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- contains nested buttons, can't use <button> */}
      <div
        className="hover:bg-muted/50 flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium"
        onClick={() => togglePrintingFold(cardId, printingId)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          <PrintingImageBox
            url={thumbnailUrl}
            alt={printingLabel}
            className="w-8 shrink-0"
            iconClassName="size-3"
          />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <PrintingIdLabel label={printingLabel} language={printing.language} />
              {!activeImage && (
                <Badge variant="destructive">
                  {printing.fallbackArtMode === "pinned" ? "substitute image" : "no image"}
                </Badge>
              )}
            </span>
            <span className="text-muted-foreground flex flex-wrap items-center gap-1.5 font-normal">
              {rarityIcon !== null && (
                <img
                  src={rarityIcon}
                  alt={enumLabel(labels.rarities, printing.rarity)}
                  width={28}
                  height={28}
                  className="size-4 shrink-0"
                />
              )}
              <span>{setAndFinish}</span>
              <span aria-hidden>·</span>
              <span>{printingKindLabel(printing, summaryLabels)}</span>
            </span>
          </span>
        </span>
        {isAdmin && uncheckedSources.length > 0 && (
          <span className="flex flex-wrap items-center gap-1">
            {uncheckedSources.map((source) => (
              <Button
                key={source.id}
                variant="outline"
                size="xs"
                title={`Mark ${sourceLabels[source.candidateCardId] ?? "this source"} as checked`}
                disabled={checkPrintingSource.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  checkPrintingSource.mutate(source.id);
                }}
              >
                <CheckCheckIcon />
                {sourceLabels[source.candidateCardId] ?? "source"}
              </Button>
            ))}
            {uncheckedSources.length > 1 && (
              <Button
                variant="ghost"
                size="xs"
                disabled={checkAllCandidatePrintings.isPending}
                onClick={(e) => {
                  e.stopPropagation();
                  checkAllCandidatePrintings.mutate({ printingId });
                }}
              >
                All {uncheckedSources.length}
              </Button>
            )}
          </span>
        )}
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" onClick={(e) => e.stopPropagation()} />
              }
            >
              <EllipsisVerticalIcon />
              <span className="sr-only">Printing actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!hasCitations && (
                <DropdownMenuItem onClick={() => setAddingCitation(true)}>
                  <QuoteIcon className="mr-2" />
                  Add source link
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                render={
                  <Link
                    to="/admin/cards/$cardSlug/printings/create"
                    params={{ cardSlug: cardId }}
                    search={{ duplicateFrom: printingId }}
                  />
                }
              >
                <CopyIcon className="mr-2" />
                Duplicate printing
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={deletePrintingMutation.isPending}
                onClick={() => {
                  if (
                    globalThis.confirm(`Delete printing "${printingLabel}"? This cannot be undone.`)
                  ) {
                    deletePrintingMutation.mutate(printingId);
                  }
                }}
              >
                <Trash2Icon className="text-destructive mr-2" />
                <span className="text-destructive">Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {isExpanded && (
        <div className="flex flex-col gap-3 px-3 pb-3">
          <div className="min-w-0 flex-1 space-y-3">
            <CandidateSpreadsheet
              key={allSources.map((s) => s.id).join(",")}
              fields={printingSourceFields}
              activeRow={printingWithImage}
              candidateRows={allSources}
              providerLabels={sourceLabels}
              providerNames={sourceNames}
              submitters={sourceSubmitters}
              providerSettings={providerSettings}
              activeImageUrl={printingWithImage.imageUrl}
              costKeywords={costKeywords}
              agreedFieldsFolded={agreedFieldsFolded}
              onAgreedFieldsFoldedChange={onAgreedFieldsFoldedChange}
              renderActiveCell={(field) =>
                field.key === "imageUrl" ? (
                  <PrintingImageSwitcher
                    printingId={printingId}
                    printingLabel={printingLabel}
                    images={ownImages}
                    providerSettings={providerSettings}
                    siblingImages={siblingImages}
                    derivedArtLabel={derivedArtPrinting?.expectedPrintingId ?? null}
                    fallbackArtMode={printing.fallbackArtMode}
                    fallbackImageFileId={printing.fallbackImageFileId}
                    invalidates={invalidates}
                    isAdmin={isAdmin}
                  />
                ) : null
              }
              renderCandidateCell={(field, row) => {
                if (field.key !== "imageUrl" || typeof row.imageUrl !== "string") {
                  return null;
                }
                return (
                  <PrintingSourceImageCell
                    candidatePrintingId={row.id}
                    url={row.imageUrl}
                    sourceLabel={sourceLabels[row.candidateCardId ?? ""] ?? "Source"}
                    isUsed={ownImageUrls.has(row.imageUrl)}
                  />
                );
              }}
              normalizeCandidate={buildPrintingNormalizer(
                setTotals,
                printing.setSlug,
                costKeywords,
              )}
              onCellClick={(field, value, candidateId) => {
                // externalId / extraData / imageUrl are read-only provider
                // columns the accept endpoint does not take.
                if (!isAcceptPrintingField(field)) {
                  return;
                }
                const previousValue = printingWithImage[field];
                acceptPrintingField.mutate({
                  printingId,
                  field,
                  value,
                  source: "provider",
                });
                const row = allSources.find((source) => source.id === candidateId);
                toastFieldAccepted({
                  fieldLabel:
                    printingSourceFields.find((entry) => entry.key === field)?.label ?? field,
                  sourceLabel:
                    row === undefined ? "this source" : getProviderLabel(row, sourceLabels),
                  previousValue,
                  onUndo: (previous) =>
                    acceptPrintingField.mutate({
                      printingId,
                      field,
                      value: previous,
                      source: "manual",
                    }),
                });
              }}
              onActiveChange={(field, value) => {
                if (value === undefined || !isAcceptPrintingField(field)) {
                  return;
                }
                acceptPrintingField.mutate({ printingId, field, value });
              }}
              onCheck={isAdmin ? (id) => checkPrintingSource.mutate(id) : undefined}
              onUncheck={isAdmin ? (id) => uncheckPrintingSource.mutate(id) : undefined}
              columnActions={
                isAdmin ? (
                  <PrintingSourceColumnActions
                    targets={printings
                      .filter((p) => p.id !== printingId)
                      .map((p) => ({
                        id: p.id,
                        label: p.expectedPrintingId,
                      }))}
                    sourceLabels={sourceLabels}
                    onAssign={(input) => linkPrintingSources.mutate(input)}
                    onCopy={(input) => copyPrintingSource.mutate(input)}
                    onIgnore={(input) => ignorePrintingSource.mutate(input)}
                    onDelete={(id) => deletePrintingSource.mutate(id)}
                  />
                ) : undefined
              }
            />
            {isAdmin && (
              <PrintingCitationsEditor
                printingId={printingId}
                adding={hasCitations ? undefined : addingCitation}
                onAddingChange={hasCitations ? undefined : setAddingCitation}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
