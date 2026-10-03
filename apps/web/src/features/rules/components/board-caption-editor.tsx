import type { BoardChainEntry, BoardPiece } from "@openrift/shared/board-state";
import { matchesCardQuery } from "@openrift/shared/card-search";
import { imageUrl } from "@openrift/shared/image-url";
import { useRef, useState } from "react";

import { Pressable } from "@/components/ui/pressable";
import { Textarea } from "@/components/ui/textarea";
import { useCards } from "@/features/cards/hooks/use-cards";
import { frontImageId } from "@/features/cards/lib/card-meta";
import { chainEntryLabel, describeZone, pieceName } from "@/features/rules/lib/board-labels";
import { pieceNumerals } from "@/features/rules/lib/board-layout";
import { PLAYER_COLOR } from "@/features/rules/lib/board-style";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface Mention {
  start: number;
  end: number;
  query: string;
}

const MENTION_PATTERN = /@(?<query>[^@\n]{0,40})$/u;

function mentionAt(value: string, caret: number): Mention | null {
  const match = MENTION_PATTERN.exec(value.slice(0, caret));
  const query = match?.groups?.query;
  if (query === undefined || match?.index === undefined) {
    return null;
  }
  return { start: match.index, end: caret, query };
}

type MentionTarget =
  | { kind: "piece"; key: string; name: string; piece: BoardPiece }
  | { kind: "chain"; key: string; name: string; entry: BoardChainEntry; position: number };

function optionId(target: MentionTarget): string {
  return target.kind === "piece" ? target.piece.id : `chain-${target.entry.id}`;
}

function BoardCaptionOption({
  target,
  imageId,
  numeral,
  active,
  id,
  onSelect,
}: {
  target: MentionTarget;
  imageId: string | null;
  numeral?: number;
  active: boolean;
  id: string;
  onSelect: () => void;
}) {
  const owner = target.kind === "piece" ? target.piece.owner : target.entry.owner;
  const where =
    target.kind === "piece"
      ? describeZone(target.piece.zone, target.piece.owner)
      : `${m.board_states_chain()} #${target.position}`;
  return (
    <Pressable
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-sm",
        active ? "bg-muted" : "hover:bg-muted/50",
      )}
    >
      {imageId === null ? null : (
        <img
          src={imageUrl(imageId, "240w")}
          alt=""
          className="h-8 w-6 min-w-0 shrink-0 rounded-sm object-cover"
        />
      )}
      <span
        aria-hidden="true"
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: PLAYER_COLOR[owner] }}
      />
      <span className="truncate">{target.name}</span>
      {numeral === undefined ? null : (
        <span className="text-muted-foreground text-2xs">{numeral}</span>
      )}
      <span className="text-muted-foreground text-2xs ml-auto shrink-0">{where}</span>
    </Pressable>
  );
}

export function BoardCaptionEditor({
  id,
  value,
  onChange,
  pieces,
  chain = [],
  maxLength,
  placeholder,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  pieces: readonly BoardPiece[];
  chain?: readonly BoardChainEntry[];
  maxLength?: number;
  placeholder?: string;
  className?: string;
}) {
  const { printingsById, printingsByCardId } = useCards();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<Mention | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const numerals = pieceNumerals(pieces);
  const targets: MentionTarget[] = [
    ...pieces.map((piece) => ({
      kind: "piece" as const,
      key: `piece:${piece.id}`,
      name: pieceName(piece),
      piece,
    })),
    ...chain.map((entry, index) => ({
      kind: "chain" as const,
      key: `chain:${entry.id}`,
      name: chainEntryLabel(entry, pieces),
      entry,
      position: index + 1,
    })),
  ];
  const matches =
    mention === null
      ? []
      : targets.filter((target) => matchesCardQuery(mention.query, [target.name]));
  const open = mention !== null && matches.length > 0;
  const active = matches[Math.min(activeIndex, matches.length - 1)];

  function imageIdFor(target: MentionTarget): string | null {
    const card =
      target.kind === "piece"
        ? target.piece.card
        : (target.entry.card ??
          pieces.find((piece) => piece.id === target.entry.source)?.card ??
          null);
    if (!card) {
      return null;
    }
    const byPrinting = card.printingId ? printingsById[card.printingId] : undefined;
    return frontImageId(byPrinting ?? printingsByCardId.get(card.cardId)?.[0]);
  }

  function insert(target: MentionTarget) {
    if (mention === null) {
      return;
    }
    const current = textareaRef.current?.value ?? value;
    const reference =
      target.kind === "piece" ? `[[card:${target.piece.id}]]` : `[[chain:${target.entry.id}]]`;
    const before = current.slice(0, mention.start);
    const caret = before.length + reference.length;
    onChange(`${before}${reference}${current.slice(mention.end)}`);
    requestAnimationFrame(() => textareaRef.current?.setSelectionRange(caret, caret));
    setMention(null);
    setActiveIndex(0);
  }

  function syncMention(target: HTMLTextAreaElement) {
    setMention(mentionAt(target.value, target.selectionStart));
    setActiveIndex(0);
  }

  return (
    <div className={cn("relative flex flex-col gap-1", className)}>
      <Textarea
        id={id}
        ref={textareaRef}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-expanded={open}
        aria-controls={open ? `${id}-mentions` : undefined}
        aria-activedescendant={open && active ? `${id}-mention-${optionId(active)}` : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          syncMention(event.target);
        }}
        onClick={(event) => syncMention(event.currentTarget)}
        onKeyUp={(event) => {
          if (event.key.startsWith("Arrow") || event.key === "Home" || event.key === "End") {
            syncMention(event.currentTarget);
          }
        }}
        onBlur={() => setMention(null)}
        onKeyDown={(event) => {
          if (!open) {
            return;
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setMention(null);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % matches.length);
            return;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => (index - 1 + matches.length) % matches.length);
            return;
          }
          if ((event.key === "Enter" || event.key === "Tab") && active) {
            event.preventDefault();
            insert(active);
          }
        }}
      />
      {open ? (
        <div className="bg-popover text-popover-foreground ring-border absolute top-full left-0 z-50 mt-1 flex w-full max-w-sm flex-col gap-1 rounded-lg p-1.5 shadow-md ring-1">
          <div
            id={`${id}-mentions`}
            role="listbox"
            aria-label={m.board_states_caption_mention_list()}
            className="flex max-h-64 flex-col overflow-y-auto"
          >
            {matches.map((target) => (
              <BoardCaptionOption
                key={target.key}
                id={`${id}-mention-${optionId(target)}`}
                target={target}
                imageId={imageIdFor(target)}
                numeral={target.kind === "piece" ? numerals.get(target.piece.id) : undefined}
                active={active?.key === target.key}
                onSelect={() => insert(target)}
              />
            ))}
          </div>
          <span className="text-muted-foreground text-2xs">
            {m.board_states_caption_mention_hint()}
          </span>
        </div>
      ) : null}
    </div>
  );
}
