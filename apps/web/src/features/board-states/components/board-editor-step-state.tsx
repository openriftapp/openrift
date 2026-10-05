import type {
  BoardBattlefieldState,
  BoardPlayer,
  BoardPlayerStats,
} from "@openrift/shared/board-state";
import { BATTLEFIELD_ENCOUNTERS, TURN_PHASES, TURN_STATES } from "@openrift/shared/board-state";
import { WellKnown } from "@openrift/shared/well-known";
import { HourglassIcon, TrophyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PHASE_LABEL, TURN_STATE_LABEL } from "@/features/board-states/components/board-status";
import { useBoardEditorStore } from "@/features/board-states/stores/board-editor-store";
import { DomainIcon } from "@/features/cards/components/domain-icon";
import { useEnumOrders } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

const UNSET = "none";

function OptionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: readonly { value: T; label: string }[];
  onChange: (value: T | undefined) => void;
}) {
  const items = [{ value: UNSET, label: m.board_states_editor_unset() }, ...options];
  return (
    <Label className="flex items-center justify-between gap-3">
      {label}
      <Select
        items={items}
        value={value ?? UNSET}
        onValueChange={(next) => {
          const option = options.find((candidate) => candidate.value === next);
          onChange(option?.value);
        }}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Label>
  );
}

function playerOptions(players: readonly BoardPlayer[]) {
  return players.map((player) => ({ value: player, label: player }));
}

export function BoardEditorTurnPopover({ players }: { players: readonly BoardPlayer[] }) {
  const turn = useBoardEditorStore((state) => state.document.steps[state.activeStep]?.turn) ?? {};
  const setTurn = useBoardEditorStore((state) => state.setTurn);
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>
        <HourglassIcon />
        {m.board_states_editor_turn()}
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-80 flex-col gap-3">
        <OptionSelect
          label={m.board_states_editor_turn_player()}
          value={turn.player}
          options={playerOptions(players)}
          onChange={(player) => setTurn({ player })}
        />
        <OptionSelect
          label={m.board_states_editor_phase()}
          value={turn.phase}
          options={TURN_PHASES.map((phase) => ({ value: phase, label: PHASE_LABEL[phase]() }))}
          onChange={(phase) => setTurn({ phase })}
        />
        <OptionSelect
          label={m.board_states_editor_turn_state()}
          value={turn.state}
          options={TURN_STATES.map((state) => ({ value: state, label: TURN_STATE_LABEL[state]() }))}
          onChange={(state) => setTurn({ state })}
        />
        <OptionSelect
          label={m.board_states_editor_priority()}
          value={turn.priority}
          options={playerOptions(players)}
          onChange={(priority) => setTurn({ priority })}
        />
        <OptionSelect
          label={m.board_states_editor_focus()}
          value={turn.focus}
          options={playerOptions(players)}
          onChange={(focus) => setTurn({ focus })}
        />
      </PopoverContent>
    </Popover>
  );
}

function NumberField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  className?: string;
}) {
  return (
    <Input
      type="number"
      min={0}
      max={99}
      aria-label={label}
      title={label}
      placeholder={label}
      className={className ?? "w-20"}
      value={value ?? ""}
      onChange={(event) => {
        const next = event.target.valueAsNumber;
        onChange(Number.isNaN(next) ? undefined : Math.min(99, Math.max(0, Math.trunc(next))));
      }}
    />
  );
}

