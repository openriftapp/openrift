import { useNavigate } from "@tanstack/react-router";
import { ExpandIcon, PlusIcon, ShrinkIcon } from "lucide-react";
import { useState } from "react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ColumnControls } from "@/features/cards/components/column-controls";
import { SortGroupControls } from "@/features/cards/components/sort-group-controls";
import type { SortGroupOption } from "@/features/cards/components/sort-group-controls";
import { useResponsiveColumns } from "@/features/cards/hooks/use-responsive-columns";
import {
  CHECK_CELL_WIDTH,
  CHECK_GRID_GAP,
  CardChecklist,
  DisplayModeToggle,
} from "@/features/tournaments/components/deck-check-checklist";
import {
  AddCardDialog,
  EditPlayerDialog,
} from "@/features/tournaments/components/deck-check-entry-dialogs";
import {
  DeckEntryTopBar,
  EntryHeader,
  EntryPreview,
  EntryTopBarActions,
  PlayerMessageField,
  StatsSummary,
} from "@/features/tournaments/components/deck-check-entry-header";
import {
  ChangeBanner,
  FindingsBanner,
} from "@/features/tournaments/components/deck-check-findings";
import { DeckCheckCardZonesSkeleton } from "@/features/tournaments/components/deck-check-skeletons";
import {
  useDeleteTournamentDeckCheckEntry,
  useSetTournamentDeckCheckEntryState,
  useTournamentDeckCheckEntry,
} from "@/features/tournaments/hooks/use-tournament-deck-check";
import { zoneFixAllowed } from "@/features/tournaments/lib/deck-check-actions";
import type { DeckCheckSort } from "@/features/tournaments/lib/deck-check-sort";
import { useDeckCheckViewStore } from "@/features/tournaments/stores/deck-check-view-store";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function checkSortOptions(): SortGroupOption<DeckCheckSort>[] {
  return [
    { value: "deck", label: m.tournaments_deck_check_sort_deck_order() },
    { value: "id", label: m.cards_label_id() },
    { value: "name", label: m.cards_label_name() },
    { value: "domain", label: m.cards_label_domain() },
    { value: "energy", label: m.cards_label_energy() },
  ];
}

