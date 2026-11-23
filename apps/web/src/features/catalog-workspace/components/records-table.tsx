import type { WorkspaceRecordRow } from "@openrift/shared/contracts/admin/catalog-workspace";
import type { LabelMap } from "@openrift/shared/enum-label";
import { enumLabel, labelMap } from "@openrift/shared/enum-label";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { WellKnown } from "@openrift/shared/well-known";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { InstantCell } from "@/features/admin/components/admin-crud-shared";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import { DeskStatusBadge } from "@/features/admin/components/printing-desk-shared";
import { useDistributionChannels } from "@/features/admin/hooks/use-distribution-channels";
import { useMarkers } from "@/features/admin/hooks/use-markers";
import type { ServerSort } from "@/features/admin/lib/admin-table-types";
import { EMPTY_VALUE_TEXT } from "@/features/admin/lib/field-value-text";
import { imageCountText } from "@/features/admin/lib/printing-desk-filter";
import { useSets } from "@/features/cards/hooks/use-sets";
import { buildChannelBreadcrumbsBySlug } from "@/features/cards/lib/channel-breadcrumbs";
import {
  CardThumb,
  RecordThumb,
} from "@/features/catalog-workspace/components/record/record-thumb";
import type { WorkspaceRecordsResult } from "@/features/catalog-workspace/hooks/use-workspace-queue";
import type { DeskRow, WorkspaceTarget } from "@/features/catalog-workspace/lib/owner-items";
import {
  cardPendingBadges,
  cardSummaryKey,
  cardSummaryTarget,
  deskEntry,
  recordEntry,
} from "@/features/catalog-workspace/lib/owner-items";
import { useEnumOrders } from "@/hooks/use-enums";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { formatCount } from "@/lib/format";

const ROW_HEIGHT = 57;

function TargetLink({
  target,
  className,
  children,
}: {
  target: WorkspaceTarget;
  className: string;
  children: ReactNode;
}) {
  switch (target.kind) {
    case "card": {
      return (
        <Link
          to="/admin/workspace/cards/$cardSlug"
          params={{ cardSlug: target.cardSlug }}
          className={className}
          search
        >
          {children}
        </Link>
      );
    }
    case "card-new": {
      return (
        <Link
          to="/admin/workspace/cards/new/$name"
          params={{ name: target.name }}
          className={className}
          search
        >
          {children}
        </Link>
      );
    }
    case "face": {
      return (
        <Link
          to="/admin/workspace/faces/$cardSlug/$faceId"
          params={{ cardSlug: target.cardSlug, faceId: target.faceId }}
          className={className}
          search
        >
          {children}
        </Link>
      );
    }
    case "printing": {
      return (
        <Link
          to="/admin/workspace/printings/$printingId"
          params={{ printingId: target.printingId }}
          className={className}
          search
        >
          {children}
        </Link>
      );
    }
  }
}

function NameLink({ target, children }: { target: WorkspaceTarget | null; children: string }) {
  if (target === null) {
    return <span className="font-medium">{children}</span>;
  }
  return (
    <TargetLink target={target} className="font-medium hover:underline">
      {children}
    </TargetLink>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground text-sm">{children}</span>;
}

function MarkerBadges({ markers, labels }: { markers: readonly string[]; labels?: LabelMap }) {
  if (markers.length === 0) {
    return null;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {markers.map((marker) => (
        <Badge key={marker} variant="neutral">
          {labels ? enumLabel(labels, marker) : marker}
        </Badge>
      ))}
    </span>
  );
}

function CardNameCell({ row }: AdminCellSlotProps<CandidateCardSummaryResponse>) {
  if (!row) {
    return null;
  }
  return (
    <span className="flex items-center gap-2">
      <CardThumb cardSlug={row.cardSlug} />
      <NameLink target={cardSummaryTarget(row)}>{row.name}</NameLink>
    </span>
  );
}

function firstSetOf(
  row: CandidateCardSummaryResponse,
  sets: readonly { slug: string; name: string }[],
): { index: number; slug: string; name: string } | null {
  const slugs = new Set(row.setSlugs.map((slug) => slug.toLowerCase()));
  const index = sets.findIndex((set) => slugs.has(set.slug.toLowerCase()));
  const set = sets[index];
  return set === undefined ? null : { index, slug: set.slug, name: set.name };
}

function CardSetCell({ row }: AdminCellSlotProps<CandidateCardSummaryResponse>) {
  const { data } = useSets();
  if (!row || row.setSlugs.length === 0) {
    return null;
  }
  const first = firstSetOf(row, data.sets);
  return <Muted>{first === null ? row.setSlugs.at(0) : `${first.slug} · ${first.name}`}</Muted>;
}

function CardPrintingsCell({ row }: AdminCellSlotProps<CandidateCardSummaryResponse>) {
  if (!row) {
    return null;
  }
  const count = row.cardSlug === null ? row.stagingShortCodes.length : row.shortCodes.length;
  return <Muted>{row.cardSlug === null ? `+${count}` : count}</Muted>;
}

function CardPendingCell({ row }: AdminCellSlotProps<CandidateCardSummaryResponse>) {
  if (!row) {
    return null;
  }
  const badges = cardPendingBadges(row);
  if (badges.length === 0) {
    return <Muted>{EMPTY_VALUE_TEXT}</Muted>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <Badge key={badge.label} variant={badge.variant}>
          {badge.label}
        </Badge>
      ))}
    </span>
  );
}

function PrintingNameCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  if (!row) {
    return null;
  }
  return (
    <span className="flex items-center gap-2">
      <RecordThumb url={row.imageUrl} />
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <NameLink target={recordEntry("printing", row).target}>{row.cardName}</NameLink>
        <MarkerBadges markers={row.markers ?? []} />
      </span>
    </span>
  );
}

function PrintingCodesCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  if (!row) {
    return null;
  }
  return (
    <span className="font-mono text-sm">
      {row.publicCode === undefined ? row.shortCode : formatPrintingCode(row.publicCode)}
    </span>
  );
}

function LanguageCell({ row }: AdminCellSlotProps<{ language: string }>) {
  return row ? <Badge variant="neutral">{row.language.toUpperCase()}</Badge> : null;
}

function FinishCell({
  row,
  finishLabels,
}: AdminCellSlotProps<{ finish: string }> & { finishLabels?: LabelMap }) {
  if (!row) {
    return null;
  }
  return <span>{finishLabels ? enumLabel(finishLabels, row.finish) : row.finish}</span>;
}

function PrintingChannelCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  return <Muted>{row?.channelLabel ?? ""}</Muted>;
}

function PrintingStatusCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  if (!row?.status) {
    return null;
  }
  return row.status === "released" ? (
    <Badge variant="success">Released</Badge>
  ) : (
    <Badge variant="warning">Announced</Badge>
  );
}

function FaceNameCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  if (!row) {
    return null;
  }
  return (
    <span className="flex items-center gap-2">
      <RecordThumb url={row.imageUrl} />
      <NameLink target={recordEntry("face", row).target}>{row.cardName}</NameLink>
    </span>
  );
}

function FaceSetCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  return <Muted>{row?.setName ?? ""}</Muted>;
}

function FaceRarityCell({
  row,
  rarityLabels,
  artVariantLabels,
}: AdminCellSlotProps<WorkspaceRecordRow> & {
  rarityLabels?: LabelMap;
  artVariantLabels?: LabelMap;
}) {
  if (!row) {
    return null;
  }
  const parts = [
    row.rarity && rarityLabels ? enumLabel(rarityLabels, row.rarity) : null,
    row.artVariant && row.artVariant !== WellKnown.artVariant.NORMAL && artVariantLabels
      ? enumLabel(artVariantLabels, row.artVariant)
      : null,
  ].filter(Boolean);
  return <Muted>{parts.join(" · ")}</Muted>;
}

function FaceCodeCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  return <span className="font-mono text-sm">{row?.shortCode ?? ""}</span>;
}

function FaceStatusCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  if (!row) {
    return null;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {row.imageState === "substitute" && <Badge variant="destructive">Substitute image</Badge>}
      {(row.imageState === "none" || (row.imageState === undefined && row.imageUrl === null)) && (
        <Badge variant="warning">No image</Badge>
      )}
      {row.artist === null && <Badge variant="neutral">No artist</Badge>}
      {row.printingCount !== undefined && row.printingCount > 1 && (
        <Badge variant="neutral">On {row.printingCount} printings</Badge>
      )}
    </span>
  );
}

function DeskNameCell({
  row,
  markerLabels,
}: AdminCellSlotProps<DeskRow> & { markerLabels?: LabelMap }) {
  if (!row) {
    return null;
  }
  const entry = deskEntry(row);
  return (
    <span className="flex items-center gap-2">
      <RecordThumb url={row.activeImageUrl} />
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        <NameLink target={entry.target}>{entry.title}</NameLink>
        <MarkerBadges markers={row.markerSlugs} labels={markerLabels} />
      </span>
    </span>
  );
}

function DeskCodesCell({ row }: AdminCellSlotProps<DeskRow>) {
  return <span className="font-mono text-sm">{row ? deskEntry(row).code : ""}</span>;
}

