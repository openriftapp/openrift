import { enumLabel } from "@openrift/shared/enum-label";
import { formatDay, formatDayTimeLocal } from "@openrift/shared/format-date";
import type {
  DeckCheckEntryCardResponse,
  PlayerDeckCheckEntryDetailResponse,
} from "@openrift/shared/types/api/deck-check";
import { useNavigate } from "@tanstack/react-router";
import { FileQuestionIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { PageTopBarButton, PageTopBarPrimaryButton } from "@/components/layout/page-top-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useCreateDeck, useSaveDeckCards } from "@/features/decks/hooks/use-decks";
import { importOverflowMessage } from "@/features/decks/lib/deck-import-cards";
import { UnmatchedCardCell } from "@/features/tournaments/components/deck-check-checklist";
import { DeckCheckStatsSummary } from "@/features/tournaments/components/deck-check-entry-header";
import { DeckCheckCardZonesSkeleton } from "@/features/tournaments/components/deck-check-skeletons";
import { DeckCheckStateBadge } from "@/features/tournaments/components/deck-check-state-badge";
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
import { resolvedSide } from "@/features/tournaments/lib/deck-check-side";
import { useZoneOrder } from "@/hooks/use-enums";
import { runReportedMutation } from "@/lib/run-reported-mutation";
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
        {entry.unlockRequested ? (
          <Badge variant="outline">{m.tournaments_deck_check_unlock_requested()}</Badge>
        ) : null}
        <DeckCheckStateBadge
          state={entry.state}
          reviewOutcome={entry.reviewOutcome}
          audience="player"
        />
      </div>

      {entry.state === "withdrawn" ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertDescription>{m.tournaments_my_deck_withdrawn_banner()}</AlertDescription>
        </Alert>
      ) : null}
      {entry.playerMessage ? (
        <Callout className="text-sm">
          <p className="text-muted-foreground mb-1 font-medium">
            {m.tournaments_my_deck_judge_message()}
          </p>
          <p className="whitespace-pre-wrap">{entry.playerMessage}</p>
        </Callout>
      ) : null}
      {entry.leftEvent ? (
        <p className="text-muted-foreground text-sm">{m.tournaments_submit_left_event()}</p>
      ) : null}
      {entry.state === "editable" && entry.windowOpen && !entry.leftEvent ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertDescription>
            {m.tournaments_my_deck_not_submitted_banner({
              deadline: closesAt ? m.tournaments_my_deck_before_deadline({ time: closesAt }) : "",
            })}
          </AlertDescription>
        </Alert>
      ) : null}
      {entry.state === "submitted" && entry.windowOpen && !entry.leftEvent ? (
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
      {entry.state === "approved" && entry.windowOpen && !entry.leftEvent ? (
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
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertDescription>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {data.violations.map((violation) => (
                <li key={`${violation.zone}:${violation.code}:${violation.cardId ?? ""}`}>
                  {violation.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <DeckCheckStatsSummary
        cards={data.cards}
        typeCounts={data.typeCounts}
        format={data.entry.format}
        isValid={data.violations.length === 0}
        domainDistribution={data.domainDistribution}
      />
      <PlayerCardGrid cards={data.cards} />
    </div>
  );
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

export function PlayerCardGrid({ cards }: { cards: DeckCheckEntryCardResponse[] }) {
  const { zoneOrder, zoneLabels } = useZoneOrder();
  const cardsByZone = Map.groupBy(cards, (card) => card.zone);
  const zones = zoneOrder.filter((zone) => cardsByZone.has(zone));

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
              {enumLabel(zoneLabels, zone)} · {copies}
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
  const { printingsById, printingsByCardId } = useCards();
  const display = useCardThumbnailDisplay();

  const printing = resolvedSide(card, printingsById, printingsByCardId);

  if (!printing || card.matchStatus !== "matched") {
    return <UnmatchedCardCell card={card} />;
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

export function SaveToDecksButton({ data }: { data: PlayerDeckCheckEntryDetailResponse }) {
  const createDeck = useCreateDeck();
  const saveDeckCards = useSaveDeckCards();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const { cards, skippedCount, overflow } = deckCardsFromCheckEntry(data.cards);
  if (cards.length === 0) {
    return null;
  }

  const save = async () => {
    const name = data.entry.eventName;
    const format = data.entry.format;
    setSaving(true);
    let deckId: string | undefined;
    const created = await runReportedMutation(async () => {
      const deck = await createDeck.mutateAsync({ name, format });
      deckId = deck.id;
    });
    if (!created || deckId === undefined) {
      setSaving(false);
      return;
    }
    const savedDeckId = deckId;
    const saved = await runReportedMutation(() =>
      saveDeckCards.mutateAsync({ deckId: savedDeckId, cards }),
    );
    if (!saved) {
      setSaving(false);
      return;
    }
    const overflowMessage = importOverflowMessage(overflow);
    if (overflowMessage) {
      toast.warning(overflowMessage);
    }
    toast.success(
      skippedCount > 0
        ? m.tournaments_my_deck_saved_toast_skipped({ name, count: skippedCount })
        : m.tournaments_my_deck_saved_toast({ name }),
    );
    void navigate({ to: "/decks/$deckId", params: { deckId: savedDeckId } });
  };

  return (
    <PageTopBarButton pending={saving} onClick={() => void save()}>
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
  if (entry.state === "editable" && !entry.leftEvent) {
    return (
      <>
        <ReplaceDeckButton
          entryId={entry.id}
          tournamentId={tournamentId}
          allowDeckPublishing={entry.allowDeckPublishing}
          allowNameSharing={entry.allowNameSharing}
          allowRiotIdSharing={entry.allowRiotIdSharing}
        />
        <PageTopBarPrimaryButton pending={submit.isPending} onClick={() => submit.mutate(ref)}>
          {m.tournaments_my_deck_submit_for_review()}
        </PageTopBarPrimaryButton>
      </>
    );
  }
  if (entry.canUnlock) {
    return (
      <PageTopBarButton pending={unlock.isPending} onClick={() => unlock.mutate(ref)}>
        {m.tournaments_my_deck_unlock_to_edit()}
      </PageTopBarButton>
    );
  }
  if (entry.unlockRequested && !entry.leftEvent) {
    return (
      <PageTopBarButton pending={cancelRequest.isPending} onClick={() => cancelRequest.mutate(ref)}>
        {m.tournaments_my_deck_cancel_unlock_request()}
      </PageTopBarButton>
    );
  }
  if (entry.canRequestUnlock) {
    return (
      <PageTopBarButton pending={unlock.isPending} onClick={() => unlock.mutate(ref)}>
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
    if (await runReportedMutation(() => edit.mutateAsync({ entryId, tournamentId, ...input }))) {
      preview.reset();
      setOpen(false);
    }
  };

  return (
    <>
      <PageTopBarButton
        onClick={() => {
          edit.reset();
          setOpen(true);
        }}
      >
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
            isSubmitting={edit.isPending}
            error={edit.error}
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
