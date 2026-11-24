import { getOrientation } from "@openrift/shared/card-orientation";
import type {
  DeskImage,
  DeskPrintingRow,
  DeskReleasePrecision,
  DeskUpdateInput,
} from "@openrift/shared/contracts/admin/printing-desk";
import { enumLabel } from "@openrift/shared/enum-label";
import { formatDay } from "@openrift/shared/format-date";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import { normalizeToPeriodStart } from "@openrift/shared/set-release";
import { pluralize } from "@openrift/shared/strings";
import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import type { CardType } from "@openrift/shared/types/enums";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, ExternalLinkIcon, Share2Icon } from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DatePrecisionControl } from "@/features/admin/components/date-precision-control";
import { PrintingActionsMenu } from "@/features/admin/components/printing-actions-menu";
import { PrintingCitationsEditor } from "@/features/admin/components/printing-citations-editor";
import { PrintingDeskChannelPicker } from "@/features/admin/components/printing-desk-channel-picker";
import { DeskStatusBadge } from "@/features/admin/components/printing-desk-shared";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { SideSearch } from "@/features/admin/components/side-search";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useUnmapMarketplacePrinting } from "@/features/admin/hooks/use-admin-card-mutations";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import {
  useDeskPrinting,
  useRemoveDeskSecondSide,
  useSetDeskSecondSide,
  useUpdateDeskPrinting,
} from "@/features/admin/hooks/use-printing-desk";
import type { AdminCardDetail } from "@/features/admin/lib/admin-card-queries";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { hasAdminSection } from "@/features/admin/lib/admin-sections";
import { deskPrintingName } from "@/features/admin/lib/desk-face-options";
import { EMPTY_VALUE_TEXT, formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { deskImageSrc } from "@/features/admin/lib/printing-desk-image";
import { deskPrintingPeriod } from "@/features/admin/lib/printing-desk-status";
import type { PrintingFace } from "@/features/admin/lib/printing-faces";
import { printingFaces } from "@/features/admin/lib/printing-faces";
import { encodePostSlides } from "@/features/admin/lib/printing-post-slides";
import { providerSettingsQueryOptions } from "@/features/admin/lib/provider-settings-queries";
import { catalogKeys } from "@/features/cards/lib/cards-query-keys";
import { RecordFieldRow } from "@/features/catalog-workspace/components/record/field-row";
import {
  PendingReviewNotice,
  RecordHeader,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { WorkspaceHistorySection } from "@/features/catalog-workspace/components/record/workspace-history-section";
import { useValueLabels } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import { buildPrintingSuggestions } from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import { replaceSecondFace } from "@/features/catalog-workspace/lib/replace-second-face";
import { useEnumOrders } from "@/hooks/use-enums";
import { useCostKeywords } from "@/hooks/use-keyword-styles";
import { errorText } from "@/lib/error-text";
import { PERSISTENT_ERROR_TOAST } from "@/lib/toast";

type PrintingField = "channel" | "size" | "announced" | "release" | "comment";
type DeskPatch = Omit<DeskUpdateInput, "printingId" | "side">;

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

  if (isPending) {
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

  const cardDetails = [
    { slug: slugs[0], detail: first },
    { slug: slugs[1], detail: second },
  ].filter(
    (entry): entry is { slug: string; detail: AdminCardDetail } =>
      entry.slug !== undefined && entry.detail !== undefined,
  );
  const details = cardDetails.map((entry) => entry.detail);
  const hiddenProviders = new Set(
    (providerData?.providerSettings ?? [])
      .filter((setting) => setting.isHidden || (!isAdmin && !setting.helperReviewable))
      .map((setting) => setting.provider),
  );
  const { suggestions } = buildPrintingSuggestions(details, printingId, {
    costKeywords,
    setTotals: Object.assign({}, ...details.map((detail) => detail.setTotals)) as Record<
      string,
      number
    >,
    hiddenProviders,
  });
  const pendingCards = cardDetails.flatMap(({ slug, detail }) => {
    const pending = suggestions.filter(
      (suggestion) =>
        cardDetails.find((entry) =>
          entry.detail.candidatePrintings.some((row) => row.id === suggestion.candidate.id),
        )?.detail === detail,
    ).length;
    return pending > 0 ? [{ cardSlug: slug, cardName: detail.displayName, pending }] : [];
  });
  const activeFront = data.images.find((image) => image.face === "front" && image.isActive);
  const postImage = activeFront ?? data.images.at(0) ?? null;
  const postSlides =
    postImage === null
      ? null
      : encodePostSlides([{ printingId, imageFileId: postImage.imageFileId }]);
  // Each card on a double-sided printing reports the printing's mappings, so both details list them.
  const mapped = [
    ...new Map(
      details
        .flatMap((detail) => detail.marketplaceMappings)
        .filter((mapping) => mapping.targetPrintingId === printingId)
        .map((mapping) => [mappingKey(mapping), mapping]),
    ).values(),
  ];

  const editOf = (field: PrintingField) =>
    printing.canEdit && editing === null ? () => setEditing(field) : undefined;
  const editorOf = (field: PrintingField) =>
    editing === field ? (
      <PrintingFieldEditor printing={printing} field={field} onDone={() => setEditing(null)} />
    ) : undefined;

  return (
    <RecordPane
      header={
        <RecordHeader
          title={deskPrintingName(printing)}
          subtitle={faces.map((face) => formatPrintingCode(face.publicCode)).join(" // ")}
          badges={<DeskStatusBadge row={printing} />}
          actions={
            <>
              <Link
                to="/cards/$cardSlug/{-$printingSlug}"
                params={{ cardSlug: printing.cardSlug, printingSlug: printing.slug }}
                target="_blank"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Public page
                <ExternalLinkIcon />
              </Link>
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
              {isAdmin && (
                <PrintingActionsMenu
                  printing={printing}
                  invalidates={RECORD_DELETE_SCOPE}
                  runWrite={queueWrite}
                  inWorkspace
                  onDeleted={() =>
                    void navigate({ to: "/admin/workspace/printings", ignoreBlocker: true })
                  }
                />
              )}
            </>
          }
        />
      }
      banner={<PendingReviewNotice record="printing" cards={pendingCards} />}
    >
      <RecordSection title="Faces">
        <div className="grid gap-3 xl:grid-cols-2">
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
          {faces.length === 1 && printing.canEdit && <AddFace printing={printing} />}
        </div>
      </RecordSection>

      <RecordSection title="Printing fields">
        <div>
          <RecordFieldRow
            label="Channel"
            value={formatCatalogFieldValue(
              "distributionChannelSlugs",
              printing.distributionChannelSlugs,
              labels,
            )}
            onEdit={editOf("channel")}
            editing={editorOf("channel")}
          />
          <RecordFieldRow
            label="Size"
            value={formatCatalogFieldValue("size", printing.size, labels)}
            onEdit={editOf("size")}
            editing={editorOf("size")}
          />
          <RecordFieldRow
            label="Announced on"
            value={
              printing.announcedAt === null ? EMPTY_VALUE_TEXT : formatDay(printing.announcedAt)
            }
            onEdit={editOf("announced")}
            editing={editorOf("announced")}
          />
          <RecordFieldRow
            label="Available from"
            value={deskPrintingPeriod(printing)}
            onEdit={editOf("release")}
            editing={editorOf("release")}
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
        <RecordSection
          title="Marketplace"
          actions={
            <Link
              to="/admin/workspace/listings"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Map listings
              <ChevronRightIcon />
            </Link>
          }
        >
          <MappedListings printingId={printingId} mapped={mapped} />
        </RecordSection>
      )}

      {canDesk && (
        <RecordSection title="Links">
          <PrintingCitationsEditor printingId={printingId} runWrite={queueWrite} />
        </RecordSection>
      )}

      {(canReview || printing.canEdit) && <WorkspaceHistorySection target={{ printingId }} />}
    </RecordPane>
  );
}

