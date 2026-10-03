import type {
  ArrowKind,
  BoardArrow,
  BoardArrowEnd,
  BoardChainEntry,
  BoardPiece,
  BoardPlayer,
  BoardStep,
  BoardZoneRef,
  ChainEntryType,
  PlayerZoneKind,
} from "@openrift/shared/board-state";
import { chainEntryName } from "@openrift/shared/board-state";

import { m } from "@/paraglide/messages.js";

export const ZONE_LABEL: Record<PlayerZoneKind | "facedown", () => string> = {
  base: m.board_states_zone_base,
  legend: m.board_states_zone_legend,
  champion: m.board_states_zone_champion,
  runes: m.board_states_zone_runes,
  hand: m.board_states_zone_hand,
  trash: m.board_states_zone_trash,
  banishment: m.board_states_zone_banishment,
  deck: m.board_states_zone_main_deck,
  runeDeck: m.board_states_zone_rune_deck,
  facedown: m.board_states_zone_facedown,
};

export const CHAIN_TYPE_LABEL: Record<ChainEntryType, () => string> = {
  spell: m.board_states_chain_type_spell,
  triggered: m.board_states_chain_type_triggered,
  activated: m.board_states_chain_type_activated,
};

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

export function chainEntryLabel(entry: BoardChainEntry, pieces: readonly BoardPiece[]): string {
  return chainEntryName(entry, pieces) ?? CHAIN_TYPE_LABEL[entry.type]();
}

export function describeZone(zone: BoardZoneRef, owner?: BoardPlayer): string {
  if (zone.kind === "battlefield") {
    return m.board_states_battlefield({ number: zone.index + 1 });
  }
  if (zone.kind === "facedown") {
    return `${ZONE_LABEL.facedown()} · ${m.board_states_battlefield({ number: zone.index + 1 })}`;
  }
  return owner ? `${ZONE_LABEL[zone.kind]()} ${owner}` : ZONE_LABEL[zone.kind]();
}

export const ARROW_KIND_LABEL: Record<ArrowKind, () => string> = {
  move: m.board_states_editor_arrow_move,
  target: m.board_states_editor_arrow_target,
  recall: m.board_states_editor_arrow_recall,
};

export function describeArrowEnd(end: BoardArrowEnd, step: BoardStep): string {
  if ("zone" in end) {
    return describeZone(end.zone, end.zone.kind === "facedown" ? undefined : end.owner);
  }
  if ("chain" in end) {
    const index = step.chain.findIndex((entry) => entry.id === end.chain);
    const entry = step.chain[index];
    return entry ? `${chainEntryLabel(entry, step.pieces)} (#${index + 1})` : end.chain;
  }
  const piece = step.pieces.find((candidate) => candidate.id === end.piece);
  return piece ? `${pieceName(piece)} (${piece.owner})` : end.piece;
}

export function describeArrow(arrow: BoardArrow, step: BoardStep): string {
  return `${ARROW_KIND_LABEL[arrow.kind]()}: ${describeArrowEnd(arrow.from, step)} → ${describeArrowEnd(arrow.to, step)}`;
}
