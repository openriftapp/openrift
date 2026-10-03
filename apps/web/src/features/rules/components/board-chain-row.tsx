import type { BoardChainEntry } from "@openrift/shared/board-state";
import type { ReactNode } from "react";

import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { CARD_CORNER_STYLE, CARD_UPRIGHT, PLAYER_COLOR } from "@/features/rules/lib/board-style";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function BoardChainRow({
  chain,
  images,
  onRemove,
  renderAdd,
}: {
  chain: readonly BoardChainEntry[];
  images: Map<number, string>;
  onRemove?: (index: number) => void;
  renderAdd?: () => ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-lg bg-black/25 p-1.5 ring-1 ring-white/10">
      <span className="text-2xs text-white/50 uppercase">
        {m.board_states_chain()} · {m.board_states_chain_order()}
      </span>
      <div className="flex flex-wrap items-end gap-1.5">
        {chain.map((entry, index) => (
          <span
            // oxlint-disable-next-line react/no-array-index-key -- chain entries are positional
            key={index}
            className={cn("bg-card border-card-edge relative overflow-hidden border", CARD_UPRIGHT)}
            style={CARD_CORNER_STYLE}
            title={entry.card.name}
          >
            {images.has(index) ? (
              <img src={images.get(index)} alt="" className="size-full object-cover" />
            ) : (
              <span className="font-card text-card-foreground flex size-full items-center justify-center p-1 text-center text-xs leading-tight">
                {entry.card.name}
              </span>
            )}
            <span
              className="text-2xs absolute right-0.5 bottom-0 font-semibold"
              style={{
                color: PLAYER_COLOR[entry.owner],
                textShadow: "0 1px 2px rgb(0 0 0 / 0.85)",
              }}
            >
              {entry.owner}
            </span>
            {onRemove && (
              <span className="absolute top-0.5 left-0.5 rounded-full bg-black/70 text-white">
                <ChipRemoveButton
                  aria-label={m.board_states_editor_remove_chain()}
                  className="ml-0 flex size-4 items-center justify-center"
                  onClick={() => onRemove(index)}
                />
              </span>
            )}
          </span>
        ))}
        {renderAdd?.()}
      </div>
    </div>
  );
}
