import type { ReviewCard } from "@openrift/shared/contracts/admin/catalog-workspace";
import { countNoun } from "@openrift/shared/strings";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { InstantCell } from "@/features/admin/components/admin-crud-shared";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import { DebouncedSearchInput } from "@/features/admin/components/debounced-search-input";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { CardThumb } from "@/features/catalog-workspace/components/record/record-thumb";
import { WorkspaceUndoButton } from "@/features/catalog-workspace/components/workspace-undo-button";
import type { BatchReason } from "@/features/catalog-workspace/hooks/use-workspace-batch";
import {
  readyPreviewQueryOptions,
  useBatchRun,
} from "@/features/catalog-workspace/hooks/use-workspace-batch";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type { ReadyRow } from "@/features/catalog-workspace/lib/ready-rows";
import {
  buildReadyRows,
  readyBatchKeys,
  selectReadyRows,
} from "@/features/catalog-workspace/lib/ready-rows";
import {
  NEW_CARD_KEY_PREFIX,
  pendingCount,
  pendingSummary,
  reviewCardsQueryOptions,
  reviewSources,
  selectReviewCards,
} from "@/features/catalog-workspace/lib/review-cards";

const routeApi = getRouteApi("/_app/_authenticated/admin/workspace/review");

function CardCell({ row }: AdminCellSlotProps<ReviewCard>) {
  if (!row) {
    return null;
  }
  const link =
    row.cardSlug === null ? (
      <Link
        to="/admin/workspace/cards/new/$name"
        params={{ name: row.key.slice(NEW_CARD_KEY_PREFIX.length) }}
      />
    ) : (
      <Link to="/admin/workspace/cards/$cardSlug" params={{ cardSlug: row.cardSlug }} />
    );
  return (
    <span className="flex items-center gap-2">
      <CardThumb cardSlug={row.cardSlug} />
      <TextLink variant="inherit" className="font-medium" render={link}>
        {row.cardName}
      </TextLink>
    </span>
  );
}

function PendingCell({ row }: AdminCellSlotProps<ReviewCard>) {
  if (!row) {
    return null;
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {row.hasContribution && <Badge variant="success">Contribution</Badge>}
      <span className="text-muted-foreground">{pendingSummary(row)}</span>
    </span>
  );
}

function SourcesCell({ row }: AdminCellSlotProps<ReviewCard>) {
  if (!row) {
    return null;
  }
  return <span className="text-muted-foreground">{reviewSources(row)}</span>;
}

const reviewColumns: AdminColumnDef<ReviewCard>[] = [
  { header: "Card", width: "w-72", sortValue: (row) => row.cardName, cell: <CardCell /> },
  {
    header: "Pending",
    wrap: true,
    sortValue: (row) => pendingCount(row),
    sortFirst: "desc",
    cell: <PendingCell />,
  },
  {
    header: "From",
    width: "w-56",
    wrap: true,
    sortValue: (row) => reviewSources(row),
    cell: <SourcesCell />,
  },
  {
    header: "Waiting",
    width: "w-24",
    align: "right",
    sortValue: (row) => row.waitingSince,
    cell: <InstantCell<ReviewCard> at={(row) => row.waitingSince} relative />,
  },
];

function ReadyCardCell({ row }: AdminCellSlotProps<ReadyRow>) {
  if (!row) {
    return null;
  }
  const link =
    row.cardSlug === null ? (
      row.reviewKey !== null && (
        <Link
          to="/admin/workspace/cards/new/$name"
          params={{ name: row.reviewKey.slice(NEW_CARD_KEY_PREFIX.length) }}
        />
      )
    ) : (
      <Link to="/admin/workspace/cards/$cardSlug" params={{ cardSlug: row.cardSlug }} />
    );
  const thumb = <CardThumb cardSlug={row.cardSlug} />;
  if (!link) {
    return (
      <span className="flex items-center gap-2">
        {thumb}
        <span className="font-medium">{row.cardName}</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2">
      {thumb}
      <TextLink variant="inherit" className="font-medium" render={link}>
        {row.cardName}
      </TextLink>
    </span>
  );
}

function CreatesCell({ row }: AdminCellSlotProps<ReadyRow>) {
  if (!row) {
    return null;
  }
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span>{row.creates}</span>
      {row.refusal !== null && (
        <span className="text-muted-foreground">Held back: {row.refusal}</span>
      )}
    </span>
  );
}

function ReadySourcesCell({ row }: AdminCellSlotProps<ReadyRow>) {
  return row ? <span className="text-muted-foreground">{row.sources}</span> : null;
}

const readyColumns: AdminColumnDef<ReadyRow>[] = [
  { header: "Card", width: "w-72", sortValue: (row) => row.cardName, cell: <ReadyCardCell /> },
  { header: "Would create", wrap: true, sortValue: (row) => row.creates, cell: <CreatesCell /> },
  {
    header: "From",
    width: "w-56",
    wrap: true,
    sortValue: (row) => row.sources,
    cell: <ReadySourcesCell />,
  },
];

