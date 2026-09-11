import { matchesCardQuery } from "@openrift/shared/card-search";
import { formatRelativeTime } from "@openrift/shared/format-date";
import type { CandidateCardSummaryResponse } from "@openrift/shared/types/api/admin";
import { formatShortCodesArray } from "@openrift/shared/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ImagePlusIcon, LoaderIcon, StarIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AdminTable } from "@/features/admin/components/admin-table";
import type { AdminCellSlotProps, AdminColumnDef } from "@/features/admin/components/admin-table";
import { CardNameCell } from "@/features/admin/components/card-name-cell";
import { DebouncedSearchInput } from "@/features/admin/components/debounced-search-input";
import { DraftRowActions } from "@/features/admin/components/draft-row-actions";
import {
  acceptFavoritesFn,
  useAcceptFavoritePrintings,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useAllCards } from "@/features/admin/hooks/use-admin-card-queries";
import type { AdminCardListStatus } from "@/features/admin/hooks/use-card-review-navigation";
import { useCardsTableSort } from "@/features/admin/hooks/use-cards-table-sort";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { CardIssue } from "@/features/admin/lib/card-attention";
import {
  ANY_ISSUE,
  CARD_ISSUE_LABELS,
  CARD_ISSUES,
  cardAttentionBadges,
  hasIssue,
  needsAttention,
} from "@/features/admin/lib/card-attention";
import type { AdminSearchableCard } from "@/features/cards/hooks/use-card-search";
import {
  ALL_ASSIGNABLE_SCOPE,
  bucketScopeKey,
  scopeLabel,
  unlinkedProductCount,
} from "@/features/cards/lib/marketplace-coverage";
import type { PriceAssignBucket } from "@/features/cards/lib/marketplace-coverage";

const cardsRouteApi = getRouteApi("/_app/_authenticated/admin/cards");

const ROW_HEIGHT = 41;

export const ALL_SETS = "__all__";

type Row = CandidateCardSummaryResponse;

/** "unchecked" stays on the list: the detail page has its own flow for it. */
function detailStatusFor(issue: CardIssue | undefined): AdminCardListStatus | undefined {
  if (issue === "unlinked-products") {
    return "prices-to-assign";
  }
  if (issue === "new-printings") {
    return "new-printings";
  }
  return undefined;
}

/** Older links carry this filter as `status` or `source`. */
function readIssue(search: {
  issue?: CardIssue;
  status?: "unchecked" | "new-printings" | "prices-to-assign";
  source?: "usersubmission";
}): CardIssue | undefined {
  if (search.issue) {
    return search.issue;
  }
  if (search.status === "unchecked") {
    return "unchecked-source";
  }
  if (search.status === "new-printings") {
    return "new-printings";
  }
  if (search.status === "prices-to-assign") {
    return "unlinked-products";
  }
  if (search.source === "usersubmission") {
    return "proposals";
  }
  return undefined;
}

function readSegment(tab: string | undefined): CardSegment | null {
  // "candidates" is the older value for the drafts tab.
  if (tab === "candidates") {
    return "drafts";
  }
  return CARD_SEGMENTS.find((option) => option === tab) ?? null;
}

/** The filter's set options arrive in release order, so their index is the rank. */
function describeSets(
  slugs: string[],
  sets: Map<string, { label: string; rank: number }>,
): { label: string; all: string; rank: number } {
  const ranked = slugs
    .map((slug) => sets.get(slug) ?? { label: slug, rank: Number.MAX_SAFE_INTEGER })
    .toSorted((a, b) => a.rank - b.rank);

  return {
    label: ranked.at(0)?.label ?? "",
    all: ranked.map((entry) => entry.label).join(", "),
    rank: ranked.at(0)?.rank ?? Number.MAX_SAFE_INTEGER,
  };
}

const CARD_SEGMENTS = ["attention", "drafts"] as const;

export type CardSegment = (typeof CARD_SEGMENTS)[number];

interface CardsRow {
  card: Row;
  sets: { label: string; all: string; rank: number };
  printingCount: number;
  detailSearch: { set?: string; status?: AdminCardListStatus; priceScope?: string };
  unlinked: number;
  allCards: AdminSearchableCard[];
  isAdmin: boolean;
}

const SORT_VALUES: Record<string, (row: CardsRow) => string | number> = {
  name: (row) => row.card.name,
  set: (row) => row.sets.rank,
  printings: (row) => row.printingCount,
  updated: (row) => row.card.updatedAt,
};

