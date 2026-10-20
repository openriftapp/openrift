import { isAcceptPrintingField } from "@openrift/shared/contracts/admin/card-mutations";
import { enumLabel } from "@openrift/shared/enum-label";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import { isPrintingLevelField } from "@openrift/shared/printing-field-level";
import type {
  AdminPrintingImageResponse,
  AdminPrintingResponse,
  CandidateCardResponse,
  CandidatePrintingResponse,
  ProviderSettingResponse,
} from "@openrift/shared/types/api/admin";
import { Link } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  CheckCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  QuoteIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
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
import { useMarkers } from "@/features/admin/hooks/use-markers";
import { toastFieldAccepted } from "@/features/admin/lib/accept-undo";
import { getProviderLabel } from "@/features/admin/lib/candidate-rows";
import type { SourceSubmitter } from "@/features/admin/lib/candidate-submitter";
import type { FaceRow } from "@/features/admin/lib/face-rows";
import { printingPairName } from "@/features/admin/lib/face-rows";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { imagesOnSide } from "@/features/admin/lib/printing-side-images";
import { printingKindLabel } from "@/features/admin/lib/printing-summary";
import {
  getStoredCollapsedPrintings,
  useAdminCardFoldStore,
} from "@/features/admin/stores/admin-card-fold-store";
import { RarityIcon } from "@/features/cards/components/rarity-icon";
import { useEnumOrders } from "@/hooks/use-enums";

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
      targets={targets.filter((target) => target.id !== printingRow.printingId)}
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
  face: FaceRow;
  cardId: string;
  cardName: string;
  canOpenPrintingPages: boolean;
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
  /** Card-review grant holders only accept fields; triage and delete stay full-admin. */
  isAdmin: boolean;
  landscape?: boolean;
  /** Driven by the printings header, so every row folds the same way. */
  agreedFieldsFolded: boolean;
  onAgreedFieldsFoldedChange: (folded: boolean) => void;
}

/**
 * The row owns its own mutations and reads its own fold slice so the detail
 * page's `.map()` closes over nothing that changes per render.
 */
