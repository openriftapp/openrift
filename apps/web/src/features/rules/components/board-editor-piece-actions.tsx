import type { BoardPiece } from "@openrift/shared/board-state";
import {
  CopyIcon,
  CrosshairIcon,
  MinusIcon,
  MoveRightIcon,
  PlusIcon,
  RotateCwIcon,
  SparklesIcon,
  TagIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { pieceName } from "@/features/rules/components/board-view";
import type { BoardPieceActions } from "@/features/rules/hooks/use-board-editor-piece-actions";
import { useCardModifierKeywords } from "@/hooks/use-keyword-styles";
import { m } from "@/paraglide/messages.js";

export type ArrowKind = "move" | "target";

function MightGlyph() {
  return <img src="/images/might.svg" alt="" className="size-3.5 brightness-0 dark:invert" />;
}

function KeywordSwatch({
  name,
  color,
  darkText,
  pressed,
  onToggle,
}: {
  name: string;
  color: string;
  darkText: boolean;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <Toggle size="sm" pressed={pressed} onPressedChange={onToggle} className="relative px-2.5">
      <span
        className="absolute inset-x-1 inset-y-0 -skew-x-[15deg]"
        style={{ backgroundColor: color, opacity: pressed ? 1 : 0.35 }}
      />
      <span
        className="relative"
        style={pressed ? { color: darkText ? "#000" : "#fff" } : undefined}
      >
        {name}
      </span>
    </Toggle>
  );
}

function KeywordPanel({ piece, actions }: { piece: BoardPiece; actions: BoardPieceActions }) {
  const keywords = useCardModifierKeywords();
  const [draft, setDraft] = useState("");
  const known = new Set(keywords.map((entry) => entry.name));
  const extra = piece.keywords.filter((keyword) => !known.has(keyword));
  const submit = () => {
    actions.toggleKeyword(draft);
    setDraft("");
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {keywords.map((entry) => (
          <KeywordSwatch
            key={entry.name}
            name={entry.name}
            color={entry.color}
            darkText={entry.darkText}
            pressed={piece.keywords.includes(entry.name)}
            onToggle={() => actions.toggleKeyword(entry.name)}
          />
        ))}
        {extra.map((keyword) => (
          <Toggle
            key={keyword}
            size="sm"
            pressed
            onPressedChange={() => actions.toggleKeyword(keyword)}
          >
            {keyword}
          </Toggle>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          maxLength={40}
          placeholder={m.board_states_editor_keyword_add()}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button size="sm" variant="outline" disabled={draft.trim() === ""} onClick={submit}>
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}

export interface PieceMarks {
  turn: boolean;
  keywords: boolean;
  stats: boolean;
}

/** Cards in hand or the champion slot are not in play; runes only turn; legends carry keywords but no stats. */
export function pieceMarks(piece: BoardPiece): PieceMarks {
  if (piece.zone.kind === "hand" || piece.zone.kind === "champion") {
    return { turn: false, keywords: false, stats: false };
  }
  if (piece.kind === "rune") {
    return { turn: true, keywords: false, stats: false };
  }
  if (piece.kind === "legend") {
    return { turn: true, keywords: true, stats: false };
  }
  return { turn: true, keywords: true, stats: true };
}

function ToolbarIconButton({
  label,
  variant = "ghost",
  onClick,
  children,
}: {
  label: string;
  variant?: "ghost" | "default";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button size="icon" variant={variant} aria-label={label} onClick={onClick} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Rendered by `BoardView` through `renderPieceOverlay`; the popover anchors to the token and dodges the viewport edges. */
export function BoardEditorPieceToolbar({
  piece,
  actions,
  keywordOpen,
  onKeywordOpenChange,
  onArrow,
  onDismiss,
}: {
  piece: BoardPiece;
  actions: BoardPieceActions;
  keywordOpen: boolean;
  onKeywordOpenChange: (open: boolean) => void;
  onArrow: (kind: ArrowKind) => void;
  onDismiss: () => void;
}) {
  const [anchor, setAnchor] = useState<Element | null>(null);
  const marks = pieceMarks(piece);
  return (
    <>
      <span
        ref={(node) => setAnchor(node?.closest("[data-board-piece]") ?? null)}
        className="hidden"
      />
      <Popover
        open={anchor !== null}
        modal={false}
        onOpenChange={(open, details) => {
          if (!open && details.reason === "escape-key") {
            onDismiss();
          }
        }}
      >
        <PopoverContent
          anchor={anchor ?? undefined}
          side="top"
          sideOffset={6}
          initialFocus={false}
          finalFocus={false}
          className="w-auto p-1"
        >
          <div
            role="toolbar"
            tabIndex={-1}
            aria-label={pieceName(piece)}
            className="flex items-center gap-0.5"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            {marks.turn && (
              <ToolbarIconButton
                label={m.board_states_state_exhausted()}
                variant={piece.exhausted ? "default" : "ghost"}
                onClick={() => actions.toggleExhaust()}
              >
                <RotateCwIcon />
              </ToolbarIconButton>
            )}
            {marks.keywords && (
              <Popover open={keywordOpen} onOpenChange={onKeywordOpenChange}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <PopoverTrigger
                        render={
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={m.board_states_editor_keyword()}
                          />
                        }
                      />
                    }
                  >
                    <TagIcon />
                  </TooltipTrigger>
                  <TooltipContent>{m.board_states_editor_keyword()}</TooltipContent>
                </Tooltip>
                <PopoverContent className="w-72">
                  <KeywordPanel piece={piece} actions={actions} />
                </PopoverContent>
              </Popover>
            )}
            {marks.stats && (
              <>
                <span className="bg-border mx-0.5 h-5 w-px" />
                <ToolbarIconButton
                  label={m.board_states_editor_damage_down()}
                  variant="ghost"
                  onClick={() => actions.adjustDamage(-1)}
                >
                  <MinusIcon />
                </ToolbarIconButton>
                <span className="min-w-5 text-center text-sm tabular-nums">{piece.damage}</span>
                <ToolbarIconButton
                  label={m.board_states_editor_damage_up()}
                  variant="ghost"
                  onClick={() => actions.adjustDamage(1)}
                >
                  <PlusIcon />
                </ToolbarIconButton>
                <span className="bg-border mx-0.5 h-5 w-px" />
                <MightGlyph />
                <ToolbarIconButton
                  label={m.board_states_editor_might_down()}
                  variant="ghost"
                  onClick={() => actions.adjustMight(-1)}
                >
                  <MinusIcon />
                </ToolbarIconButton>
                <span className="min-w-5 text-center text-sm tabular-nums">{piece.might}</span>
                <ToolbarIconButton
                  label={m.board_states_editor_might_up()}
                  variant="ghost"
                  onClick={() => actions.adjustMight(1)}
                >
                  <PlusIcon />
                </ToolbarIconButton>
                <span className="bg-border mx-0.5 h-5 w-px" />
              </>
            )}
            <ToolbarIconButton
              label={m.board_states_editor_arrow_move()}
              variant="ghost"
              onClick={() => onArrow("move")}
            >
              <MoveRightIcon />
            </ToolbarIconButton>
            <ToolbarIconButton
              label={m.board_states_editor_arrow_target()}
              variant="ghost"
              onClick={() => onArrow("target")}
            >
              <CrosshairIcon />
            </ToolbarIconButton>
            <ToolbarIconButton
              label={m.board_states_editor_remove_piece()}
              variant="ghost"
              onClick={() => actions.remove()}
            >
              <Trash2Icon />
            </ToolbarIconButton>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

export interface PieceMenuAnchor {
  pieceId: string;
  x: number;
  y: number;
}

export function BoardEditorPieceMenu({
  anchor,
  piece,
  actions,
  onClose,
  onArrow,
  onKeyword,
}: {
  anchor: PieceMenuAnchor;
  piece: BoardPiece;
  actions: BoardPieceActions;
  onClose: () => void;
  onArrow: (kind: ArrowKind) => void;
  onKeyword: () => void;
}) {
  const marks = pieceMarks(piece);
  const close = (run: () => void) => () => {
    run();
    onClose();
  };
  return (
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <div className="pointer-events-none fixed z-40" style={{ left: anchor.x, top: anchor.y }}>
        <DropdownMenuTrigger render={<span className="block size-0" />} />
      </div>
      <DropdownMenuContent>
        {marks.turn && (
          <DropdownMenuItem onClick={close(actions.toggleExhaust)}>
            <RotateCwIcon />
            {m.board_states_state_exhausted()}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={close(actions.toggleHighlight)}>
          <SparklesIcon />
          {m.board_states_state_highlight()}
        </DropdownMenuItem>
        {marks.keywords && (
          <DropdownMenuItem onClick={close(onKeyword)}>
            <TagIcon />
            {m.board_states_editor_keyword()}
          </DropdownMenuItem>
        )}
        {marks.stats && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={close(() => actions.adjustDamage(1))}>
              <PlusIcon />
              {m.board_states_editor_damage_up()}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={close(() => actions.adjustDamage(-1))}>
              <MinusIcon />
              {m.board_states_editor_damage_down()}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={close(() => actions.adjustMight(1))}>
              <PlusIcon />
              {m.board_states_editor_might_up()}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={close(() => actions.adjustMight(-1))}>
              <MinusIcon />
              {m.board_states_editor_might_down()}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={close(() => onArrow("move"))}>
          <MoveRightIcon />
          {m.board_states_editor_arrow_move()}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={close(() => onArrow("target"))}>
          <CrosshairIcon />
          {m.board_states_editor_arrow_target()}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={close(actions.nextOwner)}>
          <UsersIcon />
          {m.board_states_editor_change_owner()}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={close(actions.duplicate)}>
          <CopyIcon />
          {m.board_states_editor_duplicate()}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={close(actions.remove)}>
          <Trash2Icon />
          {m.board_states_editor_remove_piece()}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
