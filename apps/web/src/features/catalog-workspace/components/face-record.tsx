import { getOrientation } from "@openrift/shared/card-orientation";
import { COMPARABLE_PRINTING_FIELDS } from "@openrift/shared/catalog-field-compare";
import type { WorkspaceEvent } from "@openrift/shared/contracts/admin/catalog-workspace";
import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { formatRelativeTime } from "@openrift/shared/format-date";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import { isPrintingLevelField } from "@openrift/shared/printing-field-level";
import { pluralize } from "@openrift/shared/strings";
import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  EllipsisVerticalIcon,
  SquareArrowOutUpRightIcon,
} from "lucide-react";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PrintingDeskEditFields } from "@/features/admin/components/printing-desk-form-page";
import { DeskStatusBadge } from "@/features/admin/components/printing-desk-shared";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { SendNoteDialog } from "@/features/admin/components/send-note-dialog";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { useDeskCardPrintings, useDeskPrinting } from "@/features/admin/hooks/use-printing-desk";
import { useProviderSettings } from "@/features/admin/hooks/use-provider-settings";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { PRINTING_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import { printingPairName } from "@/features/admin/lib/face-rows";
import { printingFaces } from "@/features/admin/lib/printing-faces";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
import { FaceCompareSourcesDialog } from "@/features/catalog-workspace/components/compare-sources-dialog";
import {
  DeskFaceImagesSection,
  FaceImagesSection,
} from "@/features/catalog-workspace/components/face-images-section";
import { FieldRow } from "@/features/catalog-workspace/components/record/field-row";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import {
  RecordBanner,
  RecordHeader,
  RecordPane,
  RecordSection,
} from "@/features/catalog-workspace/components/record/record-pane";
import { SourceStrip } from "@/features/catalog-workspace/components/record/source-strip";
import { SuggestionChip } from "@/features/catalog-workspace/components/record/suggestion-chip";
import type { FaceChip } from "@/features/catalog-workspace/hooks/use-face-record-actions";
import {
  useFaceRecordActions,
  useValueLabels,
} from "@/features/catalog-workspace/hooks/use-face-record-actions";
import { useQueueNavigation } from "@/features/catalog-workspace/hooks/use-queue-navigation";
import { useRegisterRecordActions } from "@/features/catalog-workspace/hooks/use-register-record-actions";
import type { WorkspaceHistoryTarget } from "@/features/catalog-workspace/hooks/use-workspace-history";
import { useWorkspaceHistory } from "@/features/catalog-workspace/hooks/use-workspace-history";
import {
  ADMIN_ONLY_DISCARD,
  ADMIN_ONLY_REPLY,
  buildFaceSuggestions,
  discardLabel,
  formatSuggestionValue,
  primaryLabel,
  submitterNameOf,
} from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useCostKeywords } from "@/hooks/use-keyword-styles";

declare module "@tanstack/react-router" {
  interface HistoryState {
    workspaceFromPrintingId?: string;
  }
}

const CONTRIBUTOR_FIRST = "Use or reject the contributor proposal first.";

const FACE_FIELDS = COMPARABLE_PRINTING_FIELDS.filter((field) => !isPrintingLevelField(field));

export function FaceRecord({ cardSlug, faceId }: { cardSlug: string; faceId: string }) {
  const { data: access, isPending } = useAdminAccess();
  const isAdmin = access?.isAdmin === true;
  const canReview = isAdmin || (access?.sections ?? []).includes("card-review");

  if (isPending) {
    return <Skeleton className="m-4 h-96" />;
  }

  return (
    <Suspense fallback={<Skeleton className="m-4 h-96" />}>
      {canReview ? (
        <ReviewFaceRecord key={faceId} cardSlug={cardSlug} faceId={faceId} isAdmin={isAdmin} />
      ) : (
        <DeskFaceRecord key={faceId} cardSlug={cardSlug} faceId={faceId} />
      )}
    </Suspense>
  );
}

