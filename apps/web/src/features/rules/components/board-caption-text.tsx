import type { BoardPiece, RuleRef, RuleRefKind } from "@openrift/shared/board-state";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Pressable } from "@/components/ui/pressable";
import { PLAYER_COLOR, pieceName } from "@/features/rules/components/board-view";
import { splitCaption } from "@/features/rules/lib/board-caption";
import { pieceNumerals } from "@/features/rules/lib/board-layout";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export interface RulesPins {
  coreRulesVersion: string | null;
  tournamentRulesVersion: string | null;
}

function rulesKindLabel(kind: RuleRefKind): string {
  return kind === "core"
    ? m.board_states_rules_kind_core()
    : m.board_states_rules_kind_tournament();
}

export function pinFor(pins: RulesPins, kind: RuleRefKind): string | null {
  return kind === "core" ? pins.coreRulesVersion : pins.tournamentRulesVersion;
}

export function RulesPinBadges({ pins }: { pins: RulesPins }) {
  return (
    <>
      {(["core", "tournament"] as const).map((kind) => {
        const version = pinFor(pins, kind);
        return version === null ? null : (
          <Badge key={kind} variant="secondary" className="font-mono">
            {m.board_states_rules_badge({ kind: rulesKindLabel(kind), version })}
          </Badge>
        );
      })}
    </>
  );
}

export function RuleChip({ reference, pins }: { reference: RuleRef; pins: RulesPins }) {
  const version = pinFor(pins, reference.kind);
  const label = `§ ${reference.kind === "tournament" ? "T " : ""}${reference.ruleNumber}`;
  if (version === null) {
    return <span className="bg-muted rounded-md px-1.5 font-mono text-sm">{label}</span>;
  }
  return (
    <Link
      to="/rules/$kind/$version"
      params={{ kind: reference.kind, version }}
      hash={`rule-${reference.ruleNumber}`}
      className="bg-muted hover:bg-muted/70 inline-flex items-center rounded-md px-1.5 font-mono text-sm no-underline"
      title={m.board_states_open_rules({ version })}
    >
      {label}
    </Link>
  );
}

function CardChip({
  piece,
  numeral,
  pinned,
  onPin,
  onHoverPiece,
}: {
  piece: BoardPiece;
  numeral?: number;
  pinned: boolean;
  onPin: (id: string | null) => void;
  onHoverPiece?: (id: string | null) => void;
}) {
  const name = pieceName(piece);
  const color = PLAYER_COLOR[piece.owner];
  return (
    <Pressable
      aria-label={m.board_states_caption_highlight_piece({ name })}
      aria-pressed={pinned}
      style={{ backgroundColor: color }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 align-baseline text-sm font-medium text-white"
      onClick={() => {
        const next = pinned ? null : piece.id;
        onPin(next);
        onHoverPiece?.(next);
      }}
      onMouseEnter={() => onHoverPiece?.(piece.id)}
      onMouseLeave={() => {
        if (!pinned) {
          onHoverPiece?.(null);
        }
      }}
      onFocus={() => onHoverPiece?.(piece.id)}
      onBlur={() => {
        if (!pinned) {
          onHoverPiece?.(null);
        }
      }}
    >
      {name}
      {numeral === undefined ? null : (
        <span
          className="text-2xs inline-flex size-4 items-center justify-center rounded-full bg-white font-semibold"
          style={{ color }}
        >
          {numeral}
        </span>
      )}
    </Pressable>
  );
}

export function BoardCaptionText({
  text,
  pins,
  pieces,
  onHoverPiece,
  className,
}: {
  text: string;
  pins: RulesPins;
  pieces: readonly BoardPiece[];
  onHoverPiece?: (id: string | null) => void;
  className?: string;
}) {
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const numerals = pieceNumerals(pieces);
  return (
    <p className={cn("whitespace-pre-line", className)}>
      {splitCaption(text).map((segment, index) => {
        if (segment.type === "rule") {
          // oxlint-disable-next-line react/no-array-index-key -- segments are positional
          return <RuleChip key={index} reference={segment.ref} pins={pins} />;
        }
        if (segment.type === "card") {
          const piece = pieces.find((candidate) => candidate.id === segment.pieceId);
          if (!piece) {
            return (
              <span
                // oxlint-disable-next-line react/no-array-index-key -- segments are positional
                key={index}
                className="bg-muted text-muted-foreground rounded-md px-1.5 text-sm line-through"
              >
                {m.board_states_caption_removed_card()}
              </span>
            );
          }
          return (
            <CardChip
              // oxlint-disable-next-line react/no-array-index-key -- segments are positional
              key={index}
              piece={piece}
              numeral={numerals.get(piece.id)}
              pinned={pinnedId === piece.id}
              onPin={setPinnedId}
              onHoverPiece={onHoverPiece}
            />
          );
        }
        // oxlint-disable-next-line react/no-array-index-key -- segments are positional
        return <span key={index}>{segment.text}</span>;
      })}
    </p>
  );
}
