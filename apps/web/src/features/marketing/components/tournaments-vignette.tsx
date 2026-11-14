import { SwordsIcon, UserMinusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { UserAvatar } from "@/components/user-avatar";
import { FIXTURE_PEOPLE } from "@/features/marketing/lib/vignette-fixtures";
import { m } from "@/paraglide/messages.js";

import { Vignette } from "./vignette-parts";

interface Pairing {
  label: string;
  status: string;
  reported: boolean;
  sides: { name: string; score: string | null; points: string | null }[];
}

function pairings(): Pairing[] {
  return [
    {
      label: m.tournaments_pod_match_title({ number: 1 }),
      status: m.tournaments_pod_reported(),
      reported: true,
      sides: [
        { name: FIXTURE_PEOPLE.alice.userName, score: "2", points: "+3" },
        { name: FIXTURE_PEOPLE.mira.userName, score: "1", points: "+0" },
      ],
    },
    {
      label: m.tournaments_pod_match_title({ number: 2 }),
      status: m.tournaments_pod_entered_of({ entered: 1, size: 2 }),
      reported: false,
      sides: [
        { name: FIXTURE_PEOPLE.nour.userName, score: "2", points: null },
        { name: FIXTURE_PEOPLE.ravi.userName, score: null, points: null },
      ],
    },
  ];
}

export function TournamentsVignette() {
  return (
    <Vignette>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-heading font-medium">
          {m.tournaments_round_band_round({ number: 3 })}
        </span>
        <Badge variant="warning">{m.tournaments_round_band_reporting()}</Badge>
        <span className="text-muted-foreground text-sm">
          {[
            m.tournaments_round_matches_count({ count: 2 }),
            m.tournaments_pairings_byes_count({ count: 1 }),
          ].join(" · ")}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {pairings().map((pairing) => (
          <Card key={pairing.label} className="gap-3 p-4">
            <div className="flex items-center gap-2">
              <IconChip
                icon={SwordsIcon}
                tone={pairing.reported ? "success" : "neutral"}
                size="sm"
                shape="round"
              />
              <span className="font-heading font-medium">{pairing.label}</span>
              <span className="ml-auto">
                <Badge variant={pairing.reported ? "success" : "warning"}>{pairing.status}</Badge>
              </span>
            </div>
            <ul className="flex flex-col gap-1.5 text-sm">
              {pairing.sides.map((side) => (
                <li key={side.name} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    {side.score && (
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        {side.score}
                      </Badge>
                    )}
                    <UserAvatar name={side.name} size="sm" />
                    <span className="truncate font-medium">{side.name}</span>
                  </span>
                  {side.points && (
                    <span className="shrink-0 font-semibold tabular-nums">{side.points}</span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground flex items-center gap-1.5 text-sm font-medium">
          <UserMinusIcon className="size-4" aria-hidden="true" />
          {m.tournaments_standings_col_byes()}
        </span>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <UserAvatar name={FIXTURE_PEOPLE.sina.userName} size="sm" />
            <span className="truncate font-medium">{FIXTURE_PEOPLE.sina.userName}</span>
          </span>
          <span className="font-semibold tabular-nums">
            {m.tournaments_pairings_bye_points({ points: 3 })}
          </span>
        </div>
      </div>
    </Vignette>
  );
}