function mappingKey(mapping: AdminCardDetailResponse["marketplaceMappings"][number]): string {
  return `${mapping.marketplace}:${mapping.externalId}:${mapping.finish}:${mapping.variantLanguage ?? ""}`;
}

function MappedListings({
  printingId,
  mapped,
}: {
  printingId: string;
  mapped: AdminCardDetailResponse["marketplaceMappings"];
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const unmap = useUnmapMarketplacePrinting([
    adminKeys.cards.all,
    adminKeys.unifiedMappings.all,
    adminKeys.workspace,
  ]);

  if (mapped.length === 0) {
    return <p className="text-muted-foreground text-sm">No listing is mapped to this printing.</p>;
  }
  return (
    <ul className="space-y-1">
      {mapped.map((mapping) => (
        <li
          key={mappingKey(mapping)}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
        >
          <span className="w-28 shrink-0 font-medium">{marketplaceLabel(mapping.marketplace)}</span>
          <span className="min-w-0 flex-1">
            {mapping.productName}{" "}
            <span className="text-muted-foreground font-mono">#{mapping.externalId}</span>
          </span>
          <Button
            variant="ghost"
            size="xs"
            disabled={unmap.isPending}
            onClick={() =>
              void queueWrite((signal) =>
                unmap.mutateAsync(
                  {
                    marketplace: mapping.marketplace,
                    printingId,
                    externalId: mapping.externalId,
                    finish: mapping.finish,
                    language: mapping.variantLanguage,
                  },
                  { signal },
                ),
              )
            }
          >
            Unmap
          </Button>
        </li>
      ))}
    </ul>
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
  const error = removeFace.error ?? setFace.error;

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
        `Face 2 was removed and could not be put back. Add ${face.cardName} again under Add face 2.`,
        PERSISTENT_ERROR_TOAST,
      );
    }
  };

  return (
    <div className="flex gap-3 rounded-lg border p-3" data-face-id={face.faceId}>
      <PrintingImageBox
        url={active === null ? null : deskImageSrc(active.url, "240w")}
        alt={face.cardName}
        landscape={
          face.position === 1
            ? getOrientation([printing.cardType as CardType]) === "landscape"
            : null
        }
        className="w-16 shrink-0"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">
          Face {face.position} · {face.cardName}
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
            state={{ workspaceFromPrintingId: printing.printingId }}
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
        {error !== null && (
          <p className="text-destructive text-sm">
            {errorText(error, "Could not change the face.")}
          </p>
        )}
      </div>
    </div>
  );
}