// Polls so concurrent judges reconcile.
export function TournamentDeckCheckEntry({
  tournamentId,
  entryId,
  canManage,
}: {
  tournamentId: string;
  entryId: string;
  /** Host / organizer: may delete entries (judges can review but not delete). */
  canManage: boolean;
}) {
  const { data: detail, refetch } = useTournamentDeckCheckEntry(tournamentId, entryId);
  const wide = useDeckCheckViewStore((state) => state.wide);
  const setWide = useDeckCheckViewStore((state) => state.setWide);
  const displayMode = useDeckCheckViewStore((state) => state.displayMode);
  const setDisplayMode = useDeckCheckViewStore((state) => state.setDisplayMode);
  const sortBy = useDeckCheckViewStore((state) => state.sortBy);
  const setSortBy = useDeckCheckViewStore((state) => state.setSortBy);
  const sortDir = useDeckCheckViewStore((state) => state.sortDir);
  const setSortDir = useDeckCheckViewStore((state) => state.setSortDir);
  const maxColumns = useDeckCheckViewStore((state) => state.maxColumns);
  const setMaxColumns = useDeckCheckViewStore((state) => state.setMaxColumns);
  const { containerRef, columns, physicalMax, physicalMin, autoColumns, containerWidth } =
    useResponsiveColumns(maxColumns);
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const setState = useSetTournamentDeckCheckEntryState();
  const deleteEntry = useDeleteTournamentDeckCheckEntry();
  const navigate = useNavigate();

  async function handleDelete() {
    try {
      await deleteEntry.mutateAsync({ tournamentId, entryId });
      setDeleteOpen(false);
      void navigate({ to: "/tournaments/$id/decks", params: { id: tournamentId } });
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  // Folds in any unsaved notes so they survive advancing the entry's state.
  const transition = (
    state: "editable" | "submitted" | "approved" | "checked" | "withdrawn",
    reviewOutcome?: "ok" | "issue",
  ) => {
    setState.mutate(
      {
        tournamentId,
        entryId,
        state,
        reviewOutcome,
        ...(notesDirty ? { notes: notes.trim() || null } : {}),
      },
      { onSuccess: () => setNotesDirty(false) },
    );
  };

  if (!detail) {
    return (
      <>
        <DeckEntryTopBar tournamentId={tournamentId} />
        <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-4")}>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex flex-col gap-4 md:flex-row">
            <Skeleton className="aspect-[4/3] w-full shrink-0 rounded-lg md:w-72" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
          <DeckCheckCardZonesSkeleton cellWidth={CHECK_CELL_WIDTH} />
        </div>
      </>
    );
  }

  const cellWidth =
    columns > 0 && containerWidth > 0
      ? Math.floor((containerWidth - (columns - 1) * CHECK_GRID_GAP) / columns)
      : CHECK_CELL_WIDTH;

  // An entry in the editable state gets no cards from the server; the page
  // shows a notice instead of the deck.
  const listHidden = detail.entry.state === "editable";

  return (
    <>
      <DeckEntryTopBar
        tournamentId={tournamentId}
        entry={detail.entry}
        actions={
          <EntryTopBarActions
            entry={detail.entry}
            transition={transition}
            pending={setState.isPending}
            canManage={canManage}
            onEdit={() => setEditOpen(true)}
            onDelete={() => setDeleteOpen(true)}
          />
        }
      />
      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-4")}>
        <EntryHeader
          tournamentId={tournamentId}
          entryId={entryId}
          detail={detail}
          transition={transition}
          pending={setState.isPending}
        />
        <div className="flex flex-col gap-4 md:flex-row">
          {listHidden ? null : <EntryPreview cards={detail.cards} />}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {listHidden ? null : <StatsSummary detail={detail} />}
            <Textarea
              value={notesDirty ? notes : (detail.entry.notes ?? "")}
              onChange={(event) => {
                setNotes(event.target.value);
                setNotesDirty(true);
              }}
              placeholder={m.tournaments_deck_check_notes_placeholder()}
              maxLength={4000}
              rows={3}
              className="flex-1"
            />
            <PlayerMessageField
              tournamentId={tournamentId}
              entryId={entryId}
              entry={detail.entry}
            />
          </div>
        </div>
        {detail.entry.changeSummary ? <ChangeBanner summary={detail.entry.changeSummary} /> : null}
        <FindingsBanner
          tournamentId={tournamentId}
          detail={detail}
          onResolved={() => void refetch()}
        />
        {listHidden ? (
          <Callout className="text-muted-foreground text-sm">
            {m.tournaments_deck_check_hidden_until_submit()}
          </Callout>
        ) : null}
      </div>
      {listHidden ? null : (
        <div
          className={cn(
            "px-safe w-full pt-4 pb-4",
            (!wide || displayMode === "list") && PAGE_WIDTH.capped,
          )}
        >
          <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
            {detail.entry.state === "submitted" ? (
              <Button variant="outline" onClick={() => setAddCardOpen(true)}>
                <PlusIcon className="size-4" />
                {m.tournaments_deck_check_add_card_title()}
              </Button>
            ) : null}
            <SortGroupControls
              sortOptions={checkSortOptions()}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortByChange={setSortBy}
              onSortDirChange={setSortDir}
            />
            <DisplayModeToggle mode={displayMode} onModeChange={setDisplayMode} />
            {displayMode === "grid" ? (
              <ColumnControls
                maxColumns={maxColumns}
                autoColumns={autoColumns}
                minColumns={physicalMin}
                maxColumnsLimit={physicalMax}
                onMaxColumnsChange={setMaxColumns}
              />
            ) : null}
            {displayMode === "grid" ? (
              <Button
                variant="outline"
                className="hidden md:flex"
                aria-pressed={wide}
                onClick={() => setWide(!wide)}
              >
                {wide ? <ShrinkIcon className="size-4" /> : <ExpandIcon className="size-4" />}
                {wide
                  ? m.tournaments_deck_check_narrow_view()
                  : m.tournaments_deck_check_wide_view()}
              </Button>
            ) : null}
          </div>
          <AddCardDialog
            tournamentId={tournamentId}
            entryId={entryId}
            open={addCardOpen}
            onOpenChange={setAddCardOpen}
          />
          <div ref={containerRef}>
            <CardChecklist
              tournamentId={tournamentId}
              entryId={entryId}
              cards={detail.cards}
              displayMode={displayMode}
              sortBy={sortBy}
              sortDir={sortDir}
              columns={columns}
              cellWidth={cellWidth}
              locked={detail.entry.state !== "submitted"}
              fixLocked={!zoneFixAllowed(detail.entry.state)}
              fixZoneOnly={detail.entry.state === "approved" || detail.entry.state === "checked"}
              tickLocked={detail.entry.state !== "submitted" && detail.entry.state !== "approved"}
              onStale={() => void refetch()}
            />
          </div>
        </div>
      )}
      <EditPlayerDialog
        tournamentId={tournamentId}
        entryId={entryId}
        entry={detail.entry}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      {canManage ? (
        <ConfirmActionDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={m.tournaments_deck_check_delete_entry_title()}
          description={m.tournaments_deck_check_delete_entry_description()}
          confirmLabel={m.common_delete()}
          pendingLabel={m.tournaments_deck_check_deleting()}
          isPending={deleteEntry.isPending}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </>
  );
}
