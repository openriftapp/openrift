import { PlayIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import {
  PageDescription,
  PageTopBar,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pressable } from "@/components/ui/pressable";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { LegendPickerDialog } from "@/features/match-tracker/components/legend-picker";
import type { TrackedLegend } from "@/features/match-tracker/lib/match-legends";
import type { TeamId } from "@/features/match-tracker/stores/match-tracker-store";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  teamMemberCounts,
  useMatchTrackerStore,
} from "@/features/match-tracker/stores/match-tracker-store";
import { teamLabels } from "@/features/tournaments/lib/match-teams";
import { useNumericDraft } from "@/hooks/use-numeric-draft";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const PLAYER_COUNT_OPTIONS = Array.from(
  { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
  (_, offset) => MIN_PLAYERS + offset,
);

const TEAM_OPTIONS: TeamId[] = [0, 1];

function TeamToggle({
  playerName,
  team,
  onChange,
}: {
  playerName: string;
  team: TeamId;
  onChange: (team: TeamId) => void;
}) {
  return (
    <ToggleGroup
      className="shrink-0"
      variant="outline"
      spacing={0}
      value={[String(team)]}
      onValueChange={([next]) => {
        if (next === "0" || next === "1") {
          onChange(Number(next) as TeamId);
        }
      }}
    >
      {TEAM_OPTIONS.map((option) => (
        <ToggleGroupItem
          key={option}
          value={String(option)}
          aria-label={m.tracker_setup_put_on_team({
            player: playerName,
            team: teamLabels()[option],
          })}
          className="w-9"
        >
          {option + 1}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function SeatRow({
  playerId,
  index,
  name,
  legend,
  team,
  teamsActive,
  onRename,
  onTeamChange,
}: {
  playerId: string;
  index: number;
  name: string;
  legend: TrackedLegend | null;
  team: TeamId;
  teamsActive: boolean;
  onRename: (name: string) => void;
  onTeamChange: (team: TeamId) => void;
}) {
  const setLegend = useMatchTrackerStore((state) => state.setLegend);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Pressable
        aria-label={
          legend
            ? m.tracker_setup_change_legend({ player: name, legend: legend.name })
            : m.tracker_setup_pick_legend({ player: name })
        }
        onClick={() => setPickerOpen(true)}
        className={cn(
          "aspect-card relative h-14 shrink-0 overflow-hidden rounded-md border",
          legend ? "border-border-accent" : "border-border border-dashed",
        )}
      >
        {legend?.thumbnail ? (
          <img
            src={legend.thumbnail}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <span className="text-muted-foreground grid size-full place-items-center">
            <PlusIcon className="size-4" />
          </span>
        )}
      </Pressable>
      <Input
        value={name}
        aria-label={m.tracker_setup_player_name({ number: index + 1 })}
        onChange={(event) => onRename(event.target.value)}
      />
      {teamsActive && <TeamToggle playerName={name} team={team} onChange={onTeamChange} />}
      <LegendPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        playerName={name}
        selectedCardId={legend?.cardId ?? null}
        onSelect={(next) => setLegend(playerId, next)}
      />
    </div>
  );
}

export function SetupScreen() {
  const players = useMatchTrackerStore((state) => state.players);
  const mode = useMatchTrackerStore((state) => state.mode);
  const pointsTarget = useMatchTrackerStore((state) => state.pointsTarget);
  const setPlayerCount = useMatchTrackerStore((state) => state.setPlayerCount);
  const setMode = useMatchTrackerStore((state) => state.setMode);
  const renamePlayer = useMatchTrackerStore((state) => state.renamePlayer);
  const setPlayerTeam = useMatchTrackerStore((state) => state.setPlayerTeam);
  const setPointsTarget = useMatchTrackerStore((state) => state.setPointsTarget);
  const startGame = useMatchTrackerStore((state) => state.startGame);

  const { inputProps: pointsTargetProps, resetDraft: resetPointsTargetDraft } = useNumericDraft({
    display: String(pointsTarget),
    onCommit: (text) => {
      // oxlint-disable-next-line unicorn/prefer-number-coercion -- lenient parse of an input value; Number() would yield NaN on trailing text
      const parsed = Number.parseInt(text, 10);
      if (!Number.isNaN(parsed)) {
        setPointsTarget(parsed);
      }
    },
  });

  const teamsActive = mode === "teams" && players.length === MAX_PLAYERS;
  const [teamOneCount, teamTwoCount] = teamMemberCounts(players);
  const teamsBalanced = teamOneCount === 2 && teamTwoCount === 2;
  const canStart = !teamsActive || teamsBalanced;

  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          <PageTopBarTitle>{m.tracker_setup_title()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-8 pt-3 pb-6")}>
        <PageDescription>{m.tracker_setup_description()}</PageDescription>

        <div className="space-y-2">
          <Label>{m.tracker_setup_players()}</Label>
          <ToggleGroup
            className="w-full"
            variant="outline"
            spacing={2}
            aria-label={m.tracker_setup_players()}
            value={[String(players.length)]}
            onValueChange={([next]) => {
              const count = Number(next);
              if (PLAYER_COUNT_OPTIONS.includes(count)) {
                setPlayerCount(count);
              }
            }}
          >
            {PLAYER_COUNT_OPTIONS.map((count) => (
              <ToggleGroupItem key={count} value={String(count)} className="flex-1">
                {count}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {players.length === MAX_PLAYERS && (
          <div className="space-y-2">
            <Label>{m.tracker_setup_format()}</Label>
            <ToggleGroup
              className="w-full"
              variant="outline"
              spacing={2}
              aria-label={m.tracker_setup_format()}
              value={[mode]}
              onValueChange={([next]) => {
                if (next === "ffa" || next === "teams") {
                  resetPointsTargetDraft();
                  setMode(next);
                }
              }}
            >
              <ToggleGroupItem value="ffa" className="flex-1">
                {m.tracker_setup_format_ffa()}
              </ToggleGroupItem>
              <ToggleGroupItem value="teams" className="flex-1">
                {m.tracker_setup_format_teams()}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <Label>{m.tracker_setup_seats()}</Label>
          <div className="flex flex-col gap-2">
            {players.map((player, index) => (
              <SeatRow
                key={player.id}
                playerId={player.id}
                index={index}
                name={player.name}
                legend={player.legend}
                team={player.team}
                teamsActive={teamsActive}
                onRename={(name) => renamePlayer(player.id, name)}
                onTeamChange={(team) => setPlayerTeam(player.id, team)}
              />
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-muted-foreground text-xs">{m.tracker_setup_legend_optional()}</p>
            {teamsActive && !teamsBalanced && (
              <p className="text-muted-foreground text-xs">{m.tracker_setup_balance_teams()}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="points-target">{m.tracker_setup_points_to_win()}</Label>
          <Input
            id="points-target"
            type="number"
            min={1}
            {...pointsTargetProps}
            className={cn(
              "w-24 [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:m-0",
              "[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0",
              "[&::-webkit-outer-spin-button]:appearance-none",
            )}
          />
          <p className="text-muted-foreground text-xs">{m.tracker_setup_points_hint()}</p>
        </div>

        <Button size="lg" className="w-full" disabled={!canStart} onClick={() => startGame()}>
          <PlayIcon className="size-4" />
          {m.tracker_setup_start_game()}
        </Button>
      </div>
    </>
  );
}
