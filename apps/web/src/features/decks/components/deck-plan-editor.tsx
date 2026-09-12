import type { DeckFormat, DeckZone } from "@openrift/shared/types/enums";
import { cardSearchAltNames, legendDisplayName } from "@openrift/shared/utils";
import { WellKnown } from "@openrift/shared/well-known";
import {
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CircleXIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import type { ReactNode } from "react";
import { use, useState } from "react";
import { createPortal } from "react-dom";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Heading } from "@/components/heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExpandToggle } from "@/components/ui/expand-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeading } from "@/components/ui/section-heading";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCards } from "@/features/cards/hooks/use-cards";
import { usePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import type { HoverHandler } from "@/features/cards/lib/card-row-interactions";
import { CardChip, CardPicker } from "@/features/decks/components/deck-card-picker";
import { MatchupCard } from "@/features/decks/components/deck-matchup-card";
import { PlanTabActionsContext } from "@/features/decks/components/deck-overview-tabs";
import { SwapColumns } from "@/features/decks/components/swap-column-editor";
import { useDeckPlan, useSaveDeckPlan } from "@/features/decks/hooks/use-deck-plan";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import { sortOverviewCards } from "@/features/decks/lib/deck-card-sort";
import {
  computePlanWarnings,
  createEmptyMatchup,
  createEmptyPlanDraft,
  isMatchupComplete,
  isPlanDraftEmpty,
  planDraftToSaveInput,
  planResponseToDraft,
} from "@/features/decks/lib/deck-plan";
import type {
  DeckPlanContext,
  PlanDraft,
  PlanMatchupDraft,
  PlanWarning,
  SwapDirection,
} from "@/features/decks/lib/deck-plan";
import { zoneExpected } from "@/features/decks/lib/deck-zone-labels";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

function buildContext(deckCards: DeckBuilderCard[]): DeckPlanContext {
  const maindeck = new Map<string, number>();
  const sideboard = new Map<string, number>();
  const battlefieldCardIds = new Set<string>();
  for (const card of deckCards) {
    if (card.zone === WellKnown.deckZone.MAIN) {
      maindeck.set(card.cardId, card.quantity);
    } else if (card.zone === WellKnown.deckZone.SIDEBOARD) {
      sideboard.set(card.cardId, card.quantity);
    } else if (card.zone === WellKnown.deckZone.BATTLEFIELD) {
      battlefieldCardIds.add(card.cardId);
    }
  }
  return { maindeck, sideboard, battlefieldCardIds };
}

function ColumnLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <SectionHeading size="sm" className={className}>
      {children}
    </SectionHeading>
  );
}

function warningMessage(warning: PlanWarning, nameOf: (cardId: string) => string): string {
  switch (warning.code) {
    case "matchup-no-opponent": {
      return m.decks_plan_warning_no_opponent();
    }
    case "swap-unbalanced": {
      return m.decks_plan_warning_unbalanced({
        outCount: warning.outCount,
        inCount: warning.inCount,
      });
    }
    case "in-exceeds-sideboard": {
      return m.decks_plan_warning_in_exceeds({
        requested: warning.requested,
        card: nameOf(warning.cardId),
        available: warning.available,
      });
    }
    case "out-exceeds-maindeck": {
      return m.decks_plan_warning_out_exceeds({
        requested: warning.requested,
        card: nameOf(warning.cardId),
        available: warning.available,
      });
    }
    case "battlefield-not-in-deck": {
      return m.decks_plan_warning_not_battlefield({ card: nameOf(warning.cardId) });
    }
    case "battlefield-duplicate": {
      return m.decks_plan_warning_battlefield_duplicate({ card: nameOf(warning.cardId) });
    }
  }
}

function WarningList({
  warnings,
  nameOf,
}: {
  warnings: PlanWarning[];
  nameOf: (cardId: string) => string;
}) {
  if (warnings.length === 0) {
    return null;
  }
  return (
    <ul className="space-y-1">
      {warnings.map((warning, index) => (
        <li key={index} className="text-warning flex items-start gap-1.5 text-sm">
          <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>{warningMessage(warning, nameOf)}</span>
        </li>
      ))}
    </ul>
  );
}

