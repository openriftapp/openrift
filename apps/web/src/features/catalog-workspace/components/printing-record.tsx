import { legendDisplayName } from "@openrift/shared/card-name";
import { getOrientation } from "@openrift/shared/card-orientation";
import type { ComparablePrintingField } from "@openrift/shared/catalog-field-compare";
import type { DeskImage, DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { formatDay } from "@openrift/shared/format-date";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import { pluralize } from "@openrift/shared/strings";
import type { CardType } from "@openrift/shared/types/enums";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, Share2Icon } from "lucide-react";
import { Fragment, Suspense, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PrintingActionsMenu } from "@/features/admin/components/printing-actions-menu";
import { PrintingCitationsEditor } from "@/features/admin/components/printing-citations-editor";
import { DeskStatusBadge } from "@/features/admin/components/printing-desk-shared";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { SideSearch } from "@/features/admin/components/side-search";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import {
  useDeskPrinting,
  useRemoveDeskSecondSide,
  useSetDeskSecondSide,
} from "@/features/admin/hooks/use-printing-desk";
import type { AdminCardDetail } from "@/features/admin/lib/admin-card-queries";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { hasAdminSection } from "@/features/admin/lib/admin-sections";
import { deskPrintingName } from "@/features/admin/lib/desk-face-options";
import { EMPTY_VALUE_TEXT, formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { deskImageSrc } from "@/features/admin/lib/printing-desk-image";
import { deskPrintingQueryOptions } from "@/features/admin/lib/printing-desk-queries";
import { deskPrintingPeriod } from "@/features/admin/lib/printing-desk-status";
import type { PrintingFace } from "@/features/admin/lib/printing-faces";
import { printingFaces } from "@/features/admin/lib/printing-faces";
import { encodePostSlides } from "@/features/admin/lib/printing-post-slides";
import { providerSettingsQueryOptions } from "@/features/admin/lib/provider-settings-queries";
import { hiddenProviders as hiddenProvidersFor } from "@/features/admin/lib/source-compare";
import { catalogKeys } from "@/features/cards/lib/cards-query-keys";
import { AddFacePicker } from "@/features/catalog-workspace/components/add-face-picker";
import {
  FaceCompareGrid,
  PrintingCompareGrid,
} from "@/features/catalog-workspace/components/compare-grids";
import { FaceImagesSection } from "@/features/catalog-workspace/components/face-images-section";
import { PrintingMarketplaceSection } from "@/features/catalog-workspace/components/printing-marketplace-section";
import { FaceFieldsSection } from "@/features/catalog-workspace/components/record/face-fields-section";
import { RecordFieldRow } from "@/features/catalog-workspace/components/record/field-row";
import { PrintingCardLinks } from "@/features/catalog-workspace/components/record/printing-card-links";
import type { PrintingField } from "@/features/catalog-workspace/components/record/printing-field-editor";
import { PrintingFieldEditor } from "@/features/catalog-workspace/components/record/printing-field-editor";
import { PrintingRowSuggestions } from "@/features/catalog-workspace/components/record/printing-row-suggestions";
import { RecordDismissAll } from "@/features/catalog-workspace/components/record/record-dismiss-all";
import { RecordError } from "@/features/catalog-workspace/components/record/record-error";
import {
  CompareSourcesToggle,
  PublicPageLink,
  RecordHeader,
  RecordPane,
  RecordSection,
  VariantFacts,
} from "@/features/catalog-workspace/components/record/record-pane";
import { ReviewStopBar } from "@/features/catalog-workspace/components/record/review-stop-bar";
import { WorkspaceHistorySection } from "@/features/catalog-workspace/components/record/workspace-history-section";
import { useValueLabels } from "@/features/catalog-workspace/hooks/use-value-labels";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import { dismissTargets, showsFaceOnStop } from "@/features/catalog-workspace/lib/card-pass";
import {
  buildFaceSuggestions,
  faceCompareCandidates,
} from "@/features/catalog-workspace/lib/face-suggestion-rows";
import {
  buildPrintingSuggestions,
  sourcesReportPrintingFields,
} from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import { cardRecordScope } from "@/features/catalog-workspace/lib/record-scopes";
import { replaceSecondFace } from "@/features/catalog-workspace/lib/replace-second-face";
import { variantExtras } from "@/features/catalog-workspace/lib/variant-facts";
import { useCostKeywords } from "@/hooks/use-keyword-styles";
import { PERSISTENT_ERROR_TOAST } from "@/lib/toast";
import { cn } from "@/lib/utils";

const RECORD_DELETE_SCOPE = [
  adminKeys.cards.all,
  adminKeys.printingDesk.all,
  adminKeys.workspace,
  catalogKeys.all,
] as const;

export function PrintingRecord({ printingId }: { printingId: string }) {
  const { data: access, isPending } = useAdminAccess();
  const isAdmin = access?.isAdmin === true;
  const canReview = hasAdminSection(access, "card-review");
  const canDesk = hasAdminSection(access, "printing-desk");
  const printingQuery = useQuery(deskPrintingQueryOptions(printingId, 1));

  if (printingQuery.data === undefined && printingQuery.isError) {
    return (
      <RecordError
        error={printingQuery.error}
        missing={<>No printing with ID &ldquo;{printingId}&rdquo; exists.</>}
        onRetry={() => void printingQuery.refetch()}
      />
    );
  }
  if (isPending || printingQuery.data === undefined) {
    return <Skeleton className="m-4 h-96" />;
  }
  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      <PrintingRecordBody
        key={printingId}
        printingId={printingId}
        isAdmin={isAdmin}
        canReview={canReview}
        canDesk={canDesk}
      />
    </Suspense>
  );
}

