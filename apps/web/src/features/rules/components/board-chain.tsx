import { useDroppable } from "@dnd-kit/core";
import type { BoardChainEntry, BoardPiece, ChainEntryType } from "@openrift/shared/board-state";
import { HandIcon, SparklesIcon, ZapIcon } from "lucide-react";
import type { ReactNode } from "react";

import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { Pressable } from "@/components/ui/pressable";
import type { ChainDropData } from "@/features/rules/components/board-card-parts";
import { ArrowHandle } from "@/features/rules/components/board-card-parts";
import { CHAIN_TYPE_LABEL, chainEntryLabel } from "@/features/rules/lib/board-labels";
import { CARD_CORNER_STYLE, CARD_UPRIGHT, PLAYER_COLOR } from "@/features/rules/lib/board-style";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const CHAIN_TYPE_ICON: Record<ChainEntryType, typeof ZapIcon> = {
  spell: SparklesIcon,
  triggered: ZapIcon,
  activated: HandIcon,
};

export interface ChainInteraction {
  selectedChainId?: string | null;
  highlightedChainId?: string | null;
  /** Requires a surrounding `DndContext`. */
  draggable?: boolean;
  arrowHandle?: boolean;
  onChainEntryClick?: (entry: BoardChainEntry) => void;
  onChainEntryRemove?: (id: string) => void;
  renderChainAdd?: () => ReactNode;
  renderChainEntryOverlay?: (entry: BoardChainEntry) => ReactNode;
}

interface ChainView {
  chain: readonly BoardChainEntry[];
  pieces: readonly BoardPiece[];
  images: ReadonlyMap<string, string>;
  interaction: ChainInteraction;
  onHoverSource: (pieceId: string | null) => void;
}

export function ChainRow(view: ChainView) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-black/25 p-1.5 ring-1 ring-white/10">
      <span className="text-2xs text-white/50 uppercase">
        {m.board_states_chain()} · {m.board_states_chain_order()}
      </span>
      <div className="flex flex-wrap items-end gap-1.5">
        {view.chain.map((entry, index) => (
          <ChainEntryTile key={entry.id} entry={entry} position={index + 1} view={view} />
        ))}
        {view.interaction.renderChainAdd?.()}
      </div>
    </div>
  );
}

interface ChainEntryProps {
  entry: BoardChainEntry;
  position: number;
  view: ChainView;
}

function ChainEntryTile(props: ChainEntryProps) {
  return props.view.interaction.draggable ? (
    <DroppableChainEntry {...props} />
  ) : (
    <ChainEntryFace {...props} />
  );
}

function DroppableChainEntry(props: ChainEntryProps) {
  const data: ChainDropData = { type: "board-chain-target", entryId: props.entry.id };
  const { setNodeRef, isOver } = useDroppable({ id: `chain-target:${props.entry.id}`, data });
  return (
    <div ref={setNodeRef} className={cn(isOver && "ring-ring ring-2")} style={CARD_CORNER_STYLE}>
      <ChainEntryFace {...props} />
    </div>
  );
}

/** Abilities get a dashed frame in the owner's colour so they never read as cards. */
function ChainEntryFace({ entry, position, view }: ChainEntryProps) {
  const { interaction } = view;
  const image = view.images.get(entry.id);
  const label = chainEntryLabel(entry, view.pieces);
  const ability = entry.type !== "spell";
  const selected = interaction.selectedChainId === entry.id;
  const spotlit = interaction.highlightedChainId === entry.id;
  const TypeIcon = CHAIN_TYPE_ICON[entry.type];
  const overlay = interaction.renderChainEntryOverlay?.(entry);
  const tile = (
    <span
      data-board-chain={entry.id}
      className={cn(
        "bg-card relative block overflow-hidden transition-transform",
        CARD_UPRIGHT,
        ability ? "border-2 border-dashed" : "border-card-edge border",
        spotlit && "ring-gilt scale-105 ring-2",
        selected && !spotlit && "ring-ring ring-2",
      )}
      style={{
        ...CARD_CORNER_STYLE,
        borderColor: ability ? PLAYER_COLOR[entry.owner] : undefined,
      }}
      title={`${label} · ${CHAIN_TYPE_LABEL[entry.type]()}`}
      onMouseEnter={() => view.onHoverSource(entry.source ?? null)}
      onMouseLeave={() => view.onHoverSource(null)}
    >
      {image === undefined ? (
        <span className="font-card text-card-foreground flex size-full items-center justify-center p-1 text-center text-xs leading-tight">
          {label}
        </span>
      ) : (
        <>
          <img
            src={image}
            alt=""
            className={cn("size-full object-cover", ability && "opacity-60")}
          />
          {(ability || entry.label !== undefined) && (
            <span className="text-2xs absolute inset-x-0 bottom-3 bg-black/75 px-1 py-0.5 text-center leading-tight text-white">
              {label}
            </span>
          )}
        </>
      )}
      <span
        className="absolute top-0.5 right-0.5 rounded-full bg-black/70 p-0.5 text-white"
        aria-label={CHAIN_TYPE_LABEL[entry.type]()}
      >
        <TypeIcon className="size-3" aria-hidden />
      </span>
      <span className="bg-gilt text-2xs absolute bottom-0.5 left-0.5 flex size-3.5 items-center justify-center rounded-full font-semibold text-black">
        {position}
      </span>
      <span
        className="text-2xs absolute right-0.5 bottom-0 font-semibold"
        style={{ color: PLAYER_COLOR[entry.owner], textShadow: "0 1px 2px rgb(0 0 0 / 0.85)" }}
      >
        {entry.owner}
      </span>
    </span>
  );
  const { onChainEntryClick, onChainEntryRemove } = interaction;
  const handle = interaction.arrowHandle === true && selected;
  if (!onChainEntryClick && !onChainEntryRemove && !handle && overlay === undefined) {
    return tile;
  }
  return (
    <span className="relative block">
      {onChainEntryClick ? (
        <Pressable
          className="block"
          style={CARD_CORNER_STYLE}
          aria-label={label}
          onClick={() => onChainEntryClick(entry)}
        >
          {tile}
        </Pressable>
      ) : (
        tile
      )}
      {onChainEntryRemove && (
        <span className="absolute top-0.5 left-0.5 rounded-full bg-black/70 text-white">
          <ChipRemoveButton
            aria-label={m.board_states_editor_remove_chain()}
            className="ml-0 flex size-4 items-center justify-center"
            onClick={() => onChainEntryRemove(entry.id)}
          />
        </span>
      )}
      {handle && <ArrowHandle from={{ chain: entry.id }} />}
      {overlay}
    </span>
  );
}
