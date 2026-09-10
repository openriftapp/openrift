import type { CreateCardFromCandidateResponse } from "@openrift/shared/contracts/admin/catalog-review";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import type {
  CandidatePrintingResponse,
  UnmatchedCardDetailResponse,
} from "@openrift/shared/types/api/admin";
import { useHotkey } from "@tanstack/react-hotkeys";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PageTopBarBack, PageTopBarIconButton } from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-list";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { useAllCards, useUnmatchedCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { useProviderSettings } from "@/features/admin/hooks/use-provider-settings";
import { useAdminCardSearch } from "@/features/cards/hooks/use-card-search";
import { DraftCardFieldsForm } from "@/features/catalog-admin/components/draft-card-fields";
import type { PrintingOverrides } from "@/features/catalog-admin/components/draft-printing-row";
import { DraftPrintingRow } from "@/features/catalog-admin/components/draft-printing-row";
import { RejectSubmissionDialog } from "@/features/catalog-admin/components/reject-submission-dialog";
import type { CardsListWalk } from "@/features/catalog-admin/hooks/use-cards-list-walk";
import { useCardsListWalk } from "@/features/catalog-admin/hooks/use-cards-list-walk";
import { useCreateCardFromCandidate } from "@/features/catalog-admin/hooks/use-catalog-review";
import { catalogCardKey } from "@/features/catalog-admin/lib/catalog-card-list";
import type {
  DraftCardFields,
  DraftPrintingRow as DraftPrintingRowData,
} from "@/features/catalog-admin/lib/draft-prefill";
import {
  buildDraftPrefill,
  buildDraftPrintingRows,
  draftRulesText,
  missingDraftFields,
  toCreateCardBody,
} from "@/features/catalog-admin/lib/draft-prefill";
import type { RequiredPrintingField } from "@/features/catalog-admin/lib/printing-fields";
import { buildPrintingFieldsFromCandidate } from "@/features/catalog-admin/lib/printing-fields";

const routeApi = getRouteApi("/_app/_authenticated/admin/catalog/drafts/$name");

type DraftBackTarget = "/admin/catalog/review" | "/admin/catalog/cards";

function AdminDraftTopBar({
  title,
  backTo,
  badge,
  walk,
}: {
  title: string;
  backTo?: DraftBackTarget;
  badge?: React.ReactNode;
  walk?: CardsListWalk;
}) {
  return (
    <AdminPageTopBar
      title={
        badge ? (
          <span className="flex items-center gap-2">
            {title}
            {badge}
          </span>
        ) : (
          title
        )
      }
      back={
        backTo ? (
          <PageTopBarBack
            to={backTo}
            aria-label={backTo === "/admin/catalog/cards" ? "Back to cards" : "Back to review"}
          />
        ) : undefined
      }
      actions={
        walk ? (
          <>
            <PageTopBarIconButton
              aria-label="Previous card"
              disabled={!walk.hasPrev}
              onClick={() => walk.go("prev")}
            >
              <ChevronLeftIcon />
            </PageTopBarIconButton>
            <PageTopBarIconButton
              aria-label="Next card"
              disabled={!walk.hasNext}
              onClick={() => walk.go("next")}
            >
              <ChevronRightIcon />
            </PageTopBarIconButton>
          </>
        ) : undefined
      }
    />
  );
}

function DraftPrintingSection({
  rows,
  skipped,
  overrides,
  onToggle,
  onOverride,
}: {
  rows: DraftPrintingRowData[];
  skipped: ReadonlySet<string>;
  overrides: Record<string, PrintingOverrides>;
  onToggle: (candidateId: string) => void;
  onOverride: (candidateId: string, field: RequiredPrintingField, value: string) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Printings in this proposal</h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">This proposal carries no printings.</p>
      ) : (
        <CardList>
          {rows.map((row) => (
            <DraftPrintingRow
              key={row.candidate.id}
              candidate={row.candidate}
              sourceCount={row.sourceCount}
              isTicked={!skipped.has(row.candidate.id)}
              overrides={overrides[row.candidate.id] ?? {}}
              onToggle={() => onToggle(row.candidate.id)}
              onOverride={(field, value) => onOverride(row.candidate.id, field, value)}
            />
          ))}
        </CardList>
      )}
    </section>
  );
}