function PrintingRecordBody({
  printingId,
  isAdmin,
  canReview,
  canDesk,
}: {
  printingId: string;
  isAdmin: boolean;
  canReview: boolean;
  canDesk: boolean;
}) {
  const navigate = useNavigate();
  const { data } = useDeskPrinting(printingId, 1);
  const printing = data.printing;
  const faces = printingFaces(printing);
  const slugs = [...new Set(faces.map((face) => face.cardSlug))];
  const first = useAdminCardDetail(canReview ? (slugs[0] ?? "") : "").data;
  const second = useAdminCardDetail(canReview ? (slugs[1] ?? "") : "").data;
  const { data: providerData } = useQuery({ ...providerSettingsQueryOptions, enabled: canReview });
  const costKeywords = useCostKeywords();
  const labels = useValueLabels();
  const queueWrite = useQueueWorkspaceWrite();
  const [editing, setEditing] = useState<PrintingField | null>(null);
  const [addingFace, setAddingFace] = useState(false);
  const [comparing, setComparing] = useState(false);
  const canAddFace = faces.length === 1 && printing.canEdit;

  const cardDetails = [
    { slug: slugs[0], detail: first },
    { slug: slugs[1], detail: second },
  ].filter(
    (entry): entry is { slug: string; detail: AdminCardDetail } =>
      entry.slug !== undefined && entry.detail !== undefined,
  );
  const details = cardDetails.map((entry) => entry.detail);
  const firstFace = details
    .flatMap((detail) => detail.printings)
    .find((row) => row.id === printingId && row.faceId === printing.faceId);
  const hiddenProviders = hiddenProvidersFor(providerData?.providerSettings ?? [], isAdmin);
  const { suggestions, sources } = buildPrintingSuggestions(details, printingId, {
    costKeywords,
    setTotals: Object.assign({}, ...details.map((detail) => detail.setTotals)) as Record<
      string,
      number
    >,
    hiddenProviders,
  });
  const activeFront = data.images.find((image) => image.face === "front" && image.isActive);
  const postImage = activeFront ?? data.images.at(0) ?? null;
  const postSlides =
    postImage === null
      ? null
      : encodePostSlides([{ printingId, imageFileId: postImage.imageFileId }]);

  const reviewedCard = useLocation({
    select: (location) => location.state.workspaceReview?.cardSlug,
  });
  const faceReviews = canReview
    ? faces.flatMap((face) => {
        const detail = cardDetails.find((entry) => entry.slug === face.cardSlug)?.detail;
        if (detail === undefined) {
          return [];
        }
        const model = buildFaceSuggestions(detail, face.faceId, {
          costKeywords,
          setTotals: detail.setTotals,
          hiddenProviders,
        });
        return showsFaceOnStop(face.cardSlug, model, reviewedCard) && model.face !== null
          ? [{ printingFace: face, face: model.face, model, detail }]
          : [];
      })
    : [];

  const dismiss = dismissTargets(
    details,
    [...sources, ...faceReviews.flatMap((entry) => entry.model.sources)],
    hiddenProviders,
  );

  const reviewRow = details
    .flatMap((detail) => detail.printings)
    .find((row) => row.id === printingId);
  const reviewDetail = cardDetails.at(0);
  const rowSuggestions = (fields: readonly ComparablePrintingField[]) =>
    reviewRow !== undefined &&
    reviewDetail !== undefined &&
    suggestions.some((suggestion) => fields.includes(suggestion.field)) ? (
      <PrintingRowSuggestions
        fields={fields}
        suggestions={suggestions}
        printing={reviewRow}
        detail={reviewDetail.detail}
        cardSlug={reviewDetail.slug}
        cardSlugs={slugs}
        isAdmin={isAdmin}
        labels={labels}
      />
    ) : undefined;

  const editOf = (field: PrintingField) =>
    printing.canEdit && editing === null ? () => setEditing(field) : undefined;
  const editorOf = (field: PrintingField) =>
    editing === field ? (
      <PrintingFieldEditor printing={printing} field={field} onDone={() => setEditing(null)} />
    ) : undefined;

  return (
    <RecordPane
      banner={<ReviewStopBar current={{ kind: "printing", printingId }} />}
      header={
        <RecordHeader
          thumb={
            <span className="flex shrink-0 gap-1">
              {faces.map((face) => {
                const image = data.images.find(
                  (entry) => entry.face === face.imageFace && entry.isActive,
                );
                return (
                  <PrintingImageBox
                    key={face.faceId}
                    url={image === undefined ? null : deskImageSrc(image.url, "240w")}
                    alt={face.cardName}
                    landscape={
                      face.position === 1
                        ? getOrientation([printing.cardType as CardType]) === "landscape"
                        : null
                    }
                    className="w-12"
                  />
                );
              })}
            </span>
          }
          title={deskPrintingName(printing)}
          subtitle={
            <VariantFacts
              rarity={printing.rarity}
              code={faces.map((face) => formatPrintingCode(face.publicCode)).join(" // ")}
              language={printing.language}
              finish={formatCatalogFieldValue("finish", printing.finish, labels)}
              extras={variantExtras(
                {
                  markerSlugs: printing.markerSlugs,
                  artVariant: firstFace?.artVariant,
                  isSigned: firstFace?.isSigned,
                  isOvernumbered: firstFace?.isOvernumbered,
                  size: printing.size,
                },
                labels,
              )}
            />
          }
          actions={
            <>
              <RecordDismissAll
                scope={slugs.flatMap((slug) => cardRecordScope(slug))}
                record={deskPrintingName(printing)}
                dismiss={dismiss}
                isAdmin={isAdmin}
              />
              <PublicPageLink cardSlug={printing.cardSlug} printingSlug={printing.slug} />
              {canDesk && postSlides === null && (
                <Button variant="ghost" size="sm" disabled>
                  <Share2Icon />
                  Make a post
                </Button>
              )}
              {canDesk && postSlides !== null && (
                <Link
                  to="/admin/printing-desk/post"
                  search={{ slides: postSlides }}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  <Share2Icon />
                  Make a post
                </Link>
              )}
              {(isAdmin || canAddFace) && (
                <PrintingActionsMenu
                  printing={printing}
                  invalidates={RECORD_DELETE_SCOPE}
                  runWrite={queueWrite}
                  inWorkspace
                  canManage={isAdmin}
                  onAddFace={canAddFace ? () => setAddingFace(true) : undefined}
                  onDeleted={() =>
                    void navigate({ to: "/admin/workspace/printings", ignoreBlocker: true })
                  }
                />
              )}
            </>
          }
        />
      }
    >
      <RecordSection title={faces.length === 1 ? "Face" : "Faces"}>
        <div className={cn("grid gap-3", faces.length > 1 && "xl:grid-cols-2")}>
          {faces.map((face) => (
            <FaceSummary
              key={face.faceId}
              printing={printing}
              face={face}
              images={data.images}
              faceCount={faces.length}
              isAdmin={isAdmin}
            />
          ))}
          {canAddFace && addingFace && (
            <Suspense fallback={<Skeleton className="h-32" />}>
              <AddFace printing={printing} onCancel={() => setAddingFace(false)} />
            </Suspense>
          )}
        </div>
      </RecordSection>

      {faceReviews.map(({ printingFace, face, model, detail }) => {
        const suffix = faces.length > 1 ? ` · Face ${printingFace.position}` : "";
        return (
          <Fragment key={face.faceId}>
            <FaceImagesSection
              cardSlug={printingFace.cardSlug}
              face={face}
              detail={detail}
              images={model.images}
              printings={model.printings}
              sourceImages={model.sourceImages}
              providerSettings={providerData?.providerSettings ?? []}
              isAdmin={isAdmin}
              landscape={getOrientation(detail.card?.types ?? []) === "landscape"}
              title={`Images${suffix}`}
            />
            <FaceFieldsSection
              cardSlug={printingFace.cardSlug}
              face={face}
              canEdit={isAdmin}
              isAdmin={isAdmin}
              detail={detail}
              suggestions={model.suggestions}
              title={`Face fields${suffix}`}
              compareDisabledReason={
                faceCompareCandidates(detail, face.faceId, hiddenProviders).length === 0
                  ? "No source lists this face"
                  : undefined
              }
              compare={
                <FaceCompareGrid
                  cardSlug={printingFace.cardSlug}
                  faceId={face.faceId}
                  detail={detail}
                  providerSettings={providerData?.providerSettings ?? []}
                  hiddenProviders={hiddenProviders}
                  costKeywords={costKeywords}
                  isAdmin={isAdmin}
                />
              }
            />
          </Fragment>
        );
      })}

      <RecordSection
        title="Printing fields"
        actions={
          canReview && (
            <CompareSourcesToggle
              comparing={comparing}
              onToggle={() => setComparing(!comparing)}
              disabledReason={
                sourcesReportPrintingFields(details, printingId, hiddenProviders)
                  ? undefined
                  : "No source reports a size, channel or date for this printing"
              }
            />
          )
        }
      >
        {comparing && (
          <PrintingCompareGrid
            printingId={printingId}
            cardSlugs={slugs}
            details={details}
            providerSettings={providerData?.providerSettings ?? []}
            hiddenProviders={hiddenProviders}
            costKeywords={costKeywords}
            isAdmin={isAdmin}
          />
        )}
        <div className={comparing ? "hidden" : undefined}>
          <RecordFieldRow
            label="Channel"
            value={formatCatalogFieldValue(
              "distributionChannelSlugs",
              printing.distributionChannelSlugs,
              labels,
            )}
            onEdit={editOf("channel")}
            editing={editorOf("channel")}
            suggestions={rowSuggestions(["distributionChannelSlugs"])}
          />
          <RecordFieldRow
            label="Size"
            value={formatCatalogFieldValue("size", printing.size, labels)}
            onEdit={editOf("size")}
            editing={editorOf("size")}
            suggestions={rowSuggestions(["size"])}
          />
          <RecordFieldRow
            label="Announced on"
            value={
              printing.announcedAt === null ? EMPTY_VALUE_TEXT : formatDay(printing.announcedAt)
            }
            onEdit={editOf("announced")}
            editing={editorOf("announced")}
            suggestions={rowSuggestions(["announcedAt"])}
          />
          <RecordFieldRow
            label="Available from"
            value={
              <span className="inline-flex flex-wrap items-center gap-2">
                {deskPrintingPeriod(printing)}
                <DeskStatusBadge row={printing} />
              </span>
            }
            onEdit={editOf("release")}
            editing={editorOf("release")}
            suggestions={rowSuggestions(["releasedAt", "releasePrecision"])}
          />
          <RecordFieldRow
            label="Comment"
            value={
              printing.comment === null || printing.comment.length === 0
                ? EMPTY_VALUE_TEXT
                : printing.comment
            }
            onEdit={editOf("comment")}
            editing={editorOf("comment")}
          />
          {!printing.canEdit && (
            <p className="text-muted-foreground pt-2 text-sm">
              Not a promo. Only an admin changes this printing.
            </p>
          )}
        </div>
      </RecordSection>

      {isAdmin && (
        <PrintingMarketplaceSection
          printingId={printingId}
          cardSlug={printing.cardSlug}
          cardName={first?.card ? legendDisplayName(first.card) : printing.cardName}
          language={printing.language}
          mappings={details.flatMap((detail) => detail.marketplaceMappings)}
        />
      )}

      {canDesk && (
        <RecordSection title="Links">
          <PrintingCitationsEditor printingId={printingId} runWrite={queueWrite} />
        </RecordSection>
      )}

      {canReview && <PrintingCardLinks faces={faces} pendingCount={suggestions.length} />}

      {(canReview || printing.canEdit) && <WorkspaceHistorySection target={{ printingId }} />}
    </RecordPane>
  );
}

