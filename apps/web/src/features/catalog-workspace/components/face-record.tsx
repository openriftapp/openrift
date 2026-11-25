import { getOrientation } from "@openrift/shared/card-orientation";
import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import { pluralize } from "@openrift/shared/strings";
import type { AdminPrintingResponse } from "@openrift/shared/types/api/admin";
import { Link, useLocation } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  SquareArrowOutUpRightIcon,
} from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { PrintingDeskEditFields } from "@/features/admin/components/printing-desk-form-page";
import { DeskStatusBadge } from "@/features/admin/components/printing-desk-shared";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { useDeskCardPrintings, useDeskPrinting } from "@/features/admin/hooks/use-printing-desk";
import { useProviderSettings } from "@/features/admin/hooks/use-provider-settings";
import { hasAdminSection } from "@/features/admin/lib/admin-sections";
import { printingPairName } from "@/features/admin/lib/face-rows";
import { formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { deskRowForFace, printingFaces } from "@/features/admin/lib/printing-faces";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { FaceCompareGrid } from "@/features/catalog-workspace/components/compare-sources-dialog";
import {
  DeskFaceImagesSection,
  FaceImagesSection,
} from "@/features/catalog-workspace/components/face-images-section";
import { FaceFieldsSection } from "@/features/catalog-workspace/components/record/face-fields-section";
import { RecordFieldRow } from "@/features/catalog-workspace/components/record/field-row";
import {
  RecordBanner,
  PublicPageLink,
  RecordHeader,
  RecordPane,
  RecordSection,
  VariantFacts,
} from "@/features/catalog-workspace/components/record/record-pane";
import { ReviewStopBar } from "@/features/catalog-workspace/components/record/review-stop-bar";
import { WorkspaceHistorySection } from "@/features/catalog-workspace/components/record/workspace-history-section";
import { useValueLabels } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import {
  buildFaceSuggestions,
  faceCompareCandidates,
} from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { variantExtras } from "@/features/catalog-workspace/lib/variant-facts";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useCostKeywords } from "@/hooks/use-keyword-styles";

declare module "@tanstack/react-router" {
  interface HistoryState {
    workspaceFromPrintingId?: string;
  }
}

export function FaceRecord({ cardSlug, faceId }: { cardSlug: string; faceId: string }) {
  const { data: access, isPending } = useAdminAccess();
  const isAdmin = access?.isAdmin === true;
  const canReview = hasAdminSection(access, "card-review");

  if (isPending) {
    return <Skeleton className="m-4 h-96" />;
  }

  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      {canReview ? (
        <ReviewFaceRecord key={faceId} cardSlug={cardSlug} faceId={faceId} isAdmin={isAdmin} />
      ) : (
        <DeskFaceRecord key={faceId} cardSlug={cardSlug} faceId={faceId} />
      )}
    </Suspense>
  );
}

