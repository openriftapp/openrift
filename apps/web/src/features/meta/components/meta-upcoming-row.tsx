import type { MetaEventSummary } from "@openrift/shared/types/api/meta";
import { Link } from "@tanstack/react-router";

import { CountryFlag } from "@/components/ui/country-flag";
import { DateLeaf } from "@/components/ui/date-leaf";
import { RowListLink } from "@/components/ui/row-list";
import { MetaTierBadge } from "@/features/meta/components/meta-tier-badge";
import { m } from "@/paraglide/messages.js";

export function MetaUpcomingRow({ event }: { event: MetaEventSummary }) {
  return (
    <RowListLink
      render={<Link to="/meta/$slug" params={{ slug: event.slug }} />}
      className="gap-2.5 py-2"
    >
      <DateLeaf at={event.eventDate} clock="utc" size="sm" />

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold">{event.name}</span>
        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <MetaTierBadge tier={event.tier} />
          <CountryFlag code={event.country} size="sm" />
          {event.playerCount !== null && (
            <span className="tabular-nums">
              {m.meta_upcoming_registered({ count: event.playerCount })}
            </span>
          )}
        </span>
      </span>
    </RowListLink>
  );
}
