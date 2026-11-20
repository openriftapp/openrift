import type { CardBan } from "@openrift/shared/types/catalog";
import type { Rarity } from "@openrift/shared/types/enums";
import { LOW_RARITIES, WellKnown } from "@openrift/shared/well-known";
import { LayersIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { Fragment } from "react";
import type { ReactNode } from "react";

import { CountPill } from "@/components/ui/count-pill";
import { InfoHint } from "@/components/ui/info-hint";
import { FinishIcon, hasFinishIcon } from "@/features/cards/components/finish-icon";
import { getFilterIconPath } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface LabelSide {
  shortCode: string;
  name: string;
  finish?: string;
  finishTitle?: string;
}

interface PairEntry extends LabelSide {
  shown: boolean;
}

function inDisplayOrder(side: 1 | 2, shown: LabelSide, other: LabelSide): PairEntry[] {
  const entries = [
    { ...shown, shown: true },
    { ...other, shown: false },
  ];
  return side === 1 ? entries : entries.toReversed();
}

function PairSegments({ entries, field }: { entries: PairEntry[]; field: "shortCode" | "name" }) {
  const shownClass = field === "shortCode" ? "text-foreground" : undefined;
  return entries.map((entry, index) => (
    <Fragment key={entry.shown ? "shown" : "other"}>
      {index > 0 && " // "}
      <span className={entry.shown ? shownClass : "text-muted-foreground"}>{entry[field]}</span>
      {field === "shortCode" && entry.finish && hasFinishIcon(entry.finish) && (
        <FinishIcon
          finish={entry.finish}
          title={entry.finishTitle}
          className="ml-0.5 align-[-2px]"
          iconClassName="size-3"
        />
      )}
    </Fragment>
  ));
}

interface CardMetaLabelProps {
  shortCode: string;
  name: string;
  pair?: { side: 1 | 2; other: LabelSide };
  pairHint?: string;
  rarity: Rarity;
  rarityTitle?: string;
  finish?: string;
  finishTitle?: string;
  oversized?: boolean;
  sizeLabel?: string;
  bans?: CardBan[];
  hasRulesDeviation?: boolean;
  printingComment?: string | null;
  printingCount?: number;
  className?: string;
  price?: ReactNode;
}

export function CardMetaLabel({
  shortCode,
  name,
  pair,
  pairHint,
  rarity,
  rarityTitle,
  finish,
  finishTitle,
  oversized,
  sizeLabel,
  bans,
  hasRulesDeviation,
  printingComment,
  printingCount,
  className,
  price,
}: CardMetaLabelProps) {
  const rarityIconPath = getFilterIconPath("rarities", rarity);
  const showFinishIcon =
    pair === undefined &&
    finish !== undefined &&
    (finish !== WellKnown.finish.FOIL || LOW_RARITIES.has(rarity));
  const pairEntries = pair
    ? inDisplayOrder(pair.side, { shortCode, name, finish, finishTitle }, pair.other)
    : undefined;

  return (
    // ⚠ space-y-0.5 and py-0.5 are mirrored as META_LINE_GAP / META_LABEL_PY in card-grid-constants.ts — update both together
    // @container lets the price node collapse a min–max range to its "from"
    // price on narrow cells (see priceNode in card-thumbnail.tsx).
    <div className={cn("bg-background @container space-y-0.5 rounded-md px-1.5 py-0.5", className)}>
      {/* ⚠ text-xs is mirrored as META_LINE_HEIGHT in card-grid-constants.ts — update both together */}
      {/* min-h-4: WebKit truncate + overflow:hidden shortens by 1px on iOS Safari, see webkit.org/b/225695 */}
      <div className="text-muted-foreground flex min-h-4 items-center justify-between gap-1 text-xs">
        <span className="truncate font-medium">
          {pairEntries ? <PairSegments entries={pairEntries} field="shortCode" /> : shortCode}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {printingCount !== undefined && printingCount > 1 && (
            <CountPill
              title={m.cards_printings_count({ count: printingCount })}
              className="h-4 gap-0.5 px-1.5 py-0 leading-none"
            >
              <LayersIcon aria-hidden="true" className="size-3" />
              <span aria-hidden="true">{printingCount}</span>
              <span className="sr-only">{m.cards_printings_count({ count: printingCount })}</span>
            </CountPill>
          )}
          {rarityIconPath && (
            <img
              src={rarityIconPath}
              alt={rarityTitle ?? rarity}
              title={rarityTitle ?? rarity}
              width={28}
              height={28}
              className="size-3.5"
            />
          )}
          {showFinishIcon && finish && <FinishIcon finish={finish} title={finishTitle} />}
          {pairHint && (
            <InfoHint label={m.cards_thumb_double_sided()} icon={RefreshCwIcon}>
              {pairHint}
            </InfoHint>
          )}
          {oversized && (
            <span
              title={sizeLabel}
              className="bg-muted text-muted-foreground text-2xs rounded-md px-1 leading-tight font-semibold tracking-wide uppercase"
            >
              {sizeLabel}
            </span>
          )}
          {bans && bans.length > 0 && (
            <InfoHint
              label={m.cards_thumb_banned()}
              icon={TriangleAlertIcon}
              className="text-destructive"
            >
              {bans.map((ban) => (
                <span key={ban.formatId} className="block">
                  {m.card_detail_ban_title({ format: ban.formatName, date: ban.bannedAt })}
                </span>
              ))}
            </InfoHint>
          )}
          {hasRulesDeviation && (
            <InfoHint
              label={m.cards_flag_errata()}
              icon={TriangleAlertIcon}
              className="text-warning"
            >
              {m.card_detail_meta_rules_deviation()}
            </InfoHint>
          )}
          {printingComment && (
            <InfoHint label={m.card_detail_meta_printing_note()}>{printingComment}</InfoHint>
          )}
        </span>
      </div>
      {/* min-h-4: same WebKit workaround as above */}
      <div className="flex min-h-4 items-center gap-1 text-xs font-medium">
        <span className="min-w-0 flex-1 truncate">
          {pairEntries ? <PairSegments entries={pairEntries} field="name" /> : name}
        </span>
        {price}
      </div>
    </div>
  );
}
