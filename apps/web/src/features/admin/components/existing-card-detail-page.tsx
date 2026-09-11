import { earliestRelease } from "@openrift/shared/set-release";
import type {
  AdminCardDetailResponse,
  AdminMarketplaceName,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRightIcon, PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { Heading } from "@/components/heading";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminCardMarketplaceSection } from "@/features/admin/components/admin-card-marketplace-section";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { CardAttentionSection } from "@/features/admin/components/card-attention-section";
import { CardBansSection } from "@/features/admin/components/card-bans-section";
import { CardDetailHeader } from "@/features/admin/components/card-detail-header";
import {
  buildSourceLabels,
  useCardDetailData,
} from "@/features/admin/components/card-detail-shared";
import { CardErrataSection } from "@/features/admin/components/card-errata-section";
import { CardFieldsSection } from "@/features/admin/components/card-fields-section";
import { CardHistorySection } from "@/features/admin/components/card-history-section";
import { CardOverviewSection } from "@/features/admin/components/card-overview-section";
import type { CardSectionCount } from "@/features/admin/components/card-section-nav";
import { CardSectionNav } from "@/features/admin/components/card-section-nav";
import { NewPrintingGroupCard } from "@/features/admin/components/new-printing-group-card";
import {
  PrintingFilterBar,
  usePrintingFilters,
} from "@/features/admin/components/printing-filter-bar";
import { PrintingLanguageHeader } from "@/features/admin/components/printing-language-header";
import { PrintingReviewCard } from "@/features/admin/components/printing-review-card";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import {
  useAcceptPrintingGroup,
  useCopyCandidatePrinting,
  useDeleteCandidatePrinting,
  useLinkCandidatePrintings,
} from "@/features/admin/hooks/use-admin-card-mutations";
import type { AcceptPrintingBody } from "@/features/admin/hooks/use-admin-card-mutations";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { useCardReviewNavigation } from "@/features/admin/hooks/use-card-review-navigation";
import type { AdminCardListStatus } from "@/features/admin/hooks/use-card-review-navigation";
import { usePrintingsByLanguage } from "@/features/admin/hooks/use-printings-by-language";
import { unifiedMappingsForCardQueryOptions } from "@/features/admin/hooks/use-unified-mappings";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import {
  attentionCount,
  buildAttentionSources,
  buildAttentionSubmissions,
} from "@/features/admin/lib/attention-items";
import { buildPrintingGroups } from "@/features/admin/lib/candidate-printing-groups";
import type { CardSection } from "@/features/admin/lib/card-sections";
import { cardSectionsFor, DEFAULT_CARD_SECTION } from "@/features/admin/lib/card-sections";
import { buildOverviewSourceGroups } from "@/features/admin/lib/source-groups";
import {
  getStoredCollapsedPrintings,
  useAdminCardFoldStore,
} from "@/features/admin/stores/admin-card-fold-store";
import { useCardBans } from "@/features/cards/hooks/use-card-bans";
import { useSets } from "@/features/cards/hooks/use-sets";
import { useKeywordStyles } from "@/hooks/use-keyword-styles";

const MARKETPLACES = ["tcgplayer", "cardmarket", "cardtrader"] as const;

/** Stable placeholder so the filter hook can run before the detail lands. */
const NO_PRINTINGS: AdminPrintingResponse[] = [];

function MissingCard({ identifier, children }: { identifier: string; children: ReactNode }) {
  return (
    <>
      <AdminPageTopBar title={identifier} />
      <div className="space-y-2">
        <Heading level={2}>Card not found</Heading>
        <p className="text-muted-foreground text-sm">{children}</p>
      </div>
    </>
  );
}

/** Every printing and ambiguous-source group except the first printing, which stays open. */
function defaultCollapsedKeys(detail: AdminCardDetailResponse): string[] {
  const groups = buildPrintingGroups(detail.candidatePrintingGroups, detail.candidatePrintings);
  return [...detail.printings.slice(1).map((p) => p.id), ...groups.map((g) => g.groupKey)];
}

