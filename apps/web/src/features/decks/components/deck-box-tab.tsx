import { legendDisplayName } from "@openrift/shared/card-name";
import { getOrientation } from "@openrift/shared/card-orientation";
import { deckCardKey } from "@openrift/shared/deck-cards";
import type { LabelMap } from "@openrift/shared/enum-label";
import { enumLabel } from "@openrift/shared/enum-label";
import type { VariantLabelEnumLabels, VariantLabelPrinting } from "@openrift/shared/printing-label";
import { formatPrintingVariantLabelParts } from "@openrift/shared/printing-label";
import type { Printing } from "@openrift/shared/types/catalog";
import type { DeckZone } from "@openrift/shared/types/enums";
import { WellKnown } from "@openrift/shared/well-known";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRightIcon,
  BoxIcon,
  ChevronDownIcon,
  HandHeartIcon,
  PackageSearchIcon,
  PlusIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Checkbox } from "@/components/ui/checkbox";
import { PickerGroup, PickerList, PickerRow } from "@/components/ui/picker-list";
import {
  ResponsivePopover,
  ResponsivePopoverContent,
  ResponsivePopoverTrigger,
} from "@/components/ui/responsive-popover";
import { TextLink } from "@/components/ui/text-link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CardMiniRow } from "@/features/cards/components/card-mini-row";
import { FilterIcon } from "@/features/cards/components/filter-icon";
import { useCards } from "@/features/cards/hooks/use-cards";
import { resolvePreferredPrinting } from "@/features/cards/hooks/use-preferred-printing";
import { frontImageId } from "@/features/cards/lib/card-meta";
import type { CardOpenTarget, HoverHandler } from "@/features/cards/lib/card-row-interactions";
import {
  cardHoverProps,
  rowActivateProps,
  rowControlClick,
} from "@/features/cards/lib/card-row-interactions";
import { distinctPrintingCode } from "@/features/cards/lib/printing-search-link";
import { useCollections } from "@/features/collections/hooks/use-collections";
import { useMoveCopies } from "@/features/collections/hooks/use-copies";
import { DECK_LIST_SECTION_CLASS } from "@/features/decks/components/deck-overview-list";
import { DeckZoneHeader } from "@/features/decks/components/deck-zone-header";
import { useDeckBox } from "@/features/decks/hooks/use-deck-box";
import { useDeckBoxAdding } from "@/features/decks/hooks/use-deck-box-adding";
import type { DeckBoxCard, DeckBoxCopy, DeckBoxSlot } from "@/features/decks/lib/deck-box";
import {
  creditedPrintings,
  groupBoxSlotsBySet,
  toBoxCardFromDeck,
} from "@/features/decks/lib/deck-box";
import type { DeckBuilderCard } from "@/features/decks/lib/deck-builder-card";
import type { DeckCardGroup, DeckListGroup } from "@/features/decks/lib/deck-card-group";
import { GROUPED_ZONES } from "@/features/decks/lib/deck-card-sort";
import { DECK_ZONE_ORDER } from "@/features/decks/lib/deck-zone-order";
import {
  useDeckBoxOrigins,
  useDeckBoxOriginsStore,
} from "@/features/decks/stores/deck-box-origins-store";
import { useDomainColors } from "@/hooks/use-domain-colors";
import { useEffectiveLanguageOrder } from "@/hooks/use-effective-language-order";
import { useEnumOrders, useZoneOrder } from "@/hooks/use-enums";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

// Excludes Overflow: cards parked there don't travel with the deck.
const BOX_ZONE_ORDER = DECK_ZONE_ORDER.filter((zone) => zone !== WellKnown.deckZone.OVERFLOW);

const SURPLUS_TICK_CLASS =
  "data-checked:border-destructive data-checked:bg-destructive data-checked:text-white dark:data-checked:bg-destructive";

// Resolved once for the tab: the hooks behind these rebuild their maps on
// every call, so a row reading them itself would get a fresh object each time.
interface BoxRowLabels extends VariantLabelEnumLabels {
  rarities: LabelMap;
  conditions: LabelMap;
  domainColors: Record<string, string>;
}