function FaceSummary({
  printing,
  face,
  images,
  faceCount,
  isAdmin,
}: {
  printing: DeskPrintingRow;
  face: PrintingFace;
  images: DeskImage[];
  faceCount: number;
  isAdmin: boolean;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const removeFace = useRemoveDeskSecondSide();
  const setFace = useSetDeskSecondSide();
  const [replacing, setReplacing] = useState(false);

  const sideImages = images.filter((image) => image.face === face.imageFace);
  const active = sideImages.find((image) => image.isActive) ?? null;
  const waiting = sideImages.filter((image) => !image.isActive).length;
  const canChange = printing.canEdit && faceCount > 1;

  const replace = async (faceId: string) => {
    let outcome: Awaited<ReturnType<typeof replaceSecondFace>> | undefined;
    await queueWrite(async (signal) => {
      outcome = await replaceSecondFace({
        remove: (input) => removeFace.mutateAsync(input, { signal }),
        set: (input) => setFace.mutateAsync(input, { signal }),
        printingId: printing.printingId,
        oldFaceId: face.faceId,
        newFaceId: faceId,
      });
    });
    if (outcome === "replaced") {
      setReplacing(false);
    }
    if (outcome === "lost") {
      toast.error(
        `Face 2 was removed and could not be put back. Add ${face.cardName} again with Add face 2 in the printing menu.`,
        PERSISTENT_ERROR_TOAST,
      );
    }
  };

  return (
    <div
      className={cn("flex gap-3", faceCount > 1 && "rounded-lg border p-3")}
      data-face-id={face.faceId}
    >
      <PrintingImageBox
        url={active === null ? null : deskImageSrc(active.url, "240w")}
        alt={face.cardName}
        landscape={
          face.position === 1
            ? getOrientation([printing.cardType as CardType]) === "landscape"
            : null
        }
        className="w-16 shrink-0 self-start"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">
          {faceCount > 1 && `Face ${face.position} · `}
          {face.cardName}
        </p>
        <p className="text-muted-foreground font-mono text-sm">
          {formatPrintingCode(face.publicCode)}
        </p>
        <p className="text-muted-foreground text-sm">
          {face.sharedWith.length === 0
            ? "Only on this printing"
            : `Also on ${face.sharedWith.map((shared) => formatPrintingCode(shared.publicCode)).join(", ")}`}
        </p>
        {waiting > 0 && (
          <Badge variant="warning">
            {waiting} new {pluralize(waiting, "image")} on the face
          </Badge>
        )}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Link
            to="/admin/workspace/faces/$cardSlug/$faceId"
            params={{ cardSlug: face.cardSlug, faceId: face.faceId }}
            state={(prev) => ({ ...prev, workspaceFromPrintingId: printing.printingId })}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open face
            <ChevronRightIcon />
          </Link>
          {canChange && isAdmin && face.position === 1 && (
            <Link
              to="/admin/workspace/printings/create"
              search={{ card: printing.cardSlug, duplicateFrom: printing.printingId }}
              title="Face 1 defines the printing, so it cannot be swapped. Duplicate the printing with the other face first."
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Replace…
            </Link>
          )}
          {canChange && face.position === 2 && (
            <Button variant="outline" size="sm" onClick={() => setReplacing(true)}>
              Replace…
            </Button>
          )}
          {canChange && (
            <Button
              variant="outline"
              size="sm"
              pending={removeFace.isPending}
              onClick={() =>
                void queueWrite((signal) =>
                  removeFace.mutateAsync(
                    { printingId: printing.printingId, faceId: face.faceId },
                    { signal },
                  ),
                )
              }
            >
              Remove
            </Button>
          )}
        </div>
        {replacing && (
          <SideSearch
            excludeFaceIds={[printing.faceId, face.faceId]}
            disabled={removeFace.isPending || setFace.isPending}
            onPick={(side) => void replace(side.faceId)}
          />
        )}
      </div>
    </div>
  );
}

function AddFace({ printing, onCancel }: { printing: DeskPrintingRow; onCancel: () => void }) {
  const queueWrite = useQueueWorkspaceWrite();

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <p className="font-medium">Add face 2</p>
      <p className="text-muted-foreground text-sm">
        For a double-faced token, pick the printing&apos;s other face.
      </p>
      <AddFacePicker printing={printing} runWrite={queueWrite} />
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
