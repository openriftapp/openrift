import { enumLabel } from "@openrift/shared/enum-label";
import { formatRelativeTime } from "@openrift/shared/format-date";
import { pluralize } from "@openrift/shared/strings";
import type { AdminCardDetailResponse, AdminCardResponse } from "@openrift/shared/types/api/admin";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  BanIcon,
  CopyCheckIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AdminCardMarketplaceSection } from "@/features/admin/components/admin-card-marketplace-section";
import { CardBansSection } from "@/features/admin/components/card-bans-section";
import { useCardDetailData } from "@/features/admin/components/card-detail-shared";
import { CardErrataSection } from "@/features/admin/components/card-errata-section";
import { CardHistorySection } from "@/features/admin/components/card-history-section";
import { MoveSubmissionDialog } from "@/features/admin/components/move-submission-dialog";
import { RejectSubmissionDialog } from "@/features/admin/components/reject-submission-dialog";
import { SendNoteDialog } from "@/features/admin/components/send-note-dialog";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useDeleteCard, useRenameCard } from "@/features/admin/hooks/use-admin-card-mutations";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { useIgnoreCandidateCard } from "@/features/admin/hooks/use-ignored-candidates";
import type { AttentionSubmission } from "@/features/admin/lib/attention-items";
import { buildAttentionSubmissions } from "@/features/admin/lib/attention-items";
import { pairNamesByPrinting } from "@/features/admin/lib/face-rows";
import { printingKindLabel } from "@/features/admin/lib/printing-summary";
import { CompareSourcesDialog } from "@/features/catalog-workspace/components/compare-sources-dialog";
import { FieldRow } from "@/features/catalog-workspace/components/record/field-row";
import {
  RecordBanner,
  RecordHeader,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { SourceStrip } from "@/features/catalog-workspace/components/record/source-strip";
import { SuggestionChip } from "@/features/catalog-workspace/components/record/suggestion-chip";
import {
  cardRecordScope,
  useCardRecordActions,
} from "@/features/catalog-workspace/hooks/use-card-record-actions";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import {
  buildFaceTree,
  CARD_RECORD_FIELDS,
  cardTypeLine,
  cardWaitingSince,
  faceOpenCounts,
  formatRecordValue,
  primaryCardImage,
} from "@/features/catalog-workspace/lib/record-fields";
import type {
  CardSuggestions,
  FieldSuggestion,
  SuggestionRow,
} from "@/features/catalog-workspace/lib/suggestion-rows";
import {
  buildCardSuggestions,
  discardLabel,
  enterDifferenceCount,
  enterProviders,
} from "@/features/catalog-workspace/lib/suggestion-rows";
import { workspaceQueueQueryOptions } from "@/features/catalog-workspace/lib/workspace-queries";
import { useEnumOrders } from "@/hooks/use-enums";
import { useCostKeywords } from "@/hooks/use-keyword-styles";
import type { EnumLabels } from "@/lib/enum-labels";
import { cn } from "@/lib/utils";

type FieldsView = "differences" | "all";

type SubmissionDialog = {
  kind: "reject" | "reply" | "move";
  submission: AttentionSubmission;
} | null;

function CardThumb({ url, className }: { url: string | null; className: string }) {
  return url === null ? (
    <div className={cn("bg-muted aspect-[63/88] min-w-0 shrink-0 rounded-sm", className)} />
  ) : (
    <img
      src={url}
      alt=""
      className={cn("aspect-[63/88] min-w-0 shrink-0 rounded-sm object-cover", className)}
    />
  );
}

function listFormat(items: readonly string[]): string {
  if (items.length <= 1) {
    return items.join("");
  }
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

function bannerText(model: CardSuggestions, canCheck: boolean, contributorOpen: boolean) {
  const differences = enterDifferenceCount(model.enterTargets);
  const providers = enterProviders(model.enterTargets);
  const enter =
    !canCheck || differences === 0
      ? model.suggestions.length === 0
        ? "Nothing open on this card. Enter opens the next card."
        : "Enter opens the next card."
      : `Enter discards ${differences} ${pluralize(differences, "suggestion")} from ${listFormat(providers)} and opens the next card.`;
  return (
    <>
      {enter}
      {contributorOpen && canCheck && (
        <>
          {" "}
          <strong>Answer the contributor proposal first.</strong>
        </>
      )}
    </>
  );
}

function CardMenu({
  card,
  cardSlug,
  expectedCardId,
}: {
  card: AdminCardResponse;
  cardSlug: string;
  expectedCardId: string;
}) {
  const navigate = useNavigate();
  const renameCard = useRenameCard();
  const deleteCard = useDeleteCard();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isStale = cardSlug !== expectedCardId;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon-sm" aria-label="Card actions" />}
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isStale && (
            <DropdownMenuItem
              disabled={renameCard.isPending}
              onClick={() =>
                renameCard.mutate(
                  { cardId: card.id, newId: expectedCardId },
                  {
                    onSuccess: () =>
                      void navigate({
                        to: "/admin/workspace/cards/$cardSlug",
                        params: { cardSlug: expectedCardId },
                      }),
                  },
                )
              }
            >
              <RefreshCwIcon />
              Regenerate ID ({cardSlug} &rarr; {expectedCardId})
            </DropdownMenuItem>
          )}
          {isStale && <DropdownMenuSeparator />}
          <DropdownMenuItem
            variant="destructive"
            disabled={deleteCard.isPending}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon />
            Delete card…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmActionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete card "${card.name}"?`}
        description="This deletes the card and all its printings. This cannot be undone."
        confirmLabel="Delete card"
        pendingLabel="Deleting…"
        destructive
        isPending={deleteCard.isPending}
        onConfirm={() =>
          deleteCard.mutate(card.id, {
            onSuccess: () => {
              setDeleteOpen(false);
              void navigate({ to: "/admin/workspace/cards" });
            },
          })
        }
      />
    </>
  );
}

function FacesTree({
  detail,
  cardSlug,
  isAdmin,
  openByFace,
  labels,
  markerLabels,
}: {
  detail: AdminCardDetailResponse;
  cardSlug: string;
  isAdmin: boolean;
  openByFace: ReadonlyMap<string, number>;
  labels: EnumLabels;
  markerLabels: Record<string, string>;
}) {
  const [language, setLanguage] = useState("");
  const [marker, setMarker] = useState("");
  const languages = [...new Set(detail.printings.map((printing) => printing.language))].toSorted();
  const markers = [...new Set(detail.printings.flatMap((printing) => printing.markerSlugs))];
  const tree = buildFaceTree(detail.printings, detail.printingImages, openByFace, {
    language: language === "" ? undefined : language,
    marker: marker === "" ? undefined : marker,
  });

  return (
    <RecordSection
      title="Faces and printings"
      actions={
        <>
          {languages.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                Language: {language === "" ? "All" : language}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
                  <DropdownMenuRadioItem value="">All</DropdownMenuRadioItem>
                  {languages.map((code) => (
                    <DropdownMenuRadioItem key={code} value={code}>
                      {code}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {markers.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                Markers: {marker === "" ? "All" : enumLabel(markerLabels, marker)}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={marker} onValueChange={setMarker}>
                  <DropdownMenuRadioItem value="">All</DropdownMenuRadioItem>
                  {markers.map((slug) => (
                    <DropdownMenuRadioItem key={slug} value={slug}>
                      {enumLabel(markerLabels, slug)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {isAdmin && (
            <Link
              to="/admin/workspace/printings/create"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <PlusIcon />
              New printing
            </Link>
          )}
        </>
      }
    >
      {tree.length === 0 ? (
        <p className="text-muted-foreground">No printings match.</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
          {tree.map((face) => (
            <div key={face.faceId} className="contents">
              <Link
                to="/admin/workspace/faces/$cardSlug/$faceId"
                params={{ cardSlug, faceId: face.faceId }}
                className="hover:bg-muted/50 flex items-center gap-2 border-t py-1.5"
              >
                <CardThumb url={face.imageUrl} className="w-5" />
                <span className="flex-1 font-mono">
                  {face.shortCode} · {face.language.toUpperCase()}
                </span>
                {face.openItems > 0 && (
                  <Badge variant="warning">{face.openItems} open in Faces</Badge>
                )}
              </Link>
              <div className="flex flex-col gap-1 border-t py-1.5">
                {face.printings.map((row) => (
                  <Link
                    key={row.id}
                    to="/admin/workspace/printings/$printingId"
                    params={{ printingId: row.id }}
                    className="hover:bg-muted/50 flex gap-2"
                  >
                    <span className="flex-1 font-mono">{row.code}</span>
                    <span className="text-muted-foreground text-sm">
                      {printingKindLabel(row.printing, {
                        artVariants: labels.artVariants,
                        markers: markerLabels,
                      })}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </RecordSection>
  );
}

const SUBMISSION_KIND_LABELS: Record<AttentionSubmission["kind"], string> = {
  correction: "Correction",
  image: "Image",
  "new-printing": "New printing",
};

interface CardRecordBodyProps {
  cardSlug: string;
  detail: AdminCardDetailResponse;
  card: AdminCardResponse;
  model: CardSuggestions;
  submissions: readonly AttentionSubmission[];
  isAdmin: boolean;
  record: Omit<ReturnType<typeof useCardRecordActions>, "actions">;
}

function CardRecordBody({
  cardSlug,
  detail,
  card,
  model,
  submissions,
  isAdmin,
  record,
}: CardRecordBodyProps) {
  const navigate = useNavigate();
  const scope = cardRecordScope(cardSlug);
  const { providerSettings, candidateCardFields, markers } = useCardDetailData(scope);
  const { labels } = useEnumOrders();
  const { data: queue } = useQuery(workspaceQueueQueryOptions());
  const ignoreSource = useIgnoreCandidateCard(scope);
  const [view, setView] = useState<FieldsView>("differences");
  const [compare, setCompare] = useState<{ focusField?: string } | null>(null);
  const [dialog, setDialog] = useState<SubmissionDialog>(null);

  const { applySuggestion, discardSuggestion, acceptWholeSubmission, contributorOpen, isPending } =
    record;
  const items = queue?.items ?? [];
  const waitingSince = cardWaitingSince(items, cardSlug);
  const markerLabels = Object.fromEntries(markers.map((entry) => [entry.slug, entry.label]));
  const rowsByField = new Map<string, SuggestionRow>(model.rows.map((row) => [row.field, row]));
  const fieldDefs =
    view === "all"
      ? CARD_RECORD_FIELDS
      : CARD_RECORD_FIELDS.filter(
          (def) => (rowsByField.get(def.field)?.suggestions.length ?? 0) > 0,
        );
  const submissionById = new Map(submissions.map((entry) => [entry.candidateCardId, entry]));
  const cardValues = card as unknown as Record<string, unknown>;

  function closeDialog(open: boolean) {
    if (!open) {
      setDialog(null);
    }
  }

  function contributorChip(suggestion: FieldSuggestion, value: string) {
    const submission = submissionById.get(suggestion.candidateRowId);
    const others = suggestion.otherChanges ?? 0;
    return (
      <SuggestionChip
        key={suggestion.key}
        tone="contributor"
        sourceLabel={suggestion.sourceLabel}
        value={
          <>
            {value}
            {others > 0 && (
              <span className="text-muted-foreground ml-2 text-xs">
                Use closes the proposal. Its {others} other {pluralize(others, "change")}{" "}
                {others === 1 ? "stays" : "stay"} unapplied.
              </span>
            )}
          </>
        }
        hotkey={suggestion.hotkey}
        pending={isPending}
        onUse={() => applySuggestion(suggestion)}
        onReject={submission ? () => setDialog({ kind: "reject", submission }) : undefined}
        onReply={isAdmin && submission ? () => setDialog({ kind: "reply", submission }) : undefined}
        menu={
          submission ? (
            <>
              {others > 0 && (
                <DropdownMenuItem onClick={() => acceptWholeSubmission(suggestion.candidateRowId)}>
                  <CopyCheckIcon />
                  Use all {others + 1} changes
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setCompare({ focusField: suggestion.field })}>
                Edit before use…
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={() => setDialog({ kind: "move", submission })}>
                  <ArrowRightIcon />
                  Move to another card…
                </DropdownMenuItem>
              )}
            </>
          ) : undefined
        }
      />
    );
  }

  function sourceChip(suggestion: FieldSuggestion, value: string) {
    const source = detail.sources.find((entry) => entry.id === suggestion.candidateRowId);
    return (
      <SuggestionChip
        key={suggestion.key}
        tone="source"
        sourceLabel={suggestion.sourceLabel}
        value={value}
        hotkey={suggestion.hotkey}
        pending={isPending}
        onUse={() => applySuggestion(suggestion)}
        onDiscard={isAdmin ? () => discardSuggestion(suggestion) : undefined}
        discardLabel={discardLabel(suggestion)}
        menu={
          isAdmin && source ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                ignoreSource.mutate({ provider: source.provider, externalId: source.externalId })
              }
            >
              <BanIcon />
              Ignore this source row permanently
            </DropdownMenuItem>
          ) : undefined
        }
      />
    );
  }

  function chipFor(suggestion: FieldSuggestion) {
    const value = formatRecordValue(suggestion.field, suggestion.value, labels);
    return suggestion.tone === "contributor"
      ? contributorChip(suggestion, value)
      : sourceChip(suggestion, value);
  }

  const header = (
    <RecordHeader
      thumb={
        <CardThumb
          url={primaryCardImage(detail.printings, detail.printingImages)}
          className="w-9"
        />
      }
      title={card.name}
      subtitle={[
        cardTypeLine(card, labels),
        ...(waitingSince === null ? [] : [`flagged ${formatRelativeTime(waitingSince)}`]),
      ].join(" · ")}
      actions={
        <>
          <Link
            to="/cards/$cardSlug/{-$printingSlug}"
            params={{ cardSlug }}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            Public page
            <ArrowUpRightIcon />
          </Link>
          {isAdmin && (
            <CardMenu card={card} cardSlug={cardSlug} expectedCardId={detail.expectedCardId} />
          )}
        </>
      }
    />
  );

  return (
    <RecordPane
      header={header}
      banner={<RecordBanner>{bannerText(model, isAdmin, contributorOpen)}</RecordBanner>}
    >
      <RecordSection
        title="Card fields"
        actions={
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Which fields"
            value={[view]}
            onValueChange={(next) => {
              const [picked] = next as FieldsView[];
              if (picked !== undefined) {
                setView(picked);
              }
            }}
          >
            <ToggleGroupItem value="differences">Differences</ToggleGroupItem>
            <ToggleGroupItem value="all">All fields</ToggleGroupItem>
          </ToggleGroup>
        }
      >
        <SourceStrip sources={model.sources} onCompare={() => setCompare({})} />
        {fieldDefs.map((def) => {
          const suggestions = rowsByField.get(def.field)?.suggestions ?? [];
          return (
            <FieldRow
              key={def.field}
              label={def.label}
              value={formatRecordValue(def.field, cardValues[def.field], labels)}
              onEdit={() => setCompare({ focusField: def.field })}
              suggestions={
                suggestions.length > 0
                  ? suggestions.map((suggestion) => chipFor(suggestion))
                  : undefined
              }
            />
          );
        })}
        {view === "differences" && (
          <p className="text-muted-foreground mt-2 text-sm">
            {fieldDefs.length === 0
              ? "Every source agrees with the card."
              : `${model.agreedLabels.length} ${pluralize(model.agreedLabels.length, "field")} agree: ${listFormat(model.agreedLabels.map((label) => label.toLowerCase()))}.`}
          </p>
        )}
      </RecordSection>

      <FacesTree
        detail={detail}
        cardSlug={cardSlug}
        isAdmin={isAdmin}
        openByFace={faceOpenCounts(items, cardSlug)}
        labels={labels}
        markerLabels={markerLabels}
      />

      {isAdmin && (
        <RecordSection title="Marketplace listings">
          <AdminCardMarketplaceSection
            cardId={cardSlug}
            pairNames={pairNamesByPrinting(detail.printings, card.name)}
            onOpenPrinting={(printingId) =>
              void navigate({
                to: "/admin/workspace/printings/$printingId",
                params: { printingId },
              })
            }
          />
        </RecordSection>
      )}

      {isAdmin && (
        <RecordSection
          title="Bans & errata"
          collapsible
          defaultOpen={false}
          summary={card.errata === null ? "No errata" : "Errata on file"}
        >
          <div className="space-y-8">
            <CardBansSection cardId={card.id} />
            <CardErrataSection cardId={card.id} errata={card.errata} />
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
            onOpen={(target) => {
              if (target.kind === "printing") {
                void navigate({
                  to: "/admin/workspace/printings/$printingId",
                  params: { printingId: target.printingId },
                });
              }
            }}
          />
        </RecordSection>
      )}

      {compare !== null && (
        <CompareSourcesDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setCompare(null);
            }
          }}
          card={card}
          sources={detail.sources}
          fields={candidateCardFields}
          providerSettings={providerSettings}
          invalidates={scope}
          isAdmin={isAdmin}
          focusField={compare.focusField}
        />
      )}
      <RejectSubmissionDialog
        candidateCardId={dialog?.kind === "reject" ? dialog.submission.candidateCardId : null}
        submitterName={dialog?.submission.submitterName ?? null}
        kindLabel={SUBMISSION_KIND_LABELS[dialog?.submission.kind ?? "correction"]}
        scope={{ cardSlug }}
        onOpenChange={closeDialog}
      />
      <SendNoteDialog
        candidateCardId={dialog?.kind === "reply" ? dialog.submission.candidateCardId : null}
        submitterName={dialog?.submission.submitterName ?? null}
        onOpenChange={closeDialog}
      />
      <MoveSubmissionDialog
        candidateCardId={dialog?.kind === "move" ? dialog.submission.candidateCardId : null}
        submitterName={dialog?.submission.submitterName ?? null}
        scope={{ cardSlug }}
        onOpenChange={closeDialog}
      />
    </RecordPane>
  );
}

export function CardRecord({ cardSlug }: { cardSlug: string }) {
  const { data: access } = useAdminAccess();
  const isAdmin = access?.isAdmin === true;
  const { data, isLoading, isError } = useAdminCardDetail(cardSlug);
  const detail = data as AdminCardDetailResponse | undefined;
  const { providerSettings } = useCardDetailData(cardRecordScope(cardSlug));
  const costKeywords = useCostKeywords();

  const submissions = detail ? buildAttentionSubmissions(detail, costKeywords) : [];
  const model = detail ? buildCardSuggestions(detail, providerSettings, submissions) : null;
  const { actions, ...record } = useCardRecordActions({
    cardSlug,
    detail,
    model,
    submissions,
    canCheck: isAdmin,
  });
  useRegisterRecordActions(actions);

  const card = detail?.card ?? null;
  if (isError) {
    return (
      <RecordPane header={<RecordHeader title={cardSlug} />}>
        <p className="text-muted-foreground">No card with ID &ldquo;{cardSlug}&rdquo; exists.</p>
      </RecordPane>
    );
  }
  if (isLoading || detail === undefined) {
    return (
      <RecordPane header={<Skeleton className="h-10 w-64" />}>
        <Skeleton className="h-64" />
      </RecordPane>
    );
  }
  if (card === null || model === null) {
    return (
      <RecordPane header={<RecordHeader title={detail.displayName} />}>
        <p className="text-muted-foreground">No card data for &ldquo;{cardSlug}&rdquo;.</p>
      </RecordPane>
    );
  }
  return (
    <CardRecordBody
      key={cardSlug}
      cardSlug={cardSlug}
      detail={detail}
      card={card}
      model={model}
      submissions={submissions}
      isAdmin={isAdmin}
      record={record}
    />
  );
}
