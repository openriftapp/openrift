import type { BoardChainEntry, BoardDocument } from "@openrift/shared/board-state";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import { useCards } from "@/features/cards/hooks/use-cards";
import type { RulesPins } from "@/features/rules/components/board-caption-text";
import { BoardCaptionText } from "@/features/rules/components/board-caption-text";
import { BoardView, cardImage } from "@/features/rules/components/board-view";
import { longestChain } from "@/features/rules/lib/board-layout";
import { CARD_CORNER_STYLE, PLAYER_COLOR } from "@/features/rules/lib/board-style";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function BoardStepsPlayer({
  document,
  pins,
  activeStep,
  onStep,
  extra,
}: {
  document: BoardDocument;
  pins: RulesPins;
  activeStep: number;
  onStep: (index: number) => void;
  extra?: ReactNode;
}) {
  const [highlightedPieceId, setHighlightedPieceId] = useState<string | null>(null);
  const total = document.steps.length;
  const index = Math.min(activeStep, total - 1);
  const step = document.steps[index];
  if (!step) {
    return null;
  }
  const chainRows = document.zones.chain ? longestChain(document.steps) : 0;
  return (
    <div className="grid grid-cols-1 gap-4 [grid-template-areas:'chain'_'board'_'caption'_'extra'_'stepper'] lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_auto_auto_1fr] lg:[grid-template-areas:'board_stepper'_'board_caption'_'board_chain'_'board_extra']">
      <BoardView
        document={document}
        step={step}
        viewer
        highlightedPieceId={highlightedPieceId}
        className="self-start [grid-area:board]"
      />
      {total > 1 && (
        <nav
          aria-label={m.board_states_step_of({ current: index + 1, total })}
          className="bg-background flex flex-col gap-2 [grid-area:stepper] max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:border-t max-lg:py-2"
        >
          <span className="text-sm font-medium">
            {m.board_states_step_of({ current: index + 1, total })}
          </span>
          <div className="flex items-start gap-2">
            <Button
              size="icon-lg"
              variant="outline"
              disabled={index === 0}
              aria-label={m.board_states_previous()}
              onClick={() => onStep(index - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            <div className="flex min-w-0 flex-1 gap-1.5 max-lg:overflow-x-auto lg:flex-wrap">
              {document.steps.map((_, stepIndex) => (
                <Button
                  // oxlint-disable-next-line react/no-array-index-key -- steps are positional
                  key={stepIndex}
                  size="icon-lg"
                  variant={stepIndex === index ? "default" : "outline"}
                  aria-current={stepIndex === index ? "step" : undefined}
                  aria-label={m.board_states_editor_step_number({ number: stepIndex + 1 })}
                  onClick={() => onStep(stepIndex)}
                >
                  {stepIndex + 1}
                </Button>
              ))}
            </div>
            <Button
              size="icon-lg"
              variant="outline"
              disabled={index >= total - 1}
              aria-label={m.board_states_next()}
              onClick={() => onStep(index + 1)}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </nav>
      )}
      {step.caption === "" ? null : (
        <BoardCaptionText
          text={step.caption}
          pins={pins}
          pieces={step.pieces}
          onHoverPiece={setHighlightedPieceId}
          className="[grid-area:caption]"
        />
      )}
      {chainRows > 0 && <ChainPanel chain={step.chain} rows={chainRows} />}
      {extra === undefined ? null : <div className="[grid-area:extra]">{extra}</div>}
    </div>
  );
}

const CHAIN_ROW_REM = 3.5;
const CHAIN_GAP_REM = 0.375;

function ChainPanel({ chain, rows }: { chain: readonly BoardChainEntry[]; rows: number }) {
  const hydrated = useHydrated();
  const plain = <ChainList chain={chain} rows={rows} images={[]} />;
  if (!hydrated) {
    return plain;
  }
  return (
    <Suspense fallback={plain}>
      <ChainListWithArt chain={chain} rows={rows} />
    </Suspense>
  );
}

function ChainListWithArt({ chain, rows }: { chain: readonly BoardChainEntry[]; rows: number }) {
  const catalog = useCards();
  return (
    <ChainList
      chain={chain}
      rows={rows}
      images={chain.map((entry) => cardImage(entry.card, catalog))}
    />
  );
}

function ChainList({
  chain,
  rows,
  images,
}: {
  chain: readonly BoardChainEntry[];
  rows: number;
  images: readonly (string | undefined)[];
}) {
  const top = chain.length - 1;
  return (
    <section className="flex flex-col gap-2 [grid-area:chain]">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{m.board_states_chain()}</h2>
        <span className="text-muted-foreground text-xs">{m.board_states_chain_order_top()}</span>
      </div>
      <ol
        className="flex flex-col gap-1.5"
        style={{ minHeight: `${rows * CHAIN_ROW_REM + (rows - 1) * CHAIN_GAP_REM}rem` }}
      >
        {chain.length === 0 ? (
          <li className="text-muted-foreground flex flex-1 items-center justify-center rounded-md border border-dashed text-sm">
            {m.board_states_chain_empty()}
          </li>
        ) : (
          chain
            .map((entry, position) => ({ entry, position }))
            .toReversed()
            .map(({ entry, position }) => (
              <li
                key={position}
                className={cn(
                  "flex h-14 items-center gap-2 rounded-md border px-2",
                  position === top && "border-primary",
                )}
              >
                <span
                  className="bg-card border-card-edge relative h-12 w-[2.15rem] shrink-0 overflow-hidden border"
                  style={CARD_CORNER_STYLE}
                >
                  {images[position] === undefined ? null : (
                    <img src={images[position]} alt="" className="size-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {entry.card.name}
                </span>
                <span
                  className="flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: PLAYER_COLOR[entry.owner] }}
                >
                  {entry.owner}
                </span>
              </li>
            ))
        )}
      </ol>
    </section>
  );
}
