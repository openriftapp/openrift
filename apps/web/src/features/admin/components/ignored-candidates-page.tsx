import { formatDayTime } from "@openrift/shared/format-date";
import { Link } from "@tanstack/react-router";
import { Undo2Icon } from "lucide-react";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { PageDescription } from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import { DebouncedSearchInput } from "@/features/admin/components/debounced-search-input";
import {
  useDeletePrintingLink,
  useIgnoredCandidates,
  useUnignoreCandidateCard,
  useUnignoreCandidatePrinting,
} from "@/features/admin/hooks/use-ignored-candidates";
import { filterPrintingLinks } from "@/features/admin/lib/printing-links";

interface IgnoredCard {
  id: string;
  provider: string;
  externalId: string;
  createdAt: string;
}

interface IgnoredPrinting {
  id: string;
  provider: string;
  externalId: string;
  finish: string | null;
  createdAt: string;
}

interface PrintingLink {
  provider: string;
  externalId: string;
  finish: string;
  printingId: string;
  shortCode: string;
  cardSlug: string;
  cardName: string;
  createdAt: string;
}

function ProviderBadgeCell({ row }: AdminCellSlotProps<IgnoredCard | IgnoredPrinting>) {
  if (!row) {
    return null;
  }
  return <Badge variant="outline">{row.provider}</Badge>;
}

function ExternalIdCell({ row }: AdminCellSlotProps<{ externalId: string }>) {
  if (!row) {
    return null;
  }
  return <span className="font-mono">{row.externalId}</span>;
}

function CreatedAtCell({ row }: AdminCellSlotProps<{ createdAt: string }>) {
  if (!row) {
    return null;
  }
  return <span className="text-muted-foreground">{formatDayTime(row.createdAt)}</span>;
}

function PrintingFinishCell({ row }: AdminCellSlotProps<IgnoredPrinting>) {
  if (!row) {
    return null;
  }
  return row.finish ? (
    <Badge variant="outline">{row.finish}</Badge>
  ) : (
    <Badge variant="outline">all</Badge>
  );
}

const cardColumns: AdminColumnDef<IgnoredCard>[] = [
  {
    header: "Provider",
    width: "w-36",
    sortValue: (r) => r.provider,
    cell: <ProviderBadgeCell />,
  },
  {
    header: "External ID",
    sortValue: (r) => r.externalId,
    cell: <ExternalIdCell />,
  },
  {
    header: "Ignored At",
    width: "w-36",
    sortValue: (r) => r.createdAt,
    cell: <CreatedAtCell />,
  },
];

const printingColumns: AdminColumnDef<IgnoredPrinting>[] = [
  {
    header: "Provider",
    width: "w-36",
    sortValue: (r) => r.provider,
    cell: <ProviderBadgeCell />,
  },
  {
    header: "External ID",
    sortValue: (r) => r.externalId,
    cell: <ExternalIdCell />,
  },
  {
    header: "Finish",
    width: "w-24",
    sortValue: (r) => r.finish,
    cell: <PrintingFinishCell />,
  },
  {
    header: "Ignored At",
    width: "w-36",
    sortValue: (r) => r.createdAt,
    cell: <CreatedAtCell />,
  },
];

function CardUnignoreAction({ row }: AdminCellSlotProps<IgnoredCard>) {
  const unignoreCard = useUnignoreCandidateCard();
  if (!row) {
    return null;
  }
  return (
    <Button
      variant="ghost"
      onClick={() => unignoreCard.mutate({ provider: row.provider, externalId: row.externalId })}
      disabled={unignoreCard.isPending}
    >
      <Undo2Icon className="size-3.5" />
      Unignore
    </Button>
  );
}

function PrintingUnignoreAction({ row }: AdminCellSlotProps<IgnoredPrinting>) {
  const unignorePrinting = useUnignoreCandidatePrinting();
  if (!row) {
    return null;
  }
  return (
    <Button
      variant="ghost"
      onClick={() =>
        unignorePrinting.mutate({
          provider: row.provider,
          externalId: row.externalId,
          finish: row.finish ?? null,
        })
      }
      disabled={unignorePrinting.isPending}
    >
      <Undo2Icon className="size-3.5" />
      Unignore
    </Button>
  );
}