function ReviewFaceRecord({
  cardSlug,
  faceId,
  isAdmin,
}: {
  cardSlug: string;
  faceId: string;
  isAdmin: boolean;
}) {
  const detailQuery = useAdminCardDetail(cardSlug);
  const detail = detailQuery.data as AdminCardDetailResponse | undefined;
  const { data: providerData } = useProviderSettings();
  const costKeywords = useCostKeywords();
  const labels = useValueLabels();
  const navigation = useQueueNavigation("face");
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const queryClient = useQueryClient();

  const providerSettings = providerData.providerSettings;
  const hiddenProviders = new Set(
    providerSettings
      .filter((setting) => setting.isHidden || (!isAdmin && !setting.helperReviewable))
      .map((setting) => setting.provider),
  );
  const trusted = new Set(
    providerSettings.filter((setting) => setting.isFavorite).map((setting) => setting.provider),
  );
  const model =
    detail === undefined
      ? null
      : buildFaceSuggestions(detail, faceId, {
          costKeywords,
          setTotals: detail.setTotals,
          hiddenProviders,
        });
  const actions = useFaceRecordActions({ cardSlug, model, canCheck: isAdmin, enabled: true });

  if (detail === undefined || model === null) {
    return detailQuery.isError ? (
      <p className="text-muted-foreground p-4">The card could not be loaded.</p>
    ) : (
      <Skeleton className="m-4 h-96" />
    );
  }
  const face = model.face;
  if (face === null) {
    return <p className="text-muted-foreground p-4">This face is no longer on the card.</p>;
  }

  const chipIndex = new Map(actions.chips.map((chip, index) => [chip.key, index + 1]));
  const hotkeyOf = (key: string) => {
    const index = chipIndex.get(key);
    return index !== undefined && index <= 9 ? index : undefined;
  };
  const sourceById = new Map(model.sources.map((source) => [source.candidatePrintingId, source]));
  const discardLabelOf = (id: string, provider: string) =>
    discardLabel(sourceById.get(id)?.differences ?? 0, provider, sourceById.get(id)?.elsewhere);
  const fieldChips = actions.chips.filter(
    (chip): chip is Extract<FaceChip, { kind: "field" }> => chip.kind === "field",
  );
  const contributorWaiting = actions.contributorOpen;
  const enterProviders = [
    ...new Set(
      model.sources
        .filter((source) => model.enterCandidateIds.includes(source.candidatePrintingId))
        .map((source) => source.provider),
    ),
  ];
  const differingFields = new Set(fieldChips.map((chip) => chip.suggestion.field));
  const shownFields = showAll ? FACE_FIELDS : FACE_FIELDS.filter((f) => differingFields.has(f));
  const landscape = getOrientation(detail.card?.types ?? []) === "landscape";
  const activeImage = model.images.find((image) => image.isActive);
  const faceCount = new Set(detail.printings.map((printing) => printing.faceId)).size;
  const printingCount = new Set(detail.printings.map((printing) => printing.id)).size;

  const primaryAndNext = async () => {
    await actions.runPrimary();
    navigation.goNext();
  };

  return (
    <RecordPane
      header={
        <RecordHeader
          thumb={
            <PrintingImageBox
              url={activeImage === undefined ? null : printingImageDisplayUrl(activeImage)}
              alt={detail.displayName}
              className="w-12 shrink-0"
              landscape={landscape}
            />
          }
          title={detail.displayName}
          subtitle={[
            formatPrintingCode(face.publicCode),
            face.language,
            formatSuggestionValue("finish", face.finish, labels),
          ].join(" · ")}
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={() => navigation.skipToEnd()}>
                Skip to end <Kbd>S</Kbd>
              </Button>
              {isAdmin && (
                <span title={contributorWaiting ? CONTRIBUTOR_FIRST : undefined}>
                  <Button
                    size="sm"
                    disabled={actions.pending || contributorWaiting}
                    onClick={() => void primaryAndNext()}
                  >
                    {primaryLabel(actions.enterCount)}
                    <Kbd>↵</Kbd>
                  </Button>
                </span>
              )}
              <FaceActionsMenu cardSlug={cardSlug} faceId={faceId} />
            </>
          }
        />
      }
      banner={
        isAdmin && (actions.enterCount > 0 || contributorWaiting) ? (
          <RecordBanner>
            {actions.enterCount > 0 &&
              `Enter discards ${actions.enterCount} ${pluralize(actions.enterCount, "source")} (${enterProviders.join(", ")}) and opens the next face. `}
            {contributorWaiting && CONTRIBUTOR_FIRST}
          </RecordBanner>
        ) : undefined
      }
    >
      <FaceImagesSection
        cardSlug={cardSlug}
        face={face}
        detail={detail}
        model={model}
        providerSettings={providerSettings}
        isAdmin={isAdmin}
        chips={actions.chips}
        hotkeyOf={hotkeyOf}
        discardLabelOf={discardLabelOf}
        pending={actions.pending}
        onUse={(chip) => actions.applyChip(chip)}
        onDiscard={(id) => actions.discard(id)}
        onReject={(id) => actions.reject(id)}
        onReply={setReplyTo}
        landscape={landscape}
      />

      <RecordSection
        title="Face fields"
        actions={
          <>
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="Which fields"
              value={[showAll ? "all" : "differences"]}
              onValueChange={([next]) => setShowAll(next === "all")}
            >
              <ToggleGroupItem value="differences">Differences</ToggleGroupItem>
              <ToggleGroupItem value="all">All fields</ToggleGroupItem>
            </ToggleGroup>
            {isAdmin && !editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </>
        }
      >
        <SourceStrip
          sources={model.sources.map((source) => ({
            key: source.candidatePrintingId,
            label: source.provider,
            differences: source.differences,
            trusted: trusted.has(source.provider),
          }))}
          onCompare={() => setCompareOpen(true)}
        />
        {editing ? (
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <PrintingDeskEditFields
              printingId={face.id}
              side={face.side}
              scope="face"
              onSaved={() => {
                setEditing(false);
                void queryClient.invalidateQueries({ queryKey: adminKeys.workspace });
                void queryClient.invalidateQueries({ queryKey: adminKeys.cards.detail(cardSlug) });
              }}
              onCancel={() => setEditing(false)}
            />
          </Suspense>
        ) : (
          <div>
            {shownFields.map((field) => (
              <FieldRow
                key={field}
                label={PRINTING_FIELD_LABELS[field]}
                value={formatSuggestionValue(
                  field,
                  (face as unknown as Record<string, unknown>)[field],
                  labels,
                )}
                suggestions={
                  differingFields.has(field) ? (
                    <>
                      {fieldChips
                        .filter((chip) => chip.suggestion.field === field)
                        .map((chip) => {
                          const { suggestion } = chip;
                          return (
                            <SuggestionChip
                              key={chip.key}
                              tone={suggestion.isContributor ? "contributor" : "source"}
                              sourceLabel={
                                suggestion.isContributor ? "Contributor" : suggestion.provider
                              }
                              value={formatSuggestionValue(field, suggestion.proposed, labels)}
                              hotkey={hotkeyOf(chip.key)}
                              pending={actions.pending}
                              onUse={() => actions.applyChip(chip)}
                              onDiscard={
                                suggestion.isContributor || !isAdmin
                                  ? undefined
                                  : () => actions.discard(suggestion.candidate.id)
                              }
                              discardDisabledReason={
                                suggestion.isContributor ? undefined : ADMIN_ONLY_DISCARD
                              }
                              discardLabel={discardLabelOf(
                                suggestion.candidate.id,
                                suggestion.provider,
                              )}
                              onReject={
                                suggestion.isContributor
                                  ? () => actions.reject(suggestion.candidate.candidateCardId)
                                  : undefined
                              }
                              onReply={
                                suggestion.isContributor && isAdmin
                                  ? () => setReplyTo(suggestion.candidate.candidateCardId)
                                  : undefined
                              }
                              replyDisabledReason={
                                suggestion.isContributor ? ADMIN_ONLY_REPLY : undefined
                              }
                            />
                          );
                        })}
                    </>
                  ) : undefined
                }
              />
            ))}
            {!showAll && (
              <p className="text-muted-foreground pt-2 text-sm">
                {differingFields.size === 0
                  ? "No source differs on this face."
                  : `${model.agreeingFields} ${pluralize(model.agreeingFields, "field")} agree.`}
              </p>
            )}
          </div>
        )}
      </RecordSection>

      <RecordSection title="Card">
        <Link
          to="/admin/workspace/cards/$cardSlug"
          params={{ cardSlug }}
          className="inline-flex items-center gap-1 underline"
        >
          {detail.displayName}
          <ChevronRightIcon className="size-4" />
        </Link>
        <p className="text-muted-foreground text-sm">
          {faceCount} {pluralize(faceCount, "face")} · {printingCount}{" "}
          {pluralize(printingCount, "printing")}
        </p>
      </RecordSection>

      <FacePrintingsSection printings={model.printings} cardName={detail.displayName} />

      <WorkspaceHistorySection target={{ faceId }} />
      {compareOpen && (
        <FaceCompareSourcesDialog
          open
          onOpenChange={setCompareOpen}
          cardSlug={cardSlug}
          faceId={faceId}
          detail={detail}
          providerSettings={providerSettings}
          hiddenProviders={hiddenProviders}
          costKeywords={costKeywords}
          isAdmin={isAdmin}
        />
      )}
      <SendNoteDialog
        candidateCardId={replyTo}
        submitterName={replyTo === null ? null : submitterNameOf([detail], replyTo)}
        onOpenChange={(open) => {
          if (!open) {
            setReplyTo(null);
          }
        }}
      />
    </RecordPane>
  );
}

