import { enumLabel } from "@openrift/shared/enum-label";
import { BoxIcon, CheckIcon } from "lucide-react";
import type { ReactNode } from "react";

import { POPUP_GROUP_LABEL } from "@/components/ui/popup-group-label";
import { CardMiniRow } from "@/features/cards/components/card-mini-row";
import { DeckZoneHeader } from "@/features/decks/components/deck-zone-header";
import type { FixtureCard } from "@/features/marketing/lib/vignette-fixtures";
import {
  FIXTURE_CARDS,
  FIXTURE_DECK,
  FIXTURE_LABELS,
  fixtureVariantLabel,
} from "@/features/marketing/lib/vignette-fixtures";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { Swap, Vignette } from "./vignette-parts";

const BOX_TIMING = {
  wasAnimation: "motion-safe:animate-box-before",
  nowAnimation: "motion-safe:animate-box-after",
};

function Thumb({ card }: { card: FixtureCard }) {
  return <CardMiniRow domains={card.domains} rarity={card.rarity} shortCode={card.shortCode} />;
}

function Tick({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[4px] border",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-input",
      )}
    >
      {checked && <CheckIcon className="size-3.5" />}
    </span>
  );
}

function Row({
  leading,
  thumb,
  name,
  details,
  trailing,
  muted,
}: {
  leading: ReactNode;
  thumb: ReactNode;
  name: string;
  details?: ReactNode;
  trailing?: ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm sm:gap-2">
      {leading}
      {thumb}
      <span className={cn("min-w-0 flex-1 truncate", muted && "text-muted-foreground")}>
        {name}
      </span>
      {details}
      {trailing}
    </div>
  );
}

function Detail({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("text-muted-foreground shrink-0 text-xs", className)}>{children}</span>
  );
}

function BoxSwap({ before, after }: { before: ReactNode; after: ReactNode }) {
  return (
    <Swap was={before} now={after} className="shrink-0 items-center align-middle" {...BOX_TIMING} />
  );
}

/**
 * An inline-grid pair sets its baseline off the digits by a few pixels; keeping
 * the finished text in normal flow and floating the earlier one over it keeps one baseline.
 */
function TextSwap({ before, after }: { before: ReactNode; after: ReactNode }) {
  return (
    <span className="relative inline-block">
      <span className="motion-safe:animate-box-before absolute inset-0 opacity-0">{before}</span>
      <span className="motion-safe:animate-box-after">{after}</span>
    </span>
  );
}

function PickerRow({
  card,
  details,
  count,
  highlighted,
}: {
  card: FixtureCard;
  details?: string;
  count?: number;
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md px-1.5 py-1 text-sm",
        highlighted && "motion-safe:animate-box-pick-row",
      )}
    >
      <Thumb card={card} />
      {details && <Detail>{details}</Detail>}
      {count !== undefined && (
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">×{count}</span>
      )}
    </div>
  );
}

function PickerGroupLabel({ children }: { children: ReactNode }) {
  return <p className={cn(POPUP_GROUP_LABEL, "px-1.5 pt-2 pb-0.5")}>{children}</p>;
}

const SHOWN = FIXTURE_CARDS.azir;
const PICKED_FROM = FIXTURE_CARDS.azirAltArt;

export function BoxVignette() {
  return (
    <Vignette>
      <div className="flex items-center gap-2">
        <BoxIcon className="text-muted-foreground size-4" aria-hidden="true" />
        <span className="font-medium">
          <span className="tabular-nums">
            <TextSwap before="12 / 40" after="13 / 40" />
          </span>{" "}
          {m.decks_overview_box_in()} {FIXTURE_DECK.name}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <DeckZoneHeader label={enumLabel(FIXTURE_LABELS.zones, "main")}>
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
            <TextSwap
              before="2/4"
              after={<span className="text-foreground font-medium">3/4</span>}
            />
          </span>
        </DeckZoneHeader>

        <div className="flex flex-col gap-0.5">
          <Row
            leading={<Tick checked />}
            thumb={<Thumb card={FIXTURE_CARDS.guards} />}
            name={FIXTURE_CARDS.guards.name}
          />
          <Row
            leading={<Tick checked />}
            thumb={<Thumb card={FIXTURE_CARDS.hiddenBlade} />}
            name={FIXTURE_CARDS.hiddenBlade.name}
          />
          <Row
            leading={<span aria-hidden="true" className="size-4 shrink-0" />}
            thumb={<Thumb card={FIXTURE_CARDS.aphelios} />}
            name={FIXTURE_CARDS.aphelios.name}
            muted
            trailing={<Detail>{m.decks_overview_box_not_owned()}</Detail>}
          />
          <div className="relative">
            <Row
              leading={<BoxSwap before={<Tick checked={false} />} after={<Tick checked />} />}
              thumb={
                <BoxSwap before={<Thumb card={PICKED_FROM} />} after={<Thumb card={SHOWN} />} />
              }
              name={SHOWN.name}
              details={
                <Detail className="motion-safe:animate-box-before opacity-0">
                  {fixtureVariantLabel(PICKED_FROM)}
                </Detail>
              }
              trailing={
                <span className="text-muted-foreground flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-xs">
                  <BoxSwap
                    before={<span>{m.marketing_collections_bulk_box()}</span>}
                    after={<span>{m.marketing_collections_binder()}</span>}
                  />
                  <span>+2</span>
                </span>
              }
            />
            <div className="bg-popover text-popover-foreground ring-border motion-safe:animate-box-picker absolute right-0 bottom-full z-10 mb-1 w-72 rounded-lg text-sm opacity-0 shadow-md ring-1">
              <p className="text-muted-foreground px-2.5 pt-2 text-xs">
                {m.decks_overview_box_take_prompt()}
              </p>
              <div className="p-1">
                <PickerGroupLabel>{m.marketing_collections_binder()}</PickerGroupLabel>
                <PickerRow card={SHOWN} highlighted />
                <PickerGroupLabel>{m.marketing_collections_bulk_box()}</PickerGroupLabel>
                <PickerRow
                  card={PICKED_FROM}
                  details={fixtureVariantLabel(PICKED_FROM)}
                  count={2}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Vignette>
  );
}
