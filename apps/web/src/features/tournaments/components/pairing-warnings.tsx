import type { TeamSnapshotPlayer } from "@openrift/shared/pairing/team-units";
import type { PairingWarning } from "@openrift/shared/pairing/warnings";
import type { PodSnapshotPlayer } from "@openrift/shared/types/api/pod-tournament";
import { TriangleAlertIcon } from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

// Named so the React Compiler can reorder it.
const rawRegionSlug = (slug: string): string => slug;

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

function describeWarning(
  warning: PairingWarning,
  nameById: Map<string, string>,
  regionLabel: (slug: string) => string,
): string {
  const name = (id: string) => nameById.get(id) ?? m.tournaments_warning_fallback_player();
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
    case "sameRegion": {
      return m.tournaments_warning_same_region({
        first: name(warning.playerIds[0]),
        second: name(warning.playerIds[1]),
        region: regionLabel(warning.region),
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

/**
 * The pod's warnings written out, one line each, in the app's amber warning
 * callout. Renders nothing when there are no warnings.
 */
export function WarningList({
  warnings,
  nameById,
  regionLabel = rawRegionSlug,
  className,
}: {
  warnings: PairingWarning[];
  nameById: Map<string, string>;
  regionLabel?: (slug: string) => string;
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
            <li key={index}>{describeWarning(warning, nameById, regionLabel)}</li>
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
  regionLabel = rawRegionSlug,
}: {
  warnings: PairingWarning[];
  nameById: Map<string, string>;
  regionLabel?: (slug: string) => string;
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
            <li key={index}>{describeWarning(warning, nameById, regionLabel)}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
