import { legendDisplayName } from "@openrift/shared/card-name";
import { getOrientation } from "@openrift/shared/card-orientation";
import { enumLabel } from "@openrift/shared/enum-label";
import { countNoun } from "@openrift/shared/strings";
import type { AdminCardDetailResponse, AdminCardResponse } from "@openrift/shared/types/api/admin";
import { getRouteApi, useLocation, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Suspense, useEffect, useState } from "react";

import { RouteErrorFallback } from "@/components/error-message";
import { PageTopBarButton, PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardBansSection } from "@/features/admin/components/card-bans-section";
import { useCardDetailData } from "@/features/admin/components/card-detail-shared";
import { CardErrataSection } from "@/features/admin/components/card-errata-section";
import { CardHistorySection } from "@/features/admin/components/card-history-section";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import { buildAttentionSubmissions } from "@/features/admin/lib/attention-items";
import { favoriteProviderSet } from "@/features/admin/lib/candidate-rows";
import { pairNamesByPrinting } from "@/features/admin/lib/face-rows";
import { formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { buildSetReleaseYears } from "@/features/admin/lib/set-release-years";
import { useCardBans } from "@/features/cards/hooks/use-card-bans";
import { useSets } from "@/features/cards/hooks/use-sets";
import { CardListingsSection } from "@/features/catalog-workspace/components/card-listings-section";
import { CardCompareGrid } from "@/features/catalog-workspace/components/compare-grids";
import { CardMenu } from "@/features/catalog-workspace/components/pass/card-menu";
import { FieldSuggestions } from "@/features/catalog-workspace/components/pass/field-suggestions";
import {
  PassNotice,
  PassPlaceholder,
  PassTopBar,
} from "@/features/catalog-workspace/components/pass/pass-parts";
import { PrintingsSection } from "@/features/catalog-workspace/components/pass/printings-section";
import {
  useSubmissionDecisions,
  workspaceCardDestination,
} from "@/features/catalog-workspace/components/pass/submission-decisions";
import { RecordFieldRow } from "@/features/catalog-workspace/components/record/field-row";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import {
  PublicPageLink,
  RecordHeader,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { WorkspaceUndoButton } from "@/features/catalog-workspace/components/workspace-undo-button";
import {
  usePassCreatePrinting,
  usePassDismiss,
  useReviewNavigation,
} from "@/features/catalog-workspace/hooks/use-card-pass";
import { useCardRecordActions } from "@/features/catalog-workspace/hooks/use-card-record-actions";
import { useClearUndoOnLeave } from "@/features/catalog-workspace/hooks/use-clear-undo-on-leave";
import { useDismissSuggestion } from "@/features/catalog-workspace/hooks/use-dismiss-suggestion";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { useValueLabels } from "@/features/catalog-workspace/hooks/use-value-labels";
import { useWorkspaceKeyboard } from "@/features/catalog-workspace/hooks/use-workspace-keyboard";
import type { QueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import {
  buildCardPass,
  newPrintingGroups,
  placeNewPrintings,
  seededPrintingDraft,
} from "@/features/catalog-workspace/lib/card-pass";
import {
  CARD_RECORD_FIELDS,
  primaryCardImage,
} from "@/features/catalog-workspace/lib/record-fields";
import { cardRecordScope } from "@/features/catalog-workspace/lib/record-scopes";
import type { ReviewStop, ReviewTrail } from "@/features/catalog-workspace/lib/review-stops";
import { nextPendingStop, reviewStops } from "@/features/catalog-workspace/lib/review-stops";
import type { FieldSuggestion } from "@/features/catalog-workspace/lib/suggestion-rows";
import {
  focusRecordPane,
  useWorkspaceRecordPaneStore,
} from "@/features/catalog-workspace/stores/workspace-record-pane-store";
import { useEnumOrders } from "@/hooks/use-enums";
import { useCostKeywords } from "@/hooks/use-keyword-styles";
import { errorStatus } from "@/lib/server-fns/api-error";

const routeApi = getRouteApi("/_app/_authenticated/admin/workspace/cards/$cardSlug");

type Navigation = ReturnType<typeof useReviewNavigation>;

interface FirstStop {
  stop: ReviewStop;
  trail: ReviewTrail;
}

export function CardPassPage() {
  const { cardSlug } = routeApi.useParams();
  return <CardPass key={cardSlug} cardSlug={cardSlug} />;
}

function CardPass({ cardSlug }: { cardSlug: string }) {
  useClearUndoOnLeave();
  const review = useReviewNavigation(cardSlug);
  const [firstStop, setFirstStop] = useState<FirstStop | null>(null);
  const navigation = {
    ...review,
    goNext: () =>
      review.advance(firstStop?.stop ?? null, firstStop?.trail ?? review.trailFor(cardSlug)),
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
  const queueAnyWrite = useQueueWorkspaceWrite();
  const queueWrite: QueueWorkspaceWrite = (task, options) => {
    focusRecordPane();
    return queueAnyWrite(task, options);
  };
  const dismissValue = useDismissSuggestion(scope, detail.displayName);
  const navigate = useNavigate();
  const [allFields, setAllFields] = useState<boolean | null>(null);
  const showAll = allFields ?? !navigation.inReview;
  const [allPrintings, setAllPrintings] = useState<boolean | null>(null);
  const printingsShown = allPrintings ?? !navigation.inReview;
  const [compare, setCompare] = useState(false);

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
  const decisions = useSubmissionDecisions({ cardSlug, detail, submissions, isAdmin });
  const {
    onReject: handleReject,
    onMove: handleMove,
    onMarkApplied: handleMarkApplied,
  } = decisions;
  const favorites = favoriteProviderSet(providerSettings);
  const setReleaseYears = buildSetReleaseYears(setsData.sets);
  const newRows = newPrintingGroups(detail, pass.hiddenProviders).map((group) => ({
    group,
    ...seededPrintingDraft(detail, group, setReleaseYears, favorites),
  }));

  const trail = navigation.trailFor(cardSlug);
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
  const firstReady = placeNewPrintings(
    detail,
    pass.rows.filter((row) => row.pending),
    newRows,
  ).ordered.find((row) => row.ready);
  const firstDraft = firstReady?.draft ?? null;

  useRegisterRecordActions({
    accept:
      firstDraft === null || creator.pending
        ? undefined
        : (signal) => creator.create(signal, [firstDraft]),
    dismissAll: canDismiss && !dismiss.pending ? (signal) => dismiss.run(signal) : undefined,
  });

  const rowsByField = new Map<string, readonly FieldSuggestion[]>(
    pass.card.rows.map((row) => [row.field, row.suggestions]),
  );
  const pendingDefs = CARD_RECORD_FIELDS.filter(
    (def) => (rowsByField.get(def.field)?.length ?? 0) > 0,
  );
  const shownDefs = showAll ? CARD_RECORD_FIELDS : pendingDefs;
  const shownFailures = pass.faces.reduce((sum, entry) => sum + entry.failedRehosts.length, 0);
  const substituteFailures = (navigation.reviewCard?.pending.failedImages ?? 0) - shownFailures;
  const landscape = getOrientation(card.types) === "landscape";

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
                Next
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
              <CardMenu
                card={card}
                cardSlug={cardSlug}
                expectedCardId={detail.expectedCardId}
                runWrite={queueWrite}
                trigger={<Button variant="ghost" size="icon-sm" aria-label="Card actions" />}
                onRenamed={(nextSlug) =>
                  navigate({
                    to: "/admin/workspace/cards/$cardSlug",
                    params: { cardSlug: nextSlug },
                    ignoreBlocker: true,
                  })
                }
                onDeleted={() => navigate({ to: "/admin/workspace/cards", ignoreBlocker: true })}
              />
            )}
          </>
        }
      />

      <RecordSection
        title="Card"
        titleAction={
          !compare && (
            <Button
              variant="link"
              size="xs"
              onClick={() => {
                focusRecordPane();
                setAllFields(!showAll);
              }}
            >
              {showAll ? "Hide all fields" : "Show all fields"}
            </Button>
          )
        }
        actions={
          <Button
            variant="link"
            size="xs"
            onClick={() => {
              focusRecordPane();
              setCompare((value) => !value);
            }}
          >
            {compare ? "Close compare" : "Compare sources"}
          </Button>
        }
      >
        {compare && (
          <CardCompareGrid
            card={card}
            sources={detail.sources}
            fields={candidateCardFields}
            providerSettings={providerSettings}
            hiddenProviders={pass.hiddenProviders}
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
                suggestions.length === 0 ? undefined : (
                  <FieldSuggestions
                    suggestions={suggestions}
                    detail={detail}
                    submissions={submissions}
                    decisions={decisions}
                    pending={cardActions.pending}
                    format={(suggestion) => ({
                      value: formatCatalogFieldValue(suggestion.field, suggestion.proposed, labels),
                      current: formatCatalogFieldValue(def.field, card[def.field], labels),
                      preview: null,
                    })}
                    onUse={(suggestion) => {
                      focusRecordPane();
                      void cardActions.apply(suggestion);
                    }}
                    onDismiss={
                      isAdmin
                        ? (group) => {
                            focusRecordPane();
                            void dismissValue.run(
                              group.map((suggestion) => ({
                                kind: "card" as const,
                                candidateId: suggestion.candidateCardId,
                                field: suggestion.field,
                                value: suggestion.proposed,
                                label: def.label,
                                source: suggestion.sourceLabel,
                              })),
                            );
                          }
                        : undefined
                    }
                  />
                )
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
        acceptKey={firstReady?.group.key}
        showAll={printingsShown}
        onToggleAll={() => {
          focusRecordPane();
          setAllPrintings(!printingsShown);
        }}
        isAdmin={isAdmin}
        landscape={landscape}
        labels={valueLabels}
        submissions={submissions}
        substituteFailures={substituteFailures}
        creating={creator.pending || decisions.markingApplied}
        onCreate={(drafts) => void queueWrite((signal) => creator.create(signal, drafts))}
        onReject={handleReject}
        onMove={handleMove}
        onMarkApplied={handleMarkApplied}
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
          cardName={legendDisplayName(card)}
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

      {decisions.dialogs}
    </>
  );
}
