import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";
import { ArchiveIcon } from "lucide-react";

import { ActionBand } from "@/components/ui/action-band";
import { buttonVariants } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";

export function ArchiveListsBand({ detail }: { detail: TournamentDetailResponse }) {
  const linked = detail.uvsgamesEventId !== null;
  return (
    <ActionBand
      icon={ArchiveIcon}
      label={m.tournaments_archive_band_title()}
      value={
        linked ? m.tournaments_archive_band_description() : m.tournaments_archive_band_unlinked()
      }
      valueClassName="font-sans text-base font-medium"
      action={
        linked ? (
          <Link
            to="/tournaments/$id/decks/archive"
            params={{ id: detail.id }}
            className={buttonVariants({ size: "sm" })}
          >
            {m.tournaments_archive_band_open()}
          </Link>
        ) : (
          <Link
            to="/tournaments/$id/settings"
            params={{ id: detail.id }}
            hash="uvsgames"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {m.tournaments_archive_band_settings()}
          </Link>
        )
      }
    />
  );
}