export function PrintingReviewCard({
  face,
  cardId,
  cardName,
  canOpenPrintingPages,
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
  isAdmin,
  landscape = false,
  agreedFieldsFolded,
  onAgreedFieldsFoldedChange,
}: PrintingReviewCardProps) {
  const printing = face.printing;
  const printingId = printing.id;
  const printingLabel = printing.expectedPrintingId;
  const shared = face.printings.length > 1;
  const facePrintingIds = new Set(face.printings.map((row) => row.id));

  const isExpanded = useAdminCardFoldStore((state) => {
    const collapsed = getStoredCollapsedPrintings(state, cardId);
    return collapsed !== undefined && !collapsed.has(face.faceId);
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const ignorePrintingSource = useIgnoreCandidatePrinting();
  const { labels } = useEnumOrders();
  const { data: markersData } = useMarkers();
  const { data: citationsData } = useAdminPrintingCitations(printingId);
  const [addingCitation, setAddingCitation] = useState(false);
  const hasCitations = (citationsData?.citations.length ?? 0) > 0;

  const allSources = candidatePrintings.filter(
    (ps) => ps.printingId !== null && facePrintingIds.has(ps.printingId),
  );
  const fields = shared
    ? printingSourceFields.filter((field) => !isPrintingLevelField(field.key))
    : printingSourceFields;
  const printingOfSource = new Map(allSources.map((ps) => [ps.id, ps.printingId]));
  const ownImages = printingImages.filter((pi) => pi.printingId === printingId);
  const sideImages = imagesOnSide(ownImages, printing);
  const activeImage = sideImages.find((pi) => pi.isActive);
  const ownImageUrls = new Set(sideImages.map((image) => image.originalUrl));
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
    if (facePrintingIds.has(image.printingId) || seenImageFiles.has(image.imageFileId)) {
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
    <div data-face-id={face.faceId}>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- contains nested buttons, can't use <button> */}
      <div
        className="hover:bg-muted/50 flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium"
        onClick={() => togglePrintingFold(cardId, face.faceId)}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          <PrintingImageBox
            url={thumbnailUrl}
            alt={printingLabel}
            className={landscape ? "w-11 shrink-0" : "w-8 shrink-0"}
            iconClassName="size-3"
            landscape={landscape}
          />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <PrintingIdLabel label={printingLabel} language={printing.language} />
              {!activeImage && printing.fallbackArtMode === "pinned" && (
                <Badge variant="destructive">substitute image</Badge>
              )}
              {shared && <Badge variant="subtle">On {face.printings.length} printings</Badge>}
            </span>
            <span className="text-muted-foreground flex flex-wrap items-center gap-1.5 font-normal">
              <RarityIcon rarity={printing.rarity} labelled />
              <span>{setAndFinish}</span>
              <span aria-hidden>·</span>
              <span>{printingKindLabel(printing, summaryLabels)}</span>
            </span>
            {canOpenPrintingPages && (
              <span className="mt-1 flex flex-wrap items-center gap-1.5 font-normal">
                {face.printings.map((row) => (
                  <FacePrintingLink
                    key={row.id}
                    printing={row}
                    cardName={cardName}
                    code={printing.publicCode}
                  />
                ))}
              </span>
            )}
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
                  checkAllCandidatePrintings.mutate({
                    extraIds: uncheckedSources.map((source) => source.id),
                  });
                }}
              >
                All {uncheckedSources.length}
              </Button>
            )}
          </span>
        )}
        {isAdmin && !shared && (
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
                variant="destructive"
                disabled={deletePrintingMutation.isPending}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete printing "${printingLabel}"?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        isPending={deletePrintingMutation.isPending}
        onConfirm={() =>
          deletePrintingMutation.mutate(printingId, { onSuccess: () => setDeleteOpen(false) })
        }
      />
      {isExpanded && (
        <div className="flex flex-col gap-3 px-3 pb-3">
          <div className="min-w-0 flex-1 space-y-3">
            {shared && (
              <div className="bg-muted/50 space-y-1 rounded-md px-3 py-2 text-sm">
                <p>
                  Edits to this face change all {face.printings.length} printings.
                  {canOpenPrintingPages &&
                    " Size, release dates, channels and listings are on each printing's page."}
                </p>
                {allSources.length > 0 && (
                  <p className="text-muted-foreground">
                    {allSources.map((source, index) => {
                      const linked = face.printings.find(
                        (row) => row.id === printingOfSource.get(source.id),
                      );
                      return (
                        <span key={source.id}>
                          {index > 0 && " · "}
                          {getProviderLabel(source, sourceLabels)} from{" "}
                          {linked ? printingPairName(linked, cardName) : "this face"}
                        </span>
                      );
                    })}
                  </p>
                )}
              </div>
            )}
            <CandidateSpreadsheet
              key={allSources.map((s) => s.id).join(",")}
              fields={fields}
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
                    face={printing.side === 2 ? "back" : "front"}
                    printingLabel={printingLabel}
                    images={sideImages}
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
                    landscape={landscape}
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
                  faceId: printing.faceId,
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
                      faceId: printing.faceId,
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
                acceptPrintingField.mutate({ printingId, faceId: printing.faceId, field, value });
              }}
              onCheck={isAdmin ? (id) => checkPrintingSource.mutate(id) : undefined}
              onUncheck={isAdmin ? (id) => uncheckPrintingSource.mutate(id) : undefined}
              columnActions={
                isAdmin ? (
                  <PrintingSourceColumnActions
                    targets={[...new Map(printings.map((p) => [p.id, p])).values()].map((p) => ({
                      id: p.id,
                      label:
                        p.otherFace === null
                          ? p.expectedPrintingId
                          : `${printingPairName(p, cardName)} ${p.expectedPrintingId}`,
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
            {isAdmin && !shared && (
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

function FacePrintingLink({
  printing,
  cardName,
  code,
}: {
  printing: AdminPrintingResponse;
  cardName: string;
  code: string;
}) {
  const other = printing.otherFace;
  const codes =
    other === null
      ? formatPrintingCode(code)
      : printing.side === 2
        ? `${formatPrintingCode(other.publicCode)} // ${formatPrintingCode(code)}`
        : `${formatPrintingCode(code)} // ${formatPrintingCode(other.publicCode)}`;
  return (
    <Link
      to="/admin/printings/$printingId"
      params={{ printingId: printing.id }}
      onClick={(event) => event.stopPropagation()}
      className="hover:border-primary inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs"
    >
      {other === null ? (
        <span>Printing page</span>
      ) : (
        <span>{printingPairName(printing, cardName)}</span>
      )}
      <span className="text-muted-foreground font-mono">{codes}</span>
      <ArrowRightIcon className="size-3" />
    </Link>
  );
}