function DeskChannelCell({
  row,
  channelPaths,
}: AdminCellSlotProps<DeskRow> & { channelPaths?: ReadonlyMap<string, string> }) {
  if (!row) {
    return null;
  }
  return (
    <Muted>
      {row.distributionChannelSlugs.map((slug) => channelPaths?.get(slug) ?? slug).join(", ")}
    </Muted>
  );
}

function DeskStatusCell({ row }: AdminCellSlotProps<DeskRow>) {
  return row ? <DeskStatusBadge row={row} /> : null;
}

function DeskImagesCell({ row }: AdminCellSlotProps<DeskRow>) {
  return row ? <Muted>{imageCountText(row.imageCount)}</Muted> : null;
}

export function summaryText(
  shown: number,
  total: number | null,
  noun: string,
  hasMore: boolean,
): string {
  return hasMore && total !== null
    ? `${formatCount(shown)} of ${formatCount(total)} ${noun} loaded`
    : `${formatCount(shown)} ${noun}`;
}

const LOAD_MORE_MARGIN = "800px";

function LoadMoreFooter({
  hasMore,
  isLoadingMore,
  loadMore,
}: {
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  useScopeEffect(hasMore && !isLoadingMore, (armed) => {
    const sentinel = sentinelRef.current;
    if (!armed || sentinel === null || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: LOAD_MORE_MARGIN },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  if (!hasMore) {
    return null;
  }
  return (
    <div ref={sentinelRef} className="flex justify-center py-4">
      {isLoadingMore ? (
        <Spinner className="text-muted-foreground size-5" />
      ) : (
        <Button variant="outline" size="sm" onClick={loadMore}>
          Load more
        </Button>
      )}
    </div>
  );
}

type CardRecords = Extract<WorkspaceRecordsResult, { kind: "card" }>;
type DeskRecords = Extract<WorkspaceRecordsResult, { kind: "desk" }>;
type RowRecords = Extract<WorkspaceRecordsResult, { kind: "face" | "printing" }>;

function CardsTable({ records }: { records: CardRecords }) {
  const { data: setsData } = useSets();
  const { sets } = setsData;
  const columns: AdminColumnDef<CandidateCardSummaryResponse>[] = [
    {
      header: "Card",
      id: "name",
      wrap: true,
      sortValue: (row) => row.name,
      cell: <CardNameCell />,
    },
    {
      header: "First set",
      id: "set",
      width: "w-[22%]",
      sortValue: (row) => firstSetOf(row, sets)?.index ?? null,
      cell: <CardSetCell />,
    },
    {
      header: "Printings",
      id: "printings",
      width: "w-24",
      align: "right",
      sortValue: (row) => row.shortCodes.length,
      sortFirst: "desc",
      cell: <CardPrintingsCell />,
    },
    {
      header: "Pending",
      id: "pending",
      wrap: true,
      sortValue: (row) => cardPendingBadges(row).length,
      sortFirst: "desc",
      cell: <CardPendingCell />,
    },
    {
      header: "Updated",
      id: "updated",
      width: "w-24",
      align: "right",
      sortValue: (row) => row.updatedAt,
      sortFirst: "desc",
      cell: <InstantCell<CandidateCardSummaryResponse> at={(row) => row.updatedAt} relative />,
    },
  ];

  return (
    <AdminTable
      columns={columns}
      data={records.rows}
      getRowKey={cardSummaryKey}
      emptyText="No cards found."
      virtualize={{ rowHeight: ROW_HEIGHT }}
      minWidth="min-w-[720px]"
    />
  );
}

function PrintingsTable({ records, sort }: { records: RowRecords; sort: ServerSort }) {
  const { labels } = useEnumOrders();

  const columns: AdminColumnDef<WorkspaceRecordRow>[] = [
    {
      header: "Printing",
      id: "name",
      sortKey: "name",
      wrap: true,
      cell: <PrintingNameCell />,
    },
    { header: "Codes", id: "codes", sortKey: "code", width: "w-40", cell: <PrintingCodesCell /> },
    {
      header: "Finish",
      id: "finish",
      sortKey: "finish",
      width: "w-24",
      cell: <FinishCell finishLabels={labels.finishes} />,
    },
    { header: "Lang", id: "language", sortKey: "language", width: "w-16", cell: <LanguageCell /> },
    { header: "Channel", id: "channel", wrap: true, cell: <PrintingChannelCell /> },
    { header: "Status", id: "status", width: "w-28", cell: <PrintingStatusCell /> },
    {
      header: "Updated",
      id: "updated",
      sortKey: "updated",
      sortFirst: "desc",
      width: "w-24",
      align: "right",
      cell: <InstantCell<WorkspaceRecordRow> at={(row) => row.updatedAt} relative />,
    },
  ];

  return (
    <AdminTable
      columns={columns}
      data={records.rows}
      getRowKey={(row) => row.id}
      emptyText="No printings found."
      serverSort={sort}
      virtualize={{ rowHeight: ROW_HEIGHT }}
      minWidth="min-w-[820px]"
      footer={
        <LoadMoreFooter
          hasMore={records.hasMore}
          isLoadingMore={records.isLoadingMore}
          loadMore={records.loadMore}
        />
      }
    />
  );
}

function FacesTable({ records, sort }: { records: RowRecords; sort: ServerSort }) {
  const { labels } = useEnumOrders();
  const columns: AdminColumnDef<WorkspaceRecordRow>[] = [
    {
      header: "Face",
      id: "name",
      sortKey: "name",
      wrap: true,
      cell: <FaceNameCell />,
    },
    { header: "Code", id: "code", sortKey: "code", width: "w-28", cell: <FaceCodeCell /> },
    { header: "Set", id: "set", width: "w-32", cell: <FaceSetCell /> },
    {
      header: "Rarity",
      id: "rarity",
      width: "w-36",
      cell: <FaceRarityCell rarityLabels={labels.rarities} artVariantLabels={labels.artVariants} />,
    },
    {
      header: "Finish",
      id: "finish",
      sortKey: "finish",
      width: "w-24",
      cell: <FinishCell finishLabels={labels.finishes} />,
    },
    { header: "Lang", id: "language", sortKey: "language", width: "w-16", cell: <LanguageCell /> },
    { header: "Status", id: "status", wrap: true, cell: <FaceStatusCell /> },
    {
      header: "Updated",
      id: "updated",
      sortKey: "updated",
      sortFirst: "desc",
      width: "w-24",
      align: "right",
      cell: <InstantCell<WorkspaceRecordRow> at={(row) => row.updatedAt} relative />,
    },
  ];

  return (
    <AdminTable
      columns={columns}
      data={records.rows}
      getRowKey={(row) => row.id}
      emptyText="No faces found."
      serverSort={sort}
      virtualize={{ rowHeight: ROW_HEIGHT }}
      minWidth="min-w-[860px]"
      footer={
        <LoadMoreFooter
          hasMore={records.hasMore}
          isLoadingMore={records.isLoadingMore}
          loadMore={records.loadMore}
        />
      }
    />
  );
}

function DeskTable({ records }: { records: DeskRecords }) {
  const rows = records.rows;

  const { data: channelData } = useDistributionChannels();
  const { data: markerData } = useMarkers();
  const { labels } = useEnumOrders();
  const channelPaths = buildChannelBreadcrumbsBySlug(channelData.distributionChannels);
  const markerLabels = labelMap(markerData.markers);

  const columns: AdminColumnDef<DeskRow>[] = [
    {
      header: "Printing",
      id: "name",
      wrap: true,
      cell: <DeskNameCell markerLabels={markerLabels} />,
    },
    { header: "Codes", id: "codes", width: "w-40", cell: <DeskCodesCell /> },
    {
      header: "Finish",
      id: "finish",
      width: "w-24",
      cell: <FinishCell finishLabels={labels.finishes} />,
    },
    { header: "Lang", id: "language", width: "w-16", cell: <LanguageCell /> },
    {
      header: "Channel",
      id: "channel",
      wrap: true,
      cell: <DeskChannelCell channelPaths={channelPaths} />,
    },
    { header: "Status", id: "status", width: "w-28", cell: <DeskStatusCell /> },
    { header: "Images", id: "images", width: "w-24", align: "right", cell: <DeskImagesCell /> },
    {
      header: "Updated",
      id: "updated",
      width: "w-24",
      align: "right",
      cell: <InstantCell<DeskRow> at={(row) => row.updatedAt} relative />,
    },
  ];

  return (
    <AdminTable
      columns={columns}
      data={rows}
      getRowKey={(row) => row.printingId}
      emptyText="No printings found."
      virtualize={{ rowHeight: ROW_HEIGHT }}
      minWidth="min-w-[960px]"
    />
  );
}

export function RecordsTable({
  records,
  sort,
}: {
  records: WorkspaceRecordsResult;
  sort: ServerSort;
}) {
  switch (records.kind) {
    case "card": {
      return <CardsTable records={records} />;
    }
    case "desk": {
      return <DeskTable records={records} />;
    }
    case "printing": {
      return <PrintingsTable records={records} sort={sort} />;
    }
    case "face": {
      return <FacesTable records={records} sort={sort} />;
    }
  }
}