function PlayerStatsRow({ player }: { player: BoardPlayer }) {
  const stats = useBoardEditorStore(
    (state) => state.document.steps[state.activeStep]?.players[player],
  );
  const scoring = useBoardEditorStore((state) => state.document.scoring);
  const setPlayerStats = useBoardEditorStore((state) => state.setPlayerStats);
  const { orders } = useEnumOrders();
  const domains = orders.domains.filter((domain) => domain !== WellKnown.domain.COLORLESS);
  const holdsScore = scoring === "players" || player === "A" || player === "B";
  const set = (patch: Partial<BoardPlayerStats>) => setPlayerStats(player, patch);
  const setPower = (domain: string, amount: number | undefined) => {
    const power = Object.fromEntries(
      Object.entries({ ...stats?.power, [domain]: amount ?? 0 }).filter(([, value]) => value > 0),
    );
    set({ power: Object.keys(power).length === 0 ? undefined : power });
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{m.board_states_player({ player })}</span>
      <div className="flex flex-wrap gap-1.5">
        {holdsScore && (
          <NumberField
            label={m.board_states_stat_score()}
            value={stats?.score}
            onChange={(score) => set({ score })}
          />
        )}
        <NumberField
          label={m.board_states_stat_xp()}
          value={stats?.xp}
          onChange={(xp) => set({ xp })}
        />
        <NumberField
          label={m.board_states_stat_energy()}
          value={stats?.energy}
          onChange={(energy) => set({ energy })}
        />
        <NumberField
          label={m.board_states_stat_deck_count()}
          value={stats?.deckCount}
          onChange={(deckCount) => set({ deckCount })}
          className="w-28"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground text-sm">{m.board_states_stat_power()}</span>
        {domains.map((domain) => (
          <span key={domain} className="flex items-center gap-0.5">
            <DomainIcon domain={domain} className="size-5" />
            <NumberField
              label={`${m.board_states_stat_power()} ${domain}`}
              value={stats?.power?.[domain]}
              onChange={(amount) => setPower(domain, amount)}
              className="w-14"
            />
          </span>
        ))}
      </div>
    </div>
  );
}

export function BoardEditorStatsPopover({ players }: { players: readonly BoardPlayer[] }) {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" />}>
        <TrophyIcon />
        {m.board_states_editor_stats()}
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-[26rem] flex-col gap-4">
        {players.map((player) => (
          <PlayerStatsRow key={player} player={player} />
        ))}
      </PopoverContent>
    </Popover>
  );
}

const ENCOUNTER_LABEL = {
  showdown: m.board_states_battlefield_showdown,
  combat: m.board_states_battlefield_combat,
} as const;

export function BattlefieldStateFields({
  index,
  players,
}: {
  index: number;
  players: readonly BoardPlayer[];
}) {
  const state = useBoardEditorStore(
    (store) => store.document.steps[store.activeStep]?.battlefields[index],
  );
  const setBattlefieldState = useBoardEditorStore((store) => store.setBattlefieldState);
  if (!state) {
    return null;
  }
  const set = (patch: Partial<BoardBattlefieldState>) => setBattlefieldState(index, patch);
  return (
    <div className="flex flex-col gap-3">
      <OptionSelect
        label={m.board_states_editor_controller()}
        value={state.controller ?? undefined}
        options={playerOptions(players)}
        onChange={(controller) => set({ controller: controller ?? null })}
      />
      <Label className="flex items-center justify-between gap-3">
        {m.board_states_battlefield_contested()}
        <Switch checked={state.contested} onCheckedChange={(contested) => set({ contested })} />
      </Label>
      <OptionSelect
        label={m.board_states_editor_encounter()}
        value={state.encounter ?? undefined}
        options={BATTLEFIELD_ENCOUNTERS.map((encounter) => ({
          value: encounter,
          label: ENCOUNTER_LABEL[encounter](),
        }))}
        onChange={(encounter) => set({ encounter: encounter ?? null })}
      />
      <div className="flex items-center justify-between gap-3">
        <Label>{m.board_states_editor_scored_by()}</Label>
        <ToggleGroup
          size="sm"
          variant="outline"
          spacing={0}
          multiple
          value={state.scoredBy}
          onValueChange={(next) =>
            set({ scoredBy: players.filter((player) => next.includes(player)) })
          }
        >
          {players.map((player) => (
            <ToggleGroupItem key={player} value={player}>
              {player}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
