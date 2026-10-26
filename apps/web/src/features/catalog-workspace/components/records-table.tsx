import type { WorkspaceRecordRow } from "@openrift/shared/contracts/admin/catalog-workspace";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { enumLabel } from "@openrift/shared/enum-label";
import { formatDay, formatRelativeTime } from "@openrift/shared/format-date";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import { pluralize } from "@openrift/shared/strings";
import type {
  CandidateCardSummaryResponse,
  UnmatchedCardDetailResponse,
} from "@openrift/shared/types/api/admin";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { DownloadIcon, Share2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import { DeskStatusBadge } from "@/features/admin/components/printing-desk-shared";
import { useDistributionChannels } from "@/features/admin/hooks/use-distribution-channels";
import { useIgnoreCandidateCard } from "@/features/admin/hooks/use-ignored-candidates";
import { useMarkers } from "@/features/admin/hooks/use-markers";
import { unmatchedCardDetailQueryOptions } from "@/features/admin/lib/admin-card-queries";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import {
  buildPrintingDeskCsv,
  printingDeskCsvFilename,
} from "@/features/admin/lib/printing-desk-csv";
import { imageCountText } from "@/features/admin/lib/printing-desk-filter";
import { deskImageSrc } from "@/features/admin/lib/printing-desk-image";
import { deskPrintingQueryOptions } from "@/features/admin/lib/printing-desk-queries";
import type { PostSlide } from "@/features/admin/lib/printing-post-slides";
import { encodePostSlides } from "@/features/admin/lib/printing-post-slides";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { buildChannelBreadcrumbsBySlug } from "@/features/cards/lib/channel-breadcrumbs";
import { WorkspaceTargetLink } from "@/features/catalog-workspace/components/queue-list";
import type { WorkspaceRecordsResult } from "@/features/catalog-workspace/hooks/use-workspace-queue";
import type {
  DeskMode,
  DeskRow,
  OwnerGroup,
  WorkspaceRole,
  WorkspaceTarget,
} from "@/features/catalog-workspace/lib/owner-items";
import {
  cardOpenBadges,
  cardSummaryKey,
  cardSummaryTarget,
  deskEntry,
  recordEntry,
  rowMatchesSource,
} from "@/features/catalog-workspace/lib/owner-items";
import {
  buildCardsCsv,
  buildFacesCsv,
  buildPrintingsCsv,
  recordsCsvFilename,
} from "@/features/catalog-workspace/lib/records-csv";
import { fetchAllWorkspaceRecords } from "@/features/catalog-workspace/lib/workspace-queries";
import { useEnumOrders } from "@/hooks/use-enums";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { downloadCsv } from "@/lib/download";
import { getSiteUrl } from "@/lib/site-config";

const ROW_HEIGHT = 57;

type Selection = ReadonlySet<string>;

function useSelection() {
  const [selected, setSelected] = useState<Selection>(new Set());
  function handleToggle(key: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }
  return { selected, handleToggle, clear: () => setSelected(new Set()) };
}

function SelectCell<T>({
  row,
  rowKey,
  rowLabel,
  canSelect,
  selected,
  onToggle,
}: AdminCellSlotProps<T> & {
  rowKey?: (row: T) => string;
  rowLabel?: (row: T) => string;
  canSelect?: (row: T) => boolean;
  selected?: Selection;
  onToggle?: (key: string, checked: boolean) => void;
}) {
  if (row === undefined || rowKey === undefined || (canSelect !== undefined && !canSelect(row))) {
    return null;
  }
  const key = rowKey(row);
  return (
    <Checkbox
      aria-label={`Select ${rowLabel?.(row) ?? key}`}
      checked={selected?.has(key) ?? false}
      onCheckedChange={(checked) => onToggle?.(key, checked === true)}
    />
  );
}

function selectColumn<T>(
  props: {
    rowKey: (row: T) => string;
    rowLabel: (row: T) => string;
    canSelect?: (row: T) => boolean;
  },
  selection: ReturnType<typeof useSelection>,
): AdminColumnDef<T> {
  return {
    header: "",
    id: "select",
    width: "w-10",
    cell: (
      <SelectCell<T>
        rowKey={props.rowKey}
        rowLabel={props.rowLabel}
        canSelect={props.canSelect}
        selected={selection.selected}
        onToggle={selection.handleToggle}
      />
    ),
  };
}

function NameLink({ target, children }: { target: WorkspaceTarget | null; children: string }) {
  if (target === null) {
    return <span className="font-medium">{children}</span>;
  }
  return (
    <WorkspaceTargetLink target={target} className="font-medium hover:underline">
      {children}
    </WorkspaceTargetLink>
  );
}

function Thumb({ url }: { url: string | null }) {
  return (
    <CardArtThumb
      src={deskImageSrc(url, "240w")}
      alt=""
      loading="lazy"
      className="w-7 min-w-0 shrink-0"
    />
  );
}

function Updated({ at }: { at: string }) {
  return <span className="text-muted-foreground text-sm">{formatRelativeTime(at)}</span>;
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground text-sm">{children}</span>;
}

function MarkerBadges({
  markers,
  labels,
}: {
  markers: readonly string[];
  labels?: ReadonlyMap<string, string>;
}) {
  if (markers.length === 0) {
    return null;
  }
  return (
    <span className="mt-0.5 flex flex-wrap gap-1">
      {markers.map((marker) => (
        <Badge key={marker} variant="neutral">
          {labels?.get(marker) ?? marker}
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
    <span className="flex flex-wrap items-center gap-2">
      <NameLink target={cardSummaryTarget(row)}>{row.name}</NameLink>
      {row.cardSlug === null && <Badge variant="violet">New</Badge>}
    </span>
  );
}

function CardSetCell({ row }: AdminCellSlotProps<CandidateCardSummaryResponse>) {
  return <Muted>{row?.setSlugs.at(0) ?? ""}</Muted>;
}

function CardPrintingsCell({ row }: AdminCellSlotProps<CandidateCardSummaryResponse>) {
  if (!row) {
    return null;
  }
  const count = row.cardSlug === null ? row.stagingShortCodes.length : row.shortCodes.length;
  return <Muted>{row.cardSlug === null ? `+${count}` : count}</Muted>;
}

function CardOpenCell({
  row,
  groups,
}: AdminCellSlotProps<CandidateCardSummaryResponse> & {
  groups?: ReadonlyMap<string, OwnerGroup>;
}) {
  if (!row) {
    return null;
  }
  const badges = cardOpenBadges(row, groups?.get(cardSummaryKey(row)));
  if (badges.length === 0) {
    return <Muted>None</Muted>;
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

function CardUpdatedCell({ row }: AdminCellSlotProps<CandidateCardSummaryResponse>) {
  return row ? <Updated at={row.updatedAt} /> : null;
}

function PrintingNameCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  if (!row) {
    return null;
  }
  return (
    <span className="flex items-center gap-2">
      <Thumb url={row.imageUrl} />
      <span className="min-w-0">
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
}: AdminCellSlotProps<{ finish: string }> & { finishLabels?: Record<string, string> }) {
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

function PrintingImagesCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  if (!row) {
    return null;
  }
  if (row.imageCount === undefined) {
    return <Muted>{row.imageUrl === null ? "No image" : ""}</Muted>;
  }
  return <Muted>{imageCountText(row.imageCount)}</Muted>;
}

function RecordUpdatedCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  return row ? <Updated at={row.updatedAt} /> : null;
}

function FaceNameCell({
  row,
  rarityLabels,
  artVariantLabels,
}: AdminCellSlotProps<WorkspaceRecordRow> & {
  rarityLabels?: Record<string, string>;
  artVariantLabels?: Record<string, string>;
}) {
  if (!row) {
    return null;
  }
  const sub = [
    row.setName,
    row.rarity && rarityLabels ? enumLabel(rarityLabels, row.rarity) : null,
    row.artVariant && artVariantLabels ? enumLabel(artVariantLabels, row.artVariant) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span className="flex items-center gap-2">
      <Thumb url={row.imageUrl} />
      <span className="min-w-0">
        <NameLink target={recordEntry("face", row).target}>{row.cardName}</NameLink>
        <span className="text-muted-foreground block truncate text-sm">{sub}</span>
      </span>
    </span>
  );
}

function FaceCodeCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  return <span className="font-mono text-sm">{row?.shortCode ?? ""}</span>;
}

function FaceUsedOnCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  if (row?.printingCount === undefined) {
    return null;
  }
  return (
    <Muted>
      {row.printingCount} {pluralize(row.printingCount, "printing")}
    </Muted>
  );
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
    </span>
  );
}

function DeskNameCell({
  row,
  markerLabels,
}: AdminCellSlotProps<DeskRow> & { markerLabels?: ReadonlyMap<string, string> }) {
  if (!row) {
    return null;
  }
  const entry = deskEntry(row);
  return (
    <span className="flex items-center gap-2">
      <Thumb url={row.activeImageUrl} />
      <span className="min-w-0">
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

function DeskUpdatedCell({ row }: AdminCellSlotProps<DeskRow>) {
  return row ? <Updated at={row.updatedAt} /> : null;
}

function summaryText(shown: number, total: number | null, noun: string, hasMore: boolean): string {
  const count =
    hasMore && total !== null
      ? `${shown.toLocaleString()} of ${total.toLocaleString()} ${noun} loaded`
      : `${shown.toLocaleString()} ${noun}`;
  return `${count} · a row opens beside the list`;
}

function Toolbar({
  summary,
  selectedCount,
  actions,
  note,
  onExport,
  exporting,
}: {
  summary: string;
  selectedCount: number;
  actions?: ReactNode;
  note?: string;
  onExport: () => void;
  exporting: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedCount > 0 && (
        <span className="bg-primary/10 flex flex-wrap items-center gap-2 rounded-md px-3 py-1">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          {actions}
          {note !== undefined && <Muted>{note}</Muted>}
        </span>
      )}
      <Muted>{summary}</Muted>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto"
        disabled={exporting}
        onClick={onExport}
      >
        {exporting ? <Spinner /> : <DownloadIcon />}
        Export CSV
      </Button>
    </div>
  );
}

function withoutImageNote(count: number): string | undefined {
  if (count === 0) {
    return undefined;
  }
  return count === 1 ? "1 without an image is left out" : `${count} without an image are left out`;
}

function useMakePost() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [working, setWorking] = useState(false);

  function open(slides: PostSlide[]) {
    void navigate({
      to: "/admin/printing-desk/post",
      search: { slides: encodePostSlides(slides) },
    });
  }

  async function openFromIds(printingIds: string[]) {
    setWorking(true);
    const slides = await loadPostSlides(queryClient, printingIds);
    setWorking(false);
    if (slides !== null) {
      open(slides);
    }
  }

  return { open, openFromIds, working };
}

function useExport(build: () => Promise<{ csv: string; filename: string }>) {
  const [exporting, setExporting] = useState(false);
  async function run() {
    setExporting(true);
    await exportCsv(build);
    setExporting(false);
  }
  return { exporting, handleExport: () => void run() };
}

function todayDay(): string {
  return formatDay(new Date());
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

async function fetchMatchingRecords(records: RowRecords): Promise<WorkspaceRecordRow[]> {
  const rows = await fetchAllWorkspaceRecords(records.query, records.pages);
  return rows.filter((row) =>
    rowMatchesSource(records.groups.get(recordEntry(records.kind, row).key), records.source),
  );
}

function CardsTable({ records, isAdmin }: { records: CardRecords; isAdmin: boolean }) {
  const selection = useSelection();
  const queryClient = useQueryClient();
  const ignoreSource = useIgnoreCandidateCard([adminKeys.workspace, adminKeys.cards.list]);
  const [ignoring, setIgnoring] = useState(false);
  const exporter = useExport(() =>
    Promise.resolve({
      csv: buildCardsCsv(records.rows),
      filename: recordsCsvFilename("cards", todayDay()),
    }),
  );
  const selectedDrafts = records.rows.filter(
    (row) => row.cardSlug === null && selection.selected.has(cardSummaryKey(row)),
  );

  async function ignoreSelected() {
    setIgnoring(true);
    if (await ignoreDraftsAndReport(queryClient, ignoreSource.mutateAsync, selectedDrafts)) {
      selection.clear();
    }
    setIgnoring(false);
  }

  const columns: AdminColumnDef<CandidateCardSummaryResponse>[] = [
    ...(isAdmin
      ? [
          selectColumn<CandidateCardSummaryResponse>(
            {
              rowKey: cardSummaryKey,
              rowLabel: (row) => row.name,
              canSelect: (row) => row.cardSlug === null,
            },
            selection,
          ),
        ]
      : []),
    { header: "Card", id: "name", wrap: true, cell: <CardNameCell /> },
    { header: "First set", id: "set", width: "w-[16%]", cell: <CardSetCell /> },
    {
      header: "Printings",
      id: "printings",
      width: "w-24",
      align: "right",
      cell: <CardPrintingsCell />,
    },
    { header: "Open", id: "open", wrap: true, cell: <CardOpenCell groups={records.groups} /> },
    { header: "Updated", id: "updated", width: "w-24", align: "right", cell: <CardUpdatedCell /> },
  ];

  return (
    <AdminTable
      columns={columns}
      data={records.rows}
      getRowKey={cardSummaryKey}
      emptyText="No cards found."
      virtualize={{ rowHeight: ROW_HEIGHT }}
      minWidth="min-w-[720px]"
      rowClassName={(row) => (row.cardSlug === null ? "border-violet border-l-2" : undefined)}
      toolbar={
        <Toolbar
          summary={summaryText(records.rows.length, records.total, "cards", false)}
          selectedCount={selectedDrafts.length}
          actions={
            <Button
              variant="outline"
              size="sm"
              disabled={ignoring}
              onClick={() => void ignoreSelected()}
            >
              Ignore
            </Button>
          }
          onExport={exporter.handleExport}
          exporting={exporter.exporting}
        />
      }
    />
  );
}

function PrintingsTable({ records }: { records: RowRecords }) {
  const selection = useSelection();
  const { labels } = useEnumOrders();
  const post = useMakePost();
  const exporter = useExport(async () => ({
    csv: buildPrintingsCsv(await fetchMatchingRecords(records)),
    filename: recordsCsvFilename("printings", todayDay()),
  }));
  const selectedRows = records.rows.filter((row) => selection.selected.has(row.id));
  const withImage = selectedRows.filter((row) => row.imageUrl !== null && row.imageCount !== 0);

  const columns: AdminColumnDef<WorkspaceRecordRow>[] = [
    selectColumn<WorkspaceRecordRow>(
      { rowKey: (row) => row.id, rowLabel: (row) => row.cardName },
      selection,
    ),
    {
      header: "Printing",
      id: "name",
      wrap: true,
      cell: <PrintingNameCell />,
    },
    { header: "Codes", id: "codes", width: "w-40", cell: <PrintingCodesCell /> },
    {
      header: "Finish",
      id: "finish",
      width: "w-24",
      cell: <FinishCell finishLabels={labels.finishes} />,
    },
    { header: "Lang", id: "language", width: "w-16", cell: <LanguageCell /> },
    { header: "Channel", id: "channel", wrap: true, cell: <PrintingChannelCell /> },
    { header: "Status", id: "status", width: "w-28", cell: <PrintingStatusCell /> },
    { header: "Images", id: "images", width: "w-24", align: "right", cell: <PrintingImagesCell /> },
    {
      header: "Updated",
      id: "updated",
      width: "w-24",
      align: "right",
      cell: <RecordUpdatedCell />,
    },
  ];

  return (
    <AdminTable
      columns={columns}
      data={records.rows}
      getRowKey={(row) => row.id}
      emptyText="No printings found."
      virtualize={{ rowHeight: ROW_HEIGHT }}
      minWidth="min-w-[960px]"
      toolbar={
        <Toolbar
          summary={summaryText(records.rows.length, records.total, "printings", records.hasMore)}
          selectedCount={selectedRows.length}
          actions={
            <Button
              variant="outline"
              size="sm"
              disabled={withImage.length === 0 || post.working}
              onClick={() => void post.openFromIds(withImage.map((row) => row.id))}
            >
              <Share2Icon />
              Make a post
            </Button>
          }
          note={withoutImageNote(selectedRows.length - withImage.length)}
          onExport={exporter.handleExport}
          exporting={exporter.exporting}
        />
      }
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

function FacesTable({ records }: { records: RowRecords }) {
  const { labels } = useEnumOrders();
  const exporter = useExport(async () => ({
    csv: buildFacesCsv(await fetchMatchingRecords(records)),
    filename: recordsCsvFilename("faces", todayDay()),
  }));
  const columns: AdminColumnDef<WorkspaceRecordRow>[] = [
    {
      header: "Face",
      id: "name",
      wrap: true,
      cell: <FaceNameCell rarityLabels={labels.rarities} artVariantLabels={labels.artVariants} />,
    },
    { header: "Code", id: "code", width: "w-28", cell: <FaceCodeCell /> },
    { header: "Lang", id: "language", width: "w-16", cell: <LanguageCell /> },
    {
      header: "Finish",
      id: "finish",
      width: "w-24",
      cell: <FinishCell finishLabels={labels.finishes} />,
    },
    { header: "Used on", id: "used", width: "w-28", cell: <FaceUsedOnCell /> },
    { header: "Status", id: "status", wrap: true, cell: <FaceStatusCell /> },
    {
      header: "Updated",
      id: "updated",
      width: "w-24",
      align: "right",
      cell: <RecordUpdatedCell />,
    },
  ];

  return (
    <AdminTable
      columns={columns}
      data={records.rows}
      getRowKey={(row) => row.id}
      emptyText="No faces found."
      virtualize={{ rowHeight: ROW_HEIGHT }}
      minWidth="min-w-[860px]"
      toolbar={
        <Toolbar
          summary={summaryText(records.rows.length, records.total, "faces", records.hasMore)}
          selectedCount={0}
          onExport={exporter.handleExport}
          exporting={exporter.exporting}
        />
      }
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

function DeskTable({ records, mode }: { records: DeskRecords; mode: DeskMode }) {
  const rows = records.rows;
  const selection = useSelection();
  const post = useMakePost();
  const { data: channelData } = useDistributionChannels();
  const { data: markerData } = useMarkers();
  const { labels } = useEnumOrders();
  const channelPaths = buildChannelBreadcrumbsBySlug(channelData.distributionChannels);
  const markerLabels = new Map(markerData.markers.map((marker) => [marker.slug, marker.label]));
  const exporter = useExport(() =>
    Promise.resolve({
      csv: buildPrintingDeskCsv(rows, { channelPaths, siteUrl: getSiteUrl() }),
      filename: printingDeskCsvFilename(mode === "promos" ? "all" : "mine", todayDay()),
    }),
  );
  const selectedRows = rows.filter((row) => selection.selected.has(row.printingId));
  const slides = selectedRows.flatMap((row) =>
    row.activeImageFileId === null
      ? []
      : [{ printingId: row.printingId, imageFileId: row.activeImageFileId }],
  );

  const columns: AdminColumnDef<DeskRow>[] = [
    selectColumn<DeskRow>(
      { rowKey: (row) => row.printingId, rowLabel: (row) => row.cardName },
      selection,
    ),
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
    { header: "Updated", id: "updated", width: "w-24", align: "right", cell: <DeskUpdatedCell /> },
  ];

  return (
    <AdminTable
      columns={columns}
      data={rows}
      getRowKey={(row) => row.printingId}
      emptyText="No printings found."
      virtualize={{ rowHeight: ROW_HEIGHT }}
      minWidth="min-w-[960px]"
      toolbar={
        <Toolbar
          summary={summaryText(rows.length, records.total, "printings", false)}
          selectedCount={selectedRows.length}
          actions={
            <Button
              variant="outline"
              size="sm"
              disabled={slides.length === 0}
              onClick={() => post.open(slides)}
            >
              <Share2Icon />
              Make a post
            </Button>
          }
          note={withoutImageNote(selectedRows.length - slides.length)}
          onExport={exporter.handleExport}
          exporting={exporter.exporting}
        />
      }
    />
  );
}

export function RecordsTable({
  records,
  deskMode,
  role,
}: {
  records: WorkspaceRecordsResult;
  deskMode: DeskMode;
  role: WorkspaceRole;
}) {
  switch (records.kind) {
    case "card": {
      return <CardsTable records={records} isAdmin={role === "admin"} />;
    }
    case "desk": {
      return <DeskTable records={records} mode={deskMode} />;
    }
    case "printing": {
      return <PrintingsTable records={records} />;
    }
    case "face": {
      return <FacesTable records={records} />;
    }
  }
}

async function ignoreDraftsAndReport(
  queryClient: QueryClient,
  ignore: (input: { provider: string; externalId: string }) => Promise<unknown>,
  drafts: CandidateCardSummaryResponse[],
): Promise<boolean> {
  try {
    const details = (await Promise.all(
      drafts.map((row) => queryClient.query(unmatchedCardDetailQueryOptions(row.normalizedName))),
    )) as UnmatchedCardDetailResponse[];
    const sources = details.flatMap((detail) =>
      detail.sources.filter((source) => source.provider !== USER_SUBMISSION_PROVIDER),
    );
    await Promise.all(
      sources.map((source) => ignore({ provider: source.provider, externalId: source.externalId })),
    );
    toast.success(`Ignored ${drafts.length} ${pluralize(drafts.length, "new card")}.`);
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Ignoring failed.");
    return false;
  }
}

async function loadPostSlides(
  queryClient: QueryClient,
  printingIds: string[],
): Promise<PostSlide[] | null> {
  try {
    const details = await Promise.all(
      printingIds.map((printingId) => queryClient.query(deskPrintingQueryOptions(printingId))),
    );
    const slides = details.flatMap((detail) =>
      detail.printing.activeImageFileId === null
        ? []
        : [
            {
              printingId: detail.printing.printingId,
              imageFileId: detail.printing.activeImageFileId,
            },
          ],
    );
    if (slides.length === 0) {
      toast.error("None of the selected printings has an active image.");
      return null;
    }
    return slides;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "The printings could not be loaded.");
    return null;
  }
}

async function exportCsv(build: () => Promise<{ csv: string; filename: string }>): Promise<void> {
  try {
    const { csv, filename } = await build();
    downloadCsv(csv, filename);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "The export failed.");
  }
}