function FacePrintingsSection({
  printings,
  cardName,
}: {
  printings: readonly AdminPrintingResponse[];
  cardName: string;
}) {
  return (
    <RecordSection title="On printings">
      <ul className="space-y-1">
        {printings.map((printing) => (
          <li key={printing.id} className="flex flex-wrap items-center gap-2">
            <Link
              to="/admin/workspace/printings/$printingId"
              params={{ printingId: printing.id }}
              className="inline-flex items-center gap-1.5 underline"
            >
              {printingPairName(printing, cardName)}
              <span className="text-muted-foreground font-mono">
                {formatPrintingCode(printing.publicCode)}
              </span>
            </Link>
            <DeskStatusBadge row={printing} />
          </li>
        ))}
      </ul>
      {printings.length > 1 && (
        <p className="text-muted-foreground text-sm">Edits here show on every printing listed.</p>
      )}
    </RecordSection>
  );
}

function FaceActionsMenu({ cardSlug, faceId }: { cardSlug: string; faceId: string }) {
  const { copy } = useCopyToClipboard();

  const copyId = async () => {
    if (await copy(faceId)) {
      toast.success("Copied the face ID");
    } else {
      toast.error("Could not copy the face ID");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <EllipsisVerticalIcon />
        <span className="sr-only">Face actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          render={<Link to="/admin/workspace/cards/$cardSlug" params={{ cardSlug }} />}
        >
          <SquareArrowOutUpRightIcon />
          Open card
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void copyId()}>
          <CopyIcon />
          Copy face ID
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WorkspaceHistorySection({
  target,
  summary,
}: {
  target: WorkspaceHistoryTarget;
  summary?: string;
}) {
  const history = useWorkspaceHistory(target);
  return (
    <RecordSection
      title="History"
      collapsible
      defaultOpen={false}
      summary={summary ?? history.summary}
    >
      <WorkspaceHistoryList
        events={history.events}
        isPending={history.isPending}
        isError={history.isError}
      />
    </RecordSection>
  );
}

function WorkspaceHistoryList({
  events,
  isPending,
  isError,
}: {
  events: readonly WorkspaceEvent[];
  isPending: boolean;
  isError: boolean;
}) {
  if (isPending) {
    return <Skeleton className="h-16 w-full" />;
  }
  if (isError) {
    return <p className="text-muted-foreground text-sm">The change log could not be loaded.</p>;
  }
  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">Nothing has happened here yet.</p>;
  }
  return (
    <ul className="space-y-1">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap items-baseline gap-x-3">
          <span className="min-w-0 flex-1">{event.label}</span>
          <span className="text-muted-foreground text-sm">
            {formatRelativeTime(event.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function pickDeskRow(
  rows: readonly DeskPrintingRow[],
  faceId: string,
  fromPrintingId?: string,
): DeskPrintingRow | null {
  const from = rows.find((row) => row.printingId === fromPrintingId);
  if (from !== undefined) {
    return from;
  }
  const onFace = rows.filter((row) => row.faceId === faceId);
  return onFace.find((row) => row.canEdit) ?? onFace[0] ?? null;
}

function DeskFaceRecord({ cardSlug, faceId }: { cardSlug: string; faceId: string }) {
  const { data } = useDeskCardPrintings(cardSlug);
  const fromPrintingId = useLocation({
    select: (location) => location.state.workspaceFromPrintingId,
  });
  const row = pickDeskRow(data.printings, faceId, fromPrintingId);
  useRegisterRecordActions({});

  if (row === null) {
    return (
      <p className="text-muted-foreground p-4">This face is not on a printing you can open.</p>
    );
  }
  return <DeskFaceBody printingId={row.printingId} faceId={faceId} cardRows={data.printings} />;
}

function DeskFaceBody({
  printingId,
  faceId,
  cardRows,
}: {
  printingId: string;
  faceId: string;
  cardRows: readonly DeskPrintingRow[];
}) {
  const { data } = useDeskPrinting(printingId, 1);
  const labels = useValueLabels();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const printing = data.printing;
  const faces = printingFaces(printing);
  const face = faces.find((entry) => entry.faceId === faceId) ?? faces[0];
  if (face === undefined) {
    return null;
  }
  const canEdit = printing.canEdit;
  const landscape = getOrientation([printing.cardType]) === "landscape";
  const pairName = faces.map((entry) => entry.cardName).join(" // ");
  const editableIds = new Set(cardRows.filter((row) => row.canEdit).map((row) => row.printingId));
  const onPrintings = [
    {
      printingId,
      code: faces.map((entry) => formatPrintingCode(entry.publicCode)).join(" // "),
      canEdit,
    },
    ...face.sharedWith.map((shared) => ({
      printingId: shared.printingId,
      code: formatPrintingCode(shared.publicCode),
      canEdit: editableIds.has(shared.printingId),
    })),
  ];
  const fieldRows = [
    { label: "Code", value: formatPrintingCode(face.publicCode) },
    { label: "Set", value: face.setName },
    {
      label: "Finish · Language",
      value: `${formatSuggestionValue("finish", face.finish, labels)} · ${face.language}`,
    },
    { label: "Rarity", value: formatSuggestionValue("rarity", face.rarity, labels) },
    { label: "Markers", value: formatSuggestionValue("markerSlugs", face.markerSlugs, labels) },
    { label: "Artist", value: formatSuggestionValue("artist", face.artist, labels) },
  ];

  return (
    <RecordPane
      header={
        <RecordHeader
          thumb={
            <Link
              to="/admin/workspace/printings/$printingId"
              params={{ printingId }}
              aria-label={`Back to ${pairName}`}
              className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            >
              <ArrowLeftIcon />
            </Link>
          }
          title={face.cardName}
          subtitle={
            <>
              {formatPrintingCode(face.publicCode)} · {face.language} · from{" "}
              <Link
                to="/admin/workspace/printings/$printingId"
                params={{ printingId }}
                className="underline"
              >
                {pairName}
              </Link>
            </>
          }
        />
      }
      banner={
        <RecordBanner>
          {canEdit
            ? "You can edit this face because it is on a promo printing. Edits show on every printing listed below."
            : "Only an admin changes this face."}
        </RecordBanner>
      }
    >
      <DeskFaceImagesSection
        printing={printing}
        imageFace={face.imageFace}
        images={data.images}
        canEdit={canEdit}
        landscape={landscape}
      />

      <RecordSection title="Face fields">
        {editing ? (
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <PrintingDeskEditFields
              printingId={printingId}
              side={face.position}
              scope="face"
              onSaved={() => {
                setEditing(false);
                void queryClient.invalidateQueries({ queryKey: adminKeys.workspace });
              }}
              onCancel={() => setEditing(false)}
            />
          </Suspense>
        ) : (
          <div>
            {fieldRows.map((entry) => (
              <FieldRow
                key={entry.label}
                label={entry.label}
                value={entry.value}
                onEdit={canEdit ? () => setEditing(true) : undefined}
              />
            ))}
          </div>
        )}
      </RecordSection>

      <RecordSection title="On printings">
        <ul className="space-y-1">
          {onPrintings.map((entry) => (
            <li key={entry.printingId} className="flex flex-wrap items-center gap-2">
              <Link
                to="/admin/workspace/printings/$printingId"
                params={{ printingId: entry.printingId }}
                className="underline"
              >
                {entry.code}
              </Link>
              <Badge variant="neutral">
                {entry.canEdit ? "yours to edit" : "added by an admin"}
              </Badge>
            </li>
          ))}
        </ul>
      </RecordSection>

      {onPrintings.some((entry) => entry.canEdit) && (
        <WorkspaceHistorySection target={{ faceId }} summary="Your edits only" />
      )}
    </RecordPane>
  );
}