interface DeckBoxTabProps {
  deckId: string;
  cards: DeckBuilderCard[];
  homeCollectionId: string;
  homeCollectionName: string;
  missingCount: number;
  onViewMissing?: () => void;
  sortCards: (zoneCards: DeckBuilderCard[]) => DeckBuilderCard[];
  groupCards: (zoneCards: DeckBuilderCard[]) => DeckCardGroup[];
  groupBy: DeckListGroup;
  groupDir: "asc" | "desc";
  setOrder: readonly { id: string; name: string }[];
  onCardClick?: (card: CardOpenTarget) => void;
  onHoverCard?: HoverHandler;
}

/** Copies in the box that no deck calls for trail the list, already ticked, in red. */
export function DeckBoxTab({
  deckId,
  cards,
  homeCollectionId,
  homeCollectionName,
  missingCount,
  onViewMissing,
  sortCards,
  groupCards,
  groupBy,
  groupDir,
  setOrder,
  onCardClick,
  onHoverCard,
}: DeckBoxTabProps) {
  // Preference for this pull run only; not persisted.
  const [slotCopyIds, setSlotCopyIds] = useState<ReadonlyMap<string, string>>(new Map());
  // Origins live until the deck's editor session ends; without one, an untick sends the copy to the Inbox.
  const origins = useDeckBoxOrigins(deckId);
  const rememberOrigin = useDeckBoxOriginsStore((state) => state.remember);
  const forgetOrigins = useDeckBoxOriginsStore((state) => state.forget);
  const plan = useDeckBox(deckId, cards, homeCollectionId, slotCopyIds);
  const moveCopies = useMoveCopies();
  const adder = useDeckBoxAdding(homeCollectionId, homeCollectionName);
  const { printingsByCardId } = useCards();
  const languageOrder = useEffectiveLanguageOrder();
  const { data: collections } = useCollections();
  const inboxId = collections.find((collection) => collection.isInbox)?.id;
  const { labels: enumLabels } = useEnumOrders();
  const domainColors = useDomainColors();
  const labels: BoxRowLabels = {
    rarities: enumLabels.rarities,
    finishes: enumLabels.finishes,
    artVariants: enumLabels.artVariants,
    cardSizes: enumLabels.cardSizes,
    conditions: enumLabels.conditions,
    domainColors,
  };

  if (!plan) {
    return <p className="text-muted-foreground py-6 text-sm">{m.decks_overview_box_loading()}</p>;
  }

  const slotsByCardKey = Map.groupBy(plan.slots, (slot) => slot.cardKey);

  /** No toast: the tick going green is the feedback, unticking it is the undo. */
  const putIn = (copy: DeckBoxCopy) => {
    rememberOrigin(deckId, copy.copyId, copy.collectionId);
    moveCopies.mutate({ copyIds: [copy.copyId], toCollectionId: homeCollectionId });
  };

  const takeOut = (copyIds: readonly string[], announce = true) => {
    if (inboxId === undefined) {
      return;
    }
    const byTarget = [...Map.groupBy(copyIds, (copyId) => origins[copyId] ?? inboxId)];
    for (const [toCollectionId, ids] of byTarget) {
      moveCopies.mutate({ copyIds: ids, toCollectionId });
    }
    forgetOrigins(deckId, copyIds);
    if (!announce) {
      return;
    }
    const single = byTarget.length === 1 ? byTarget[0]?.[0] : undefined;
    const target = collections.find((collection) => collection.id === single);
    const count = copyIds.length;
    toast.success(
      target
        ? m.decks_overview_box_moved_into({ count, collection: target.name })
        : m.decks_overview_box_moved_out({ count }),
      {
        action: {
          label: m.decks_overview_box_undo(),
          onClick: () => {
            for (const [fromCollectionId, ids] of byTarget) {
              for (const copyId of ids) {
                rememberOrigin(deckId, copyId, fromCollectionId);
              }
            }
            moveCopies.mutate({ copyIds: [...copyIds], toCollectionId: homeCollectionId });
          },
        },
      },
    );
  };

  /** Freezes every row of the card, so acting on one row never reshuffles its siblings. */
  const hold = (target: DeckBoxSlot, copyId: string) => {
    const next = new Map(slotCopyIds);
    for (const slot of plan.slots) {
      if (slot.cardId === target.cardId && slot.copy && slot.state !== "blocked") {
        next.set(slot.key, slot.copy.copyId);
      }
    }
    next.set(target.key, copyId);
    setSlotCopyIds(next);
  };

  const complete = plan.neededTotal > 0 && plan.inBoxTotal === plan.neededTotal;
  const anyMissing = plan.slots.some((slot) => slot.state === "missing");

  const slotRow = (card: DeckBuilderCard, slot: DeckBoxSlot) => {
    const printings = creditedPrintings(cards, card.cardId, printingsByCardId);
    return (
      <SlotRow
        key={slot.key}
        card={toBoxCardFromDeck(card)}
        slot={slot}
        labels={labels}
        siblings={plan.siblingPrintingsByCardId.get(card.cardId) ?? []}
        printings={printings}
        disabled={moveCopies.isPending}
        adding={adder.adding}
        isNew={slot.copy !== undefined && adder.createdIds.has(slot.copy.copyId)}
        onAdd={() => {
          const printing = resolvePreferredPrinting(
            new Map([[card.cardId, printings]]),
            languageOrder,
            card.cardId,
            card.preferredPrintingId,
          );
          if (printing) {
            hold(slot, adder.add(printing.printingId));
          }
        }}
        onReprint={(printingId) => {
          if (slot.copy) {
            hold(slot, adder.replace(slot.copy.copyId, printingId));
          }
        }}
        onTick={() => {
          if (slot.copy) {
            hold(slot, slot.copy.copyId);
            putIn(slot.copy);
          }
        }}
        onTakeOut={() => {
          if (slot.copy && adder.createdIds.has(slot.copy.copyId)) {
            adder.remove(slot.copy.copyId);
          } else if (slot.copy) {
            hold(slot, slot.copy.copyId);
            takeOut([slot.copy.copyId], false);
          }
        }}
        onSwap={(copyId) => hold(slot, copyId)}
        onHoverCard={onHoverCard}
        onOpen={
          onCardClick
            ? () =>
                onCardClick({
                  cardId: card.cardId,
                  preferredPrintingId: slot.copy?.printingId ?? card.preferredPrintingId,
                  zone: card.zone,
                })
            : undefined
        }
      />
    );
  };

  const zones = BOX_ZONE_ORDER.map((zone) => ({
    zone,
    cards: cards.filter((card) => card.zone === zone),
  })).filter((entry) => entry.cards.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground max-w-prose">{m.decks_overview_box_intro()}</p>
      {adder.adding ? (
        <Callout className="border-primary/50 bg-primary/10 flex max-w-prose items-center gap-3 py-3">
          <PlusIcon className="text-primary size-4 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="font-medium">{m.decks_overview_box_adding_title()}</span>
            <span className="text-muted-foreground">
              {m.decks_overview_box_adding_body({ collection: homeCollectionName })}
            </span>
          </div>
          <Button size="sm" onClick={() => adder.finish()}>
            {m.decks_overview_box_adding_done()}
          </Button>
        </Callout>
      ) : (
        anyMissing && (
          <Button variant="link" className="h-auto self-start p-0" onClick={() => adder.start()}>
            <PlusIcon className="size-4" />
            {m.decks_overview_box_adding_start()}
          </Button>
        )
      )}
      <div className="flex items-center gap-2">
        <BoxIcon className="text-muted-foreground size-4" />
        <span className="font-medium">
          <span className="tabular-nums">
            {plan.inBoxTotal} / {plan.neededTotal}
          </span>{" "}
          {m.decks_overview_box_in()}{" "}
          <TextLink
            variant="inherit"
            render={
              <Link to="/collections/$collectionId" params={{ collectionId: homeCollectionId }} />
            }
          >
            {homeCollectionName}
          </TextLink>
        </span>
        {complete && <Badge variant="success">{m.decks_overview_ready_to_play()}</Badge>}
      </div>

      <div className="w-full columns-[30rem] gap-x-10">
        {zones.map(({ zone, cards: zoneCards }) => (
          <ZoneSection
            key={zone}
            zone={zone}
            slotsByCardKey={slotsByCardKey}
            cards={zoneCards}
            sortCards={sortCards}
            groupCards={groupCards}
            groupBy={groupBy}
            groupDir={groupDir}
            setOrder={setOrder}
            slotRow={slotRow}
          />
        ))}

        {plan.extras.length > 0 && (
          <section className={DECK_LIST_SECTION_CLASS}>
            <DeckZoneHeader label={m.decks_overview_box_not_in_deck()}>
              <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                {plan.extraCount}
              </span>
            </DeckZoneHeader>
            <div className="flex flex-col gap-0.5">
              {plan.extras.flatMap((entry) =>
                entry.copies.map((copy) => (
                  <BoxRow
                    key={copy.copyId}
                    card={entry.card}
                    copy={copy}
                    labels={labels}
                    siblings={plan.siblingPrintingsByCardId.get(entry.card.cardId) ?? []}
                    onHoverCard={onHoverCard}
                    // No zone: these copies aren't deck entries.
                    onOpen={
                      onCardClick
                        ? () =>
                            onCardClick({
                              cardId: entry.card.cardId,
                              preferredPrintingId: copy.printingId,
                            })
                        : undefined
                    }
                    leading={
                      <Checkbox
                        checked
                        className={SURPLUS_TICK_CLASS}
                        disabled={moveCopies.isPending}
                        aria-label={m.decks_overview_box_move_out({
                          card: legendDisplayName(entry.card),
                        })}
                        onClick={rowControlClick()}
                        onCheckedChange={() => takeOut([copy.copyId])}
                      />
                    }
                  />
                )),
              )}
            </div>
          </section>
        )}
      </div>

      {missingCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={onViewMissing}
          disabled={!onViewMissing}
        >
          <PackageSearchIcon className="size-3.5" />
          {m.decks_overview_box_missing({ count: missingCount })}
        </Button>
      )}
    </div>
  );
}

