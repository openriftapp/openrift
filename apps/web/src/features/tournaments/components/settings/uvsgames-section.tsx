import { formatDayTimeLocal } from "@openrift/shared/format-date";
import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { parseUvsgamesEventId, uvsgamesEventUrl } from "@openrift/shared/uvsgames-links";

import { Button } from "@/components/ui/button";
import { RowList, RowListItem } from "@/components/ui/row-list";
import { EventLinkSection } from "@/features/tournaments/components/settings/event-link-section";
import { useUvsgamesSuggestions } from "@/features/tournaments/hooks/use-tournament-archive-lists";
import { m } from "@/paraglide/messages.js";

export function UvsgamesSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const { data: suggestions } = useUvsgamesSuggestions(detail.id, detail.groupId !== null);
  const offered = (suggestions ?? []).filter(
    (suggestion) => suggestion.externalId !== detail.uvsgamesEventId,
  );

  return (
    <EventLinkSection
      id="uvsgames"
      tournamentId={detail.id}
      field="uvsgamesEventId"
      linkedId={detail.uvsgamesEventId}
      parse={parseUvsgamesEventId}
      eventUrl={uvsgamesEventUrl}
      placeholder="https://locator.riftbound.uvsgames.com/events/…"
      locked={locked}
      labels={{
        title: m.tournaments_settings_uvsgames_title(),
        description: m.tournaments_settings_uvsgames_description(),
        label: m.tournaments_settings_uvsgames_label(),
        invalid: m.tournaments_settings_uvsgames_invalid(),
        save: m.tournaments_settings_uvsgames_save(),
        remove: m.tournaments_settings_uvsgames_remove(),
        open: m.tournaments_settings_uvsgames_open(),
      }}
    >
      {(link, pending) =>
        offered.length === 0 ? null : (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-sm">
              {m.tournaments_settings_uvsgames_suggestions()}
            </p>
            <RowList>
              {offered.map((suggestion) => (
                <RowListItem key={suggestion.externalId} className="justify-between">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{suggestion.name}</span>
                    <span className="text-muted-foreground truncate text-sm">
                      {suggestion.storeName} · {formatDayTimeLocal(suggestion.startAt)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => link(suggestion.externalId)}
                  >
                    {m.tournaments_settings_uvsgames_use()}
                  </Button>
                </RowListItem>
              ))}
            </RowList>
          </div>
        )
      }
    </EventLinkSection>
  );
}