function ReviewFaceRecord({
  cardSlug,
  faceId,
  isAdmin,
}: {
  cardSlug: string;
  faceId: string;
  isAdmin: boolean;
}) {
  const detailQuery = useAdminCardDetail(cardSlug);
  const detail = detailQuery.data;
  const { data: providerData } = useProviderSettings();
  const costKeywords = useCostKeywords();
  const labels = useValueLabels();

  if (detail === undefined) {
    return detailQuery.isError ? (
      <p className="text-muted-foreground p-4">The card could not be loaded.</p>
    ) : (
      <Skeleton className="m-4 h-96" />
    );
  }
  const providerSettings = providerData.providerSettings;
  const hiddenProviders = new Set(
    providerSettings
      .filter((setting) => setting.isHidden || (!isAdmin && !setting.helperReviewable))
      .map((setting) => setting.provider),
  );
  const model = buildFaceSuggestions(detail, faceId, {
    costKeywords,
    setTotals: detail.setTotals,
    hiddenProviders,
  });
  const face = model.face;
  if (face === null) {
    return <p className="text-muted-foreground p-4">This face is no longer on the card.</p>;
  }

  const landscape = getOrientation(detail.card?.types ?? []) === "landscape";
  const activeImage = model.images.find((image) => image.isActive);
  const faceCount = new Set(detail.printings.map((printing) => printing.faceId)).size;
  const printingCount = new Set(detail.printings.map((printing) => printing.id)).size;

  return (
    <RecordPane
      banner={<ReviewStopBar current={{ kind: "face", faceId }} />}
      header={
        <RecordHeader
          thumb={
            <PrintingImageBox
              url={activeImage === undefined ? null : printingImageDisplayUrl(activeImage)}
              alt={detail.displayName}
              className="w-12 shrink-0"
              landscape={landscape}
            />
          }
          title={detail.displayName}
          subtitle={
            <VariantFacts
              rarity={face.rarity}
              code={formatPrintingCode(face.publicCode)}
              language={face.language}
              finish={formatCatalogFieldValue("finish", face.finish, labels)}
              extras={variantExtras(face, labels)}
            />
          }
          actions={
            <>
              <PublicPageLink cardSlug={cardSlug} />
              <FaceActionsMenu cardSlug={cardSlug} faceId={faceId} />
            </>
          }
        />
      }
    >
      <FaceImagesSection
        cardSlug={cardSlug}
        face={face}
        detail={detail}
        images={model.images}
        printings={model.printings}
        sourceImages={model.sourceImages}
        providerSettings={providerSettings}
        isAdmin={isAdmin}
        landscape={landscape}
      />

      <FaceFieldsSection
        cardSlug={cardSlug}
        face={face}
        canEdit={isAdmin}
        isAdmin={isAdmin}
        detail={detail}
        suggestions={model.suggestions}
        compareDisabledReason={
          faceCompareCandidates(detail, faceId, hiddenProviders).length === 0
            ? "No source lists this face"
            : undefined
        }
        compare={
          <FaceCompareGrid
            cardSlug={cardSlug}
            faceId={faceId}
            detail={detail}
            providerSettings={providerSettings}
            hiddenProviders={hiddenProviders}
            costKeywords={costKeywords}
            isAdmin={isAdmin}
          />
        }
      />

      <RecordSection title="Card">
        <Link
          to="/admin/workspace/cards/$cardSlug"
          params={{ cardSlug }}
          className="inline-flex items-center gap-1 underline"
        >
          {detail.displayName}
          <ChevronRightIcon className="size-4" />
        </Link>
        <p className="text-muted-foreground text-sm">
          {faceCount} {pluralize(faceCount, "face")} · {printingCount}{" "}
          {pluralize(printingCount, "printing")}
        </p>
      </RecordSection>

      <FacePrintingsSection printings={model.printings} cardName={detail.displayName} />

      <WorkspaceHistorySection target={{ faceId }} />
    </RecordPane>
  );
}

function FacePrintingsSection({
  printings,
  cardName,
}: {
  printings: readonly AdminPrintingResponse[];
  cardName: string;
}) {
  return (
    <RecordSection title="On printings">
      <ul className="space-y-1">
        {printings.map((printing) => (
          <li key={printing.id} className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/workspace/printings/$printingId"
              params={{ printingId: printing.id }}
              className="inline-flex items-center gap-1.5 underline"
            >
              {printingPairName(printing, cardName)}
              <span className="text-muted-foreground font-mono">
                {formatPrintingCode(printing.publicCode)}
              </span>
            </Link>
            <DeskStatusBadge row={printing} />
          </li>
        ))}
      </ul>
      {printings.length > 1 && (
        <p className="text-muted-foreground text-sm">Edits here show on every printing listed.</p>
      )}
    </RecordSection>
  );
}