function ReadyTable({
  reviewCards,
  query,
  toolbarStart,
}: {
  reviewCards: readonly ReviewCard[];
  query: string;
  toolbarStart: ReactNode;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const { data: preview } = useQuery(readyPreviewQueryOptions());
  const acceptCards = useBatchRun("trusted-cards");
  const acceptPrintings = useBatchRun("trusted-printings");
  const [result, setResult] = useState<{ done: number; skipped: BatchReason[] } | null>(null);

  const all = preview ? buildReadyRows(reviewCards, preview.cards, preview.printings) : [];
  const rows = selectReadyRows(all, query);
  const keys = readyBatchKeys(rows);
  const count = keys.cards.length + keys.printings.length;
  const heldBack = rows.length - count;
  const pending = acceptCards.isPending || acceptPrintings.isPending;

  async function accept(signal: AbortSignal) {
    let done = 0;
    const skipped: BatchReason[] = [];
    if (keys.cards.length > 0) {
      const outcome = await acceptCards.mutateAsync(keys.cards, { signal });
      done += outcome.done;
      skipped.push(...outcome.skipped);
    }
    if (keys.printings.length > 0) {
      const outcome = await acceptPrintings.mutateAsync(keys.printings, { signal });
      done += outcome.done;
      skipped.push(...outcome.skipped);
    }
    setResult({ done, skipped });
  }

  return (
    <AdminTable
      topBar={(actions) => (
        <AdminPageTopBar
          title="Review"
          actions={
            <>
              {actions}
              <WorkspaceUndoButton />
            </>
          }
        />
      )}
      columns={readyColumns}
      data={rows}
      getRowKey={(row) => row.key}
      emptyText={
        all.length === 0
          ? "No trusted source has a new card or printing to accept."
          : "Nothing matches this search."
      }
      minWidth="min-w-[820px]"
      toolbar={
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {toolbarStart}
            <span className="text-muted-foreground flex-1 text-sm">
              {heldBack > 0 && `${heldBack} held back`}
            </span>
            <Button
              disabled={count === 0}
              pending={pending}
              onClick={() => void queueWrite(accept, { limit: "long" })}
            >
              Accept {count === 1 ? "this 1" : `these ${count}`}
            </Button>
          </div>
          {result !== null && (
            <div className="text-sm">
              <p>
                Created {result.done}.
                {result.skipped.length > 0 &&
                  ` ${countNoun(result.skipped.length, "row")} skipped:`}
              </p>
              {result.skipped.length > 0 && (
                <ul className="text-muted-foreground">
                  {result.skipped.map((entry) => (
                    <li key={entry.key}>
                      {entry.label}: {entry.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      }
    />
  );
}

export function ReviewPage() {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const { data } = useQuery(reviewCardsQueryOptions());
  const { data: access } = useAdminAccess();
  const isAdmin = access?.isAdmin === true;
  const query = search.q ?? "";
  const all = data?.cards ?? [];
  const cards = selectReviewCards(all, query);
  const { data: preview } = useQuery({ ...readyPreviewQueryOptions(), enabled: isAdmin });
  const readyCount = (preview?.cards.count ?? 0) + (preview?.printings.count ?? 0);
  const ready = isAdmin && search.only === "ready";

  const toolbarStart = (
    <>
      <DebouncedSearchInput
        urlValue={query}
        placeholder="Search cards or sources…"
        className="w-64"
        onCommit={(next) => {
          void navigate({
            replace: true,
            search: (prev) => ({ ...prev, q: next === "" ? undefined : next }),
          });
        }}
      />
      {isAdmin && (
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[ready ? "ready" : "all"]}
          aria-label="Show"
          onValueChange={([next]) => {
            if (next !== undefined) {
              void navigate({
                replace: true,
                search: (prev) => ({ ...prev, only: next === "ready" ? "ready" : undefined }),
              });
            }
          }}
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          <ToggleGroupItem value="ready">Ready to accept {readyCount}</ToggleGroupItem>
        </ToggleGroup>
      )}
    </>
  );

  if (ready) {
    return <ReadyTable reviewCards={all} query={query} toolbarStart={toolbarStart} />;
  }

  return (
    <AdminTable
      topBar={(actions) => (
        <AdminPageTopBar
          title="Review"
          actions={
            <>
              {actions}
              <WorkspaceUndoButton />
            </>
          }
        />
      )}
      columns={reviewColumns}
      data={cards}
      getRowKey={(card) => card.key}
      emptyText={all.length === 0 ? "Nothing waiting for review." : "No card matches this search."}
      minWidth="min-w-[820px]"
      toolbar={
        <div className="flex flex-wrap items-center gap-3">
          {toolbarStart}
          <span className="text-muted-foreground text-sm">{countNoun(all.length, "card")}</span>
        </div>
      }
    />
  );
}