function AddFace({ printing }: { printing: DeskPrintingRow }) {
  const queueWrite = useQueueWorkspaceWrite();
  const setFace = useSetDeskSecondSide();

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <p className="font-medium">Add face 2</p>
      <p className="text-muted-foreground text-sm">
        For a double-faced token, pick the printing&apos;s other face.
      </p>
      <SideSearch
        excludeFaceIds={[printing.faceId]}
        disabled={setFace.isPending}
        onPick={(side) =>
          void queueWrite((signal) =>
            setFace.mutateAsync(
              { printingId: printing.printingId, faceId: side.faceId },
              { signal },
            ),
          )
        }
      />
      {setFace.error && (
        <p className="text-destructive text-sm">
          {errorText(setFace.error, "Could not add the face.")}
        </p>
      )}
    </div>
  );
}

function PrintingFieldEditor({
  printing,
  field,
  onDone,
}: {
  printing: DeskPrintingRow;
  field: PrintingField;
  onDone: () => void;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const update = useUpdateDeskPrinting();
  const { orders, labels } = useEnumOrders();
  const [channels, setChannels] = useState<string[]>([...printing.distributionChannelSlugs]);
  const [size, setSize] = useState(printing.size);
  const [announcedAt, setAnnouncedAt] = useState(printing.announcedAt);
  const [releasedAt, setReleasedAt] = useState(printing.releasedAt);
  const [precision, setPrecision] = useState<DeskReleasePrecision>(
    printing.releasePrecision ?? "day",
  );
  const [comment, setComment] = useState(printing.comment ?? "");

  function patch(): DeskPatch {
    switch (field) {
      case "channel": {
        return { distributionChannelSlugs: channels };
      }
      case "size": {
        return { size };
      }
      case "announced": {
        return { announcedAt };
      }
      case "release": {
        const release =
          releasedAt === null
            ? { releasedAt: null, precision: null }
            : normalizeToPeriodStart({ releasedAt, precision });
        return { releasedAt: release.releasedAt, releasePrecision: release.precision };
      }
      case "comment": {
        const trimmed = comment.trim();
        return { comment: trimmed.length > 0 ? trimmed : null };
      }
    }
  }

  async function save() {
    const input = { printingId: printing.printingId, ...patch() };
    if (await queueWrite((signal) => update.mutateAsync(input, { signal }))) {
      onDone();
    }
  }

  return (
    <div className="space-y-2">
      {field === "channel" && (
        <Suspense fallback={<Skeleton className="h-9 w-full" />}>
          <PrintingDeskChannelPicker value={channels} onChange={setChannels} />
        </Suspense>
      )}
      {field === "size" && (
        <SimpleSelect
          items={orders.cardSizes.map((slug) => ({
            value: slug,
            label: enumLabel(labels.cardSizes, slug),
          }))}
          value={size}
          onChange={setSize}
          label="Size"
          className="w-full sm:w-56"
        />
      )}
      {field === "announced" && (
        <DatePicker
          aria-label="Announced on"
          className="w-44"
          value={announcedAt}
          onValueChange={setAnnouncedAt}
          onClear={() => setAnnouncedAt(null)}
        />
      )}
      {field === "release" && (
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            aria-label="Available from"
            className="w-44"
            value={releasedAt}
            onValueChange={setReleasedAt}
            onClear={() => setReleasedAt(null)}
          />
          <DatePrecisionControl
            includeQuarter={printing.releasePrecision === "quarter"}
            value={precision}
            onChange={setPrecision}
          />
        </div>
      )}
      {field === "comment" && (
        <Textarea
          aria-label="Comment"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" pending={update.isPending} onClick={() => void save()}>
          Save
        </Button>
        <Button variant="ghost" size="sm" disabled={update.isPending} onClick={onDone}>
          Cancel
        </Button>
      </div>
      {update.error !== null && (
        <p className="text-destructive text-sm">
          {errorText(update.error, "Could not save the field.")}
        </p>
      )}
    </div>
  );
}