export function ExistingCardDetailPage({
  identifier,
  section,
  focusMarketplace,
  focusFinish,
  focusLanguage,
  setSlug,
  listStatus,
  priceScope,
}: {
  identifier: string;
  section?: CardSection;
  focusMarketplace?: AdminMarketplaceName;
  focusFinish?: string;
  focusLanguage?: string;
  setSlug?: string;
  listStatus?: AdminCardListStatus;
  priceScope?: string;
}) {
  const cardId = identifier;
  const { data: access } = useAdminAccess();
  // card-review grant holders keep the per-field accept flow and image finishing;
  // triage, printing create/delete, rename, bans, errata, and marketplace stay full-admin.
  const isAdmin = access?.isAdmin === true;

  // Only refetches this card's detail and the admin card list, not every query under `admin.cards`.
  const invalidateScope = [adminKeys.cards.detail(cardId), adminKeys.cards.list];

  const {
    data: existingData,
    isLoading,
    isError,
  } = useAdminCardDetail(identifier) as {
    data: AdminCardDetailResponse | undefined;
    isLoading: boolean;
    isError: boolean;
  };

  const { providerSettings, candidateCardFields, printingSourceFields, ignorePrintingSource } =
    useCardDetailData(invalidateScope);

  const acceptPrintingGroup = useAcceptPrintingGroup(invalidateScope);
  const copyPrintingSource = useCopyCandidatePrinting(invalidateScope);
  const deletePrintingSource = useDeleteCandidatePrinting(invalidateScope);
  const linkPrintingSources = useLinkCandidatePrintings(invalidateScope);
  const { data: setsData } = useSets();
  const keywordStyles = useKeywordStyles();

  const {
    prevNextCards,
    navSearch,
    isCheckingAll,
    checkAllAndNext,
    goToCard,
    goToList,
    checkAllCardSources,
  } = useCardReviewNavigation({
    identifier,
    detail: existingData,
    setSlug,
    listStatus,
    priceScope,
    isAdmin,
    invalidates: invalidateScope,
  });

  const storedCollapsedPrintings = useAdminCardFoldStore((state) =>
    getStoredCollapsedPrintings(state, cardId),
  );
  const togglePrintingFold = useAdminCardFoldStore((state) => state.togglePrinting);
  const expandPrintingFold = useAdminCardFoldStore((state) => state.expandPrinting);
  const setCollapsedForCard = useAdminCardFoldStore((state) => state.setCollapsedForCard);
  const initCollapsedForCard = useAdminCardFoldStore((state) => state.initCollapsedForCard);
  // A link from the list that focuses a marketplace variant means the printings.
  const requestedSection: CardSection =
    section ?? (focusMarketplace === undefined ? DEFAULT_CARD_SECTION : "printings");
  const sections = cardSectionsFor(isAdmin);
  const activeSection = sections.includes(requestedSection)
    ? requestedSection
    : DEFAULT_CARD_SECTION;
  const navigate = useNavigate();

  function goToSection(next: CardSection) {
    void navigate({
      to: "/admin/cards/$cardSlug",
      params: { cardSlug: identifier },
      search: { ...navSearch, section: next === DEFAULT_CARD_SECTION ? undefined : next },
    });
  }

  function revealPrinting(printingId: string) {
    goToSection("printings");
    expandPrintingFold(cardId, printingId);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-printing-id="${printingId}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
  function revealNewPrinting(candidatePrintingId: string) {
    if (!existingData) {
      return;
    }
    const group = buildPrintingGroups(
      existingData.candidatePrintingGroups,
      existingData.candidatePrintings,
    ).find((entry) => entry.candidates.some((candidate) => candidate.id === candidatePrintingId));
    if (!group) {
      return;
    }
    goToSection("printings");
    expandPrintingFold(cardId, group.groupKey);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-printing-group="${group.groupKey}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }
  const [agreedFieldsFolded, setAgreedFieldsFolded] = useState(true);
  const { filteredPrintings, filters } = usePrintingFilters(
    existingData?.printings ?? NO_PRINTINGS,
  );
  const printingsByLanguage = usePrintingsByLanguage(filteredPrintings);

  const { data: mappingsData } = useQuery({
    ...unifiedMappingsForCardQueryOptions(identifier),
    enabled: isAdmin,
  });
  const { data: bansData } = useCardBans(identifier);
  const attentionSubmissions = existingData ? buildAttentionSubmissions(existingData) : [];
  const attentionSources = existingData
    ? buildAttentionSources(existingData, providerSettings)
    : [];
  const attentionTotal = attentionCount(attentionSubmissions, attentionSources);
  const mappingGroup = mappingsData?.group ?? null;
  const unassignedProducts =
    mappingGroup === null
      ? 0
      : MARKETPLACES.reduce(
          (total, marketplace) => total + mappingGroup[marketplace].stagedProducts.length,
          0,
        );

  const pendingScrollTarget = useRef<string | null>(null);
  const focusHandledRef = useRef(false);

  // Seeding runs before the focus effects below, which reach into a seeded card
  // to open one row.
  useEffect(() => {
    if (!existingData) {
      return;
    }
    initCollapsedForCard(cardId, new Set(defaultCollapsedKeys(existingData)));
  }, [existingData, cardId, initCollapsedForCard]);

  useEffect(() => {
    const targetId = pendingScrollTarget.current;
    if (!targetId || !existingData) {
      return;
    }
    const printing = existingData.printings.find((p) => p.id === targetId);
    if (!printing) {
      return;
    }
    const id = printing.id;
    pendingScrollTarget.current = null;
    expandPrintingFold(cardId, id);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-printing-id="${id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [existingData, cardId, expandPrintingFold]);

  // Cardmarket rows apply to all siblings, so any matching finish works there;
  // other marketplaces also require a language match.
  useEffect(() => {
    if (focusHandledRef.current || !focusMarketplace || !focusFinish || !existingData) {
      return;
    }
    const printings = existingData.printings;
    if (printings.length === 0) {
      return;
    }
    const isLanguageAggregate = focusMarketplace === "cardmarket";
    const match =
      printings.find(
        (p) =>
          p.finish === focusFinish &&
          (isLanguageAggregate || !focusLanguage || p.language === focusLanguage),
      ) ??
      printings.find((p) => p.finish === focusFinish) ??
      null;
    if (!match) {
      return;
    }
    focusHandledRef.current = true;
    expandPrintingFold(cardId, match.id);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-printing-id="${match.id}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [existingData, focusMarketplace, focusFinish, focusLanguage, cardId, expandPrintingFold]);

  if (isError) {
    return (
      <MissingCard identifier={identifier}>
        No card with ID &ldquo;{identifier}&rdquo; exists.
      </MissingCard>
    );
  }

  if (isLoading || !existingData) {
    return (
      <>
        <AdminPageTopBar title={identifier} />
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64" />
        </div>
      </>
    );
  }

  const sources = existingData.sources;
  const candidatePrintings = existingData.candidatePrintings;
  const printings = existingData.printings;
  const printingImages = existingData.printingImages;
  const setTotals = existingData.setTotals ?? {};
  // Keyed both by set slug (earliest release, as a fallback) and by
  // `slug|LANGUAGE`, since a set reaches each language in its own year.
  const setReleaseYears: Record<string, number> = {};
  for (const set of setsData.sets) {
    for (const [language, release] of Object.entries(set.releases)) {
      if (release.releasedAt) {
        setReleaseYears[`${set.slug}|${language}`] = Number(release.releasedAt.slice(0, 4));
      }
    }
    const earliest = earliestRelease(set.releases);
    if (earliest?.releasedAt) {
      setReleaseYears[set.slug] = Number(earliest.releasedAt.slice(0, 4));
    }
  }
  const costKeywords = Object.entries(keywordStyles)
    .filter(([, entry]) => entry.costKeyword)
    .map(([name]) => name);
  const expectedCardId = existingData.expectedCardId;
  const card = existingData.card;
  if (!card) {
    return (
      <MissingCard identifier={identifier}>
        No card data for &ldquo;{identifier}&rdquo;.
      </MissingCard>
    );
  }
  const canonicalName = card.name;

  const {
    labels: sourceLabels,
    names: sourceNames,
    submitters: sourceSubmitters,
  } = buildSourceLabels(sources, canonicalName);

  const ambiguousGroups = buildPrintingGroups(
    existingData.candidatePrintingGroups,
    candidatePrintings,
  );

  const hasUnchecked =
    sources.some((s) => !s.checkedAt) || candidatePrintings.some((ps) => !ps.checkedAt);

  // Ids are what the audit log stores; History reads the printing ids off this.
  const printingLabelsById = Object.fromEntries(
    printings.map((printing) => [printing.id, printing.expectedPrintingId]),
  );

  const sectionCounts: Partial<Record<CardSection, CardSectionCount>> = {
    attention: { waiting: attentionTotal },
    fields: { waiting: sources.filter((source) => !source.checkedAt).length },
    printings: { total: printings.length, waiting: ambiguousGroups.length },
    marketplace: { waiting: unassignedProducts },
    bans: { total: (bansData?.length ?? 0) + (card.errata === null ? 0 : 1) },
  };

  const allPrintingKeys = [
    ...printings.map((p) => p.id),
    ...ambiguousGroups.map((g) => g.groupKey),
  ];
  // Until the seeding effect lands, read the folds the card is about to get.
  const collapsedPrintings =
    storedCollapsedPrintings ?? new Set(defaultCollapsedKeys(existingData));
  const allExpanded =
    allPrintingKeys.length > 0 && allPrintingKeys.every((k) => !collapsedPrintings.has(k));

  return (
    <div className="space-y-6 pt-3">
      <CardDetailHeader
        card={card}
        cardId={cardId}
        expectedCardId={expectedCardId}
        hasUnchecked={hasUnchecked}
        prevNextCards={prevNextCards}
        listSearch={navSearch}
        isCheckingAll={isCheckingAll}
        onCheckAllAndNext={() => void checkAllAndNext()}
        goToCard={goToCard}
        goToList={goToList}
        isAdmin={isAdmin}
      />

      <div className="grid grid-cols-1 gap-6 pt-3 md:grid-cols-[11rem_minmax(0,1fr)]">
        <CardSectionNav
          cardSlug={cardId}
          sections={sections}
          section={activeSection}
          counts={sectionCounts}
          search={{ ...navSearch }}
        />

        <div className="min-w-0 space-y-3">
          {activeSection === "overview" && (
            <CardOverviewSection
              detail={existingData}
              card={card as unknown as Record<string, unknown>}
              cardFields={candidateCardFields}
              sourceGroups={buildOverviewSourceGroups(existingData, providerSettings)}
              attentionCount={attentionTotal}
              invalidates={invalidateScope}
              isAdmin={isAdmin}
              onOpenPrinting={revealPrinting}
              onOpenAttention={() => goToSection("attention")}
            />
          )}

          {activeSection === "attention" &&
            (attentionTotal === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nothing needs a decision on this card.
              </p>
            ) : (
              <CardAttentionSection
                detail={existingData}
                cardSlug={cardId}
                compareAction={
                  <Button variant="ghost" onClick={() => goToSection("fields")}>
                    Card fields
                  </Button>
                }
                onOpenNewPrinting={revealNewPrinting}
                printingFields={printingSourceFields}
                providerLabels={sourceLabels}
              />
            ))}

          {activeSection === "fields" && (
            <CardFieldsSection
              card={card}
              sources={sources}
              candidateCardFields={candidateCardFields}
              providerSettings={providerSettings}
              onCheckAllSources={() => checkAllCardSources.mutate(card.id)}
              isCheckingAllSources={checkAllCardSources.isPending}
              invalidates={invalidateScope}
              isAdmin={isAdmin}
            />
          )}

          {activeSection === "marketplace" && (
            <AdminCardMarketplaceSection cardId={identifier} onOpenPrinting={revealPrinting} />
          )}

          {activeSection === "printings" && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                <PrintingFilterBar
                  {...filters}
                  agreedFieldsFolded={agreedFieldsFolded}
                  onAgreedFieldsFoldedChange={setAgreedFieldsFolded}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCollapsedForCard(cardId, allExpanded ? new Set(allPrintingKeys) : new Set());
                  }}
                >
                  {allExpanded ? "Collapse all" : "Expand all"}
                </Button>
                {isAdmin && (
                  <Button
                    variant="default"
                    size="sm"
                    render={
                      <Link
                        to="/admin/cards/$cardSlug/printings/create"
                        params={{ cardSlug: cardId }}
                      />
                    }
                  >
                    <PlusIcon />
                    Create printing
                  </Button>
                )}
              </div>
              {filteredPrintings.length > 0 && (
                <div className="overflow-hidden rounded-md border">
                  {printingsByLanguage.map(([language, languagePrintings]) => (
                    <div key={language}>
                      <PrintingLanguageHeader code={language} />
                      {languagePrintings.map((printing) => (
                        <PrintingReviewCard
                          key={printing.id}
                          printing={printing}
                          cardId={cardId}
                          printings={printings}
                          candidatePrintings={candidatePrintings}
                          printingImages={printingImages}
                          sourceLabels={sourceLabels}
                          sourceNames={sourceNames}
                          sourceSubmitters={sourceSubmitters}
                          providerSettings={providerSettings}
                          printingSourceFields={printingSourceFields}
                          setTotals={setTotals}
                          costKeywords={costKeywords}
                          invalidates={invalidateScope}
                          defaultExpanded={printing.id === printings[0]?.id}
                          isAdmin={isAdmin}
                          agreedFieldsFolded={agreedFieldsFolded}
                          onAgreedFieldsFoldedChange={setAgreedFieldsFolded}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {isAdmin &&
                ambiguousGroups.length > 0 &&
                (() => {
                  const matchable = ambiguousGroups.filter((g) =>
                    printings.some((p) => p.expectedPrintingId === g.expectedPrintingId),
                  );
                  if (matchable.length < 2) {
                    return null;
                  }
                  return (
                    <div className="flex items-center">
                      <Button
                        variant="default"
                        size="sm"
                        disabled={linkPrintingSources.isPending}
                        onClick={() => {
                          for (const g of matchable) {
                            const match = printings.find(
                              (p) => p.expectedPrintingId === g.expectedPrintingId,
                            );
                            if (!match) {
                              continue;
                            }
                            const pid = match.id;
                            linkPrintingSources.mutate({
                              printingId: pid,
                              candidatePrintingIds: g.candidates.map((s) => s.id),
                            });
                          }
                        }}
                      >
                        <ArrowRightIcon className="mr-1" />
                        Assign all {matchable.length} groups to existing
                      </Button>
                    </div>
                  );
                })()}

              {ambiguousGroups.length > 0 && (
                <div className="overflow-hidden rounded-md border border-dashed">
                  {ambiguousGroups.map((group) => (
                    <NewPrintingGroupCard
                      key={group.groupKey}
                      group={group}
                      existingPrintings={printings}
                      providerLabels={sourceLabels}
                      providerNames={sourceNames}
                      providerSubmitters={sourceSubmitters}
                      providerSettings={providerSettings}
                      setTotals={setTotals}
                      setReleaseYears={setReleaseYears}
                      isExpanded={!collapsedPrintings.has(group.groupKey)}
                      onToggle={() => togglePrintingFold(cardId, group.groupKey)}
                      onAccept={(printingFields, candidatePrintingIds) => {
                        acceptPrintingGroup.mutate(
                          {
                            cardId: card.id,
                            printingFields: printingFields as AcceptPrintingBody["printingFields"],
                            candidatePrintingIds,
                          },
                          {
                            onSuccess: (data) => {
                              pendingScrollTarget.current = (
                                data as { printingId: string }
                              ).printingId;
                            },
                          },
                        );
                      }}
                      onLink={(pid, candidatePrintingIds) => {
                        linkPrintingSources.mutate({ printingId: pid, candidatePrintingIds });
                      }}
                      onCopy={(id, pid) => {
                        copyPrintingSource.mutate({ id, printingId: pid });
                      }}
                      onDelete={(id) => {
                        deletePrintingSource.mutate(id);
                      }}
                      onIgnore={(externalId, finish) => {
                        ignorePrintingSource.mutate({
                          provider:
                            sourceLabels[
                              group.candidates.find((s) => s.externalId === externalId)
                                ?.candidateCardId ?? ""
                            ] ?? "",
                          externalId,
                          finish,
                        });
                      }}
                      isAccepting={acceptPrintingGroup.isPending}
                      isLinking={linkPrintingSources.isPending}
                      printingFields={printingSourceFields}
                      costKeywords={costKeywords}
                      invalidates={invalidateScope}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {activeSection === "bans" && (
            <div className="space-y-8">
              <CardBansSection cardId={card.id} />
              <CardErrataSection cardId={card.id} errata={card.errata} />
            </div>
          )}

          {activeSection === "history" && (
            <CardHistorySection
              cardSlug={cardId}
              cardName={canonicalName}
              printingLabels={printingLabelsById}
              onOpen={(target) => {
                if (target.kind === "printing") {
                  revealPrinting(target.printingId);
                  return;
                }
                if (target.kind === "sources") {
                  void navigate({ to: "/admin/sources" });
                  return;
                }
                goToSection(target.kind === "submissions" ? "attention" : target.kind);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
