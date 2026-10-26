import type { ComparablePrintingField } from "@openrift/shared/catalog-field-compare";
import type {
  DeskImage,
  DeskPrintingRow,
  DeskReleasePrecision,
  DeskUpdateInput,
} from "@openrift/shared/contracts/admin/printing-desk";
import { enumLabel } from "@openrift/shared/enum-label";
import { formatDay } from "@openrift/shared/format-date";
import { marketplaceLabel } from "@openrift/shared/marketplace";
import {
  computeProductSuggestions,
  productSuggestionKey,
} from "@openrift/shared/marketplace-suggestions";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import type { ReleasePrecision } from "@openrift/shared/set-release";
import {
  formatReleasePeriod,
  normalizeToPeriodStart,
  parseReleaseInput,
} from "@openrift/shared/set-release";
import { pluralize } from "@openrift/shared/strings";
import type { AdminCardDetailResponse } from "@openrift/shared/types/api/admin";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ChevronRightIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  Share2Icon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { collectEntries } from "@/features/admin/components/marketplace-product-entries";
import { PrintingCitationsEditor } from "@/features/admin/components/printing-citations-editor";
import { PrintingDeskChannelPicker } from "@/features/admin/components/printing-desk-channel-picker";
import { DeskSegmented, DeskStatusBadge } from "@/features/admin/components/printing-desk-shared";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { SendNoteDialog } from "@/features/admin/components/send-note-dialog";
import { SideSearch } from "@/features/admin/components/side-search";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import {
  useDeletePrinting,
  useUnmapMarketplacePrinting,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import {
  useDeskPrinting,
  useRemoveDeskSecondSide,
  useSetDeskSecondSide,
  useUpdateDeskPrinting,
} from "@/features/admin/hooks/use-printing-desk";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { deskPrintingName } from "@/features/admin/lib/desk-face-options";
import { deskImageBust, deskImageSrc } from "@/features/admin/lib/printing-desk-image";
import { deskPrintingPeriod } from "@/features/admin/lib/printing-desk-status";
import type { PrintingFace } from "@/features/admin/lib/printing-faces";
import { printingFaces } from "@/features/admin/lib/printing-faces";
import { encodePostSlides } from "@/features/admin/lib/printing-post-slides";
import { providerSettingsQueryOptions } from "@/features/admin/lib/provider-settings-queries";
import { unifiedMappingsForCardQueryOptions } from "@/features/admin/lib/unified-mappings-queries";
import { catalogKeys } from "@/features/cards/lib/cards-query-keys";
import { PrintingCompareSourcesDialog } from "@/features/catalog-workspace/components/compare-sources-dialog";
import { WorkspaceHistorySection } from "@/features/catalog-workspace/components/face-record";
import { FieldRow } from "@/features/catalog-workspace/components/record/field-row";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import {
  RecordBanner,
  RecordHeader,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { SourceStrip } from "@/features/catalog-workspace/components/record/source-strip";
import { SuggestionChip } from "@/features/catalog-workspace/components/record/suggestion-chip";
import { useValueLabels } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import type { PrintingChip } from "@/features/catalog-workspace/hooks/use-printing-record-actions";
import { usePrintingRecordActions } from "@/features/catalog-workspace/hooks/use-printing-record-actions";
import { useQueueNavigation } from "@/features/catalog-workspace/hooks/use-queue-navigation";
import {
  ADMIN_ONLY_DISCARD,
  ADMIN_ONLY_REPLY,
  discardLabel,
  formatSuggestionValue,
  primaryLabel,
  submitterNameOf,
} from "@/features/catalog-workspace/lib/face-suggestion-rows";
import {
  buildPrintingSuggestions,
  listingSuggestionsForPrinting,
} from "@/features/catalog-workspace/lib/printing-suggestion-rows";
import { useEnumOrders } from "@/hooks/use-enums";
import { useCostKeywords } from "@/hooks/use-keyword-styles";
import { errorText } from "@/lib/error-text";

type PrintingField = "channel" | "size" | "announced" | "release" | "comment";
type DeskPatch = Omit<DeskUpdateInput, "printingId" | "side">;

const PRECISION_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const satisfies readonly { value: DeskReleasePrecision; label: string }[];

export function PrintingRecord({ printingId }: { printingId: string }) {
  const { data: access, isPending } = useAdminAccess();
  const isAdmin = access?.isAdmin === true;
  const canReview = isAdmin || (access?.sections ?? []).includes("card-review");
  const canDesk = isAdmin || (access?.sections ?? []).includes("printing-desk");

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
  const { data } = useDeskPrinting(printingId, 1);
  const printing = data.printing;
  const faces = printingFaces(printing);
  const slugs = [...new Set(faces.map((face) => face.cardSlug))];
  const first = useAdminCardDetail(canReview ? (slugs[0] ?? "") : "").data as
    | AdminCardDetailResponse
    | undefined;
  const second = useAdminCardDetail(canReview ? (slugs[1] ?? "") : "").data as
    | AdminCardDetailResponse
    | undefined;
  const { data: providerData } = useQuery({ ...providerSettingsQueryOptions, enabled: canReview });
  const { data: mappingData } = useQuery({
    ...unifiedMappingsForCardQueryOptions(printing.cardSlug),
    enabled: isAdmin,
  });
  const costKeywords = useCostKeywords();
  const labels = useValueLabels();
  const navigation = useQueueNavigation("printing");
  const [editing, setEditing] = useState<PrintingField | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const details = [first, second].filter(
    (detail): detail is AdminCardDetailResponse => detail !== undefined,
  );
  const providerSettings = providerData?.providerSettings ?? [];
  const trusted = new Set(
    providerSettings.filter((setting) => setting.isFavorite).map((setting) => setting.provider),
  );
  const hiddenProviders = new Set(
    providerSettings
      .filter((setting) => setting.isHidden || (!isAdmin && !setting.helperReviewable))
      .map((setting) => setting.provider),
  );
  const model = buildPrintingSuggestions(details, printingId, {
    costKeywords,
    setTotals: Object.assign({}, ...details.map((detail) => detail.setTotals)) as Record<
      string,
      number
    >,
    hiddenProviders,
  });
  const group = mappingData?.group ?? null;
  const listings =
    group === null
      ? []
      : listingSuggestionsForPrinting(
          collectEntries(group),
          computeProductSuggestions(group),
          (entry) =>
            productSuggestionKey(
              entry.marketplace,
              entry.product.externalId,
              entry.product.finish,
              entry.product.language,
            ),
          printingId,
        );
  const actions = usePrintingRecordActions({
    printingId,
    model,
    listings,
    canCheck: isAdmin,
    canMap: isAdmin,
  });

  const chipIndex = new Map(actions.chips.map((chip, index) => [chip.key, index + 1]));
  const hotkeyOf = (key: string) => {
    const index = chipIndex.get(key);
    return index !== undefined && index <= 9 ? index : undefined;
  };
  const sourceById = new Map(model.sources.map((source) => [source.candidatePrintingId, source]));
  const enterProviders = [
    ...new Set(
      model.sources
        .filter((source) => model.enterCandidateIds.includes(source.candidatePrintingId))
        .map((source) => source.provider),
    ),
  ];
  const fieldChips = actions.chips.filter(
    (chip): chip is Extract<PrintingChip, { kind: "field" }> => chip.kind === "field",
  );
  const listingChips = actions.chips.filter(
    (chip): chip is Extract<PrintingChip, { kind: "listing" }> => chip.kind === "listing",
  );
  const activeFront = data.images.find((image) => image.face === "front" && image.isActive);
  const postImage = activeFront ?? data.images.at(0) ?? null;
  const postSlides =
    postImage === null
      ? null
      : encodePostSlides([{ printingId, imageFileId: postImage.imageFileId }]);
  const mapped = details
    .flatMap((detail) => detail.marketplaceMappings)
    .filter((mapping) => mapping.targetPrintingId === printingId);

  const primaryAndNext = async () => {
    await actions.runPrimary();
    navigation.goNext();
  };

  function chipValue(
    field: ComparablePrintingField,
    suggestion: Extract<PrintingChip, { kind: "field" }>["suggestion"],
  ): string {
    if (field === "announcedAt" && typeof suggestion.proposed === "string") {
      return formatDay(suggestion.proposed);
    }
    if (field === "releasedAt" && typeof suggestion.proposed === "string") {
      const release = parseReleaseInput(suggestion.proposed, suggestion.candidate.releasePrecision);
      return release === null ? suggestion.proposed : formatReleasePeriod(release);
    }
    if (field === "releasePrecision" && printing.releasedAt !== null) {
      return formatReleasePeriod({
        releasedAt: printing.releasedAt,
        precision: suggestion.proposed as ReleasePrecision,
      });
    }
    return formatSuggestionValue(field, suggestion.proposed, labels);
  }

  function chipsFor(field: ComparablePrintingField): ReactNode {
    const own = fieldChips.filter((chip) => chip.suggestion.field === field);
    if (own.length === 0) {
      return undefined;
    }
    return own.map((chip) => {
      const { suggestion } = chip;
      return (
        <SuggestionChip
          key={chip.key}
          tone={suggestion.isContributor ? "contributor" : "source"}
          sourceLabel={suggestion.isContributor ? "Contributor" : suggestion.provider}
          value={chipValue(field, suggestion)}
          hotkey={hotkeyOf(chip.key)}
          pending={actions.pending}
          onUse={() => actions.applyChip(chip)}
          onDiscard={
            suggestion.isContributor || !isAdmin
              ? undefined
              : () => actions.discard(suggestion.candidate.id)
          }
          discardDisabledReason={suggestion.isContributor ? undefined : ADMIN_ONLY_DISCARD}
          discardLabel={discardLabel(
            sourceById.get(suggestion.candidate.id)?.differences ?? 0,
            suggestion.provider,
            sourceById.get(suggestion.candidate.id)?.elsewhere,
          )}
          onReject={
            suggestion.isContributor
              ? () => actions.reject(suggestion.candidate.candidateCardId)
              : undefined
          }
          onReply={
            suggestion.isContributor && isAdmin
              ? () => setReplyTo(suggestion.candidate.candidateCardId)
              : undefined
          }
          replyDisabledReason={suggestion.isContributor ? ADMIN_ONLY_REPLY : undefined}
        />
      );
    });
  }

  const releaseChips = [chipsFor("releasedAt"), chipsFor("releasePrecision")].filter(
    (chips) => chips !== undefined,
  );
  const availableFromChips = releaseChips.length === 0 ? undefined : releaseChips;
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
              <Button variant="ghost" size="sm" onClick={() => navigation.skipToEnd()}>
                Skip to end <Kbd>S</Kbd>
              </Button>
              {isAdmin && (
                <Button size="sm" disabled={actions.pending} onClick={() => void primaryAndNext()}>
                  {primaryLabel(actions.enterCount)}
                  <Kbd>↵</Kbd>
                </Button>
              )}
              {isAdmin && <PrintingActionsMenu printing={printing} />}
            </>
          }
        />
      }
      banner={
        isAdmin && actions.enterCount > 0 ? (
          <RecordBanner>
            {`Enter discards ${actions.enterCount} ${pluralize(actions.enterCount, "source")} (${enterProviders.join(", ")}) and opens the next printing.`}
          </RecordBanner>
        ) : undefined
      }
    >
      <RecordSection title="Faces">
        <p className="text-muted-foreground text-sm">
          Images and face fields are edited on each face.
        </p>
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
        {canReview && (
          <SourceStrip
            sources={model.sources.map((source) => ({
              key: source.candidatePrintingId,
              label: source.provider,
              differences: source.differences,
              trusted: trusted.has(source.provider),
            }))}
            onCompare={() => setCompareOpen(true)}
          />
        )}
        <div>
          <FieldRow
            label="Channel"
            value={formatSuggestionValue(
              "distributionChannelSlugs",
              printing.distributionChannelSlugs,
              labels,
            )}
            onEdit={editOf("channel")}
            editing={editorOf("channel")}
            suggestions={chipsFor("distributionChannelSlugs")}
          />
          <FieldRow
            label="Size"
            value={formatSuggestionValue("size", printing.size, labels)}
            onEdit={editOf("size")}
            editing={editorOf("size")}
            suggestions={chipsFor("size")}
          />
          <FieldRow
            label="Announced on"
            value={printing.announcedAt === null ? "Not set" : formatDay(printing.announcedAt)}
            onEdit={editOf("announced")}
            editing={editorOf("announced")}
            suggestions={chipsFor("announcedAt")}
          />
          <FieldRow
            label="Available from"
            value={deskPrintingPeriod(printing)}
            onEdit={editOf("release")}
            editing={editorOf("release")}
            suggestions={availableFromChips}
          />
          <FieldRow
            label="Comment"
            value={
              printing.comment === null || printing.comment.length === 0 ? "None" : printing.comment
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
          title={
            <span className="inline-flex flex-wrap items-center gap-2">
              Marketplace
              {listingChips.length > 0 && (
                <Badge variant="warning">{listingChips.length} to map</Badge>
              )}
            </span>
          }
        >
          {listingChips.map((chip) => (
            <div
              key={chip.key}
              className="bg-warning-soft flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <span className="min-w-0 flex-1 break-words">
                &ldquo;{chip.listing.product.productName}&rdquo;{" "}
                <span className="text-muted-foreground">
                  · {marketplaceLabel(chip.listing.marketplace)} #{chip.listing.product.externalId}
                </span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => actions.ignoreListing(chip.listing)}
              >
                Ignore
              </Button>
              <Button variant="outline" size="sm" onClick={() => actions.mapListing(chip.listing)}>
                Map here
                {hotkeyOf(chip.key) !== undefined && <Kbd>{hotkeyOf(chip.key)}</Kbd>}
              </Button>
            </div>
          ))}
          <MappedListings printingId={printingId} mapped={mapped} />
        </RecordSection>
      )}

      {canDesk && (
        <RecordSection title="Links">
          <PrintingCitationsEditor printingId={printingId} />
        </RecordSection>
      )}

      {(canReview || printing.canEdit) && <WorkspaceHistorySection target={{ printingId }} />}
      {compareOpen && (
        <PrintingCompareSourcesDialog
          open
          onOpenChange={setCompareOpen}
          printingId={printingId}
          cardSlugs={slugs}
          details={details}
          providerSettings={providerSettings}
          hiddenProviders={hiddenProviders}
          costKeywords={costKeywords}
          isAdmin={isAdmin}
        />
      )}
      <SendNoteDialog
        candidateCardId={replyTo}
        submitterName={replyTo === null ? null : submitterNameOf(details, replyTo)}
        onOpenChange={(open) => {
          if (!open) {
            setReplyTo(null);
          }
        }}
      />
    </RecordPane>
  );
}

