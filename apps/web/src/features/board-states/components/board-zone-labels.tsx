import type { BoardPlayer, BoardZoneRef } from "@openrift/shared/board-state";

import { arrowZoneKey } from "@/features/board-states/lib/board-layout";
import { seatInk, zoneEdge } from "@/features/board-states/lib/board-style";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function ZoneLabel({
  text,
  owner,
  mirrored,
}: {
  text: string;
  owner: BoardPlayer;
  mirrored?: boolean;
}) {
  return (
    <span
      className={cn(
        "text-2xs shrink-0 self-stretch truncate font-semibold tracking-wide uppercase [writing-mode:vertical-rl]",
        mirrored ? "text-left" : "rotate-180 text-left",
      )}
      style={{ color: seatInk(owner) }}
    >
      {owner} · {text}
    </span>
  );
}

export function EmptyZoneStrip({
  zone,
  owner,
  label,
  className,
}: {
  zone: BoardZoneRef;
  owner: BoardPlayer;
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-9 min-w-0 items-center gap-2 rounded-md border bg-black/15 px-2",
        className,
      )}
      style={{ borderColor: zoneEdge(owner) }}
      data-board-zone={arrowZoneKey(zone, owner)}
    >
      <span
        className="text-2xs shrink-0 font-semibold tracking-wide uppercase"
        style={{ color: seatInk(owner) }}
      >
        {label === undefined ? owner : `${owner} · ${label}`}
      </span>
      <span className="truncate text-xs text-white/60">{m.board_states_zone_empty()}</span>
    </div>
  );
}
