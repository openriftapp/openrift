import { TrophyIcon } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { Heading } from "@/components/heading";
import { Button } from "@/components/ui/button";
import { MatchSeamControls } from "@/features/match-tracker/components/match-seam-controls";
import { PlayerPanel } from "@/features/match-tracker/components/player-panel";
import { SetupScreen } from "@/features/match-tracker/components/setup-screen";
import {
  medallionSizeTier,
  perRowHeight,
  planSeats,
  scoreSizeClass,
  xpSizeTier,
} from "@/features/match-tracker/lib/match-layout";
import type { MedallionSize, Seat, XpSize } from "@/features/match-tracker/lib/match-layout";
import { useMatchTrackerStore } from "@/features/match-tracker/stores/match-tracker-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { useIsLandscape } from "@/hooks/use-is-landscape";
import { useMeasuredHeight } from "@/hooks/use-measured-height";
import { m } from "@/paraglide/messages.js";

// The store reads localStorage, so rendering is gated behind hydration to avoid an SSR mismatch.
export function MatchTrackerPage() {
  const hydrated = useHydrated();
  if (!hydrated) {
    return null;
  }
  return <MatchTracker />;
}

function MatchTracker() {
  const status = useMatchTrackerStore((state) => state.status);
  if (status === "setup") {
    return <SetupScreen />;
  }
  return <MatchBoard />;
}

function MatchBoard() {
  const playerIds = useMatchTrackerStore(useShallow((state) => state.players.map((p) => p.id)));
  const isLandscape = useIsLandscape();
  const rows = planSeats(playerIds, isLandscape);

  const [boardEl, setBoardEl] = useState<HTMLDivElement | null>(null);
  const boardHeight = useMeasuredHeight(boardEl);
  const panelHeight = perRowHeight(boardHeight, rows.length);
  const scoreClass = scoreSizeClass(panelHeight);
  const medSize = medallionSizeTier(panelHeight);
  const xpSize = xpSizeTier(panelHeight);

  return (
    // Clears the iOS safe areas so a landscape Dynamic Island (sides) and home indicator
    // (bottom) don't cover the edge panels; max() keeps the 8px gutter where insets are 0.
    <div className="relative flex min-h-0 flex-1 flex-col pt-2 pr-[max(0.5rem,env(safe-area-inset-right,0px))] pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] pl-[max(0.5rem,env(safe-area-inset-left,0px))]">
      <div ref={setBoardEl} className="relative flex min-h-0 flex-1 flex-col gap-2">
        {rows.map((seats) => (
          <BoardRow
            key={seats.map((seat) => seat.id).join("-")}
            seats={seats}
            scoreClass={scoreClass}
            medSize={medSize}
            xpSize={xpSize}
          />
        ))}
        <MatchSeamControls />
      </div>
      <WinnerBanner />
    </div>
  );
}

function BoardRow({
  seats,
  scoreClass,
  medSize,
  xpSize,
}: {
  seats: Seat[];
  scoreClass: string;
  medSize: MedallionSize;
  xpSize: XpSize;
}) {
  return (
    <div className="flex min-h-0 flex-1 gap-2">
      {seats.map((seat) => (
        <PlayerPanel
          key={seat.id}
          playerId={seat.id}
          rotated={seat.rotated}
          scoreClass={scoreClass}
          medSize={medSize}
          xpSize={xpSize}
        />
      ))}
    </div>
  );
}

function WinnerBanner() {
  const winner = useMatchTrackerStore(
    useShallow((state) => {
      const player = state.players.find((entry) => entry.id === state.winnerId);
      if (!player) {
        return null;
      }
      if (state.mode === "teams") {
        const names = state.players
          .filter((entry) => entry.team === player.team)
          .map((entry) => entry.name);
        return { name: names.join(" & "), isTeam: true };
      }
      return { name: player.name, isTeam: false };
    }),
  );
  const startGame = useMatchTrackerStore((state) => state.startGame);
  const backToSetup = useMatchTrackerStore((state) => state.backToSetup);
  const dismissWinner = useMatchTrackerStore((state) => state.dismissWinner);

  if (!winner) {
    return null;
  }

  return (
    // z-30: above the seam controls (z-20), which don't sit in their own stacking context.
    <div className="bg-background/80 absolute inset-0 z-30 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-card w-full max-w-sm space-y-4 rounded-lg border p-6 text-center shadow-lg">
        <TrophyIcon className="text-primary mx-auto size-10" />
        <Heading level={2}>
          {winner.isTeam
            ? m.tracker_winner_team({ name: winner.name })
            : m.tracker_winner_solo({ name: winner.name })}
        </Heading>
        <div className="flex flex-col gap-2">
          <Button onClick={() => startGame()}>{m.tracker_rematch()}</Button>
          <Button variant="outline" onClick={() => backToSetup()}>
            {m.tracker_new_players()}
          </Button>
          <Button variant="ghost" onClick={() => dismissWinner()}>
            {m.tracker_keep_adjusting()}
          </Button>
        </div>
      </div>
    </div>
  );
}
