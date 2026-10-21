import type { WorkspaceRecordRow } from "@openrift/shared/contracts/admin/catalog-workspace";
import { formatDay, formatRelativeTime } from "@openrift/shared/format-date";
import { pluralize } from "@openrift/shared/strings";
import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { DownloadIcon } from "lucide-react";
import { useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import { DeskStatusBadge } from "@/features/admin/components/printing-desk-shared";
import { useDistributionChannels } from "@/features/admin/hooks/use-distribution-channels";
import {
  buildPrintingDeskCsv,
  printingDeskCsvFilename,
} from "@/features/admin/lib/printing-desk-csv";
import { imageCountText } from "@/features/admin/lib/printing-desk-filter";
import { deskImageSrc } from "@/features/admin/lib/printing-desk-image";
import { CardArtThumb } from "@/features/cards/components/card-art-thumb";
import { buildChannelBreadcrumbsBySlug } from "@/features/cards/lib/channel-breadcrumbs";
import { WorkspaceTargetLink } from "@/features/catalog-workspace/components/queue-list";
import type { useWorkspaceRecords } from "@/features/catalog-workspace/hooks/use-workspace-queue";
import type {
  DeskMode,
  DeskRow,
  WorkspaceTarget,
} from "@/features/catalog-workspace/lib/owner-items";
import {
  cardSummaryOpen,
  cardSummaryTarget,
  deskEntry,
  recordEntry,
} from "@/features/catalog-workspace/lib/owner-items";
import { useScopeEffect } from "@/hooks/use-scope-effect";
import { downloadCsv } from "@/lib/download";
import { getSiteUrl } from "@/lib/site-config";

const ROW_HEIGHT = 49;

type RecordsResult = ReturnType<typeof useWorkspaceRecords>;

function SelectCell() {
  return <Checkbox disabled aria-label="Select" title="Bulk actions are not available yet" />;
}

const SELECT_COLUMN = {
  header: "",
  id: "select",
  width: "w-10",
  cell: <SelectCell />,
};

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
  return <span className="text-muted-foreground text-xs">{formatRelativeTime(at)}</span>;
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
  return <span className="text-muted-foreground">{row?.setSlugs.at(0) ?? ""}</span>;
}

function CardPrintingsCell({ row }: AdminCellSlotProps<CandidateCardSummaryResponse>) {
  if (!row) {
    return null;
  }
  return (
    <span className="text-muted-foreground">
      {row.cardSlug === null ? row.stagingShortCodes.length : row.shortCodes.length}
    </span>
  );
}

function CardOpenCell({ row }: AdminCellSlotProps<CandidateCardSummaryResponse>) {
  if (!row) {
    return null;
  }
  const open = cardSummaryOpen(row);
  return (
    <span className="flex flex-wrap gap-1">
      {row.uncheckedCardCount + row.uncheckedPrintingCount > 0 && (
        <Badge variant="warning">
          {row.uncheckedCardCount + row.uncheckedPrintingCount} from sources
        </Badge>
      )}
      {row.pendingSubmissions > 0 && (
        <Badge variant="violet">
          {row.pendingSubmissions} {pluralize(row.pendingSubmissions, "proposal")}
        </Badge>
      )}
      {open === 0 && <span className="text-muted-foreground text-xs">None</span>}
    </span>
  );
}

function CardUpdatedCell({ row }: AdminCellSlotProps<CandidateCardSummaryResponse>) {
  return row ? <Updated at={row.updatedAt} /> : null;
}

const CARD_COLUMNS: AdminColumnDef<CandidateCardSummaryResponse>[] = [
  SELECT_COLUMN,
  { header: "Card", id: "name", wrap: true, cell: <CardNameCell /> },
  { header: "First set", id: "set", width: "w-[16%]", cell: <CardSetCell /> },
  {
    header: "Printings",
    id: "printings",
    width: "w-24",
    align: "right",
    cell: <CardPrintingsCell />,
  },
  { header: "Open", id: "open", wrap: true, cell: <CardOpenCell /> },
  { header: "Updated", id: "updated", width: "w-24", align: "right", cell: <CardUpdatedCell /> },
];

