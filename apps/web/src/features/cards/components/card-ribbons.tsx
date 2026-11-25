import { cardBansFor, standardSetLegality } from "@openrift/shared/format-legality";
import type { Card, CardBan } from "@openrift/shared/types/catalog";
import { isBaseBanFormat } from "@openrift/shared/well-known";
import type { ReactNode } from "react";

import { CARD_BORDER_RADIUS } from "@/features/cards/lib/card-grid-constants";
import { useViewerLegality } from "@/hooks/use-viewer-legality";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const RIBBON_TONE = {
  banned: "bg-destructive text-white",
  caution: "bg-warning text-warning-foreground",
} as const;

// contain: paint keeps the rotated band out of the page's scrollable overflow, which clip-path alone does not.
const RIBBON_CLIP_STYLE = {
  clipPath: `inset(0 round ${CARD_BORDER_RADIUS})`,
  contain: "paint",
} as const;

/** The one diagonal corner label a card may carry: banned, rotated, ban incoming, or unreleased. */
export function CornerRibbon({
  tone,
  title,
  children,
}: {
  tone: keyof typeof RIBBON_TONE;
  title?: string;
  children: ReactNode;
}) {
  return (
    // clip-path, not overflow-hidden: Firefox's GPU compositor cuts this overflow-hidden
    // @container box to a thin strip when it sits inside the tilt transform.
    <div
      className="@container pointer-events-none absolute inset-0 z-30"
      style={RIBBON_CLIP_STYLE}
      title={title}
    >
      <div
        className={cn(
          "absolute top-[18cqi] -right-[22cqi] w-[90cqi] rotate-[45deg] py-[1.5cqi] text-center text-[6cqi] font-black tracking-wider uppercase shadow-md select-none",
          RIBBON_TONE[tone],
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function BanRibbon({
  bans,
  upcomingBans,
  rotatedOn,
}: {
  bans: CardBan[];
  upcomingBans: CardBan[];
  rotatedOn?: string;
}) {
  if (bans.length > 0) {
    const hasBaseBan = bans.some((ban) => isBaseBanFormat(ban.formatId));
    const soleModeBan = !hasBaseBan && bans.length === 1 ? bans[0] : undefined;
    const banLines = bans.map((ban) =>
      m.cards_thumb_banned_since({ format: ban.formatName, date: ban.bannedAt }),
    );
    return (
      <CornerRibbon
        tone="banned"
        title={(hasBaseBan ? banLines : [...banLines, m.cards_thumb_legal_elsewhere()]).join("\n")}
      >
        {soleModeBan
          ? m.cards_thumb_format_ban({ format: soleModeBan.formatName })
          : m.cards_thumb_banned()}
      </CornerRibbon>
    );
  }
  if (rotatedOn !== undefined) {
    return (
      <CornerRibbon tone="caution" title={m.cards_thumb_rotated_on({ date: rotatedOn })}>
        {m.cards_thumb_rotated()}
      </CornerRibbon>
    );
  }
  if (upcomingBans.length > 0) {
    return (
      <CornerRibbon
        tone="caution"
        title={upcomingBans
          .map((ban) => m.cards_thumb_banned_from({ format: ban.formatName, date: ban.bannedAt }))
          .join("\n")}
      >
        {m.cards_thumb_ban_upcoming()}
      </CornerRibbon>
    );
  }
  return null;
}

/** {@link BanRibbon} for a card, judged by the viewer's play region. */
export function CardLegalityRibbon({ card }: { card: Card }) {
  const legality = useViewerLegality();
  const { bans, upcomingBans } = cardBansFor(card, legality);
  const setStatus = standardSetLegality(card, legality);
  return (
    <BanRibbon
      bans={bans}
      upcomingBans={upcomingBans}
      rotatedOn={setStatus.status === "rotated" ? setStatus.until : undefined}
    />
  );
}
