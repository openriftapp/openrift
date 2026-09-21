import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { RulesPins } from "@/features/rules/components/board-caption-text";
import { BoardCaptionText } from "@/features/rules/components/board-caption-text";
import { BoardView } from "@/features/rules/components/board-view";
import { useBoardEditorShortcuts } from "@/features/rules/hooks/use-board-editor-shortcuts";
import { useBoardEditorStore } from "@/features/rules/stores/board-editor-store";
import { m } from "@/paraglide/messages.js";

export function BoardEditorPreview({ answer, pins }: { answer: string; pins: RulesPins }) {
  const document = useBoardEditorStore((state) => state.document);
  const activeStep = useBoardEditorStore((state) => state.activeStep);
  const selectStep = useBoardEditorStore((state) => state.selectStep);
  const [highlightedPieceId, setHighlightedPieceId] = useState<string | null>(null);
  const total = document.steps.length;
  useBoardEditorShortcuts({
    hasSelection: false,
    onEscape: () => setHighlightedPieceId(null),
    onUndo: () => setHighlightedPieceId(null),
    onStep: (delta) => selectStep(activeStep + delta),
  });
  const step = document.steps[activeStep];
  if (!step) {
    return null;
  }
  return (
    <div className="flex flex-col gap-3">
      <BoardView document={document} step={step} highlightedPieceId={highlightedPieceId} />
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          disabled={activeStep === 0}
          aria-label={m.board_states_previous()}
          onClick={() => selectStep(activeStep - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="text-muted-foreground text-sm">
          {m.board_states_step_of({ current: activeStep + 1, total })}
        </span>
        <Button
          size="icon"
          variant="outline"
          disabled={activeStep >= total - 1}
          aria-label={m.board_states_next()}
          onClick={() => selectStep(activeStep + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
      {step.caption === "" ? null : (
        <BoardCaptionText
          text={step.caption}
          pins={pins}
          pieces={step.pieces}
          onHoverPiece={setHighlightedPieceId}
        />
      )}
      {answer.trim() === "" ? null : (
        <section className="flex flex-col gap-1">
          <h2 className="text-muted-foreground text-xs uppercase">{m.board_states_answer()}</h2>
          <BoardCaptionText text={answer} pins={pins} pieces={step.pieces} />
        </section>
      )}
    </div>
  );
}