function RecordNameCell({
  row,
  owner,
}: AdminCellSlotProps<WorkspaceRecordRow> & { owner?: "face" | "printing" }) {
  if (!row || owner === undefined) {
    return null;
  }
  return (
    <span className="flex items-center gap-2">
      <Thumb url={row.imageUrl} />
      <span className="min-w-0">
        <NameLink target={recordEntry(owner, row).target}>{row.cardName}</NameLink>
        <span className="text-muted-foreground block truncate text-xs">
          {row.setName}
          {row.isPromo === true ? " · Promo" : ""}
        </span>
      </span>
    </span>
  );
}

function RecordCodeCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  return <span className="font-mono text-xs">{row?.shortCode ?? ""}</span>;
}

function RecordLanguageCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  return row ? <Badge variant="neutral">{row.language.toUpperCase()}</Badge> : null;
}

function RecordFinishCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  return <span>{row?.finish ?? ""}</span>;
}

function RecordUsedOnCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  if (row?.printingCount === undefined) {
    return null;
  }
  return (
    <span className="text-muted-foreground">
      {row.printingCount} {pluralize(row.printingCount, "printing")}
    </span>
  );
}

function RecordFacesCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  if (row?.faceCount === undefined) {
    return null;
  }
  return <span className="text-muted-foreground">{row.faceCount}</span>;
}

function RecordUpdatedCell({ row }: AdminCellSlotProps<WorkspaceRecordRow>) {
  return row ? <Updated at={row.updatedAt} /> : null;
}

function recordColumns(owner: "face" | "printing"): AdminColumnDef<WorkspaceRecordRow>[] {
  return [
    SELECT_COLUMN,
    {
      header: owner === "face" ? "Face" : "Printing",
      id: "name",
      wrap: true,
      cell: <RecordNameCell owner={owner} />,
    },
    { header: "Code", id: "code", width: "w-32", cell: <RecordCodeCell /> },
    { header: "Lang", id: "language", width: "w-20", cell: <RecordLanguageCell /> },
    { header: "Finish", id: "finish", width: "w-24", cell: <RecordFinishCell /> },
    owner === "face"
      ? { header: "Used on", id: "used", width: "w-28", cell: <RecordUsedOnCell /> }
      : { header: "Faces", id: "faces", width: "w-20", align: "right", cell: <RecordFacesCell /> },
    {
      header: "Updated",
      id: "updated",
      width: "w-24",
      align: "right",
      cell: <RecordUpdatedCell />,
    },
  ];
}

function DeskNameCell({ row }: AdminCellSlotProps<DeskRow>) {
  if (!row) {
    return null;
  }
  const entry = deskEntry(row);
  return (
    <span className="flex items-center gap-2">
      <Thumb url={row.activeImageUrl} />
      <NameLink target={entry.target}>{entry.title}</NameLink>
    </span>
  );
}

function DeskCodesCell({ row }: AdminCellSlotProps<DeskRow>) {
  return <span className="font-mono text-xs">{row ? deskEntry(row).code : ""}</span>;
}

function DeskLanguageCell({ row }: AdminCellSlotProps<DeskRow>) {
  return row ? <Badge variant="neutral">{row.language.toUpperCase()}</Badge> : null;
}

function DeskFinishCell({ row }: AdminCellSlotProps<DeskRow>) {
  return <span>{row?.finish ?? ""}</span>;
}

function DeskChannelCell({
  row,
  channelPaths,
}: AdminCellSlotProps<DeskRow> & { channelPaths?: ReadonlyMap<string, string> }) {
  if (!row) {
    return null;
  }
  return (
    <span className="text-muted-foreground">
      {row.distributionChannelSlugs.map((slug) => channelPaths?.get(slug) ?? slug).join(", ")}
    </span>
  );
}

function DeskStatusCell({ row }: AdminCellSlotProps<DeskRow>) {
  return row ? <DeskStatusBadge row={row} /> : null;
}

