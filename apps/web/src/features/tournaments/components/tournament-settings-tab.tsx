import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { Suspense } from "react";

import type { PageTocItem } from "@/components/layout/page-toc";
import { SettingsGroup } from "@/components/layout/settings-group";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { DangerZoneCard } from "@/features/tournaments/components/settings/danger-zone-card";
import { DecksSection } from "@/features/tournaments/components/settings/decks-section";
import { FollowAlongSection } from "@/features/tournaments/components/settings/follow-along-section";
import { FormatSection } from "@/features/tournaments/components/settings/format-section";
import { GroupSection } from "@/features/tournaments/components/settings/group-section";
import { HostSection } from "@/features/tournaments/components/settings/host-section";
import { NameSection } from "@/features/tournaments/components/settings/name-section";
import { PointsSection } from "@/features/tournaments/components/settings/points-section";
import { RegionsSection } from "@/features/tournaments/components/settings/regions-section";
import { ScheduleSection } from "@/features/tournaments/components/settings/schedule-section";
import { SignupLinksSection } from "@/features/tournaments/components/settings/signup-links-section";
import {
  effectiveTournamentState,
  hasPairing,
} from "@/features/tournaments/lib/tournament-display";

function buildTocItems({
  isHost,
  runsRounds,
}: {
  isHost: boolean;
  runsRounds: boolean;
}): PageTocItem[] {
  return [
    { id: "general", label: "General" },
    { id: "name", label: "Name", level: 1 },
    ...(isHost
      ? [
          { id: "host", label: "Host", level: 1 },
          { id: "group", label: "Group", level: 1 },
        ]
      : []),
    { id: "schedule", label: "Schedule", level: 1 },
    { id: "pairings-decks", label: "Pairings & decks" },
    { id: "pairings", label: "Format", level: 1 },
    ...(runsRounds
      ? [
          { id: "points", label: "Points", level: 1 },
          { id: "regions", label: "Regions", level: 1 },
        ]
      : []),
    { id: "decks", label: "Decks", level: 1 },
    { id: "sharing", label: "Sharing" },
    { id: "signup-links", label: "Sign-up links", level: 1 },
    ...(runsRounds ? [{ id: "follow-along", label: "Follow-along", level: 1 }] : []),
    { id: "danger-zone", label: "Danger zone" },
  ];
}

export function TournamentSettingsTab({ detail }: { detail: TournamentDetailResponse }) {
  const runsRounds = hasPairing(detail.pairingStyle);
  const isHost = detail.myRoles.includes("host");
  const effectiveState = effectiveTournamentState(detail.startsAt, detail.endsAt, detail.status);
  const locked = effectiveState === "cancelled";
  const canEndEarly = effectiveState !== "completed" && effectiveState !== "cancelled";

  return (
    <SettingsLayout toc={buildTocItems({ isHost, runsRounds })}>
      <SettingsGroup id="general" title="General">
        <NameSection detail={detail} locked={locked} />

        {isHost ? (
          <Suspense fallback={null}>
            <HostSection detail={detail} locked={locked} />
            <GroupSection detail={detail} locked={locked} />
          </Suspense>
        ) : null}

        <ScheduleSection detail={detail} locked={locked} canEndEarly={canEndEarly} />
      </SettingsGroup>

      <SettingsGroup id="pairings-decks" title="Pairings & decks">
        <FormatSection detail={detail} locked={locked} />
        {runsRounds ? <PointsSection detail={detail} locked={locked} /> : null}
        {runsRounds && detail.playMode !== "2v2" ? (
          <RegionsSection detail={detail} locked={locked} />
        ) : null}
        <DecksSection detail={detail} locked={locked} />
      </SettingsGroup>

      <SettingsGroup id="sharing" title="Sharing">
        <SignupLinksSection detail={detail} locked={locked} />
        {runsRounds ? <FollowAlongSection detail={detail} locked={locked} /> : null}
      </SettingsGroup>

      <SettingsGroup id="danger-zone" title="Danger zone">
        <DangerZoneCard detail={detail} />
      </SettingsGroup>
    </SettingsLayout>
  );
}