function LinkProviderCell({ row }: AdminCellSlotProps<PrintingLink>) {
  if (!row) {
    return null;
  }
  return <Badge variant="outline">{row.provider || "any source"}</Badge>;
}

function LinkFinishCell({ row }: AdminCellSlotProps<PrintingLink>) {
  if (!row) {
    return null;
  }
  return <Badge variant="outline">{row.finish || "all"}</Badge>;
}

function LinkTargetCell({ row }: AdminCellSlotProps<PrintingLink>) {
  if (!row) {
    return null;
  }
  return (
    <Link to="/admin/cards/$cardSlug" params={{ cardSlug: row.cardSlug }} className="underline">
      <span className="font-mono">{row.shortCode}</span>
      <span className="text-muted-foreground ml-2">{row.cardName}</span>
    </Link>
  );
}

const printingLinkColumns: AdminColumnDef<PrintingLink>[] = [
  {
    header: "Source",
    width: "w-36",
    sortValue: (r) => r.provider,
    cell: <LinkProviderCell />,
  },
  {
    header: "External ID",
    sortValue: (r) => r.externalId,
    cell: <ExternalIdCell />,
  },
  {
    header: "Finish",
    width: "w-24",
    sortValue: (r) => r.finish,
    cell: <LinkFinishCell />,
  },
  {
    header: "Pinned To",
    sortValue: (r) => r.shortCode,
    cell: <LinkTargetCell />,
  },
  {
    header: "Pinned At",
    width: "w-36",
    sortValue: (r) => r.createdAt,
    cell: <CreatedAtCell />,
  },
];

const PRINTING_LINK_ROW_HEIGHT = 41;

function PinnedPrintingLinks({ links }: { links: readonly PrintingLink[] }) {
  const [query, setQuery] = useState("");
  const deleteLink = useDeletePrintingLink();

  const rows = filterPrintingLinks(links, query);

  return (
    <AdminTable
      columns={printingLinkColumns}
      data={rows}
      getRowKey={(r) => `${r.provider}|${r.externalId}|${r.finish}`}
      emptyText={query.trim() ? "No pinned links match." : "No pinned printing links."}
      defaultSort={{ column: "Pinned At", direction: "desc" }}
      virtualize={{ rowHeight: PRINTING_LINK_ROW_HEIGHT }}
      minWidth="min-w-[720px]"
      toolbar={
        <div className="flex flex-wrap items-center gap-3">
          <DebouncedSearchInput
            urlValue={query}
            onCommit={setQuery}
            placeholder="Search source, ID or card…"
            className="w-56"
          />
          <PageDescription>
            {rows.length} of {links.length} pinned
          </PageDescription>
        </div>
      }
      delete={{
        onDelete: (row) =>
          deleteLink.mutateAsync({
            provider: row.provider,
            externalId: row.externalId,
            finish: row.finish,
          }),
        confirm: (row) => ({
          title: `Unpin “${row.externalId}”?`,
          description: `Future uploads from ${row.provider || "any source"} stop linking this row to ${row.shortCode} on their own. The candidates already linked to it stay linked.`,
        }),
      }}
    />
  );
}

export function IgnoredCandidatesPage() {
  const { data } = useIgnoredCandidates();
  const { cards, printings, printingLinks } = data;

  return (
    <div className="space-y-8">
      <AdminPageTopBar title="Review Decisions" />
      <section className="space-y-3">
        <Heading level={2}>Ignored Candidate Cards</Heading>
        <AdminTable
          columns={cardColumns}
          data={cards}
          getRowKey={(r) => r.id}
          emptyText="No ignored candidate cards."
          defaultSort={{ column: "Ignored At", direction: "desc" }}
          actions={<CardUnignoreAction />}
        />
      </section>

      <section className="space-y-3">
        <Heading level={2}>Ignored Candidate Printings</Heading>
        <AdminTable
          columns={printingColumns}
          data={printings}
          getRowKey={(r) => r.id}
          emptyText="No ignored candidate printings."
          defaultSort={{ column: "Ignored At", direction: "desc" }}
          actions={<PrintingUnignoreAction />}
        />
      </section>

      <section className="space-y-3">
        <Heading level={2}>Pinned Printing Links</Heading>
        <PinnedPrintingLinks links={printingLinks} />
      </section>
    </div>
  );
}
