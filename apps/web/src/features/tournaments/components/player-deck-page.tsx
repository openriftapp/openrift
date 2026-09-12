import { formatDay, formatDayTimeLocal } from "@openrift/shared/format-date";
import type {
  DeckCheckEntryCardResponse,
  PlayerDeckCheckEntryDetailResponse,
} from "@openrift/shared/types/api/deck-check";
import { WellKnown } from "@openrift/shared/well-known";
import { useNavigate } from "@tanstack/react-router";
import { FileQuestionIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { PageTopBarButton, PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionHeading } from "@/components/ui/section-heading";
import { Skeleton } from "@/components/ui/skeleton";
import { CardCell } from "@/features/cards/components/card-cell";
import { useCardThumbnailDisplay } from "@/features/cards/hooks/use-card-thumbnail-display";
import { useCards } from "@/features/cards/hooks/use-cards";
import { DeckDomainBar } from "@/features/decks/components/deck-domain-bar";
import { FormatStateBadge } from "@/features/decks/components/deck-format-badge";
import { typeCountSummary } from "@/features/decks/components/deck-tile";
import { useCreateDeck, useSaveDeckCards } from "@/features/decks/hooks/use-decks";
import { DeckCheckCardZonesSkeleton } from "@/features/tournaments/components/deck-check-skeletons";
import { PlayerDeckSourceForm } from "@/features/tournaments/components/player-deck-source-form";
import type { DeckSourceInput } from "@/features/tournaments/components/player-deck-source-form";
import { TournamentSectionFrame } from "@/features/tournaments/components/tournament-detail-frame";
import {
  useCancelUnlockRequest,
  useEditMyTournamentDeck,
  useMyTournamentDeck,
  usePreviewTournamentDeck,
  useSubmitMyTournamentDeck,
  useUnlockMyTournamentDeck,
} from "@/features/tournaments/hooks/use-deck-check-player";
import { deckCardsFromCheckEntry } from "@/features/tournaments/lib/deck-check-save";
import { useDeckFormatList, useZoneOrder } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

const PLAYER_CELL_WIDTH = 150;

export function PlayerDeckPage({ tournamentId }: { tournamentId: string }) {
  const { data, isPending, isError } = useMyTournamentDeck(tournamentId);

  return (
    <TournamentSectionFrame
      id={tournamentId}
      section="my-deck"
      actions={
        data ? (
          <>
            <SaveToDecksButton data={data} />
            <PlayerDeckActions entry={data.entry} tournamentId={tournamentId} />
          </>
        ) : undefined
      }
      render={() =>
        isPending ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-2 w-full" />
            <DeckCheckCardZonesSkeleton cellWidth={PLAYER_CELL_WIDTH} />
          </div>
        ) : isError || !data ? (
          <EmptyState
            className="py-12"
            icon={FileQuestionIcon}
            title={m.tournaments_my_deck_unavailable_title()}
            description={m.tournaments_my_deck_unavailable_description()}
          />
        ) : (
          <PlayerDeckBody data={data} />
        )
      }
    />
  );
}

