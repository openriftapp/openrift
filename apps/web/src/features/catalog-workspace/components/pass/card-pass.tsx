import { getOrientation } from "@openrift/shared/card-orientation";
import { countNoun } from "@openrift/shared/strings";
import type { AdminCardDetailResponse, AdminCardResponse } from "@openrift/shared/types/api/admin";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { RouteErrorFallback } from "@/components/error-message";
import { Heading } from "@/components/heading";
import { PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";
import { AdminPrintingMatrix } from "@/features/admin/components/admin-printing-matrix";
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
import { formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { buildSetReleaseYears } from "@/features/admin/lib/set-release-years";
import { useSets } from "@/features/cards/hooks/use-sets";
import { CardCompareGrid } from "@/features/catalog-workspace/components/compare-sources-dialog";
import { CardMenu } from "@/features/catalog-workspace/components/pass/card-menu";
import { FacePanel, faceHeading } from "@/features/catalog-workspace/components/pass/face-panel";
import { NewPrintingsSection } from "@/features/catalog-workspace/components/pass/new-printings-section";
import {
  ContributionBlock,
  PassTopBar,
  SourceUse,
} from "@/features/catalog-workspace/components/pass/pass-parts";
import { PrintingPanel } from "@/features/catalog-workspace/components/pass/printing-panel";
import { RecordFieldRow } from "@/features/catalog-workspace/components/record/field-row";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
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
import { useValueLabels } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { useWorkspaceKeyboard } from "@/features/catalog-workspace/hooks/use-workspace-keyboard";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import {
  buildCardPass,
  nextUploadId,
  newPrintingGroups,
  passContributor,
  seededPrintingDraft,
} from "@/features/catalog-workspace/lib/card-pass";
import {
  CARD_RECORD_FIELDS,
  primaryCardImage,
} from "@/features/catalog-workspace/lib/record-fields";
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
  const navigation = useReviewNavigation(cardSlug);
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
}: {
  cardSlug: string;
  detail: AdminCardDetailResponse;
  card: AdminCardResponse;
  isAdmin: boolean;
  navigation: Navigation;
}) {
  const scope = cardRecordScope(cardSlug);
  const { providerSettings, candidateCardFields } = useCardDetailData(scope);
  const { labels } = useEnumOrders();
  const valueLabels = useValueLabels();
  const costKeywords = useCostKeywords();
  const { data: setsData } = useSets();
  const queueWrite = useQueueWorkspaceWrite();
  const navigate = useNavigate();
  const [allFields, setAllFields] = useState<boolean | null>(null);
  const showAll = allFields ?? !navigation.inReview;
  const [allFaces, setAllFaces] = useState<boolean | null>(null);
  const [allPrintings, setAllPrintings] = useState<boolean | null>(null);
  const facesShown = allFaces ?? !navigation.inReview;
  const printingsShown = allPrintings ?? !navigation.inReview;
  const [compare, setCompare] = useState(false);
  const [rejecting, setRejecting] = useState<{ candidateCardId: string; kindLabel: string } | null>(
    null,
  );
  const [movingId, setMovingId] = useState<string | null>(null);
  const [comparingImageId, setComparingImageId] = useState<string | null>(null);

  const submissions: AttentionSubmission[] = buildAttentionSubmissions(detail, costKeywords);
  const pass = buildCardPass(detail, { providerSettings, submissions, costKeywords, isAdmin });
  const cardActions = useCardRecordActions({
    cardSlug,
    detail,
    submissions,
  });
  const dismiss = usePassDismiss({
    cardSlug,
    cardId: card.id,
    record: detail.displayName,
    dismiss: pass.dismiss,
  });
  const creator = usePassCreatePrinting(cardSlug);
  const markApplied = useAcceptSubmission({ cardSlug });
  const favorites = favoriteProviderSet(providerSettings);
  const setReleaseYears = buildSetReleaseYears(setsData.sets);
  const rows = newPrintingGroups(detail, pass.hiddenProviders).map((group) => ({
    group,
    ...seededPrintingDraft(detail, group, setReleaseYears, favorites),
  }));

  const dismissCount = pass.dismiss.suggestions;
  const canDismiss = isAdmin && dismissCount > 0;
  const stillPending = navigation.position !== null;
  const primaryText = canDismiss
    ? `Dismiss ${dismissCount} & next`
    : stillPending
      ? "Skip"
      : "Next";
  const firstDraft = rows[0]?.ready === true ? rows[0].draft : null;

  useRegisterRecordActions({
    primary:
      canDismiss && navigation.inReview
        ? { label: primaryText, disabled: dismiss.pending, run: dismiss.run }
        : undefined,
    accept:
      firstDraft === null || creator.pending
        ? undefined
        : (signal) => creator.create(signal, [firstDraft]),
  });

  async function primaryAndNext() {
    if (!canDismiss) {
      navigation.goNext();
      return;
    }
    if (await queueWrite(dismiss.run)) {
      navigation.goNext();
    }
  }

  const rowsByField = new Map<string, FieldSuggestion[]>(
    pass.card.rows.map((row) => [row.field, row.suggestions]),
  );
  const pendingDefs = CARD_RECORD_FIELDS.filter(
    (def) => (rowsByField.get(def.field)?.length ?? 0) > 0,
  );
  const shownDefs = showAll ? CARD_RECORD_FIELDS : pendingDefs;
  const pendingFaces = pass.faces.filter((entry) => entry.pending);
  const pendingFaceIds = new Set(pendingFaces.map((entry) => entry.face.id));
  const shownFailures = pass.faces.reduce((sum, entry) => sum + entry.failedRehosts.length, 0);
  const substituteFailures = (navigation.reviewCard?.pending.failedImages ?? 0) - shownFailures;
  const substituteFaces = pass.faces.filter(({ face }) => face.fallbackImageFileId !== null);
  const pendingPrintings = pass.printings.filter((entry) => entry.pending);
  const pendingPrintingIds = new Set(pendingPrintings.map((entry) => entry.printing.id));
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
  const panelProps = {
    cardSlug,
    detail,
    submissions,
    providerSettings,
    hiddenProviders: pass.hiddenProviders,
    costKeywords,
    isAdmin,
    labels: valueLabels,
    onReject,
    onMove,
    onMarkApplied,
    comparingImageId,
    onCompareImage: setComparingImageId,
    onImageResolved: (imageId: string) => setComparingImageId(nextUploadId(pass.faces, imageId)),
  };

  return (
    <>
      <PassTopBar
        position={navigation.position}
        inReview={navigation.inReview}
        actions={
          <>
            <WorkspaceUndoButton />
            {navigation.inReview && (
              <PageTopBarPrimaryButton
                pending={dismiss.pending}
                onClick={() => void primaryAndNext()}
              >
                {primaryText}
                <Kbd>↵</Kbd>
              </PageTopBarPrimaryButton>
            )}
          </>
        }
      />

      <div className="flex items-center gap-3">
        <PrintingImageBox
          url={primaryCardImage(detail.printings, detail.printingImages)}
          alt={detail.displayName}
          className="w-12 shrink-0"
          landscape={landscape}
        />
        <div className="min-w-0 flex-1">
          <Heading level={2}>{detail.displayName}</Heading>
        </div>
        <TextLink render={<Link to="/cards/$cardSlug/{-$printingSlug}" params={{ cardSlug }} />}>
          Public page
        </TextLink>
        {isAdmin && (
          <CardMenu card={card} cardSlug={cardSlug} expectedCardId={detail.expectedCardId} />
        )}
      </div>

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
                            source={suggestion.sourceLabel}
                            pending={cardActions.isPending}
                            onUse={() => void cardActions.applySuggestion(suggestion)}
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

      {rows.length > 0 && (
        <NewPrintingsSection
          cardSlug={cardSlug}
          detail={detail}
          rows={rows}
          isAdmin={isAdmin}
          landscape={landscape}
          labels={valueLabels}
          submissions={submissions}
          creating={creator.pending}
          onCreate={(drafts) => void queueWrite((signal) => creator.create(signal, drafts))}
          onReject={onReject}
          onMove={onMove}
          onMarkApplied={onMarkApplied}
        />
      )}

      <RecordSection
        title={pass.faces.length === 0 ? "Faces" : countNoun(pass.faces.length, "face")}
        titleAction={
          pass.faces.length > 0 && (
            <Button variant="link" size="xs" onClick={() => setAllFaces(!facesShown)}>
              {facesShown ? "Hide all faces" : "Show all faces"}
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-3">
          {pass.faces.length === 0 && <p className="text-muted-foreground">No faces yet.</p>}
          {substituteFailures > 0 && (
            <p className="text-muted-foreground">
              {countNoun(substituteFailures, "substitute image")} failed to rehost. Pick another on
              the face that uses it:{" "}
              {substituteFaces.map(({ face }) => (
                <TextLink
                  key={face.faceId}
                  className="mr-2"
                  render={
                    <Link
                      to="/admin/workspace/faces/$cardSlug/$faceId"
                      params={{ cardSlug, faceId: face.faceId }}
                    />
                  }
                >
                  {faceHeading(face, valueLabels)}
                </TextLink>
              ))}
            </p>
          )}
          {pendingFaces.map((entry) => (
            <FacePanel
              key={entry.face.faceId}
              entry={entry}
              landscape={landscape}
              {...panelProps}
            />
          ))}
          {facesShown && pass.faces.length > 0 && (
            <AdminPrintingMatrix
              detail={detail}
              highlightedIds={pendingFaceIds}
              faces={pass.faces.map((entry) => entry.face)}
              landscape={landscape}
              onOpen={(printingId) => {
                const face = pass.faces.find((entry) => entry.face.id === printingId)?.face;
                if (face !== undefined) {
                  void navigate({
                    to: "/admin/workspace/faces/$cardSlug/$faceId",
                    params: { cardSlug, faceId: face.faceId },
                  });
                }
              }}
            />
          )}
        </div>
      </RecordSection>

      <RecordSection
        title={
          pass.printings.length === 0 ? "Printings" : countNoun(pass.printings.length, "printing")
        }
        titleAction={
          pass.printings.length > 0 && (
            <Button variant="link" size="xs" onClick={() => setAllPrintings(!printingsShown)}>
              {printingsShown ? "Hide all printings" : "Show all printings"}
            </Button>
          )
        }
        actions={
          isAdmin && (
            <Link
              to="/admin/workspace/printings/create"
              search={{ card: cardSlug }}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              New printing
            </Link>
          )
        }
      >
        <div className="flex flex-col gap-3">
          {pass.printings.length === 0 && (
            <p className="text-muted-foreground">No printings yet.</p>
          )}
          {pendingPrintings.map((entry) => (
            <PrintingPanel key={entry.printing.id} entry={entry} {...panelProps} />
          ))}
          {printingsShown && pass.printings.length > 0 && (
            <AdminPrintingMatrix
              detail={detail}
              printings={pass.printings.map((entry) => entry.printing)}
              highlightedIds={pendingPrintingIds}
              landscape={landscape}
              onOpen={(printingId) =>
                void navigate({
                  to: "/admin/workspace/printings/$printingId",
                  params: { printingId },
                })
              }
            />
          )}
        </div>
      </RecordSection>

      {isAdmin && (
        <RecordSection title="Bans, errata and history" collapsible defaultOpen={false}>
          <div className="space-y-8">
            <CardBansSection cardId={card.id} runWrite={queueWrite} />
            <CardErrataSection cardId={card.id} errata={card.errata} runWrite={queueWrite} />
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
          </div>
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
