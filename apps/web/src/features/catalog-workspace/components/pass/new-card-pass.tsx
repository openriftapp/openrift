import { normalizeNameForIdentity } from "@openrift/shared/card-name";
import { getOrientation } from "@openrift/shared/card-orientation";
import { hasFieldValue } from "@openrift/shared/catalog-field-compare";
import { REQUIRED_CARD_FIELD_KEYS } from "@openrift/shared/contracts/admin/card-mutations";
import type { AcceptNewCardBody } from "@openrift/shared/contracts/admin/card-mutations";
import { USER_SUBMISSION_PROVIDER } from "@openrift/shared/contracts/card-submissions";
import { pluralize } from "@openrift/shared/strings";
import type { UnmatchedCardDetailResponse } from "@openrift/shared/types/api/admin";
import type { CardType } from "@openrift/shared/types/enums";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Suspense, useRef, useState } from "react";
import { toast } from "sonner";

import { RouteErrorFallback } from "@/components/error-message";
import { Heading } from "@/components/heading";
import { PageTopBarButton, PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { hasDropdown, isValidOption } from "@/features/admin/components/candidate-field-defs";
import {
  buildPreseededActiveCard,
  sortByProviderOrder,
  useCardDetailData,
} from "@/features/admin/components/card-detail-shared";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { RejectSubmissionDialog } from "@/features/admin/components/reject-submission-dialog";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import {
  useAcceptNewCard,
  useAcceptPrintingGroup,
  useLinkCard,
} from "@/features/admin/hooks/use-admin-card-mutations";
import { useAllCards, useUnmatchedCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import {
  useIgnoreNewCardDrafts,
  useNewCardDraftIgnorePending,
} from "@/features/admin/hooks/use-ignored-candidates";
import {
  describeAcceptCardFieldIssues,
  hasRequiredActiveFields,
} from "@/features/admin/lib/accept-card-validation";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { favoriteProviderSet } from "@/features/admin/lib/candidate-rows";
import { readCreatedCardId } from "@/features/admin/lib/created-card-id";
import { formatCatalogFieldValue } from "@/features/admin/lib/field-value-text";
import { ignorableSources } from "@/features/admin/lib/ignorable-sources";
import { buildSetReleaseYears } from "@/features/admin/lib/set-release-years";
import { CardSearchDropdown } from "@/features/cards/components/card-search-dropdown";
import { useAdminCardSearch } from "@/features/cards/hooks/use-card-search";
import { setsQueryOptions } from "@/features/cards/lib/sets-queries";
import { CreationPanel } from "@/features/catalog-workspace/components/creation/creation-panel";
import { NewCardFieldEditor } from "@/features/catalog-workspace/components/pass/new-card-pass-field-editor";
import {
  ContributorNote,
  PassTopBar,
  SourceUse,
} from "@/features/catalog-workspace/components/pass/pass-parts";
import { RecordFieldRow } from "@/features/catalog-workspace/components/record/field-row";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
import { WorkspaceUndoButton } from "@/features/catalog-workspace/components/workspace-undo-button";
import { ignoredCardsUndo } from "@/features/catalog-workspace/hooks/candidate-undo";
import { useReviewNavigation } from "@/features/catalog-workspace/hooks/use-card-pass";
import { useClearUndoOnLeave } from "@/features/catalog-workspace/hooks/use-clear-undo-on-leave";
import { useValueLabels } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import { useWorkspaceKeyboard } from "@/features/catalog-workspace/hooks/use-workspace-keyboard";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import { useQueueWorkspaceWrite } from "@/features/catalog-workspace/hooks/workspace-writes";
import type { CreationDraft, DraftCard } from "@/features/catalog-workspace/lib/creation-draft";
import { toAcceptInput } from "@/features/catalog-workspace/lib/creation-draft";
import type { NewCardGroup } from "@/features/catalog-workspace/lib/new-card-groups";
import {
  checkedGroupKeys,
  isDraftComplete,
  runInSequence,
  seedNewCardGroups,
} from "@/features/catalog-workspace/lib/new-card-groups";
import {
  newCardCreateLabel,
  newCardFieldRows,
  newCardReviewKey,
  printingGroupLines,
  printingGroupProviders,
  sourceDisplayName,
} from "@/features/catalog-workspace/lib/new-card-pass";
import { useWorkspaceRecordPaneStore } from "@/features/catalog-workspace/stores/workspace-record-pane-store";
import { useEnumOrders } from "@/hooks/use-enums";
import { runReportedMutation } from "@/lib/run-reported-mutation";
import { PERSISTENT_ERROR_TOAST } from "@/lib/toast";

const routeApi = getRouteApi("/_app/_authenticated/admin/workspace/cards/new/$name");

type Navigation = ReturnType<typeof useReviewNavigation>;

const CARD_ID_FIELD = "id";

function nameHead(name: string): string {
  return name.split(",")[0]?.trim() ?? name;
}

function draftImageUrl(draft: CreationDraft): string | null {
  const image = draft.faces[0]?.images.find((entry) => entry.kind === "source");
  return image?.kind === "source" ? image.url : null;
}

export function NewCardPassPage() {
  const { name } = routeApi.useParams();
  const normName = normalizeNameForIdentity(name);
  return <NewCardPass key={normName} normName={normName} />;
}

function PassPlaceholder({ navigation }: { navigation: Navigation }) {
  useRegisterRecordActions({ loading: true });
  return (
    <>
      <PassTopBar position={navigation.position} />
      <Skeleton className="h-16" />
      <Skeleton className="h-64" />
    </>
  );
}

function PassNotice({ navigation, children }: { navigation: Navigation; children: ReactNode }) {
  useRegisterRecordActions({});
  return (
    <>
      <PassTopBar position={navigation.position} />
      {children}
    </>
  );
}

function NewCardPass({ normName }: { normName: string }) {
  useClearUndoOnLeave();
  const navigation = useReviewNavigation({ reviewKey: newCardReviewKey(normName) });
  useWorkspaceKeyboard(navigation);
  const setPane = useWorkspaceRecordPaneStore((state) => state.setPane);
  const { data: access } = useAdminAccess();
  const { data: detail, isError, error, refetch } = useUnmatchedCardDetail(normName);
  const { data: setsData } = useQuery(setsQueryOptions);
  const ignoring = useNewCardDraftIgnorePending(normName);
  const [leaving, setLeaving] = useState(false);

  let body: ReactNode;
  if (isError) {
    body = (
      <PassNotice navigation={navigation}>
        <RouteErrorFallback error={error} onRetry={() => void refetch()} />
      </PassNotice>
    );
  } else if (detail === undefined || setsData === undefined || (ignoring && !leaving)) {
    body = <PassPlaceholder navigation={navigation} />;
  } else if (detail.sources.length === 0 && !leaving) {
    body = (
      <PassNotice navigation={navigation}>
        <p role="alert" className="text-muted-foreground">
          This card is not in Review any more.
        </p>
      </PassNotice>
    );
  } else {
    body = (
      <Suspense fallback={<PassPlaceholder navigation={navigation} />}>
        <NewCardPassBody
          normName={normName}
          detail={detail}
          sets={setsData.sets}
          isAdmin={access?.isAdmin === true}
          navigation={navigation}
          leaving={leaving}
          onLeavingChange={setLeaving}
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

function NewCardPassBody({
  normName,
  detail,
  sets,
  isAdmin,
  navigation,
  leaving,
  onLeavingChange,
}: {
  normName: string;
  detail: UnmatchedCardDetailResponse;
  sets: Parameters<typeof buildSetReleaseYears>[0];
  isAdmin: boolean;
  navigation: Navigation;
  leaving: boolean;
  onLeavingChange: (leaving: boolean) => void;
}) {
  const queueWrite = useQueueWorkspaceWrite();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scope = [
    adminKeys.cards.unmatched(normName),
    adminKeys.cards.list,
    adminKeys.cards.allCards,
    adminKeys.workspace,
  ];
  const { providerSettings, newCardFields } = useCardDetailData(scope);
  const acceptNewCard = useAcceptNewCard();
  const acceptPrintingGroup = useAcceptPrintingGroup(scope);
  const linkCard = useLinkCard();
  const ignoreDrafts = useIgnoreNewCardDrafts(scope);
  const { announce } = useWorkspaceUndo();
  const { data: allCards } = useAllCards();
  const { labels } = useEnumOrders();
  const valueLabels = useValueLabels();

  const [edits, setEdits] = useState<Record<string, unknown> | null>(null);
  const [cardIdEdit, setCardIdEdit] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [groupEdits, setGroupEdits] = useState<ReadonlyMap<string, CreationDraft>>(new Map());
  const [picks, setPicks] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerTarget, setPickerTarget] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const accepting = useRef(false);

  const { displayName, sources } = detail;
  const similar = useAdminCardSearch(allCards, nameHead(displayName)).slice(0, 3);
  const pickerResults = useAdminCardSearch(allCards, pickerSearch);
  const compareProviders = sortByProviderOrder(providerSettings);
  const orderedSources = sources.toSorted((a, b) => compareProviders(a.provider, b.provider));
  const activeCard = edits ?? buildPreseededActiveCard(sources, newCardFields, providerSettings);
  const cardId = (cardIdEdit ?? detail.defaultCardId).trim();
  const newCard: DraftCard = {
    mode: "new",
    slug: cardId,
    name: typeof activeCard.name === "string" ? activeCard.name : displayName,
    summary: `${sources.length} ${pluralize(sources.length, "source")}`,
  };
  const groups: NewCardGroup[] = seedNewCardGroups(
    detail,
    compareProviders,
    newCard,
    buildSetReleaseYears(sets),
    favoriteProviderSet(providerSettings),
  ).map((group) => {
    const edit = groupEdits.get(group.key);
    return edit === undefined ? group : { ...group, draft: { ...edit, card: newCard } };
  });
  const checked = new Set(checkedGroupKeys(groups, picks));
  const contributors = sources.filter((source) => source.provider === USER_SUBMISSION_PROVIDER);
  const canIgnore = isAdmin && contributors.length === 0 && ignorableSources(sources).length > 0;
  const busy =
    leaving || acceptNewCard.isPending || acceptPrintingGroup.isPending || linkCard.isPending;
  const canAccept = hasRequiredActiveFields(activeCard) && cardId.length > 0;
  const types = Array.isArray(activeCard.types) ? (activeCard.types as CardType[]) : [];
  const landscape = getOrientation(types) === "landscape";
  const fieldDefs = new Map(newCardFields.map((field) => [field.key as string, field]));
  const fieldRows = newCardFieldRows(newCardFields, orderedSources, activeCard, (key, value) => {
    const def = fieldDefs.get(key);
    return def === undefined || !hasDropdown(def) || isValidOption(def, value);
  });
  const rejecting = sources.find((source) => source.id === rejectingId);

  function setField(key: string, value: unknown) {
    setEdits(
      value === null || value === undefined
        ? Object.fromEntries(Object.entries(activeCard).filter(([entry]) => entry !== key))
        : { ...activeCard, [key]: value },
    );
  }

  function openCard(cardSlug: string) {
    void navigate({ to: "/admin/workspace/cards/$cardSlug", params: { cardSlug } });
  }

  async function acceptPrintings(
    signal: AbortSignal,
    cardSlug: string,
    chosen: readonly NewCardGroup[],
  ): Promise<boolean> {
    const created = await readCreatedCardId(queryClient, cardSlug);
    if (!created.ok) {
      toast.error(
        `The card was created, but its printings were not: ${created.reason}. They stay on the card as new printings.`,
        PERSISTENT_ERROR_TOAST,
      );
      return false;
    }
    const cardUuid = created.id;
    const failures = await runInSequence(chosen, (group) =>
      acceptPrintingGroup.mutateAsync(toAcceptInput(group.draft, cardUuid), { signal }),
    );
    if (failures.length > 0) {
      toast.error(
        `Not created: ${failures.map((failure) => failure.item.label).join(", ")}. ${failures.length === 1 ? "It stays" : "They stay"} on the card as a new printing.`,
        PERSISTENT_ERROR_TOAST,
      );
      return false;
    }
    return true;
  }

  async function createCard(signal: AbortSignal) {
    if (!canAccept || busy || accepting.current) {
      return;
    }
    const cardFields = { id: cardId, ...activeCard } as AcceptNewCardBody["cardFields"];
    const issues = describeAcceptCardFieldIssues(cardFields);
    if (issues.length > 0) {
      toast.error(`Can't create this card:\n${issues.join("\n")}`, PERSISTENT_ERROR_TOAST);
      return;
    }
    accepting.current = true;
    onLeavingChange(true);
    if (
      !(await runReportedMutation(() =>
        acceptNewCard.mutateAsync({ name: normName, cardFields }, { signal }),
      ))
    ) {
      accepting.current = false;
      onLeavingChange(false);
      return;
    }
    const chosen = groups.filter((group) => checked.has(group.key));
    const printingsCreated = chosen.length === 0 || (await acceptPrintings(signal, cardId, chosen));
    if (printingsCreated) {
      navigation.goNext(cardId);
    } else {
      openCard(cardId);
    }
  }

  async function ignoreCard(signal: AbortSignal) {
    let result: Awaited<ReturnType<typeof ignoreDrafts.mutateAsync>> | undefined;
    onLeavingChange(true);
    const ok = await runReportedMutation(async () => {
      result = await ignoreDrafts.mutateAsync([normName], { signal });
    });
    if (!(ok && result)) {
      onLeavingChange(false);
      return;
    }
    if (result.sources.length > 0) {
      announce(ignoredCardsUndo(result.sources, displayName));
    }
    navigation.goNext();
  }

  async function linkTo(signal: AbortSignal, targetId: string) {
    const targetSlug = allCards.find((card) => card.id === targetId)?.slug ?? targetId;
    onLeavingChange(true);
    const ok = await runReportedMutation(() =>
      linkCard.mutateAsync({ name: normName, cardId: targetId, cardSlug: targetSlug }, { signal }),
    );
    if (ok) {
      setPickerOpen(false);
      openCard(targetSlug);
    } else {
      onLeavingChange(false);
    }
  }

  useRegisterRecordActions({
    accept: canAccept && !busy ? createCard : undefined,
    acceptLimit: "long",
  });

  const pickAnother = isAdmin && (
    <Button variant="link-muted" size="xs" onClick={() => setPickerOpen(true)}>
      {similar.length > 0 ? "Pick another card…" : "It is an existing card…"}
    </Button>
  );
  const firstImage = groups.map((group) => draftImageUrl(group.draft)).find((url) => url !== null);

  return (
    <>
      <PassTopBar
        position={navigation.position}
        actions={
          <>
            <WorkspaceUndoButton />
            {canIgnore && (
              <PageTopBarButton
                pending={ignoreDrafts.isPending}
                disabled={busy}
                onClick={() => void queueWrite(ignoreCard)}
              >
                Ignore
              </PageTopBarButton>
            )}
            {contributors[0] !== undefined && (
              <PageTopBarButton
                disabled={busy}
                onClick={() => setRejectingId(contributors[0]?.id ?? null)}
              >
                Reject and reply…
              </PageTopBarButton>
            )}
            <PageTopBarPrimaryButton
              disabled={!canAccept || busy}
              pending={acceptNewCard.isPending || acceptPrintingGroup.isPending}
              onClick={() => void queueWrite(createCard, { limit: "long" })}
            >
              {newCardCreateLabel(checked.size)}
              <Kbd>A</Kbd>
            </PageTopBarPrimaryButton>
          </>
        }
      />

      <div className="flex items-center gap-3">
        <PrintingImageBox
          url={firstImage ?? null}
          alt={displayName}
          className="w-12 shrink-0"
          landscape={landscape}
        />
        <div className="min-w-0 flex-1">
          <Heading level={2}>{displayName}</Heading>
          <p className="text-muted-foreground text-sm">New card · not in the catalog</p>
        </div>
        {similar.length === 0 && pickAnother}
      </div>

      {contributors.map((source) => (
        <ContributorNote
          key={source.id}
          name={source.submittedByName ?? "Contributor"}
          note={source.submissionNote}
        />
      ))}

      {isAdmin && similar.length > 0 && (
        <RecordSection title="Already in the catalog?">
          <div className="flex flex-col">
            {similar.map((card) => (
              <div
                key={card.id}
                className="flex items-center gap-3 border-t py-1.5 first:border-t-0"
              >
                <span className="min-w-0 flex-1 break-words">{card.label}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void queueWrite((signal) => linkTo(signal, card.id))}
                >
                  It is this card
                </Button>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground pt-2 text-sm">{pickAnother}</p>
        </RecordSection>
      )}

      <RecordSection title="Card">
        <RecordFieldRow
          label="Card ID"
          value={<span className="font-mono">{cardId}</span>}
          onEdit={busy ? undefined : () => setEditingField(CARD_ID_FIELD)}
          editing={
            editingField === CARD_ID_FIELD ? (
              <Input
                aria-label="Card ID"
                value={cardIdEdit ?? detail.defaultCardId}
                onChange={(event) => setCardIdEdit(event.target.value)}
                onBlur={() => setEditingField(null)}
                className="w-48 font-mono"
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- opened by its Edit button, focus follows the click
                autoFocus
              />
            ) : undefined
          }
        />
        {fieldRows.map((row) => {
          const def = fieldDefs.get(row.key);
          const required = (REQUIRED_CARD_FIELD_KEYS as readonly string[]).includes(row.key);
          return (
            <RecordFieldRow
              key={row.key}
              label={row.label}
              value={
                required && !hasFieldValue(row.value) ? (
                  <span className="text-destructive">Missing</span>
                ) : (
                  formatCatalogFieldValue(row.key, row.value, labels)
                )
              }
              onEdit={busy || def === undefined ? undefined : () => setEditingField(row.key)}
              editing={
                editingField === row.key && def !== undefined ? (
                  <NewCardFieldEditor
                    field={def}
                    value={row.value}
                    required={required}
                    onCommit={(value) => setField(row.key, value)}
                    onClose={() => setEditingField(null)}
                  />
                ) : undefined
              }
              suggestions={
                row.alternatives.length === 0
                  ? undefined
                  : row.alternatives.map((alternative) => (
                      <SourceUse
                        key={alternative.key}
                        value={formatCatalogFieldValue(row.key, alternative.value, labels)}
                        source={alternative.sources.join(", ")}
                        pending={busy}
                        onUse={() => setField(row.key, alternative.value)}
                      />
                    ))
              }
            />
          );
        })}
      </RecordSection>

      <RecordSection title="Printings to create">
        {groups.length === 0 ? (
          <p className="text-muted-foreground">No source lists a printing.</p>
        ) : (
          <div className="flex flex-col">
            {groups.map((group) => {
              const complete = isDraftComplete(group.draft);
              const id = `new-card-group-${group.key}`;
              const lines = printingGroupLines(
                group.draft,
                printingGroupProviders(group.draft, detail.candidatePrintings, sources),
                valueLabels,
              );
              const open = openGroup === group.key;
              return (
                <div key={group.key} className="border-t first:border-t-0">
                  <div className="flex items-center gap-3 py-2">
                    <Checkbox
                      id={id}
                      checked={checked.has(group.key)}
                      disabled={!complete || busy}
                      onCheckedChange={(value) => setPicks(new Map(picks).set(group.key, value))}
                    />
                    <PrintingImageBox
                      url={draftImageUrl(group.draft)}
                      alt={lines.summary}
                      className="w-12 shrink-0"
                      landscape={landscape}
                    />
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={id} className="break-words">
                        {lines.summary}
                      </Label>
                      <p className="text-muted-foreground text-sm break-words">{lines.details}</p>
                    </div>
                    {!complete && <Badge variant="warning">Incomplete</Badge>}
                    <Button
                      variant="link-muted"
                      size="xs"
                      onClick={() => setOpenGroup(open ? null : group.key)}
                    >
                      {open ? "Done" : "Edit"}
                    </Button>
                  </div>
                  {open && (
                    <div className="pb-3">
                      <CreationPanel
                        draft={group.draft}
                        onChange={(draft) =>
                          setGroupEdits(new Map(groupEdits).set(group.key, draft))
                        }
                        disabled={busy}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-muted-foreground pt-2 text-sm">
              Unticked ones stay on the card as new printings.
            </p>
          </div>
        )}
      </RecordSection>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick the card</DialogTitle>
          </DialogHeader>
          <CardSearchDropdown
            results={pickerResults}
            onSearch={(query) => {
              setPickerSearch(query);
              setPickerTarget("");
            }}
            onSelect={(targetId) => setPickerTarget(targetId)}
            placeholder="Search by name…"
          />
          <Button
            disabled={pickerTarget.length === 0}
            pending={linkCard.isPending}
            onClick={() => void queueWrite((signal) => linkTo(signal, pickerTarget))}
          >
            It is this card
          </Button>
        </DialogContent>
      </Dialog>
      <RejectSubmissionDialog
        candidateCardId={rejectingId}
        submitterName={rejecting === undefined ? null : sourceDisplayName(rejecting)}
        kindLabel="New card"
        scope={{ draftName: normName }}
        runWrite={queueWrite}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingId(null);
          }
        }}
      />
    </>
  );
}
