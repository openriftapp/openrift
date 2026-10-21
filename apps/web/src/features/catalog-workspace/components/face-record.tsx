import { getOrientation } from "@openrift/shared/card-orientation";
import { COMPARABLE_PRINTING_FIELDS } from "@openrift/shared/catalog-field-compare";
import type { DeskPrintingRow } from "@openrift/shared/contracts/admin/printing-desk";
import { formatPrintingCode } from "@openrift/shared/printing-code";
import { isPrintingLevelField } from "@openrift/shared/printing-field-level";
import { pluralize } from "@openrift/shared/strings";
import type {
  AdminCardDetailResponse,
  AdminPrintingResponse,
} from "@openrift/shared/types/api/admin";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import { Suspense, useState } from "react";

import { ShowMoreButton } from "@/components/show-more-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardList } from "@/components/ui/card-list";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HistoryRow } from "@/features/admin/components/card-history-section";
import { PrintingDeskEditFields } from "@/features/admin/components/printing-desk-form-page";
import { PrintingImageBox } from "@/features/admin/components/printing-image-box";
import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import { useAuditEvents } from "@/features/admin/hooks/use-admin-audit";
import { useAdminCardDetail } from "@/features/admin/hooks/use-admin-card-queries";
import { useDeskCardPrintings, useDeskPrinting } from "@/features/admin/hooks/use-printing-desk";
import { useProviderSettings } from "@/features/admin/hooks/use-provider-settings";
import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import { PRINTING_FIELD_LABELS } from "@/features/admin/lib/catalog-field-labels";
import { printingPairName } from "@/features/admin/lib/face-rows";
import { printingFaces } from "@/features/admin/lib/printing-faces";
import { printingImageDisplayUrl } from "@/features/admin/lib/printing-image-display-url";
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
import {
  buildFaceSuggestions,
  discardLabel,
  formatSuggestionValue,
  primaryLabel,
} from "@/features/catalog-workspace/lib/face-suggestion-rows";
import { useCostKeywords } from "@/hooks/use-keyword-styles";
import { useUserId } from "@/hooks/use-session";

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
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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
  const contributorWaiting = actions.chips.some((chip) =>
    chip.kind === "image" ? chip.image.isContributor : chip.suggestion.isContributor,
  );
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
                <Button size="sm" disabled={actions.pending} onClick={() => void primaryAndNext()}>
                  {primaryLabel(actions.enterCount)}
                  <Kbd>↵</Kbd>
                </Button>
              )}
            </>
          }
        />
      }
      banner={
        isAdmin && (actions.enterCount > 0 || contributorWaiting) ? (
          <RecordBanner>
            {actions.enterCount > 0 &&
              `Enter discards ${actions.enterCount} ${pluralize(actions.enterCount, "source")} (${enterProviders.join(", ")}) and opens the next face. `}
            {contributorWaiting && "Use or reject the contributor proposal first."}
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
          onCompare={() =>
            void navigate({
              to: "/admin/cards/$cardSlug",
              params: { cardSlug },
              search: { section: "printings", face: faceId },
            })
          }
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
                              discardLabel={discardLabelOf(
                                suggestion.candidate.id,
                                suggestion.provider,
                              )}
                              onReject={
                                suggestion.isContributor
                                  ? () => actions.reject(suggestion.candidate.candidateCardId)
                                  : undefined
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

      {isAdmin && (
        <RecordSection title="History" collapsible defaultOpen={false}>
          {model.printings.map((printing) => (
            <PrintingHistoryList key={printing.id} printingId={printing.id} />
          ))}
        </RecordSection>
      )}
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
          <li key={printing.id}>
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
          </li>
        ))}
      </ul>
      {printings.length > 1 && (
        <p className="text-muted-foreground text-sm">Edits here show on every printing listed.</p>
      )}
    </RecordSection>
  );
}

export function PrintingHistoryList({ printingId }: { printingId: string }) {
  const userId = useUserId();
  const events = useAuditEvents({ search: printingId });
  const rows = (events.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (event) => event.entityType === "printing" && event.entityId === printingId,
  );

  if (events.isPending) {
    return <Skeleton className="h-16 w-full" />;
  }
  if (events.isError) {
    return <p className="text-muted-foreground text-sm">The change log could not be loaded.</p>;
  }

  return (
    <div className="space-y-2">
      {rows.length > 0 ? (
        <CardList>
          {rows.map((event) => (
            <HistoryRow key={event.id} event={event} userId={userId} context={{}} />
          ))}
        </CardList>
      ) : (
        !events.hasNextPage && (
          <p className="text-muted-foreground text-sm">Nothing has happened here yet.</p>
        )
      )}
      {events.hasNextPage && (
        <ShowMoreButton
          className="mt-0"
          pending={events.isFetchingNextPage}
          onClick={() => void events.fetchNextPage()}
        >
          {events.isFetchingNextPage ? "Looking further back" : "Load more"}
        </ShowMoreButton>
      )}
    </div>
  );
}

function pickDeskRow(rows: readonly DeskPrintingRow[], faceId: string): DeskPrintingRow | null {
  const onFace = rows.filter((row) => row.faceId === faceId);
  return onFace.find((row) => row.canEdit) ?? onFace[0] ?? null;
}

function DeskFaceRecord({ cardSlug, faceId }: { cardSlug: string; faceId: string }) {
  const { data } = useDeskCardPrintings(cardSlug);
  const row = pickDeskRow(data.printings, faceId);
  useRegisterRecordActions({});

  if (row === null) {
    return (
      <p className="text-muted-foreground p-4">This face is not on a printing you can open.</p>
    );
  }
  return <DeskFaceBody printingId={row.printingId} faceId={faceId} />;
}

function DeskFaceBody({ printingId, faceId }: { printingId: string; faceId: string }) {
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
          <li className="flex items-center gap-2">
            <Link
              to="/admin/workspace/printings/$printingId"
              params={{ printingId }}
              className="underline"
            >
              {faces.map((entry) => formatPrintingCode(entry.publicCode)).join(" // ")}
            </Link>
            {canEdit && <Badge variant="neutral">yours to edit</Badge>}
          </li>
          {face.sharedWith.map((shared) => (
            <li key={shared.printingId}>
              <Link
                to="/admin/workspace/printings/$printingId"
                params={{ printingId: shared.printingId }}
                className="underline"
              >
                {formatPrintingCode(shared.publicCode)}
              </Link>
            </li>
          ))}
        </ul>
      </RecordSection>
    </RecordPane>
  );
}