function ZoneSection({
  zone,
  cards,
  slotsByCardKey,
  sortCards,
  groupCards,
  groupBy,
  groupDir,
  setOrder,
  slotRow,
}: {
  zone: DeckZone;
  cards: DeckBuilderCard[];
  slotsByCardKey: ReadonlyMap<string, DeckBoxSlot[]>;
  sortCards: (zoneCards: DeckBuilderCard[]) => DeckBuilderCard[];
  groupCards: (zoneCards: DeckBuilderCard[]) => DeckCardGroup[];
  groupBy: DeckListGroup;
  groupDir: "asc" | "desc";
  setOrder: readonly { id: string; name: string }[];
  slotRow: (card: DeckBuilderCard, slot: DeckBoxSlot) => React.ReactNode;
}) {
  const { zoneLabels } = useZoneOrder();
  const zoneSlots = cards.flatMap((card) => slotsByCardKey.get(deckCardKey(card)) ?? []);
  const inBox = zoneSlots.filter((slot) => slot.state === "in-box").length;
  const entriesOf = (list: DeckBuilderCard[]) =>
    sortCards(list).flatMap((card) =>
      (slotsByCardKey.get(deckCardKey(card)) ?? []).map((slot) => ({ card, slot })),
    );
  const groups = GROUPED_ZONES.has(zone)
    ? groupBy === "set"
      ? groupBoxSlotsBySet(entriesOf(cards), setOrder, groupDir).map((group) => ({
          key: group.key,
          label: group.set?.name ?? m.decks_editor_group_not_owned(),
          entries: group.entries,
        }))
      : groupCards(cards).map((group) => ({
          key: group.key,
          label: group.label,
          entries: entriesOf(group.cards),
        }))
    : null;

  return (
    <section className={DECK_LIST_SECTION_CLASS}>
      <DeckZoneHeader label={enumLabel(zoneLabels, zone)}>
        <span
          className={cn(
            "ml-auto text-xs tabular-nums",
            inBox === zoneSlots.length ? "text-success" : "text-muted-foreground",
          )}
        >
          {inBox}/{zoneSlots.length}
        </span>
      </DeckZoneHeader>

      {groups ? (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-0.5">
              {group.label !== null && (
                <div className="text-muted-foreground flex items-center gap-1.5 px-2 text-xs">
                  {groupBy === "type" && (
                    <FilterIcon category="types" value={group.key} className="size-3.5" />
                  )}
                  <span className="whitespace-nowrap">{group.label}</span>
                </div>
              )}
              {group.entries.map(({ card, slot }) => slotRow(card, slot))}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {entriesOf(cards).map(({ card, slot }) => slotRow(card, slot))}
        </div>
      )}
    </section>
  );
}

