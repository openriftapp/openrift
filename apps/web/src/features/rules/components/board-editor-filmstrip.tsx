import type { BoardDocument } from "@openrift/shared/board-state";
import { MAX_BOARD_STEPS } from "@openrift/shared/board-state";
import { ChevronLeftIcon, ChevronRightIcon, CopyPlusIcon, Trash2Icon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { BoardView } from "@/features/rules/components/board-view";
import { useBoardEditorStore } from "@/features/rules/stores/board-editor-store";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const THUMB_WIDTH_REM = 144;

/** Scales the full-size board so it sits inside the thumbnail box, centred, like a contained image. */
function useContainScale(
  box: React.RefObject<HTMLElement | null>,
  board: React.RefObject<HTMLElement | null>,
) {
  const [fit, setFit] = useState({ scale: 0, x: 0, y: 0 });
  useLayoutEffect(() => {
    const outer = box.current;
    const inner = board.current;
    if (!outer || !inner) {
      return;
    }
    const update = () => {
      const scale = Math.min(
        outer.clientWidth / inner.offsetWidth,
        outer.clientHeight / inner.offsetHeight,
      );
      setFit({
        scale,
        x: (outer.clientWidth - inner.offsetWidth * scale) / 2,
        y: (outer.clientHeight - inner.offsetHeight * scale) / 2,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(outer);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [box, board]);
  return fit;
}

function firstLine(caption: string): string {
  return caption.split("\n")[0]?.trim() ?? "";
}

function StepThumb({
  document,
  index,
  active,
  onSelect,
}: {
  document: BoardDocument;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  const step = document.steps[index];
  const boxRef = useRef<HTMLSpanElement>(null);
  const boardRef = useRef<HTMLSpanElement>(null);
  const fit = useContainScale(boxRef, boardRef);
  if (!step) {
    return null;
  }
  return (
    <Pressable
      className={cn(
        "border-border flex w-33 shrink-0 flex-col gap-1 rounded-md border p-1 text-left",
        active && "ring-ring ring-2",
      )}
      aria-label={m.board_states_editor_step_number({ number: index + 1 })}
      aria-current={active ? "step" : undefined}
      onClick={onSelect}
    >
      <span ref={boxRef} className="bg-muted relative block h-21 w-full overflow-hidden rounded-sm">
        <span
          ref={boardRef}
          className="pointer-events-none absolute top-0 left-0 block origin-top-left"
          style={{
            width: `${THUMB_WIDTH_REM}rem`,
            transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`,
            visibility: fit.scale === 0 ? "hidden" : undefined,
          }}
          aria-hidden
        >
          <BoardView document={document} step={step} pieceNumerals={false} />
        </span>
        <span className="bg-foreground text-background text-2xs absolute top-0.5 left-0.5 rounded-sm px-1 font-semibold">
          {index + 1}
        </span>
      </span>
      <span className="text-muted-foreground text-2xs line-clamp-2">{firstLine(step.caption)}</span>
    </Pressable>
  );
}

export function BoardEditorFilmstrip() {
  const document = useBoardEditorStore((state) => state.document);
  const activeStep = useBoardEditorStore((state) => state.activeStep);
  const selectStep = useBoardEditorStore((state) => state.selectStep);
  const addStep = useBoardEditorStore((state) => state.addStep);
  const removeStep = useBoardEditorStore((state) => state.removeStep);
  const moveStep = useBoardEditorStore((state) => state.moveStep);
  const count = document.steps.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={count >= MAX_BOARD_STEPS} onClick={addStep}>
          <CopyPlusIcon />
          {m.board_states_editor_copy_step()}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={activeStep === 0}
          aria-label={m.board_states_editor_move_step_left()}
          onClick={() => moveStep(activeStep, activeStep - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          disabled={activeStep >= count - 1}
          aria-label={m.board_states_editor_move_step_right()}
          onClick={() => moveStep(activeStep, activeStep + 1)}
        >
          <ChevronRightIcon />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={count <= 1}
          onClick={() => removeStep(activeStep)}
        >
          <Trash2Icon />
          {m.board_states_editor_remove_step()}
        </Button>
      </div>
      <div className="-m-1 flex gap-2 overflow-x-auto p-1">
        {Array.from({ length: count }, (_, index) => (
          <StepThumb
            // oxlint-disable-next-line react/no-array-index-key -- steps are positional
            key={index}
            document={document}
            index={index}
            active={index === activeStep}
            onSelect={() => selectStep(index)}
          />
        ))}
      </div>
    </div>
  );
}