function AcceptFavoriteButton({ cardSlug, codes }: { cardSlug: string; codes: string[] }) {
  const acceptFavorite = useAcceptFavoritePrintings();
  const title = `Accept ${codes.length} trusted printing${codes.length === 1 ? "" : "s"}: ${formatShortCodesArray(codes).join(", ")}`;

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={acceptFavorite.isPending}
      aria-label={title}
      title={title}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        acceptFavorite.mutate(cardSlug, {
          onSuccess: (data) => {
            const result = data as {
              printingsCreated: number;
              skipped: { shortCode: string; reason: string }[];
            };
            if (result.printingsCreated > 0 && result.skipped.length === 0) {
              toast.success(
                `Accepted ${result.printingsCreated} printing${result.printingsCreated === 1 ? "" : "s"}`,
              );
            } else if (result.printingsCreated > 0 && result.skipped.length > 0) {
              toast.warning(
                `Accepted ${result.printingsCreated}, skipped ${result.skipped.length}: ${result.skipped.map((s) => `${s.shortCode} (${s.reason})`).join(", ")}`,
              );
            } else if (result.skipped.length > 0) {
              toast.error(
                `All skipped: ${result.skipped.map((s) => `${s.shortCode} (${s.reason})`).join(", ")}`,
              );
            } else {
              toast.info("No printings to accept");
            }
          },
        });
      }}
    >
      {acceptFavorite.isPending ? <LoaderIcon className="animate-spin" /> : <StarIcon />}
      {codes.length}
    </Button>
  );
}

function NameCell({ row }: AdminCellSlotProps<CardsRow>) {
  if (!row) {
    return null;
  }
  const card = row.card;

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {card.cardSlug === null ? (
        <CardNameCell row={card} />
      ) : (
        <Link
          to="/admin/cards/$cardSlug"
          params={{ cardSlug: card.cardSlug }}
          search={row.detailSearch}
          className="font-medium hover:underline"
        >
          {card.name}
        </Link>
      )}
      {card.cardSlug === null && <Badge variant="violet">Draft</Badge>}
    </span>
  );
}

function SetCell({ row }: AdminCellSlotProps<CardsRow>) {
  if (!row) {
    return null;
  }
  return (
    <span className="text-muted-foreground block truncate" title={row.sets.all}>
      {row.sets.label === "" ? "—" : row.sets.label}
    </span>
  );
}

function PrintingCountCell({ row }: AdminCellSlotProps<CardsRow>) {
  if (!row) {
    return null;
  }
  return <span className="text-muted-foreground">{row.printingCount}</span>;
}

function AttentionCell({ row }: AdminCellSlotProps<CardsRow>) {
  if (!row) {
    return null;
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {cardAttentionBadges(row.card, row.unlinked).map((badge) => (
        <Badge key={badge.key} variant={badge.tone} title={badge.title}>
          {badge.label}
        </Badge>
      ))}
    </span>
  );
}

function UpdatedCell({ row }: AdminCellSlotProps<CardsRow>) {
  if (!row) {
    return null;
  }
  return (
    <span className="text-muted-foreground text-xs">{formatRelativeTime(row.card.updatedAt)}</span>
  );
}

function RowActions({ row }: AdminCellSlotProps<CardsRow>) {
  if (!row || !row.isAdmin) {
    return null;
  }
  const card = row.card;

  if (card.cardSlug === null) {
    return <DraftRowActions row={card} allCards={row.allCards} />;
  }

  if (card.favoriteStagingShortCodes.length === 0) {
    return null;
  }
  return <AcceptFavoriteButton cardSlug={card.cardSlug} codes={card.favoriteStagingShortCodes} />;
}

function buildColumns(): AdminColumnDef<CardsRow>[] {
  return [
    {
      header: "Card",
      id: "name",
      sortKey: "name",
      width: "w-[26%]",
      wrap: true,
      cell: <NameCell />,
    },
    {
      header: "First appearance",
      id: "set",
      sortKey: "set",
      width: "w-[18%]",
      cell: <SetCell />,
    },
    {
      header: "Printings",
      id: "printings",
      sortKey: "printings",
      width: "w-[6rem]",
      align: "right",
      cell: <PrintingCountCell />,
    },
    {
      header: "Attention",
      id: "attention",
      wrap: true,
      cell: <AttentionCell />,
    },
    {
      header: "Updated",
      id: "updated",
      sortKey: "updated",
      width: "w-24",
      align: "right",
      cell: <UpdatedCell />,
    },
  ];
}