function FaceActionsMenu({ cardSlug, faceId }: { cardSlug: string; faceId: string }) {
  const { copy } = useCopyToClipboard();

  const copyId = async () => {
    if (await copy(faceId)) {
      toast.success("Copied the face ID");
    } else {
      toast.error("Could not copy the face ID");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <EllipsisVerticalIcon />
        <span className="sr-only">Face actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          render={<Link to="/admin/workspace/cards/$cardSlug" params={{ cardSlug }} />}
        >
          <SquareArrowOutUpRightIcon />
          Open card
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void copyId()}>
          <CopyIcon />
          Copy face ID
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DeskFaceRecord({ cardSlug, faceId }: { cardSlug: string; faceId: string }) {
  const { data } = useDeskCardPrintings(cardSlug);
  const fromPrintingId = useLocation({
    select: (location) => location.state.workspaceFromPrintingId,
  });
  const row = deskRowForFace(data.printings, faceId, fromPrintingId);

  if (row === null) {
    return (
      <p className="text-muted-foreground p-4">This face is not on a printing you can open.</p>
    );
  }
  return <DeskFaceBody printingId={row.printingId} faceId={faceId} cardRows={data.printings} />;
}

function DeskFaceBody({
  printingId,
  faceId,
  cardRows,
}: {
  printingId: string;
  faceId: string;
  cardRows: readonly DeskPrintingRow[];
}) {
  const { data } = useDeskPrinting(printingId, 1);
  const labels = useValueLabels();
  const [editing, setEditing] = useState(false);

  const printing = data.printing;
  const faces = printingFaces(printing);
  const face = faces.find((entry) => entry.faceId === faceId);
  if (face === undefined) {
    return <p className="text-muted-foreground p-4">This printing does not carry this face.</p>;
  }
  const canEdit = printing.canEdit;
  const landscape = getOrientation([printing.cardType]) === "landscape";
  const pairName = faces.map((entry) => entry.cardName).join(" // ");
  const editableIds = new Set(cardRows.filter((row) => row.canEdit).map((row) => row.printingId));
  const onPrintings = [
    {
      printingId,
      code: faces.map((entry) => formatPrintingCode(entry.publicCode)).join(" // "),
      canEdit,
    },
    ...face.sharedWith.map((shared) => ({
      printingId: shared.printingId,
      code: formatPrintingCode(shared.publicCode),
      canEdit: editableIds.has(shared.printingId),
    })),
  ];
  const fieldRows = [
    { label: "Code", value: formatPrintingCode(face.publicCode) },
    { label: "Set", value: face.setName },
    {
      label: "Finish · Language",
      value: `${formatCatalogFieldValue("finish", face.finish, labels)} · ${face.language}`,
    },
    { label: "Rarity", value: formatCatalogFieldValue("rarity", face.rarity, labels) },
    { label: "Markers", value: formatCatalogFieldValue("markerSlugs", face.markerSlugs, labels) },
    { label: "Artist", value: formatCatalogFieldValue("artist", face.artist, labels) },
    ...(face.faceId === printing.faceId
      ? [
          {
            label: "Flavor text",
            value: formatCatalogFieldValue("flavorText", printing.flavorText),
          },
        ]
      : []),
  ];

  return (
    <RecordPane
      header={
        <RecordHeader
          thumb={
            <Link
              to="/admin/workspace/printings/$printingId"
              params={{ printingId }}
              aria-label={`Back to ${pairName}`}
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <ArrowLeftIcon />
            </Link>
          }
          title={face.cardName}
          subtitle={
            <>
              {formatPrintingCode(face.publicCode)} · {face.language} · from{" "}
              <Link
                to="/admin/workspace/printings/$printingId"
                params={{ printingId }}
                className="underline"
              >
                {pairName}
              </Link>
            </>
          }
        />
      }
      banner={
        <RecordBanner>
          {canEdit
            ? "You can edit this face because it is on a promo printing. Edits show on every printing listed below."
            : "Only an admin changes this face."}
        </RecordBanner>
      }
    >
      <DeskFaceImagesSection
        printing={printing}
        imageFace={face.imageFace}
        images={data.images}
        canEdit={canEdit}
        landscape={landscape}
      />

      <RecordSection title="Face fields">
        {editing ? (
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <PrintingDeskEditFields
              printingId={printingId}
              side={face.position}
              scope="face"
              onSaved={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
          </Suspense>
        ) : (
          <div>
            {fieldRows.map((entry) => (
              <RecordFieldRow
                key={entry.label}
                label={entry.label}
                value={entry.value}
                onEdit={canEdit ? () => setEditing(true) : undefined}
              />
            ))}
          </div>
        )}
      </RecordSection>

      <RecordSection title="On printings">
        <ul className="space-y-1">
          {onPrintings.map((entry) => (
            <li key={entry.printingId} className="flex flex-wrap items-center gap-2">
              <Link
                to="/admin/workspace/printings/$printingId"
                params={{ printingId: entry.printingId }}
                className="underline"
              >
                {entry.code}
              </Link>
              <Badge variant="neutral">
                {entry.canEdit ? "yours to edit" : "added by an admin"}
              </Badge>
            </li>
          ))}
        </ul>
      </RecordSection>

      {onPrintings.some((entry) => entry.canEdit) && (
        <WorkspaceHistorySection target={{ faceId }} summary="Your edits only" />
      )}
    </RecordPane>
  );
}