function SlotRow({
  card,
  slot,
  labels,
  siblings,
  printings,
  disabled,
  adding,
  isNew,
  onAdd,
  onReprint,
  onTick,
  onTakeOut,
  onSwap,
  onHoverCard,
  onOpen,
}: {
  card: DeckBoxCard;
  slot: DeckBoxSlot;
  labels: BoxRowLabels;
  siblings: readonly VariantLabelPrinting[];
  printings: readonly Printing[];
  disabled: boolean;
  adding: boolean;
  isNew: boolean;
  onAdd: () => void;
  onReprint: (printingId: string) => void;
  onTick: () => void;
  onTakeOut: () => void;
  onSwap: (copyId: string) => void;
  onHoverCard?: HoverHandler;
  onOpen?: () => void;
}) {
  if (slot.state === "in-box" && slot.copy && isNew && adding) {
    return (
      <BoxRow
        card={card}
        copy={slot.copy}
        labels={labels}
        siblings={siblings}
        onHoverCard={onHoverCard}
        onOpen={onOpen}
        leading={
          <Checkbox
            checked
            aria-label={m.decks_overview_box_remove_new({ card: legendDisplayName(card) })}
            onClick={rowControlClick()}
            onCheckedChange={onTakeOut}
          />
        }
        trailing={
          <span className="flex shrink-0 items-center gap-1.5">
            <Badge variant="secondary">{m.decks_overview_box_new()}</Badge>
            <PrintingPicker
              card={card}
              copy={slot.copy}
              printings={printings}
              labels={labels}
              onPick={onReprint}
            />
          </span>
        }
      />
    );
  }

  if (slot.state === "in-box") {
    return (
      <BoxRow
        card={card}
        copy={slot.copy}
        labels={labels}
        siblings={siblings}
        onHoverCard={onHoverCard}
        onOpen={onOpen}
        leading={
          <Checkbox
            checked
            disabled={disabled}
            aria-label={m.decks_overview_box_take_out({ card: legendDisplayName(card) })}
            onClick={rowControlClick()}
            onCheckedChange={onTakeOut}
          />
        }
        trailing={
          <SourcePicker
            card={card}
            slot={slot}
            labels={labels}
            siblings={siblings}
            mode="keep"
            onSwap={onSwap}
          />
        }
      />
    );
  }

  if (slot.state === "available") {
    return (
      <BoxRow
        card={card}
        copy={slot.copy}
        labels={labels}
        siblings={siblings}
        onHoverCard={onHoverCard}
        onOpen={onOpen}
        leading={
          <Checkbox
            checked={false}
            disabled={disabled}
            aria-label={m.decks_overview_box_put_in({ card: legendDisplayName(card) })}
            onClick={rowControlClick()}
            onCheckedChange={onTick}
          />
        }
        trailing={
          <SourcePicker
            card={card}
            slot={slot}
            labels={labels}
            siblings={siblings}
            onSwap={onSwap}
          />
        }
      />
    );
  }

  if (slot.state === "blocked") {
    return (
      <BoxRow
        card={card}
        copy={slot.copy}
        labels={labels}
        siblings={siblings}
        onHoverCard={onHoverCard}
        onOpen={onOpen}
        muted
        leading={
          <span className="flex size-4 shrink-0 items-center justify-center">
            {slot.reason === "loan" ? (
              <HandHeartIcon className="text-muted-foreground size-3.5" />
            ) : (
              <ArrowUpRightIcon className="text-muted-foreground size-3.5" />
            )}
          </span>
        }
        trailing={
          slot.reason === "loan" ? (
            <TextLink
              variant="muted"
              className="shrink-0 text-xs"
              render={<Link to="/loans" onClick={rowControlClick()} />}
            >
              {m.decks_overview_box_on_loan()}
            </TextLink>
          ) : (
            <span className="text-muted-foreground shrink-0 text-xs">
              {m.decks_overview_box_reserved()}
            </span>
          )
        }
      />
    );
  }

  if (adding && printings.length > 0) {
    return (
      <BoxRow
        card={card}
        labels={labels}
        siblings={siblings}
        onHoverCard={onHoverCard}
        onOpen={onOpen}
        leading={
          <Checkbox
            checked={false}
            className="border-primary border-dashed"
            aria-label={m.decks_overview_box_add_copy({ card: legendDisplayName(card) })}
            onClick={rowControlClick()}
            onCheckedChange={onAdd}
          />
        }
        trailing={
          <span className="text-primary shrink-0 text-xs">
            {m.decks_overview_box_tick_to_add()}
          </span>
        }
      />
    );
  }

  return (
    <BoxRow
      card={card}
      labels={labels}
      siblings={siblings}
      onHoverCard={onHoverCard}
      onOpen={onOpen}
      muted
      leading={<span className="size-4 shrink-0" />}
      trailing={
        <span className="text-muted-foreground shrink-0 text-xs">
          {m.decks_overview_box_not_owned()}
        </span>
      }
    />
  );
}