function DeskImagesCell({ row }: AdminCellSlotProps<DeskRow>) {
  return row ? (
    <span className="text-muted-foreground">{imageCountText(row.imageCount)}</span>
  ) : null;
}

function deskColumns(channelPaths: ReadonlyMap<string, string>): AdminColumnDef<DeskRow>[] {
  return [
    SELECT_COLUMN,
    { header: "Printing", id: "name", wrap: true, cell: <DeskNameCell /> },
    { header: "Codes", id: "codes", width: "w-40", cell: <DeskCodesCell /> },
    { header: "Finish", id: "finish", width: "w-24", cell: <DeskFinishCell /> },
    { header: "Lang", id: "language", width: "w-20", cell: <DeskLanguageCell /> },
    {
      header: "Channel",
      id: "channel",
      wrap: true,
      cell: <DeskChannelCell channelPaths={channelPaths} />,
    },
    { header: "Status", id: "status", width: "w-28", cell: <DeskStatusCell /> },
    { header: "Images", id: "images", width: "w-24", cell: <DeskImagesCell /> },
  ];
}

function Toolbar({ summary, onExport }: { summary: string; onExport?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-sm">{summary}</span>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto"
        disabled={onExport === undefined}
        title={onExport === undefined ? "Export is not available for this list yet" : undefined}
        onClick={onExport}
      >
        <DownloadIcon />
        Export CSV
      </Button>
    </div>
  );
}

function summaryText(count: number, noun: string, hasMore: boolean): string {
  const base = `${count.toLocaleString()} ${noun}${hasMore ? " loaded" : ""} · a row opens beside the list`;
  return hasMore ? `${base} · more load as you scroll` : base;
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

function todayDay(): string {
  return formatDay(new Date());
}

function DeskTable({ rows, mode }: { rows: DeskRow[]; mode: DeskMode }) {
  const { data: channelData } = useDistributionChannels();
  const channelPaths = buildChannelBreadcrumbsBySlug(channelData.distributionChannels);

  function handleExport() {
    const csv = buildPrintingDeskCsv(rows, { channelPaths, siteUrl: getSiteUrl() });
    downloadCsv(csv, printingDeskCsvFilename(mode === "promos" ? "all" : "mine", todayDay()));
  }

  return (
    <AdminTable
      columns={deskColumns(channelPaths)}
      data={rows}
      getRowKey={(row) => row.printingId}
      emptyText="No printings found."
      virtualize={{ rowHeight: ROW_HEIGHT }}
      minWidth="min-w-[860px]"
      toolbar={
        <Toolbar summary={summaryText(rows.length, "printings", false)} onExport={handleExport} />
      }
    />
  );
}

export function RecordsTable({
  records,
  deskMode,
}: {
  records: RecordsResult;
  deskMode: DeskMode;
}) {
  switch (records.kind) {
    case "card": {
      return (
        <AdminTable
          columns={CARD_COLUMNS}
          data={records.rows}
          getRowKey={(row) => row.cardSlug ?? `new:${row.normalizedName}`}
          emptyText="No cards found."
          virtualize={{ rowHeight: ROW_HEIGHT }}
          minWidth="min-w-[720px]"
          rowClassName={(row) => (row.cardSlug === null ? "border-violet border-l-2" : undefined)}
          toolbar={<Toolbar summary={summaryText(records.rows.length, "cards", false)} />}
        />
      );
    }
    case "desk": {
      return <DeskTable rows={records.rows} mode={deskMode} />;
    }
    case "face":
    case "printing": {
      return (
        <AdminTable
          columns={recordColumns(records.kind)}
          data={records.rows}
          getRowKey={(row) => row.id}
          emptyText={records.kind === "face" ? "No faces found." : "No printings found."}
          virtualize={{ rowHeight: ROW_HEIGHT }}
          minWidth="min-w-[760px]"
          toolbar={
            <Toolbar
              summary={summaryText(
                records.rows.length,
                records.kind === "face" ? "faces" : "printings",
                records.hasMore,
              )}
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
  }
}