function PlayerDeckBody({ data }: { data: PlayerDeckCheckEntryDetailResponse }) {
  const { entry } = data;
  const eventDate = entry.eventDate ? formatDay(entry.eventDate) : null;
  // Local time zone is safe only because this route is `data-only`.
  const closesAt = entry.submissionsCloseAt ? formatDayTimeLocal(entry.submissionsCloseAt) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-sm">
          {[entry.groupName, eventDate].filter(Boolean).join(" · ")}
        </span>
        <span className="flex-1" />
        {entry.reviewOutcome === "issue" && entry.state === "editable" ? (
          <Badge variant="destructive">{m.tournaments_my_deck_changes_requested()}</Badge>
        ) : null}
        {entry.unlockRequested ? (
          <Badge variant="outline">{m.tournaments_deck_check_unlock_requested()}</Badge>
        ) : null}
        <PlayerStateBadge state={entry.state} reviewOutcome={entry.reviewOutcome} />
      </div>

      {entry.state === "withdrawn" ? (
        <Banner>{m.tournaments_my_deck_withdrawn_banner()}</Banner>
      ) : null}
      {entry.playerMessage ? (
        <Callout className="text-sm">
          <p className="text-muted-foreground mb-1 font-medium">
            {m.tournaments_my_deck_judge_message()}
          </p>
          <p className="whitespace-pre-wrap">{entry.playerMessage}</p>
        </Callout>
      ) : null}
      {entry.state === "editable" && entry.windowOpen ? (
        <Banner>
          {m.tournaments_my_deck_not_submitted_banner({
            deadline: closesAt ? m.tournaments_my_deck_before_deadline({ time: closesAt }) : "",
          })}
        </Banner>
      ) : null}
      {entry.state === "submitted" && entry.windowOpen ? (
        <p className="text-muted-foreground text-sm">
          {entry.canUnlock
            ? m.tournaments_my_deck_locked_unlock({
                deadline: closesAt ? m.tournaments_my_deck_until_deadline({ time: closesAt }) : "",
              })
            : entry.unlockRequested
              ? m.tournaments_my_deck_waiting_for_unlock()
              : m.tournaments_my_deck_submitted_locked()}
        </p>
      ) : null}
      {entry.state === "approved" && entry.windowOpen ? (
        <p className="text-muted-foreground text-sm">
          {entry.unlockRequested
            ? m.tournaments_my_deck_waiting_for_unlock()
            : m.tournaments_my_deck_approved_locked()}
        </p>
      ) : null}
      {!entry.windowOpen && entry.state !== "withdrawn" && entry.state !== "checked" ? (
        <p className="text-muted-foreground text-sm">
          {m.tournaments_my_deck_submissions_closed()}
        </p>
      ) : null}
      <p className="text-muted-foreground text-sm">
        {sharingSummary(
          entry.allowDeckPublishing,
          entry.allowNameSharing,
          entry.allowRiotIdSharing,
        )}
        {entry.canEdit ? m.tournaments_my_deck_can_edit_note() : ""}
      </p>
      {data.violations.length > 0 ? (
        <Banner>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {data.violations.map((violation) => (
              <li key={`${violation.zone}:${violation.code}:${violation.cardId ?? ""}`}>
                {violation.message}
              </li>
            ))}
          </ul>
        </Banner>
      ) : null}

      <DeckMetaSummary data={data} />
      <PlayerCardGrid cards={data.cards} />
    </div>
  );
}

// Mirrors the labels in `MY_DECK_STATE_LABEL`; keep both in sync.
function PlayerStateBadge({
  state,
  reviewOutcome,
}: {
  state: PlayerDeckCheckEntryDetailResponse["entry"]["state"];
  reviewOutcome: PlayerDeckCheckEntryDetailResponse["entry"]["reviewOutcome"];
}) {
  if (state === "editable") {
    return <Badge variant="outline">{m.tournaments_my_deck_state_not_submitted()}</Badge>;
  }
  if (state === "approved") {
    return <Badge>{m.tournaments_deck_check_state_approved()}</Badge>;
  }
  if (state === "checked") {
    return reviewOutcome === "issue" ? (
      <Badge variant="destructive">{m.tournaments_deck_check_state_checked_issue()}</Badge>
    ) : (
      <Badge>{m.tournaments_deck_check_state_checked()}</Badge>
    );
  }
  if (state === "withdrawn") {
    return <Badge variant="secondary">{m.tournaments_deck_check_state_withdrawn()}</Badge>;
  }
  return <Badge variant="secondary">{m.tournaments_deck_check_state_submitted()}</Badge>;
}

function sharingSummary(allowPublish: boolean, allowName: boolean, allowRiotId: boolean): string {
  if (!allowPublish) {
    return m.tournaments_my_deck_sharing_none();
  }
  if (allowName && allowRiotId) {
    return m.tournaments_my_deck_sharing_all();
  }
  if (allowName) {
    return m.tournaments_my_deck_sharing_name_only();
  }
  if (allowRiotId) {
    return m.tournaments_my_deck_sharing_riot_only();
  }
  return m.tournaments_my_deck_sharing_anonymous();
}

