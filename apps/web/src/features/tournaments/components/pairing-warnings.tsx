import type { TeamSnapshotPlayer } from "@openrift/shared/pairing/team-units";
import type { PairingWarning } from "@openrift/shared/pairing/warnings";
import type { PodSnapshotPlayer } from "@openrift/shared/types/api/pod-tournament";
import { TriangleAlertIcon } from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRegionLabel } from "@/features/tournaments/hooks/use-region-label";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/**
 * Rebuilds the engine's snapshot players (Map opponents, plus the 2v2 team)
 * from the wire snapshot.
 */
export function snapshotToPlayers(snapshot: PodSnapshotPlayer[]): TeamSnapshotPlayer[] {
  return snapshot.map((player) => ({
    id: player.playerId,
    teamId: player.teamId,
    score: player.score,
    pods3: player.pods3,
    pods4: player.pods4,
    byes: player.byes,
    opponents: new Map(Object.entries(player.opponents)),
    region: player.region,
    regionHistory: new Map(Object.entries(player.regionHistory)),
    fixedTable: player.fixedTable,
  }));
}

type SameRegionWarning = Extract<PairingWarning, { kind: "sameRegion" }>;

function playerName(nameById: Map<string, string>, id: string): string {
  return nameById.get(id) ?? m.tournaments_warning_fallback_player();
}

function describeWarning(
  warning: Exclude<PairingWarning, SameRegionWarning>,
  nameById: Map<string, string>,
): string {
  const name = (id: string) => playerName(nameById, id);
  switch (warning.kind) {
    case "rematch": {
      return warning.meetings === 1
        ? m.tournaments_warning_rematch_once({
            first: name(warning.playerIds[0]),
            second: name(warning.playerIds[1]),
          })
        : m.tournaments_warning_rematch_times({
            first: name(warning.playerIds[0]),
            second: name(warning.playerIds[1]),
            count: warning.meetings,
          });
    }
    case "largeSpread": {
      return m.tournaments_warning_wide_spread({ spread: warning.spread });
    }
    case "repeatedThreePod": {
      return m.tournaments_warning_three_pods({
        name: name(warning.playerId),
        count: warning.priorThreePods,
      });
    }
    case "repeatBye": {
      return m.tournaments_warning_byes({
        name: name(warning.playerId),
        count: warning.priorByes,
      });
    }
    case "fixedSeatDisplaced": {
      return m.tournaments_warning_fixed_seat({
        name: name(warning.playerId),
        from: warning.fixedTable,
        to: warning.assignedTable,
      });
    }
  }
}

function SameRegionWarningLine({
  warning,
  nameById,
}: {
  warning: SameRegionWarning;
  nameById: Map<string, string>;
}) {
  const regionLabel = useRegionLabel();
  return (
    <li>
      {m.tournaments_warning_same_region({
        first: playerName(nameById, warning.playerIds[0]),
        second: playerName(nameById, warning.playerIds[1]),
        region: regionLabel(warning.region),
      })}
    </li>
  );
}

function WarningLine({
  warning,
  nameById,
}: {
  warning: PairingWarning;
  nameById: Map<string, string>;
}) {
  if (warning.kind === "sameRegion") {
    return <SameRegionWarningLine warning={warning} nameById={nameById} />;
  }
  return <li>{describeWarning(warning, nameById)}</li>;
}

/**
 * The pod's warnings written out, one line each, in the app's amber warning
 * callout. Renders nothing when there are no warnings.
 */
export function WarningList({
  warnings,
  nameById,
  className,
}: {
  warnings: PairingWarning[];
  nameById: Map<string, string>;
  className?: string;
}) {
  if (warnings.length === 0) {
    return null;
  }
  return (
    <Alert variant="warning" className={cn(className)}>
      <TriangleAlertIcon />
      <AlertTitle>
        <ul className="flex flex-col gap-0.5 font-normal">
          {warnings.map((warning, index) => (
            <WarningLine key={index} warning={warning} nameById={nameById} />
          ))}
        </ul>
      </AlertTitle>
    </Alert>
  );
}

/**
 * The compact form: a warning badge with the count, and the warnings themselves
 * in a tooltip. Renders nothing when there are no warnings.
 */
export function WarningBadge({
  warnings,
  nameById,
}: {
  warnings: PairingWarning[];
  nameById: Map<string, string>;
}) {
  if (warnings.length === 0) {
    return null;
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge variant="warning" />}>
        <TriangleAlertIcon />
        <span className="tabular-nums">{warnings.length}</span>
      </TooltipTrigger>
      <TooltipContent>
        <ul className="flex flex-col gap-0.5">
          {warnings.map((warning, index) => (
            <WarningLine key={index} warning={warning} nameById={nameById} />
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