export function DraftCardPage({ name }: { name: string }) {
  const navigate = useNavigate();
  const search = routeApi.useSearch();
  const { data: detail, isLoading } = useUnmatchedCardDetail(name) as {
    data: UnmatchedCardDetailResponse | undefined;
    isLoading: boolean;
  };
  const { data: providerSettingsData } = useProviderSettings();
  const { data: allCards } = useAllCards();
  const createCard = useCreateCardFromCandidate({ draftName: name });

  const [edits, setEdits] = useState<DraftCardFields | null>(null);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => new Set());
  const [overrides, setOverrides] = useState<Record<string, PrintingOverrides>>({});
  const [rejecting, setRejecting] = useState(false);

  const nameMatches = useAdminCardSearch(allCards, name);
  const fromCards = search.from === "cards";
  const backTo: DraftBackTarget | undefined = fromCards
    ? "/admin/catalog/cards"
    : search.from === "review"
      ? "/admin/catalog/review"
      : undefined;

  const listWalk = useCardsListWalk({
    enabled: fromCards,
    key: catalogCardKey({ cardSlug: null, normName: name }),
    search,
  });
  // oxlint-disable-next-line no-empty-function -- default no-op until the effect below installs the real handler
  const walkRef = useRef<(direction: "prev" | "next") => void>(() => {});
  useHotkey("Mod+ArrowLeft", () => walkRef.current("prev"), { enabled: fromCards });
  useHotkey("Mod+ArrowRight", () => walkRef.current("next"), { enabled: fromCards });
  useEffect(() => {
    walkRef.current = (direction) => listWalk.go(direction);
  });
  const walk = fromCards ? listWalk : undefined;

  if (isLoading || !detail) {
    return (
      <>
        <AdminDraftTopBar title={name} backTo={backTo} walk={walk} />
        <div className="pt-3">
          <Skeleton className="h-96 w-full" />
        </div>
      </>
    );
  }

  const providerSettings = providerSettingsData.providerSettings;
  const prefill = buildDraftPrefill(detail, providerSettings);
  const fields = edits ?? prefill;
  const rows = buildDraftPrintingRows(detail);
  const chosen = rows.filter((row) => !skipped.has(row.candidate.id));
  const missing = missingDraftFields(fields);
  const closestMatch = nameMatches.at(0);
  const closest = closestMatch ? allCards.find((card) => card.id === closestMatch.id) : undefined;

  const submissionSource = detail.sources.find(
    (source) => source.provider === USER_SUBMISSION_PROVIDER,
  );
  const candidateCardId = submissionSource?.id ?? detail.sources.at(0)?.id ?? null;

  function printingFieldsFor(candidate: CandidatePrintingResponse) {
    return buildPrintingFieldsFromCandidate(candidate, overrides[candidate.id] ?? {});
  }

  async function handleCreate() {
    if (missing.length > 0 || candidateCardId === null) {
      return;
    }
    // Errors are reported by the global mutation error toast.
    const created: CreateCardFromCandidateResponse | null = await createCard
      .mutateAsync({
        candidateCardId,
        cardFields: toCreateCardBody(fields),
        printings: chosen.map((row) => ({
          candidatePrintingId: row.candidate.id,
          printingFields: printingFieldsFor(row.candidate),
        })),
        images: chosen
          .filter((row) => row.candidate.imageUrl !== null)
          .map((row) => ({ candidatePrintingId: row.candidate.id })),
      })
      .catch(() => null);
    if (created === null) {
      return;
    }
    void navigate({
      to: "/admin/catalog/cards/$cardSlug",
      params: { cardSlug: created.cardSlug },
      search: {},
    });
  }

  return (
    <>
      <AdminDraftTopBar
        title={detail.displayName}
        backTo={backTo}
        walk={walk}
        badge={<Badge variant="violet">Draft</Badge>}
      />

      <div className="space-y-6 pt-3">
        <p className="text-muted-foreground text-sm">Nothing is live yet.</p>

        <p className="text-sm">
          {closest ? (
            <>
              Closest existing card:{" "}
              <Link
                to="/admin/catalog/cards/$cardSlug"
                params={{ cardSlug: closest.slug }}
                className="text-primary hover:underline"
              >
                {closest.name}
              </Link>
            </>
          ) : (
            "No existing card matches this name."
          )}
        </p>

        <DraftCardFieldsForm
          fields={fields}
          suggestedId={detail.defaultCardId}
          rulesText={draftRulesText(detail, providerSettings)}
          onChange={(next) => setEdits({ ...fields, ...next })}
        />

        <DraftPrintingSection
          rows={rows}
          skipped={skipped}
          overrides={overrides}
          onToggle={(candidateId) =>
            setSkipped((prev) => {
              const next = new Set(prev);
              if (next.has(candidateId)) {
                next.delete(candidateId);
              } else {
                next.add(candidateId);
              }
              return next;
            })
          }
          onOverride={(candidateId, field, value) =>
            setOverrides((prev) => ({
              ...prev,
              [candidateId]: { ...prev[candidateId], [field]: value },
            }))
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          {submissionSource && (
            <Button variant="ghost" className="text-destructive" onClick={() => setRejecting(true)}>
              Reject…
            </Button>
          )}
          <div className="ml-auto flex items-center gap-3">
            {missing.length > 0 && (
              <p className="text-destructive text-xs">Fill in {missing.join(", ")} first.</p>
            )}
            <Button
              disabled={missing.length > 0 || candidateCardId === null || createCard.isPending}
              onClick={() => void handleCreate()}
            >
              {chosen.length === 0
                ? "Create card"
                : `Create card with ${chosen.length} printing${chosen.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </div>

      <RejectSubmissionDialog
        candidateCardId={rejecting && submissionSource ? submissionSource.id : null}
        submitterName={submissionSource?.submittedByName ?? null}
        kindLabel="New card"
        scope={{ draftName: name }}
        onOpenChange={(open) => {
          if (!open) {
            setRejecting(false);
          }
        }}
        onRejected={() => void navigate({ to: "/admin/catalog/review", search: {} })}
      />
    </>
  );
}