function MappedListings({
  printingId,
  mapped,
}: {
  printingId: string;
  mapped: AdminCardDetailResponse["marketplaceMappings"];
}) {
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
          key={`${mapping.marketplace}:${mapping.externalId}:${mapping.finish}:${mapping.variantLanguage ?? ""}`}
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
              unmap.mutate({
                marketplace: mapping.marketplace,
                printingId,
                externalId: mapping.externalId,
                finish: mapping.finish,
                language: mapping.variantLanguage,
              })
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
  const queryClient = useQueryClient();
  const removeFace = useRemoveDeskSecondSide();
  const setFace = useSetDeskSecondSide();
  const [replacing, setReplacing] = useState(false);

  const sideImages = images.filter((image) => image.face === face.imageFace);
  const active = sideImages.find((image) => image.isActive) ?? null;
  const waiting = sideImages.filter((image) => !image.isActive).length;
  const settle = {
    onSettled: () => void queryClient.invalidateQueries({ queryKey: adminKeys.workspace }),
  };
  const canChange = printing.canEdit && faceCount > 1;
  const error = removeFace.error ?? setFace.error;

  const replace = (faceId: string) =>
    removeFace.mutate(
      { printingId: printing.printingId, faceId: face.faceId },
      {
        ...settle,
        onSuccess: () =>
          setFace.mutate(
            { printingId: printing.printingId, faceId },
            { ...settle, onSuccess: () => setReplacing(false) },
          ),
      },
    );

  return (
    <div className="flex gap-3 rounded-lg border p-3" data-face-id={face.faceId}>
      <PrintingImageBox
        url={active === null ? null : deskImageSrc(active.url, "240w", deskImageBust(active))}
        alt={face.cardName}
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
              to="/admin/cards/$cardSlug/printings/create"
              params={{ cardSlug: printing.cardSlug }}
              search={{ duplicateFrom: printing.printingId }}
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
              disabled={removeFace.isPending}
              onClick={() =>
                removeFace.mutate({ printingId: printing.printingId, faceId: face.faceId }, settle)
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
            onPick={(side) => replace(side.faceId)}
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
  const queryClient = useQueryClient();
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
          setFace.mutate(
            { printingId: printing.printingId, faceId: side.faceId },
            {
              onSettled: () =>
                void queryClient.invalidateQueries({ queryKey: adminKeys.workspace }),
            },
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

function PrintingActionsMenu({ printing }: { printing: DeskPrintingRow }) {
  const navigation = useQueueNavigation("printing");
  const deletePrinting = useDeletePrinting([
    adminKeys.cards.all,
    adminKeys.printingDesk.all,
    adminKeys.workspace,
    catalogKeys.all,
  ]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <EllipsisVerticalIcon />
          <span className="sr-only">Printing actions</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={
              <Link
                to="/admin/cards/$cardSlug/printings/create"
                params={{ cardSlug: printing.cardSlug }}
                search={{ duplicateFrom: printing.printingId }}
              />
            }
          >
            <CopyIcon />
            Duplicate printing
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={deletePrinting.isPending}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete printing "${deskPrintingName(printing)}"?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        isPending={deletePrinting.isPending}
        onConfirm={() =>
          deletePrinting.mutate(printing.printingId, {
            onSuccess: () => {
              setDeleteOpen(false);
              navigation.goNext();
            },
          })
        }
      />
    </>
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
  const update = useUpdateDeskPrinting();
  const { orders, labels } = useEnumOrders();
  const [channels, setChannels] = useState<string[]>([...printing.distributionChannelSlugs]);
  const [size, setSize] = useState(printing.size);
  const [announcedAt, setAnnouncedAt] = useState(printing.announcedAt);
  const [releasedAt, setReleasedAt] = useState(printing.releasedAt);
  const [precision, setPrecision] = useState<DeskReleasePrecision>(
    printing.releasePrecision === "quarter" ? "month" : (printing.releasePrecision ?? "day"),
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

  return (
    <div className="space-y-2">
      {field === "channel" && (
        <Suspense fallback={<Skeleton className="h-9 w-full" />}>
          <PrintingDeskChannelPicker value={channels} onChange={setChannels} />
        </Suspense>
      )}
      {field === "size" && (
        <Select
          items={orders.cardSizes.map((slug) => ({
            value: slug,
            label: enumLabel(labels.cardSizes, slug),
          }))}
          value={size}
          onValueChange={(value) => {
            if (value !== null) {
              setSize(value);
            }
          }}
        >
          <SelectTrigger aria-label="Size" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {orders.cardSizes.map((slug) => (
              <SelectItem key={slug} value={slug}>
                {enumLabel(labels.cardSizes, slug)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {field === "announced" && (
        <DatePicker
          className="w-44"
          value={announcedAt}
          onValueChange={setAnnouncedAt}
          onClear={() => setAnnouncedAt(null)}
        />
      )}
      {field === "release" && (
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker
            className="w-44"
            value={releasedAt}
            onValueChange={setReleasedAt}
            onClear={() => setReleasedAt(null)}
          />
          <DeskSegmented
            ariaLabel="How exact the date is"
            value={precision}
            onChange={setPrecision}
            options={PRECISION_OPTIONS}
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
        <Button
          size="sm"
          disabled={update.isPending}
          onClick={() =>
            update.mutate({ printingId: printing.printingId, ...patch() }, { onSuccess: onDone })
          }
        >
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