function BoxCardThumb({
  card,
  copy,
  labels,
}: {
  card: DeckBoxCard;
  copy?: DeckBoxCopy;
  labels: BoxRowLabels;
}) {
  return (
    <CardMiniRow
      className="self-stretch"
      imageId={copy?.imageId}
      landscape={getOrientation(card.types) === "landscape"}
      domains={card.domains}
      domainColors={labels.domainColors}
      rarity={copy?.rarity}
      rarityLabels={labels.rarities}
      shortCode={copy && distinctPrintingCode(copy)}
      loading="lazy"
    />
  );
}

/**
 * The count shown is how many *different* copies are behind the source, not
 * how many copies exist: a shelf of forty identical runes is one choice.
 */
function SourcePicker({
  card,
  slot,
  labels,
  siblings,
  mode = "take",
  onSwap,
}: {
  card: DeckBoxCard;
  slot: DeckBoxSlot;
  labels: BoxRowLabels;
  siblings: readonly VariantLabelPrinting[];
  mode?: "take" | "keep";
  onSwap: (copyId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState("");
  const source = slot.copy?.collectionName ?? "";
  const wording =
    mode === "keep"
      ? {
          trigger: m.decks_overview_box_swap(),
          action: m.decks_overview_box_keep_other({ card: legendDisplayName(card) }),
          prompt: m.decks_overview_box_keep_prompt(),
        }
      : {
          trigger: source,
          action: m.decks_overview_box_take_other({ card: legendDisplayName(card) }),
          prompt: m.decks_overview_box_take_prompt(),
        };
  const byCollection = Map.groupBy(
    slot.alternatives,
    (alternative) => alternative.copy.collectionName,
  );
  if (slot.alternatives.length === 0) {
    return mode === "keep" ? null : (
      <span className="text-muted-foreground max-w-[50cqw] min-w-0 shrink truncate text-xs">
        {source}
      </span>
    );
  }

  const pick = (copyId: string) => {
    setOpen(false);
    onSwap(copyId);
  };

  return (
    <ResponsivePopover open={open} onOpenChange={setOpen}>
      <ResponsivePopoverTrigger
        render={
          <Button
            variant="ghost"
            size="xs"
            className="max-w-[50cqw] min-w-0 shrink"
            aria-label={wording.action}
            onClick={rowControlClick()}
          >
            <span className="min-w-0 truncate">{wording.trigger}</span>
            <span className="text-muted-foreground">+{slot.alternatives.length}</span>
          </Button>
        }
      />
      <ResponsivePopoverContent
        title={wording.action}
        hideTitle
        align="end"
        onClick={rowControlClick()}
      >
        <PickerList
          highlightedId={highlightedId}
          onHighlightChange={setHighlightedId}
          header={<p className="text-muted-foreground px-2.5 pt-2 text-xs">{wording.prompt}</p>}
        >
          {[...byCollection].map(([collectionName, alternatives]) => (
            <PickerGroup key={collectionName} label={collectionName}>
              {alternatives.map((alternative) => (
                <PickerRow
                  key={alternative.key}
                  value={alternative.key}
                  onSelect={() => pick(alternative.copy.copyId)}
                >
                  <BoxCardThumb card={card} copy={alternative.copy} labels={labels} />
                  <CopyDetails copy={alternative.copy} labels={labels} siblings={siblings} />
                  {alternative.count > 1 && (
                    <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                      ×{alternative.count}
                    </span>
                  )}
                </PickerRow>
              ))}
            </PickerGroup>
          ))}
        </PickerList>
      </ResponsivePopoverContent>
    </ResponsivePopover>
  );
}

function PrintingPicker({
  card,
  copy,
  printings,
  labels,
  onPick,
}: {
  card: DeckBoxCard;
  copy: DeckBoxCopy;
  printings: readonly Printing[];
  labels: BoxRowLabels;
  onPick: (printingId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState("");
  if (printings.length < 2) {
    return null;
  }
  const action = m.decks_overview_box_change_printing({ card: legendDisplayName(card) });

  return (
    <ResponsivePopover open={open} onOpenChange={setOpen}>
      <ResponsivePopoverTrigger
        render={
          <Button variant="ghost" size="icon-xs" aria-label={action} onClick={rowControlClick()}>
            <ChevronDownIcon />
          </Button>
        }
      />
      <ResponsivePopoverContent title={action} hideTitle align="end" onClick={rowControlClick()}>
        <PickerList highlightedId={highlightedId} onHighlightChange={setHighlightedId}>
          {printings.map((printing) => (
            <PickerRow
              key={printing.printingId}
              value={printing.printingId}
              onSelect={() => {
                setOpen(false);
                if (printing.printingId !== copy.printingId) {
                  onPick(printing.printingId);
                }
              }}
            >
              <CardMiniRow
                className="self-stretch"
                imageId={frontImageId(printing)}
                landscape={getOrientation(card.types) === "landscape"}
                domains={card.domains}
                domainColors={labels.domainColors}
                rarity={printing.rarity}
                rarityLabels={labels.rarities}
                shortCode={distinctPrintingCode(printing)}
                loading="lazy"
              />
              <span className="text-muted-foreground text-xs">
                {printingVariantText(printing, printings, labels)}
              </span>
            </PickerRow>
          ))}
        </PickerList>
      </ResponsivePopoverContent>
    </ResponsivePopover>
  );
}

function printingVariantText(
  printing: VariantLabelPrinting,
  siblings: readonly VariantLabelPrinting[],
  labels: BoxRowLabels,
): string {
  const { language, rest, otherSide } = formatPrintingVariantLabelParts(printing, siblings, labels);
  const parts: string[] = language === null ? [...rest] : [language, ...rest];
  if (otherSide) {
    parts.push(m.cards_printing_with_side({ name: otherSide }));
  }
  return parts.join(" · ");
}

function BoxRow({
  card,
  copy,
  labels,
  siblings,
  muted,
  leading,
  trailing,
  onHoverCard,
  onOpen,
}: {
  card: DeckBoxCard;
  copy?: DeckBoxCopy;
  labels: BoxRowLabels;
  siblings: readonly VariantLabelPrinting[];
  muted?: boolean;
  leading: React.ReactNode;
  trailing?: React.ReactNode;
  onHoverCard?: HoverHandler;
  onOpen?: () => void;
}) {
  return (
    // Firefox's column balancing can leave a flex row here half-fragmented. A grid row stays whole.
    // A grid item's % width resolves against its own track, so the trailing cap uses cqw.
    <div
      className={cn(
        "hover:bg-muted/50 @container grid auto-cols-auto grid-flow-col grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-1.5 rounded-md px-2 py-1 text-sm sm:gap-2",
        onOpen !== undefined && "cursor-pointer",
      )}
      {...cardHoverProps(onHoverCard, card.cardId, copy?.printingId)}
      {...rowActivateProps(onOpen)}
    >
      {leading}
      <BoxCardThumb card={card} copy={copy} labels={labels} />
      <span className={cn("min-w-0 flex-1 truncate", muted && "text-muted-foreground")}>
        {legendDisplayName(card)}
      </span>
      {copy && <CopyDetails copy={copy} labels={labels} siblings={siblings} />}
      {trailing}
    </div>
  );
}

function CopyDetails({
  copy,
  labels,
  siblings,
}: {
  copy: DeckBoxCopy;
  labels: BoxRowLabels;
  siblings: readonly VariantLabelPrinting[];
}) {
  const variant = printingVariantText(copy, siblings, labels);
  const parts: string[] = variant === "" ? [] : [variant];
  if (copy.grade !== null) {
    parts.push(m.decks_overview_box_graded({ grade: copy.grade }));
  } else if (copy.condition !== null) {
    parts.push(enumLabel(labels.conditions, copy.condition));
  }
  if (parts.length === 0) {
    return null;
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "text-muted-foreground shrink-0 text-xs",
              copy.grade !== null && "text-warning",
            )}
          />
        }
      >
        {parts.join(" · ")}
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {copy.grade === null
          ? m.decks_overview_box_copy_hint()
          : m.decks_overview_box_graded_hint()}
      </TooltipContent>
    </Tooltip>
  );
}
