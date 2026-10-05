import type { RulesPins } from "@/features/board-states/components/board-caption-text";
import { BoardStepsPlayer } from "@/features/board-states/components/board-steps-player";
import { useBoardEditorShortcuts } from "@/features/board-states/hooks/use-board-editor-shortcuts";
import { useBoardEditorStore } from "@/features/board-states/stores/board-editor-store";

export function BoardEditorPreview({ pins }: { pins: RulesPins }) {
  const document = useBoardEditorStore((state) => state.document);
  const activeStep = useBoardEditorStore((state) => state.activeStep);
  const selectStep = useBoardEditorStore((state) => state.selectStep);
  useBoardEditorShortcuts({
    hasSelection: false,
    onStep: (delta) => selectStep(activeStep + delta),
  });
  return (
    <BoardStepsPlayer document={document} pins={pins} activeStep={activeStep} onStep={selectStep} />
  );
}
