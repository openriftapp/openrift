import { formatShortDay, formatShortDayYear } from "@openrift/shared/format-date";
import { isBaseBanFormat } from "@openrift/shared/well-known";
import { BanIcon, CalendarClockIcon } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pressable } from "@/components/ui/pressable";
import type { MetaBanGroup } from "@/features/meta/lib/meta-deck-bans";
import { nextBanDate, soleModeBanFormat } from "@/features/meta/lib/meta-deck-bans";
import { DATE_WORDS } from "@/lib/date-words";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const CHIP =
  "inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap";

export function MetaDeckBanChips({
  groups,
  eventDate,
  className,
}: {
  groups: readonly MetaBanGroup[];
  /** UTC date. */
  eventDate: string;
  className?: string;
}) {
  if (groups.length === 0) {
    return null;
  }
  const inEffect = groups.some((group) => group.inEffect);
  const next = nextBanDate(groups);
  const modeFormat = soleModeBanFormat(groups, true);
  const upcomingModeFormat = soleModeBanFormat(groups, false);
  const legalElsewhere = groups.every((group) => !isBaseBanFormat(group.formatId));
  const legalWhenPlayed = groups.every((group) => group.bannedAt > eventDate);

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        render={
          <Pressable
            className={cn(
              "inline-flex max-w-36 flex-wrap items-center justify-end gap-1 rounded-md",
              className,
            )}
          />
        }
      >
        {inEffect && (
          <span className={cn(CHIP, "bg-destructive-soft text-destructive")}>
            <BanIcon className="size-3" />
            {modeFormat === undefined
              ? m.cards_thumb_banned()
              : m.cards_thumb_format_ban({ format: modeFormat })}
          </span>
        )}
        {next !== undefined && (
          <span className={cn(CHIP, "bg-warning-soft text-warning")}>
            <CalendarClockIcon className="size-3" />
            {upcomingModeFormat === undefined
              ? m.meta_ban_chip_upcoming({ date: formatShortDay(next, DATE_WORDS) })
              : m.meta_ban_chip_format_upcoming({
                  format: upcomingModeFormat,
                  date: formatShortDay(next, DATE_WORDS),
                })}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        {groups.map((group) => {
          const date = formatShortDayYear(group.bannedAt, DATE_WORDS);
          return (
            <section key={`${group.inEffect}|${group.bannedAt}|${group.formatId}`}>
              <p className="font-medium">
                {group.inEffect
                  ? m.card_detail_ban_title({ format: group.formatName, date })
                  : m.card_detail_ban_upcoming_title({ format: group.formatName, date })}
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {group.cards.map((card) => (
                  <li key={card.cardId} className="flex items-baseline gap-2">
                    <span className="text-muted-foreground w-6 shrink-0 tabular-nums">
                      {card.main + card.side}×
                    </span>
                    <span className="min-w-0 flex-1">{card.displayName}</span>
                    {card.side > 0 && (
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {m.meta_ban_in_sideboard({ count: card.side })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {legalElsewhere && (
          <p className="text-muted-foreground text-xs">{m.cards_thumb_legal_elsewhere()}</p>
        )}
        {legalWhenPlayed && (
          <p className="text-muted-foreground text-xs">
            {m.meta_ban_legal_when_played({ date: formatShortDayYear(eventDate, DATE_WORDS) })}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
