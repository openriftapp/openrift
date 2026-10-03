import type {
  BoardBattlefieldState,
  BoardPlayer,
  BoardStep,
  BoardTurn,
  ScoringMode,
  TurnPhase,
  TurnState,
} from "@openrift/shared/board-state";
import { useQuery } from "@tanstack/react-query";

import { hasTurnState, scoreHolder } from "@/features/rules/lib/board-layout";
import { PLAYER_COLOR } from "@/features/rules/lib/board-style";
import { useHydrated } from "@/hooks/use-hydrated";
import { getFilterIconPath } from "@/lib/icons";
import { initQueryOptions } from "@/lib/init-queries";
import { m } from "@/paraglide/messages.js";

export const PHASE_LABEL: Record<TurnPhase, () => string> = {
  awaken: m.board_states_phase_awaken,
  beginning: m.board_states_phase_beginning,
  channel: m.board_states_phase_channel,
  draw: m.board_states_phase_draw,
  main: m.board_states_phase_main,
  ending: m.board_states_phase_ending,
};

export const TURN_STATE_LABEL: Record<TurnState, () => string> = {
  "neutral-open": m.board_states_turn_state_neutral_open,
  "neutral-closed": m.board_states_turn_state_neutral_closed,
  "showdown-open": m.board_states_turn_state_showdown_open,
  "showdown-closed": m.board_states_turn_state_showdown_closed,
};

const TEAMMATES: Record<"A" | "B", string> = { A: "A+C", B: "B+D" };

function PlayerChip({ text, player }: { text: string; player: BoardPlayer }) {
  return (
    <span
      className="rounded-sm px-1.5 font-semibold text-white"
      style={{ backgroundColor: PLAYER_COLOR[player] }}
    >
      {text}
    </span>
  );
}

function PlainChip({ text }: { text: string }) {
  return <span className="rounded-sm bg-black/40 px-1.5 text-white/90">{text}</span>;
}

export function BoardTurnBar({ turn }: { turn: BoardTurn }) {
  if (!hasTurnState(turn)) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      {turn.player && (
        <PlayerChip
          text={m.board_states_turn_player({ player: turn.player })}
          player={turn.player}
        />
      )}
      {turn.phase && <PlainChip text={PHASE_LABEL[turn.phase]()} />}
      {turn.state && <PlainChip text={TURN_STATE_LABEL[turn.state]()} />}
      {turn.priority && (
        <PlayerChip
          text={m.board_states_turn_priority({ player: turn.priority })}
          player={turn.priority}
        />
      )}
      {turn.focus && (
        <PlayerChip text={m.board_states_turn_focus({ player: turn.focus })} player={turn.focus} />
      )}
    </div>
  );
}

/** The share page renders without the enums on the server, so the label waits for hydration. */
function DomainGlyph({ domain }: { domain: string }) {
  const hydrated = useHydrated();
  const domains = useQuery({ ...initQueryOptions, enabled: hydrated }).data?.enums.domains;
  const label = (hydrated ? domains?.find((row) => row.slug === domain)?.label : null) ?? domain;
  return (
    <img src={getFilterIconPath("domains", domain)} alt={label} title={label} className="size-4" />
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-2xs text-white/60 uppercase">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

export function BattlefieldStateBadges({ state }: { state: BoardBattlefieldState }) {
  const badges: { key: string; text: string; color?: string }[] = [];
  if (state.controller !== null) {
    badges.push({
      key: "controller",
      text: m.board_states_battlefield_controlled({ player: state.controller }),
      color: PLAYER_COLOR[state.controller],
    });
  }
  if (state.contested) {
    badges.push({ key: "contested", text: m.board_states_battlefield_contested() });
  }
  if (state.encounter !== null) {
    badges.push({
      key: "encounter",
      text:
        state.encounter === "combat"
          ? m.board_states_battlefield_combat()
          : m.board_states_battlefield_showdown(),
    });
  }
  if (state.scoredBy.length > 0) {
    badges.push({
      key: "scored",
      text: m.board_states_battlefield_scored({ players: state.scoredBy.join(", ") }),
    });
  }
  if (badges.length === 0) {
    return null;
  }
  return (
    <span className="absolute top-0 left-0 z-10 flex flex-col items-start gap-0.5">
      {badges.map((badge) => (
        <span
          key={badge.key}
          className="text-2xs rounded-sm bg-black/75 px-1 font-semibold whitespace-nowrap uppercase"
          style={badge.color ? { color: badge.color } : undefined}
        >
          {badge.text}
        </span>
      ))}
    </span>
  );
}

/** In team scoring the team total sits on A and B. */
export function BoardSeatStats({
  player,
  stats,
  scoring,
  showScore,
}: {
  player: BoardPlayer;
  stats: BoardStep["players"];
  scoring: ScoringMode;
  showScore: boolean;
}) {
  const own = stats[player];
  const holder = scoreHolder(player, scoring);
  const scoreShown = showScore && holder === player;
  const score = stats[holder]?.score ?? 0;
  const power = Object.entries(own?.power ?? {});
  if (!scoreShown && own?.xp === undefined && own?.energy === undefined && power.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      {scoreShown && (
        <span className="flex items-baseline gap-1">
          <span
            className="text-2xs rounded-sm px-1 font-semibold text-white uppercase"
            style={{ backgroundColor: PLAYER_COLOR[player] }}
          >
            {scoring === "teams" && (player === "A" || player === "B")
              ? m.board_states_team({ players: TEAMMATES[player] })
              : m.board_states_stat_score()}
          </span>
          <span className="text-lg font-semibold tabular-nums">{score}</span>
        </span>
      )}
      {own?.xp !== undefined && <Stat label={m.board_states_stat_xp()} value={own.xp} />}
      {own?.energy !== undefined && (
        <Stat label={m.board_states_stat_energy()} value={own.energy} />
      )}
      {power.length > 0 && (
        <span className="flex items-center gap-1">
          <span className="text-2xs text-white/60 uppercase">{m.board_states_stat_power()}</span>
          {power.map(([domain, amount]) => (
            <span key={domain} className="flex items-center gap-0.5 font-semibold tabular-nums">
              <DomainGlyph domain={domain} />
              {amount}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