interface MatchupEditorProps {
  matchup: PlanMatchupDraft;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  cardCandidates: { cardId: string; cardName: string; altNames: string[] }[];
  maindeckCandidates: { cardId: string; cardName: string; quantity: number }[];
  sideboardCandidates: { cardId: string; cardName: string; quantity: number }[];
  warnings: PlanWarning[];
  nameOf: (cardId: string) => string;
  onHoverCard?: HoverHandler;
  onChange: (partial: Partial<PlanMatchupDraft>) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}

function MatchupEditor({
  matchup,
  index,
  isFirst,
  isLast,
  cardCandidates,
  maindeckCandidates,
  sideboardCandidates,
  warnings,
  nameOf,
  onHoverCard,
  onChange,
  onMove,
  onRemove,
}: MatchupEditorProps) {
  const [collapsed, setCollapsed] = useState(false);

  const cardName = matchup.opponentCardId ? nameOf(matchup.opponentCardId) : null;
  const label = matchup.opponentLabel.trim();
  const hasOpponent = cardName !== null || label !== "";
  const summaryTitle = cardName
    ? label
      ? `${cardName} · ${label}`
      : cardName
    : label || m.decks_plan_new_matchup();
  const outCount = matchup.swaps
    .filter((swap) => swap.direction === "out")
    .reduce((total, swap) => total + swap.quantity, 0);
  const inCount = matchup.swaps
    .filter((swap) => swap.direction === "in")
    .reduce((total, swap) => total + swap.quantity, 0);

  const addSwap = (direction: SwapDirection, cardId: string) => {
    if (matchup.swaps.some((swap) => swap.cardId === cardId && swap.direction === direction)) {
      return;
    }
    onChange({ swaps: [...matchup.swaps, { cardId, direction, quantity: 1 }] });
  };
  const setSwapQuantity = (swapIndex: number, quantity: number) => {
    onChange({
      swaps: matchup.swaps.map((swap, i) => (i === swapIndex ? { ...swap, quantity } : swap)),
    });
  };
  const removeSwap = (swapIndex: number) => {
    onChange({ swaps: matchup.swaps.filter((_, i) => i !== swapIndex) });
  };
  // A card missing from candidates returns Infinity, so the row stays editable.
  const maxSwapQuantity = (cardId: string, direction: SwapDirection) => {
    const candidates = direction === "out" ? maindeckCandidates : sideboardCandidates;
    return (
      candidates.find((candidate) => candidate.cardId === cardId)?.quantity ??
      Number.POSITIVE_INFINITY
    );
  };

  return (
    <MatchupCard
      editable
      collapsed={collapsed}
      header={
        <>
          <ExpandToggle
            expanded={!collapsed}
            onClick={() => setCollapsed((value) => !value)}
            className="min-w-0 flex-1"
          >
            <span
              className={cn(
                "truncate text-sm font-medium",
                !hasOpponent && "text-muted-foreground",
              )}
            >
              {summaryTitle}
            </span>
            {outCount + inCount > 0 ? (
              <span className="text-muted-foreground shrink-0 text-xs">
                −{outCount}/+{inCount}
              </span>
            ) : null}
          </ExpandToggle>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isFirst}
              onClick={() => onMove(-1)}
              aria-label={m.decks_plan_move_up()}
            >
              <ArrowUpIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isLast}
              onClick={() => onMove(1)}
              aria-label={m.decks_plan_move_down()}
            >
              <ArrowDownIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRemove}
              aria-label={m.decks_plan_remove_matchup({ index: index + 1 })}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        </>
      }
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <ColumnLabel>{m.decks_plan_key_card()}</ColumnLabel>
          <div className="h-8">
            {matchup.opponentCardId ? (
              <CardChip
                cardId={matchup.opponentCardId}
                variant="field"
                onRemove={() => onChange({ opponentCardId: null })}
                onHoverCard={onHoverCard}
              />
            ) : (
              <CardPicker
                candidates={cardCandidates}
                onSelect={(cardId) => onChange({ opponentCardId: cardId })}
                placeholder={m.decks_plan_card_search_placeholder()}
                listAllWhenEmpty={false}
              />
            )}
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <ColumnLabel>{m.decks_plan_build()}</ColumnLabel>
          <Input
            value={matchup.opponentLabel}
            onChange={(event) => onChange({ opponentLabel: event.target.value })}
            placeholder={m.decks_plan_build_placeholder()}
            maxLength={120}
            className="h-8 w-full"
          />
        </div>
      </div>

      <SwapColumns
        swaps={matchup.swaps}
        maindeckCandidates={maindeckCandidates}
        sideboardCandidates={sideboardCandidates}
        onAdd={addSwap}
        onSetQuantity={setSwapQuantity}
        onRemove={removeSwap}
        onHoverCard={onHoverCard}
        maxQuantityFor={maxSwapQuantity}
      />

      <WarningList warnings={warnings} nameOf={nameOf} />

      <div className="space-y-2">
        <ColumnLabel>{m.decks_plan_matchup_notes()}</ColumnLabel>
        <Textarea
          value={matchup.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
          placeholder={m.decks_plan_optional()}
          rows={2}
          maxLength={4000}
        />
      </div>
    </MatchupCard>
  );
}