function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-warning/40 bg-warning-soft flex items-start gap-2 rounded-md border p-3 text-sm">
      <TriangleAlertIcon className="text-warning mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function DeckMetaSummary({ data }: { data: PlayerDeckCheckEntryDetailResponse }) {
  const typeSummary = typeCountSummary(data.typeCounts);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        {typeSummary ? (
          <span className="text-muted-foreground text-2xs">{typeSummary}</span>
        ) : (
          <span />
        )}
        {data.entry.format ? (
          <FormatStateBadge format={data.entry.format} isValid={data.violations.length === 0} />
        ) : null}
      </div>
      {data.domainDistribution.length > 0 ? (
        <DeckDomainBar distribution={data.domainDistribution} />
      ) : null}
    </div>
  );
}

function PlayerCardGrid({ cards }: { cards: DeckCheckEntryCardResponse[] }) {
  const { zoneLabels } = useZoneOrder();
  const cardsByZone = Map.groupBy(cards, (card) => card.zone);
  const zones = (
    [
      WellKnown.deckZone.LEGEND,
      WellKnown.deckZone.CHAMPION,
      WellKnown.deckZone.BATTLEFIELD,
      WellKnown.deckZone.MAIN,
      WellKnown.deckZone.SIDEBOARD,
      WellKnown.deckZone.OVERFLOW,
      WellKnown.deckZone.RUNES,
    ] as const
  ).filter((zone) => cardsByZone.has(zone));

  return (
    <div className="flex flex-col gap-6">
      {zones.map((zone) => {
        const zoneCards = (cardsByZone.get(zone) ?? []).toSorted(
          (left, right) => left.sortOrder - right.sortOrder,
        );
        const copies = zoneCards.reduce((sum, card) => sum + card.quantity, 0);
        return (
          <section key={zone} className="flex min-w-0 flex-col gap-2">
            <SectionHeading as="h3">
              {zoneLabels[zone]} · {copies}
            </SectionHeading>
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(min(${PLAYER_CELL_WIDTH}px, 100%), 1fr))`,
              }}
            >
              {zoneCards.flatMap((card) =>
                Array.from({ length: card.quantity }, (_copy, copyIndex) => (
                  <PlayerCardCell key={`${card.id}:${copyIndex}`} card={card} />
                )),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PlayerCardCell({ card }: { card: DeckCheckEntryCardResponse }) {
  const { allPrintings } = useCards();
  const display = useCardThumbnailDisplay();

  const printing = card.resolvedPrintingId
    ? allPrintings.find((candidate) => candidate.id === card.resolvedPrintingId)
    : undefined;

  if (!printing || card.matchStatus !== "matched") {
    return (
      <div className="border-warning/40 bg-warning-soft flex h-full w-full flex-col items-start gap-1 rounded-md border border-dashed p-2 text-left text-sm">
        <span className="font-medium break-all">{card.rawName}</span>
        <span className="text-muted-foreground">
          {card.matchStatus === "ambiguous"
            ? m.tournaments_deck_check_several_matches()
            : m.tournaments_deck_check_not_in_catalog()}
        </span>
      </div>
    );
  }

  return (
    <CardCell
      printing={printing}
      ctx={{ isSelected: false, isFlashing: false, cardWidth: PLAYER_CELL_WIDTH, priority: false }}
      display={display}
      showImages
      // oxlint-disable-next-line no-empty-function -- read-only cell, clicks do nothing
      onClick={() => {}}
    />
  );
}

function SaveToDecksButton({ data }: { data: PlayerDeckCheckEntryDetailResponse }) {
  const createDeck = useCreateDeck();
  const saveDeckCards = useSaveDeckCards();
  const navigate = useNavigate();
  const { formats } = useDeckFormatList();
  const [isSaving, setIsSaving] = useState(false);

  const { cards, skippedCount } = deckCardsFromCheckEntry(data.cards);
  if (cards.length === 0) {
    return null;
  }

  const save = () => {
    setIsSaving(true);
    const name = data.entry.eventName;
    createDeck.mutate(
      { name, format: data.entry.format ?? formats[0]?.slug ?? "" },
      {
        onSuccess: (deck) => {
          saveDeckCards.mutate(
            { deckId: deck.id, cards },
            {
              onSuccess: () => {
                toast.success(
                  skippedCount > 0
                    ? skippedCount === 1
                      ? m.tournaments_my_deck_saved_toast_skipped_one({
                          name,
                          count: skippedCount,
                        })
                      : m.tournaments_my_deck_saved_toast_skipped_other({
                          name,
                          count: skippedCount,
                        })
                    : m.tournaments_my_deck_saved_toast({ name }),
                );
                void navigate({ to: "/decks/$deckId", params: { deckId: deck.id } });
              },
              // Error itself is reported by the global mutation toast.
              onError: () => {
                setIsSaving(false);
              },
            },
          );
        },
        // Error itself is reported by the global mutation toast.
        onError: () => {
          setIsSaving(false);
        },
      },
    );
  };

  return (
    <PageTopBarButton disabled={isSaving} onClick={save}>
      {m.tournaments_my_deck_save_to_decks()}
    </PageTopBarButton>
  );
}

function PlayerDeckActions({
  entry,
  tournamentId,
}: {
  entry: PlayerDeckCheckEntryDetailResponse["entry"];
  tournamentId: string;
}) {
  const submit = useSubmitMyTournamentDeck();
  const unlock = useUnlockMyTournamentDeck();
  const cancelRequest = useCancelUnlockRequest();
  const ref = { entryId: entry.id, tournamentId };

  if (!entry.windowOpen) {
    return null;
  }
  if (entry.state === "editable") {
    return (
      <>
        <ReplaceDeckButton
          entryId={entry.id}
          tournamentId={tournamentId}
          allowDeckPublishing={entry.allowDeckPublishing}
          allowNameSharing={entry.allowNameSharing}
          allowRiotIdSharing={entry.allowRiotIdSharing}
        />
        <PageTopBarPrimaryButton disabled={submit.isPending} onClick={() => submit.mutate(ref)}>
          {m.tournaments_my_deck_submit_for_review()}
        </PageTopBarPrimaryButton>
      </>
    );
  }
  if (entry.canUnlock) {
    return (
      <PageTopBarButton disabled={unlock.isPending} onClick={() => unlock.mutate(ref)}>
        {m.tournaments_my_deck_unlock_to_edit()}
      </PageTopBarButton>
    );
  }
  if (entry.unlockRequested) {
    return (
      <PageTopBarButton
        disabled={cancelRequest.isPending}
        onClick={() => cancelRequest.mutate(ref)}
      >
        {m.tournaments_my_deck_cancel_unlock_request()}
      </PageTopBarButton>
    );
  }
  if (entry.canRequestUnlock) {
    return (
      <PageTopBarButton disabled={unlock.isPending} onClick={() => unlock.mutate(ref)}>
        {m.tournaments_my_deck_request_unlock()}
      </PageTopBarButton>
    );
  }
  return null;
}

function ReplaceDeckButton({
  entryId,
  tournamentId,
  allowDeckPublishing,
  allowNameSharing,
  allowRiotIdSharing,
}: {
  entryId: string;
  tournamentId: string;
  allowDeckPublishing: boolean;
  allowNameSharing: boolean;
  allowRiotIdSharing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const edit = useEditMyTournamentDeck();
  const preview = usePreviewTournamentDeck();

  const submit = async (input: DeckSourceInput) => {
    await edit.mutateAsync({ entryId, tournamentId, ...input });
    preview.reset();
    setOpen(false);
  };

  return (
    <>
      <PageTopBarButton onClick={() => setOpen(true)}>
        {m.tournaments_my_deck_replace_deck()}
      </PageTopBarButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.tournaments_my_deck_replace_title()}</DialogTitle>
            <DialogDescription>{m.tournaments_my_deck_replace_description()}</DialogDescription>
          </DialogHeader>
          <PlayerDeckSourceForm
            submitLabel={m.tournaments_my_deck_replace_deck()}
            pendingLabel={m.tournaments_my_deck_replacing()}
            isSubmitting={edit.isPending}
            onSubmit={(input) => void submit(input)}
            onPreview={(input) => preview.mutate({ entryId, ...input })}
            preview={preview.data ?? null}
            isPreviewing={preview.isPending}
            initialAllowDeckPublishing={allowDeckPublishing}
            initialAllowNameSharing={allowNameSharing}
            initialAllowRiotIdSharing={allowRiotIdSharing}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
