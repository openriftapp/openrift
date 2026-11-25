import { Undo2Icon } from "lucide-react";

import { PageTopBarButton } from "@/components/layout/page-top-bar";
import { Kbd } from "@/features/catalog-workspace/components/record/kbd";
import { useWorkspaceUndo } from "@/features/catalog-workspace/hooks/use-workspace-undo";
import { useWorkspaceUndoStore } from "@/features/catalog-workspace/stores/workspace-undo-store";

export function WorkspaceUndoButton() {
  const latest = useWorkspaceUndoStore((state) => state.undoStack.at(-1));
  const undoing = useWorkspaceUndoStore((state) => state.undoing);
  const { undoLatest } = useWorkspaceUndo();

  if (latest === undefined) {
    return null;
  }
  const text = `Undo: ${latest.label}`;
  return (
    <PageTopBarButton
      // oxlint-disable-next-line shadcn/no-restyle -- bordered to stand apart in the top bar
      className="border-border max-w-[40vw] border md:max-w-md"
      title={text}
      disabled={undoing}
      onClick={() => undoLatest()}
    >
      <Undo2Icon />
      <span className="min-w-0 truncate">{text}</span>
      <Kbd>Z</Kbd>
    </PageTopBarButton>
  );
}