export function AdminCardsTable({
  data,
  assignBucketsBySlug,
  setOptions,
  isAdmin,
}: {
  data: Row[];
  assignBucketsBySlug: Map<string, PriceAssignBucket[]>;
  setOptions: { value: string; label: string }[];
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: allCards } = useAllCards();
  const [acceptAllProgress, setAcceptAllProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  const navigate = cardsRouteApi.useNavigate();
  const { globalFilter, segment, setSlug, issue, priceScope } = cardsRouteApi.useSearch({
    select: (s) => ({
      globalFilter: s.q ?? "",
      segment: readSegment(s.tab),
      setSlug: s.set,
      issue: readIssue(s),
      priceScope: s.priceScope ?? ALL_ASSIGNABLE_SCOPE,
    }),
  });
  const { serverSort, sortRows } = useCardsTableSort(SORT_VALUES, "name");

  const priceFilterActive = issue === "unlinked-products";
  const detailStatus = detailStatusFor(issue);
  // The detail page's prev/next walks only rows matching this filter.
  const detailSearch = {
    ...(setSlug ? { set: setSlug } : {}),
    ...(detailStatus ? { status: detailStatus } : {}),
    ...(priceFilterActive && priceScope !== ALL_ASSIGNABLE_SCOPE ? { priceScope } : {}),
  };

  const draftCount = data.filter((r) => r.cardSlug === null).length;

  const acceptableCards = data.filter((r) => !r.cardSlug && r.hasFavorite).length;

  function unlinkedFor(slug: string | null, scope: string): number {
    return unlinkedProductCount(slug ? assignBucketsBySlug.get(slug) : undefined, scope);
  }

  const scopeCardCounts = new Map<string, number>();
  for (const row of data) {
    const buckets = row.cardSlug ? assignBucketsBySlug.get(row.cardSlug) : undefined;
    if (!buckets) {
      continue;
    }
    const seen = new Set<string>();
    for (const bucket of buckets) {
      if (bucket.unbound === 0) {
        continue;
      }
      const key = bucketScopeKey(bucket);
      if (!seen.has(key)) {
        seen.add(key);
        scopeCardCounts.set(key, (scopeCardCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const allAssignableCount = data.filter(
    (r) => unlinkedFor(r.cardSlug, ALL_ASSIGNABLE_SCOPE) > 0,
  ).length;

  const scopeOrder = (key: string) => {
    if (key.startsWith("cardmarket")) {
      return `0:${key}`;
    }
    if (key.startsWith("tcgplayer")) {
      return `1:${key}`;
    }
    return `2:${key}`;
  };
  const scopeItems = [
    {
      value: ALL_ASSIGNABLE_SCOPE,
      label: `${scopeLabel(ALL_ASSIGNABLE_SCOPE)} (${allAssignableCount})`,
    },
    ...[...scopeCardCounts.keys()]
      .toSorted((a, b) => scopeOrder(a).localeCompare(scopeOrder(b)))
      .map((key) => ({
        value: key,
        label: `${scopeLabel(key)} (${scopeCardCounts.get(key) ?? 0})`,
      })),
  ];

  const issueCounts: Record<CardIssue, number> = {
    proposals: data.filter((r) => r.pendingSubmissions > 0).length,
    "new-printings": data.filter((r) => r.unlinkedTrustedPrintingCount > 0).length,
    "unlinked-products": data.filter((r) => unlinkedFor(r.cardSlug, priceScope) > 0).length,
    "unchecked-source": data.filter((r) => r.uncheckedTrustedProviders.length > 0).length,
  };
  const attentionCount = data.filter((r) =>
    needsAttention(r, unlinkedFor(r.cardSlug, priceScope)),
  ).length;
  // The active filter stays listed even once nothing matches it, or the trigger
  // would go blank while the table silently stayed filtered.
  const offeredIssues = CARD_ISSUES.filter(
    (option) =>
      option === issue || option !== "unlinked-products" || (isAdmin && scopeCardCounts.size > 0),
  );
  const issueItems = [
    { value: ANY_ISSUE, label: "Any issue" },
    ...offeredIssues.map((option) => ({
      value: option,
      label: `${CARD_ISSUE_LABELS[option]} (${issueCounts[option]})`,
    })),
  ];

  function changeIssue(next: CardIssue | null) {
    void navigate({
      search: (prev) => ({
        ...prev,
        issue: next ?? undefined,
        // The legacy params feed the same filter, so clearing one clears both.
        status: undefined,
        source: undefined,
        priceScope: next === "unlinked-products" ? prev.priceScope : undefined,
      }),
      replace: true,
    });
  }

  function changeSegment(next: CardSegment | null) {
    void navigate({ search: (prev) => ({ ...prev, tab: next ?? undefined }), replace: true });
  }

  function changeSet(value: string | null) {
    void navigate({
      search: (prev) => ({
        ...prev,
        set: value === null || value === ALL_SETS ? undefined : value,
      }),
      replace: true,
    });
  }

  function changePriceScope(value: string | null) {
    void navigate({
      search: (prev) => ({
        ...prev,
        priceScope: value && value !== ALL_ASSIGNABLE_SCOPE ? value : undefined,
      }),
      replace: true,
    });
  }

  function commitQuery(next: string) {
    void navigate({
      search: (prev) => ({ ...prev, q: next === "" ? undefined : next }),
      replace: true,
    });
  }

  const acceptAllCards = useMutation({
    mutationFn: async (names: string[]) => {
      let done = 0;
      let failed = 0;
      setAcceptAllProgress({ done: 0, total: names.length });

      for (const name of names) {
        try {
          await acceptFavoritesFn({ data: { name } });
        } catch {
          failed++;
        }
        done++;
        setAcceptAllProgress({ done, total: names.length });
      }

      setAcceptAllProgress(null);
      return { accepted: done - failed, failed };
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: [...adminKeys.cards.all] });
      if (result.failed === 0) {
        toast.success(`Accepted ${result.accepted} new cards`);
      } else {
        toast.warning(`Accepted ${result.accepted}, failed ${result.failed}`);
      }
    },
  });

  const progressLabel = acceptAllProgress
    ? `${acceptAllProgress.done}/${acceptAllProgress.total}`
    : "...";

  const visible = data.filter((card) => {
    if (segment === "drafts" && card.cardSlug !== null) {
      return false;
    }
    if (segment === "attention" && !needsAttention(card, unlinkedFor(card.cardSlug, priceScope))) {
      return false;
    }
    if (issue !== undefined && !hasIssue(card, issue, unlinkedFor(card.cardSlug, priceScope))) {
      return false;
    }
    if (globalFilter === "") {
      return true;
    }
    return matchesCardQuery(globalFilter, [
      card.name,
      ...card.shortCodes,
      ...card.stagingShortCodes,
    ]);
  });

  const setsBySlug = new Map(
    setOptions.map((option, index) => [option.value, { label: option.label, rank: index }]),
  );
  const rows = sortRows(
    visible.map((card) => ({
      card,
      sets: describeSets(card.setSlugs, setsBySlug),
      unlinked: unlinkedFor(card.cardSlug, priceScope),
      printingCount:
        card.cardSlug === null ? card.stagingShortCodes.length : card.shortCodes.length,
      detailSearch,
      allCards,
      isAdmin,
    })),
  );

  return (
    <AdminTable
      columns={buildColumns()}
      data={rows}
      getRowKey={(row) => row.card.cardSlug ?? row.card.name}
      emptyText="No cards found."
      serverSort={serverSort}
      virtualize={{ rowHeight: ROW_HEIGHT }}
      minWidth="min-w-[720px]"
      rowClassName={(row) => (row.card.cardSlug === null ? "bg-violet-soft" : undefined)}
      actions={<RowActions />}
      toolbar={
        <div className="flex flex-wrap items-center gap-3">
          <DebouncedSearchInput
            urlValue={globalFilter}
            onCommit={commitQuery}
            placeholder="Search by name or code…"
            className="w-56"
          />

          <ToggleGroup
            variant="outline"
            spacing={0}
            value={[segment ?? "all"]}
            aria-label="Card segment"
            onValueChange={([next]) => {
              changeSegment(CARD_SEGMENTS.find((option) => option === next) ?? null);
            }}
          >
            <ToggleGroupItem value="all">All ({data.length})</ToggleGroupItem>
            <ToggleGroupItem value="attention">Needs attention ({attentionCount})</ToggleGroupItem>
            <ToggleGroupItem value="drafts">Drafts ({draftCount})</ToggleGroupItem>
          </ToggleGroup>

          <Select items={setOptions} value={setSlug ?? ALL_SETS} onValueChange={changeSet}>
            <SelectTrigger aria-label="Filter by set" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {setOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            items={issueItems}
            value={issue ?? ANY_ISSUE}
            onValueChange={(value: string | null) => {
              changeIssue(CARD_ISSUES.find((option) => option === value) ?? null);
            }}
          >
            <SelectTrigger aria-label="Issue" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {issueItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {priceFilterActive && (
            <Select items={scopeItems} value={priceScope} onValueChange={changePriceScope}>
              <SelectTrigger aria-label="Marketplace scope" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scopeItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {isAdmin && acceptableCards > 0 && (
            <Button
              variant="outline"
              disabled={acceptAllCards.isPending}
              onClick={() => {
                const names = data
                  .filter((r) => !r.cardSlug && r.hasFavorite)
                  .map((r) => r.normalizedName);
                acceptAllCards.mutate(names);
              }}
            >
              {acceptAllCards.isPending ? (
                <>
                  <LoaderIcon className="size-3 animate-spin" />
                  {progressLabel}
                </>
              ) : (
                <>
                  <ImagePlusIcon className="size-3" />
                  Accept new cards ({acceptableCards})
                </>
              )}
            </Button>
          )}

          <p className="text-muted-foreground ml-auto text-sm">
            {rows.length} card{rows.length === 1 ? "" : "s"}
          </p>
        </div>
      }
    />
  );
}
