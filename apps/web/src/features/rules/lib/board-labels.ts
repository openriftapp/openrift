import type {
  BoardArrow,
  BoardPiece,
  BoardPlayer,
  BoardStep,
  BoardZoneRef,
  PlayerZoneKind,
} from "@openrift/shared/board-state";

import { m } from "@/paraglide/messages.js";

export const ZONE_LABEL: Record<PlayerZoneKind, () => string> = {
  base: m.board_states_zone_base,
  legend: m.board_states_zone_legend,
  champion: m.board_states_zone_champion,
  runes: m.board_states_zone_runes,
  hand: m.board_states_zone_hand,
  trash: m.board_states_zone_trash,
};

export const STACK_LABEL = {
  runeDeck: m.board_states_zone_rune_deck,
  deck: m.board_states_zone_main_deck,
} as const;

const PIECE_KIND_LABEL = {
  unit: m.board_states_piece_unit,
  spell: m.board_states_piece_spell,
  gear: m.board_states_piece_gear,
  rune: m.board_states_piece_rune,
  legend: m.board_states_piece_legend,
  token: m.board_states_piece_token,
} as const;

export function pieceName(piece: BoardPiece): string {
  return piece.card?.name ?? PIECE_KIND_LABEL[piece.kind]();
}

export function describeZone(zone: BoardZoneRef, owner?: BoardPlayer): string {
  if (zone.kind === "battlefield") {
    return m.board_states_battlefield({ number: zone.index + 1 });
  }
  return owner ? `${ZONE_LABEL[zone.kind]()} ${owner}` : ZONE_LABEL[zone.kind]();
}

export function describeArrow(arrow: BoardArrow, step: BoardStep): string {
  const nameOf = (id: string) => {
    const piece = step.pieces.find((candidate) => candidate.id === id);
    return piece ? `${pieceName(piece)} (${piece.owner})` : id;
  };
  const kind =
    arrow.kind === "move"
      ? m.board_states_editor_arrow_move()
      : m.board_states_editor_arrow_target();
  const target =
    "piece" in arrow.to ? nameOf(arrow.to.piece) : describeZone(arrow.to.zone, arrow.to.owner);
  return `${kind}: ${nameOf(arrow.from)} → ${target}`;
}
