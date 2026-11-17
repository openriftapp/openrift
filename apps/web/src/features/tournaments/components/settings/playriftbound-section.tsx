import { playriftboundEventUrl } from "@openrift/shared/playriftbound-links";
import { parsePlayriftboundEventId } from "@openrift/shared/playriftbound-sync";
import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";

import { EventLinkSection } from "@/features/tournaments/components/settings/event-link-section";
import { m } from "@/paraglide/messages.js";

export function PlayriftboundSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  return (
    <EventLinkSection
      id="playriftbound"
      tournamentId={detail.id}
      field="playriftboundEventId"
      linkedId={detail.playriftboundEventId}
      parse={parsePlayriftboundEventId}
      eventUrl={playriftboundEventUrl}
      placeholder="https://playriftbound.com/en-US/events/…"
      locked={locked}
      labels={{
        title: m.tournaments_settings_playriftbound_title(),
        description: m.tournaments_settings_playriftbound_description(),
        label: m.tournaments_settings_playriftbound_label(),
        invalid: m.tournaments_settings_playriftbound_invalid(),
        save: m.tournaments_settings_playriftbound_save(),
        remove: m.tournaments_settings_playriftbound_remove(),
        open: m.tournaments_settings_playriftbound_open(),
      }}
    />
  );
}