export function DeckPlanEditor({
  deckId,
  deckCards,
  format,
  onHoverCard,
}: {
  deckId: string;
  deckCards: DeckBuilderCard[];
  format: DeckFormat;
  onHoverCard?: HoverHandler;
}) {
  const actionsSlot = use(PlanTabActionsContext);
  const { data } = useDeckPlan(deckId);
  const savePlan = useSaveDeckPlan();
  const { allPrintings } = useCards();
  const { getPreferredPrinting } = usePreferredPrinting();
  const [draft, setDraft] = useState<PlanDraft>(() => planResponseToDraft(data.plan));
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const singleBattlefield = zoneExpected(WellKnown.deckZone.BATTLEFIELD, format) === 1;

  const context = buildContext(deckCards);
  const warnings = computePlanWarnings(draft, context);
  const battlefieldWarnings = warnings.filter(
    (warning) =>
      warning.code === "battlefield-not-in-deck" || warning.code === "battlefield-duplicate",
  );
  const nameOf = (cardId: string) =>
    getPreferredPrinting(cardId)?.card.name ?? m.decks_plan_a_card();

  const cardSeen = new Set<string>();
  const cardCandidates: { cardId: string; cardName: string; altNames: string[] }[] = [];
  for (const printing of allPrintings) {
    if (!cardSeen.has(printing.cardId)) {
      cardSeen.add(printing.cardId);
      cardCandidates.push({
        cardId: printing.cardId,
        cardName: legendDisplayName(printing.card),
        altNames: cardSearchAltNames(printing.card, [printing.printedName]),
      });
    }
  }
  const zoneCandidates = (zone: DeckZone) => {
    const inZone = deckCards.filter((card) => card.zone === zone);
    const totalByCard = new Map<string, number>();
    for (const card of inZone) {
      totalByCard.set(card.cardId, (totalByCard.get(card.cardId) ?? 0) + card.quantity);
    }
    return sortOverviewCards(inZone, zone).map((card) => ({
      cardId: card.cardId,
      cardName: card.cardName,
      quantity: totalByCard.get(card.cardId) ?? card.quantity,
    }));
  };
  const maindeckCandidates = zoneCandidates(WellKnown.deckZone.MAIN);
  const sideboardCandidates = zoneCandidates(WellKnown.deckZone.SIDEBOARD);
  const battlefieldCandidates = deckCards
    .filter((card) => card.zone === WellKnown.deckZone.BATTLEFIELD)
    .map((card) => ({ cardId: card.cardId, cardName: card.cardName }));

  const savedPayload = JSON.stringify(planDraftToSaveInput(planResponseToDraft(data.plan)));
  const draftPayload = JSON.stringify(planDraftToSaveInput(draft));
  const isDirty = savedPayload !== draftPayload;

  const updateMatchup = (index: number, partial: Partial<PlanMatchupDraft>) => {
    setDraft((current) => ({
      ...current,
      matchups: current.matchups.map((matchup, i) =>
        i === index ? { ...matchup, ...partial } : matchup,
      ),
    }));
  };
  const moveMatchup = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      const next = [...current.matchups];
      const target = index + direction;
      const moved = next[index];
      const replaced = next[target];
      if (!moved || !replaced) {
        return current;
      }
      next[index] = replaced;
      next[target] = moved;
      return { ...current, matchups: next };
    });
  };

  const setBattlefield = (
    key: "battlefieldGame1CardId" | "battlefieldFirstCardId" | "battlefieldSecondCardId",
    cardId: string | null,
  ) => {
    setDraft((current) => ({ ...current, [key]: cardId }));
  };

  const battlefieldRow = (
    label: string,
    key: "battlefieldGame1CardId" | "battlefieldFirstCardId" | "battlefieldSecondCardId",
  ) => {
    const value = draft[key];
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-muted-foreground text-sm">{label}</span>
        {value ? (
          <CardChip
            cardId={value}
            variant="field"
            onRemove={() => setBattlefield(key, null)}
            onHoverCard={onHoverCard}
          />
        ) : battlefieldCandidates.length > 0 ? (
          <CardPicker
            candidates={battlefieldCandidates}
            onSelect={(cardId) => setBattlefield(key, cardId)}
            placeholder={m.decks_plan_choose_battlefield()}
          />
        ) : (
          <span className="text-muted-foreground text-sm">
            {m.decks_plan_add_battlefields_hint()}
          </span>
        )}
      </div>
    );
  };

  const completeMatchups = draft.matchups.filter(isMatchupComplete).length;

  const actions = (
    <>
      {isDirty ? (
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {m.decks_plan_unsaved_changes()}
        </Badge>
      ) : null}
      {savePlan.isError ? (
        <span className="text-muted-foreground hidden items-center gap-1.5 text-sm sm:inline-flex">
          <CircleXIcon className="text-destructive size-4 shrink-0" />
          {m.decks_plan_save_failed()}
        </span>
      ) : null}
      {isPlanDraftEmpty(draft) ? null : (
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          aria-label={m.decks_plan_clear_plan()}
          onClick={() => setClearConfirmOpen(true)}
        >
          <Trash2Icon />
          <span className="hidden sm:inline">{m.decks_plan_clear_plan()}</span>
        </Button>
      )}
      <Button
        size="sm"
        onClick={() => savePlan.mutate({ deckId, plan: planDraftToSaveInput(draft) })}
        disabled={!isDirty || savePlan.isPending}
      >
        {savePlan.isPending ? m.common_saving() : m.decks_plan_save_plan()}
      </Button>
    </>
  );

  return (
    <div className="space-y-8 pb-8">
      {actionsSlot === undefined && <div className="flex items-center gap-2">{actions}</div>}
      {actionsSlot ? createPortal(actions, actionsSlot) : null}

      <p className="text-muted-foreground max-w-prose">{m.decks_plan_intro()}</p>

      <section className="space-y-2">
        <Label htmlFor="plan-strategy">{m.decks_plan_general_strategy()}</Label>
        <Textarea
          id="plan-strategy"
          value={draft.generalStrategy}
          onChange={(event) =>
            setDraft((current) => ({ ...current, generalStrategy: event.target.value }))
          }
          placeholder={m.decks_plan_strategy_placeholder()}
          rows={4}
          maxLength={8000}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Heading level={3}>{m.decks_plan_mulligan_priority()}</Heading>
          <Label className="flex items-center gap-2 text-sm font-normal">
            <Switch
              checked={draft.mulliganSplit}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, mulliganSplit: checked === true }))
              }
            />
            {m.decks_plan_mulligan_split_label()}
          </Label>
        </div>
        {draft.mulliganSplit ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-sm">{m.decks_plan_going_first()}</span>
              <Textarea
                value={draft.mulliganFirst}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, mulliganFirst: event.target.value }))
                }
                rows={3}
                maxLength={4000}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-muted-foreground text-sm">{m.decks_plan_going_second()}</span>
              <Textarea
                value={draft.mulliganSecond}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, mulliganSecond: event.target.value }))
                }
                rows={3}
                maxLength={4000}
              />
            </div>
          </div>
        ) : (
          <Textarea
            value={draft.mulliganGeneral}
            onChange={(event) =>
              setDraft((current) => ({ ...current, mulliganGeneral: event.target.value }))
            }
            placeholder={m.decks_plan_mulligan_placeholder()}
            rows={3}
            maxLength={4000}
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Heading level={3}>{m.decks_plan_battlefields()}</Heading>
          <Label className="flex items-center gap-2 text-sm font-normal">
            <Switch
              checked={draft.battlefieldCustom}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, battlefieldCustom: checked === true }))
              }
            />
            {m.decks_plan_custom_plan()}
          </Label>
        </div>
        {draft.battlefieldCustom ? (
          <Textarea
            value={draft.battlefieldNote}
            onChange={(event) =>
              setDraft((current) => ({ ...current, battlefieldNote: event.target.value }))
            }
            placeholder={m.decks_plan_battlefield_note_placeholder()}
            rows={3}
            maxLength={4000}
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {singleBattlefield ? (
                <>
                  {/* Extra picks saved before a format switch stay visible to be cleared. */}
                  {battlefieldRow(m.decks_plan_battlefield(), "battlefieldGame1CardId")}
                  {draft.battlefieldFirstCardId
                    ? battlefieldRow(m.decks_plan_going_first(), "battlefieldFirstCardId")
                    : null}
                  {draft.battlefieldSecondCardId
                    ? battlefieldRow(m.decks_plan_going_second(), "battlefieldSecondCardId")
                    : null}
                </>
              ) : (
                <>
                  {battlefieldRow(m.decks_plan_game_1(), "battlefieldGame1CardId")}
                  {battlefieldRow(m.decks_plan_going_first(), "battlefieldFirstCardId")}
                  {battlefieldRow(m.decks_plan_going_second(), "battlefieldSecondCardId")}
                </>
              )}
            </div>
            <WarningList warnings={battlefieldWarnings} nameOf={nameOf} />
          </>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <Heading level={3}>
            {m.decks_plan_matchups()}
            {completeMatchups > 0 ? (
              <span className="text-muted-foreground ml-1 font-normal">({completeMatchups})</span>
            ) : null}
          </Heading>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                matchups: [...current.matchups, createEmptyMatchup()],
              }))
            }
          >
            <PlusIcon className="size-4" />
            {m.decks_plan_add_matchup()}
          </Button>
        </div>
        {draft.matchups.length === 0 ? (
          <p className="text-muted-foreground">{m.decks_plan_no_matchups()}</p>
        ) : (
          <div className="space-y-3">
            {draft.matchups.map((matchup, index) => (
              <MatchupEditor
                // Keyed by uid, not index, so collapse state follows a matchup across reorders.
                key={matchup.uid}
                matchup={matchup}
                index={index}
                isFirst={index === 0}
                isLast={index === draft.matchups.length - 1}
                cardCandidates={cardCandidates}
                maindeckCandidates={maindeckCandidates}
                sideboardCandidates={sideboardCandidates}
                warnings={warnings.filter(
                  (warning) => "matchupIndex" in warning && warning.matchupIndex === index,
                )}
                nameOf={nameOf}
                onHoverCard={onHoverCard}
                onChange={(partial) => updateMatchup(index, partial)}
                onMove={(direction) => moveMatchup(index, direction)}
                onRemove={() =>
                  setDraft((current) => ({
                    ...current,
                    matchups: current.matchups.filter((_, i) => i !== index),
                  }))
                }
              />
            ))}
          </div>
        )}
      </section>

      <ConfirmActionDialog
        open={clearConfirmOpen}
        onOpenChange={setClearConfirmOpen}
        title={m.decks_plan_clear_confirm_title()}
        description={m.decks_plan_clear_confirm_description()}
        confirmLabel={m.decks_plan_clear_plan()}
        pendingLabel={m.decks_plan_clearing()}
        isPending={savePlan.isPending}
        onConfirm={() => {
          const empty = createEmptyPlanDraft();
          setDraft(empty);
          savePlan.mutate(
            { deckId, plan: planDraftToSaveInput(empty) },
            { onSuccess: () => setClearConfirmOpen(false) },
          );
        }}
      />
    </div>
  );
}
