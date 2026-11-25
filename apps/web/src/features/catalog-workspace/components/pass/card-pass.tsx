import { getOrientation } from "@openrift/shared/card-orientation";
import { enumLabel } from "@openrift/shared/enum-label";
import { countNoun } from "@openrift/shared/strings";
import type { AdminCardDetailResponse, AdminCardResponse } from "@openrift/shared/types/api/admin";
import { getRouteApi, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";

import { RouteErrorFallback } from "@/components/error-message";
import { PageTopBarButton, PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CardBansSection } from "@/features/admin/components/card-bans-section";
import { useCardDetailData } from "@/features/admin/components/card-detail-shared";
import { CardErrataSection } from "@/features/admin/components/card-errata-section";
import { CardHistorySection } from "@/features/admin/components/card-history-section";
import { MoveSubmissionDialog } from "@/features/admin/components/move-submission-dialog";
import type { MovedCardDestination } from "@/features/admin/components/move-submission-dialog";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { RejectSubmissionDialog } from "@/features/admin/components/reject-submission-dialog";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { useAcceptSubmission } from "@/features/admin/hooks/use-catalog-review";
import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import { buildAttentionSubmissions } from "@/features/admin/lib/attention-items";
import { favoriteProviderSet } from "@/features/admin/lib/candidate-rows";
import { pairNamesByPrinting } from "@/features/admin/lib/face-rows";
import { formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { buildSetReleaseYears } from "@/features/admin/lib/set-release-years";
import { useCardBans } from "@/features/cards/hooks/use-card-bans";
import { useSets } from "@/features/cards/hooks/use-sets";
import { CardListingsSection } from "@/features/catalog-workspace/components/card-listings-section";
import { CardCompareGrid } from "@/features/catalog-workspace/components/compare-sources-dialog";
import { CardMenu } from "@/features/catalog-workspace/components/pass/card-menu";
import {
  ContributionBlock,
  PassTopBar,
  SourceUse,
} from "@/features/catalog-workspace/components/pass/pass-parts";
import { PrintingsSection } from "@/features/catalog-workspace/components/pass/printings-section";
import { RecordFieldRow } from "@/features/catalog-workspace/components/record/field-row";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import {
  PublicPageLink,
  RecordHeader,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { stopNavigation } from "@/features/catalog-workspace/components/record/review-stop-bar";
import { WorkspaceUndoButton } from "@/features/catalog-workspace/components/workspace-undo-button";
import {
  usePassCreatePrinting,
  usePassDismiss,
  useReviewNavigation,
} from "@/features/catalog-workspace/hooks/use-card-pass";
import {
  cardRecordScope,
  useCardRecordActions,
} from "@/features/catalog-workspace/hooks/use-card-record-actions";
import { useClearUndoOnLeave } from "@/features/catalog-workspace/hooks/use-clear-undo-on-leave";
import { useDismissSuggestion } from "@/features/catalog-workspace/hooks/use-dismiss-suggestion";
import { useValueLabels } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { useWorkspaceKeyboard } from "@/features/catalog-workspace/hooks/use-workspace-keyboard";
import { useCardView } from "@/features/catalog-workspace/hooks/use-workspace-queue";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import {
  buildCardPass,
  newPrintingGroups,
  passContributor,
  placeNewPrintings,
  seededPrintingDraft,
} from "@/features/catalog-workspace/lib/card-pass";
import {
  CARD_RECORD_FIELDS,
  primaryCardImage,
} from "@/features/catalog-workspace/lib/record-fields";
import type { ReviewStop, ReviewTrail } from "@/features/catalog-workspace/lib/review-stops";
import { nextPendingStop, reviewStops } from "@/features/catalog-workspace/lib/review-stops";
import type { FieldSuggestion } from "@/features/catalog-workspace/lib/suggestion-rows";
import { useWorkspaceRecordPaneStore } from "@/features/catalog-workspace/stores/workspace-record-pane-store";
import { useEnumOrders } from "@/hooks/use-enums";
import { useCostKeywords } from "@/hooks/use-keyword-styles";
import { errorStatus } from "@/lib/server-fns/api-error";

const routeApi = getRouteApi("/_app/_authenticated/admin/workspace/cards/$cardSlug");

const workspaceCardDestination: MovedCardDestination = (cardSlug) => ({
  to: "/admin/workspace/cards/$cardSlug",
  params: { cardSlug },
  ignoreBlocker: true,
});

type Navigation = ReturnType<typeof useReviewNavigation>;

interface FirstStop {
  stop: ReviewStop;
  trail: ReviewTrail;
}

export function CardPassPage() {
  const { cardSlug } = routeApi.useParams();
  return <CardPass key={cardSlug} cardSlug={cardSlug} />;
}

function PassPlaceholder({ navigation, loading }: { navigation: Navigation; loading: boolean }) {
  useRegisterRecordActions({ loading });
  return (
    <>
      <PassTopBar position={navigation.position} inReview={navigation.inReview} />
      <Skeleton className="h-16" />
      <Skeleton className="h-64" />
    </>
  );
}

function PassNotice({ navigation, children }: { navigation: Navigation; children: ReactNode }) {
  useRegisterRecordActions({});
  return (
    <>
      <PassTopBar position={navigation.position} inReview={navigation.inReview} />
      {children}
    </>
  );
}

function CardPass({ cardSlug }: { cardSlug: string }) {
  useClearUndoOnLeave();
  const review = useReviewNavigation(cardSlug);
  const navigate = useNavigate();
  const [firstStop, setFirstStop] = useState<FirstStop | null>(null);
  const navigation = {
    ...review,
    goNext: () => {
      if (firstStop === null) {
        review.goNext();
      } else {
        void navigate(stopNavigation(firstStop.stop, firstStop.trail));
      }
    },
  };
  useWorkspaceKeyboard(navigation.inReview ? navigation : undefined);
  const setPane = useWorkspaceRecordPaneStore((state) => state.setPane);
  const { data: access } = useAdminAccess();
  const { data: detail, isError, error, refetch } = useAdminCardDetail(cardSlug);

  let body: ReactNode;
  if (isError) {
    body = (
      <PassNotice navigation={navigation}>
        {errorStatus(error) === 404 ? (
          <p role="alert" className="text-muted-foreground">
            No card with ID &ldquo;{cardSlug}&rdquo; exists.
          </p>
        ) : (
          <RouteErrorFallback error={error} onRetry={() => void refetch()} />
        )}
      </PassNotice>
    );
  } else if (detail === undefined) {
    body = <PassPlaceholder navigation={navigation} loading />;
  } else if (detail.card === null) {
    body = (
      <PassNotice navigation={navigation}>
        <p role="alert" className="text-muted-foreground">
          No card data for &ldquo;{cardSlug}&rdquo;.
        </p>
      </PassNotice>
    );
  } else {
    body = (
      <Suspense fallback={<PassPlaceholder navigation={navigation} loading />}>
        <CardPassBody
          cardSlug={cardSlug}
          detail={detail}
          card={detail.card}
          isAdmin={access?.isAdmin === true}
          navigation={navigation}
          onFirstStop={setFirstStop}
        />
      </Suspense>
    );
  }

  return (
    <section
      ref={setPane}
      tabIndex={-1}
      aria-label="Card pass"
      className="flex flex-col gap-4 pt-3 outline-none"
    >
      {body}
    </section>
  );
}

function CardPassBody({
  cardSlug,
  detail,
  card,
  isAdmin,
  navigation,
  onFirstStop,
}: {
  cardSlug: string;
  detail: AdminCardDetailResponse;
  card: AdminCardResponse;
  isAdmin: boolean;
  navigation: Navigation;
  onFirstStop: (first: FirstStop | null) => void;
}) {
  const scope = cardRecordScope(cardSlug);
  const { providerSettings, candidateCardFields } = useCardDetailData(scope);
  const { labels } = useEnumOrders();
  const valueLabels = useValueLabels();
  const costKeywords = useCostKeywords();
  const { data: setsData } = useSets();
  const queueWrite = useQueueWorkspaceWrite();
  const dismissValue = useDismissSuggestion(scope, detail.displayName);
  const navigate = useNavigate();
  const [allFields, setAllFields] = useState<boolean | null>(null);
  const showAll = allFields ?? !navigation.inReview;
  const [allPrintings, setAllPrintings] = useState<boolean | null>(null);
  const printingsShown = allPrintings ?? !navigation.inReview;
  const [compare, setCompare] = useState(false);
  const [rejecting, setRejecting] = useState<{ candidateCardId: string; kindLabel: string } | null>(
    null,
  );
  const [movingId, setMovingId] = useState<string | null>(null);

  const submissions: AttentionSubmission[] = buildAttentionSubmissions(detail, costKeywords);
  const opensListings = useLocation({ select: (location) => location.hash === "listings" });
  const { data: bans } = useCardBans(isAdmin ? card.id : "");
  const isBanned = (bans?.length ?? 0) > 0;
  const pass = buildCardPass(detail, { providerSettings, submissions, costKeywords, isAdmin });
  const cardActions = useCardRecordActions({
    cardSlug,
    detail,
    submissions,
  });
  const dismiss = usePassDismiss({
    scope,
    cardId: card.id,
    record: detail.displayName,
    dismiss: pass.dismiss,
  });
  const creator = usePassCreatePrinting(cardSlug);
  const markApplied = useAcceptSubmission({ cardSlug });
  const favorites = favoriteProviderSet(providerSettings);
  const setReleaseYears = buildSetReleaseYears(setsData.sets);
  const newRows = newPrintingGroups(detail, pass.hiddenProviders).map((group) => ({
    group,
    ...seededPrintingDraft(detail, group, setReleaseYears, favorites),
  }));

  const queue = useCardView();
  const trail: ReviewTrail = {
    cardSlug,
    queue,
    cardIndex: navigation.position?.index ?? -1,
  };
  const firstStop = navigation.inReview
    ? nextPendingStop(reviewStops(pass), { kind: "card" })
    : null;
  const firstStopKey = firstStop === null ? null : JSON.stringify({ stop: firstStop, trail });
  useEffect(() => {
    onFirstStop(firstStopKey === null ? null : (JSON.parse(firstStopKey) as FirstStop));
    return () => onFirstStop(null);
  }, [firstStopKey, onFirstStop]);

  const dismissCount = pass.dismiss.suggestions;
  const canDismiss = isAdmin && dismissCount > 0;
  const stillPending = navigation.position !== null;
  const primaryText = firstStop === null && stillPending ? "Skip" : "Next";
  const [topNewRow] = placeNewPrintings(
    detail,
    pass.rows.filter((row) => row.pending),
    newRows,
  ).ordered;
  const firstDraft = topNewRow?.ready === true ? topNewRow.draft : null;

  useRegisterRecordActions({
    accept:
      firstDraft === null || creator.pending
        ? undefined
        : (signal) => creator.create(signal, [firstDraft]),
    dismissAll: canDismiss && !dismiss.pending ? (signal) => dismiss.run(signal) : undefined,
  });

  const rowsByField = new Map<string, FieldSuggestion[]>(
    pass.card.rows.map((row) => [row.field, row.suggestions]),
  );
  const pendingDefs = CARD_RECORD_FIELDS.filter(
    (def) => (rowsByField.get(def.field)?.length ?? 0) > 0,
  );
  const shownDefs = showAll ? CARD_RECORD_FIELDS : pendingDefs;
  const shownFailures = pass.faces.reduce((sum, entry) => sum + entry.failedRehosts.length, 0);
  const substituteFailures = (navigation.reviewCard?.pending.failedImages ?? 0) - shownFailures;
  const landscape = getOrientation(card.types) === "landscape";
  const onReject = (candidateCardId: string, kindLabel: string) =>
    setRejecting({ candidateCardId, kindLabel });
  const onMarkApplied = (candidateCardId: string) =>
    void queueWrite(async (signal) => {
      await markApplied.mutateAsync({ candidateCardId, markApplied: true }, { signal });
      toast.success(
        `Marked ${passContributor(detail, submissions, candidateCardId).name}'s contribution as applied`,
      );
    });
  const onMove = isAdmin ? (candidateCardId: string) => setMovingId(candidateCardId) : undefined;

  return (
    <>
      <PassTopBar
        position={navigation.position}
        inReview={navigation.inReview}
        actions={
          <>
            <WorkspaceUndoButton />
            {canDismiss && (
              <PageTopBarButton
                disabled={dismiss.pending}
                onClick={() => void queueWrite((signal) => dismiss.run(signal))}
              >
                Dismiss all {dismissCount}
                <Kbd>D</Kbd>
              </PageTopBarButton>
            )}
            {navigation.inReview && (
              <PageTopBarPrimaryButton onClick={() => navigation.goNext()}>
                {primaryText}
                <Kbd>↵</Kbd>
              </PageTopBarPrimaryButton>
            )}
          </>
        }
      />

      <RecordHeader
        thumb={
          <PrintingImageBox
            url={primaryCardImage(detail.printings, detail.printingImages)}
            alt={detail.displayName}
            className="w-12 shrink-0"
            landscape={landscape}
          />
        }
        title={detail.displayName}
        subtitle={[
          [
            ...card.superTypes.map((type) => enumLabel(labels.superTypes, type)),
            ...card.types.map((type) => enumLabel(labels.cardTypes, type)),
          ].join(" "),
          card.domains.map((domain) => enumLabel(labels.domains, domain)).join(" / "),
          countNoun(new Set(detail.printings.map((printing) => printing.id)).size, "printing"),
          countNoun(new Set(detail.printings.map((printing) => printing.faceId)).size, "face"),
        ].join(" · ")}
        badges={isBanned && <Badge variant="destructive">Banned</Badge>}
        actions={
          <>
            <PublicPageLink cardSlug={cardSlug} />
            {isAdmin && (
              <CardMenu card={card} cardSlug={cardSlug} expectedCardId={detail.expectedCardId} />
            )}
          </>
        }
      />

      <RecordSection
        title="Card"
        titleAction={
          !compare && (
            <Button variant="link" size="xs" onClick={() => setAllFields(!showAll)}>
              {showAll ? "Hide all fields" : "Show all fields"}
            </Button>
          )
        }
        actions={
          <Button variant="link" size="xs" onClick={() => setCompare((value) => !value)}>
            {compare ? "Close compare" : "Compare and edit"}
          </Button>
        }
      >
        {compare && (
          <CardCompareGrid
            card={card}
            sources={detail.sources}
            fields={candidateCardFields}
            providerSettings={providerSettings}
            invalidates={scope}
            isAdmin={isAdmin}
            cardDestination={workspaceCardDestination}
          />
        )}
        {!compare && shownDefs.length === 0 && (
          <p className="text-muted-foreground">No card field has a pending suggestion.</p>
        )}
        {(compare ? [] : shownDefs).map((def) => {
          const suggestions = rowsByField.get(def.field) ?? [];
          return (
            <RecordFieldRow
              key={def.field}
              label={def.label}
              value={formatCatalogFieldValue(def.field, card[def.field], labels)}
              suggestions={
                suggestions.length === 0
                  ? undefined
                  : suggestions.map((suggestion) => {
                      const value = formatCatalogFieldValue(
                        suggestion.field,
                        suggestion.value,
                        labels,
                      );
                      if (suggestion.tone === "source") {
                        return (
                          <SourceUse
                            key={suggestion.key}
                            value={value}
                            current={formatCatalogFieldValue(def.field, card[def.field], labels)}
                            source={suggestion.sourceLabel}
                            pending={cardActions.isPending}
                            onUse={() => void cardActions.applySuggestion(suggestion)}
                            onDismiss={
                              isAdmin
                                ? () =>
                                    void dismissValue.run({
                                      kind: "card",
                                      candidateId: suggestion.candidateRowId,
                                      field: suggestion.field,
                                      value: suggestion.value,
                                      label: def.label,
                                      source: suggestion.sourceLabel,
                                    })
                                : undefined
                            }
                          />
                        );
                      }
                      const contributor = passContributor(
                        detail,
                        submissions,
                        suggestion.candidateRowId,
                      );
                      return (
                        <ContributionBlock
                          key={suggestion.key}
                          {...contributor}
                          value={value}
                          pending={cardActions.isPending}
                          onUse={() => void cardActions.applySuggestion(suggestion)}
                          onReject={() => onReject(suggestion.candidateRowId, "Correction")}
                          onMove={onMove && (() => onMove(suggestion.candidateRowId))}
                          onMarkApplied={() => onMarkApplied(suggestion.candidateRowId)}
                        />
                      );
                    })
              }
            />
          );
        })}
      </RecordSection>

      <PrintingsSection
        cardSlug={cardSlug}
        detail={detail}
        pass={pass}
        newRows={newRows}
        trail={trail}
        showAll={printingsShown}
        onToggleAll={() => setAllPrintings(!printingsShown)}
        isAdmin={isAdmin}
        landscape={landscape}
        labels={valueLabels}
        submissions={submissions}
        substituteFailures={substituteFailures}
        creating={creator.pending}
        onCreate={(drafts) => void queueWrite((signal) => creator.create(signal, drafts))}
        onReject={onReject}
        onMove={onMove}
        onMarkApplied={onMarkApplied}
        onOpenPrinting={(printingId) =>
          void navigate({
            to: "/admin/workspace/printings/$printingId",
            params: { printingId },
          })
        }
      />

      {isAdmin && (
        <CardListingsSection
          cardSlug={cardSlug}
          pairNames={pairNamesByPrinting(detail.printings, card.name)}
          collapsible
          defaultOpen={opensListings}
          scrollWhenLoaded={opensListings}
        />
      )}

      {isAdmin && (
        <RecordSection title="Bans and errata" collapsible defaultOpen={false}>
          <div className="space-y-8">
            <CardBansSection cardId={card.id} runWrite={queueWrite} />
            <CardErrataSection cardId={card.id} errata={card.errata} runWrite={queueWrite} />
          </div>
        </RecordSection>
      )}

      {isAdmin && (
        <RecordSection title="History" collapsible defaultOpen={false}>
          <CardHistorySection
            cardSlug={cardSlug}
            cardName={card.name}
            printingLabels={Object.fromEntries(
              detail.printings.map((printing) => [printing.id, printing.expectedPrintingId]),
            )}
            openable={["printing", "sources"]}
            onOpen={(target) => {
              if (target.kind === "printing") {
                void navigate({
                  to: "/admin/workspace/printings/$printingId",
                  params: { printingId: target.printingId },
                });
              } else if (target.kind === "sources") {
                void navigate({ to: "/admin/sources" });
              }
            }}
          />
        </RecordSection>
      )}

      <RejectSubmissionDialog
        candidateCardId={rejecting?.candidateCardId ?? null}
        submitterName={
          rejecting === null
            ? null
            : passContributor(detail, submissions, rejecting.candidateCardId).name
        }
        kindLabel={rejecting?.kindLabel ?? "Correction"}
        scope={{ cardSlug }}
        runWrite={queueWrite}
        onOpenChange={(open) => {
          if (!open) {
            setRejecting(null);
          }
        }}
      />
      <MoveSubmissionDialog
        candidateCardId={movingId}
        submitterName={
          movingId === null ? null : passContributor(detail, submissions, movingId).name
        }
        scope={{ cardSlug }}
        runWrite={queueWrite}
        cardDestination={workspaceCardDestination}
        onOpenChange={(open) => {
          if (!open) {
            setMovingId(null);
          }
        }}
      />
    </>
  );
}
