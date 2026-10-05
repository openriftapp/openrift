import type {
  BoardChainEntry,
  BoardPiece,
  BoardPlayer,
  RuleRef,
  RuleRefKind,
} from "@openrift/shared/board-state";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Pressable } from "@/components/ui/pressable";
import { splitCaption } from "@/features/board-states/lib/board-caption";
import { chainEntryLabel, pieceName } from "@/features/board-states/lib/board-labels";
import { pieceNumerals } from "@/features/board-states/lib/board-layout";
import { PLAYER_COLOR } from "@/features/board-states/lib/board-style";
import type { KnownRules } from "@/features/rules/hooks/use-known-rules";
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

function pinFor(pins: RulesPins, kind: RuleRefKind): string | null {
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

export function ruleRefLabel(reference: RuleRef): string {
  return `§ ${reference.kind === "tournament" ? "T " : ""}${reference.ruleNumber}`;
}

export function RuleChip({
  reference,
  pins,
  knownRules,
}: {
  reference: RuleRef;
  pins: RulesPins;
  knownRules?: KnownRules;
}) {
  const version = pinFor(pins, reference.kind);
  const label = ruleRefLabel(reference);
  if (version === null) {
    return <span className="bg-muted rounded-md px-1.5 font-mono text-sm">{label}</span>;
  }
  if (knownRules?.[reference.kind]?.has(reference.ruleNumber) === false) {
    return (
      <span
        className="bg-muted text-muted-foreground rounded-md px-1.5 font-mono text-sm"
        title={m.board_states_rule_not_pinned({ version })}
      >
        {label}
      </span>
    );
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

function RefChip({
  id,
  name,
  owner,
  numeral,
  pinned,
  onPin,
  onHover,
}: {
  id: string;
  name: string;
  owner: BoardPlayer;
  numeral?: number;
  pinned: boolean;
  onPin: (id: string | null) => void;
  onHover?: (id: string | null) => void;
}) {
  const color = PLAYER_COLOR[owner];
  return (
    <Pressable
      aria-label={m.board_states_caption_highlight_piece({ name })}
      aria-pressed={pinned}
      style={{ backgroundColor: color }}
      className="inline-flex items-center gap-1 rounded-md px-1.5 align-baseline text-sm font-medium text-white"
      onClick={() => {
        const next = pinned ? null : id;
        onPin(next);
        onHover?.(next);
      }}
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => {
        if (!pinned) {
          onHover?.(null);
        }
      }}
      onFocus={() => onHover?.(id)}
      onBlur={() => {
        if (!pinned) {
          onHover?.(null);
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

function RemovedRef({ text }: { text: string }) {
  return (
    <span className="bg-muted text-muted-foreground rounded-md px-1.5 text-sm line-through">
      {text}
    </span>
  );
}

export function BoardCaptionText({
  text,
  pins,
  pieces,
  chain = [],
  knownRules,
  onHoverPiece,
  onHoverChain,
  className,
}: {
  text: string;
  pins: RulesPins;
  pieces: readonly BoardPiece[];
  chain?: readonly BoardChainEntry[];
  knownRules?: KnownRules;
  onHoverPiece?: (id: string | null) => void;
  onHoverChain?: (id: string | null) => void;
  className?: string;
}) {
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const numerals = pieceNumerals(pieces);
  return (
    <p className={cn("whitespace-pre-line", className)}>
      {splitCaption(text).map((segment, index) => {
        if (segment.type === "rule") {
          return (
            <RuleChip
              // oxlint-disable-next-line react/no-array-index-key -- segments are positional
              key={index}
              reference={segment.ref}
              pins={pins}
              knownRules={knownRules}
            />
          );
        }
        if (segment.type === "card") {
          const piece = pieces.find((candidate) => candidate.id === segment.pieceId);
          if (!piece) {
            // oxlint-disable-next-line react/no-array-index-key -- segments are positional
            return <RemovedRef key={index} text={m.board_states_caption_removed_card()} />;
          }
          return (
            <RefChip
              // oxlint-disable-next-line react/no-array-index-key -- segments are positional
              key={index}
              id={piece.id}
              name={pieceName(piece)}
              owner={piece.owner}
              numeral={numerals.get(piece.id)}
              pinned={pinnedId === piece.id}
              onPin={setPinnedId}
              onHover={onHoverPiece}
            />
          );
        }
        if (segment.type === "chain") {
          const position = chain.findIndex((entry) => entry.id === segment.entryId);
          const entry = chain[position];
          if (!entry) {
            // oxlint-disable-next-line react/no-array-index-key -- segments are positional
            return <RemovedRef key={index} text={m.board_states_caption_removed_chain()} />;
          }
          return (
            <RefChip
              // oxlint-disable-next-line react/no-array-index-key -- segments are positional
              key={index}
              id={`chain:${entry.id}`}
              name={chainEntryLabel(entry, pieces)}
              owner={entry.owner}
              numeral={position + 1}
              pinned={pinnedId === `chain:${entry.id}`}
              onPin={setPinnedId}
              onHover={(id) => onHoverChain?.(id === null ? null : entry.id)}
            />
          );
        }
        // oxlint-disable-next-line react/no-array-index-key -- segments are positional
        return <span key={index}>{segment.text}</span>;
      })}
    </p>
  );
}
