import type { BoardPiece } from "@openrift/shared/board-state";
import { useState } from "react";

import { ExpandToggle } from "@/components/ui/expand-toggle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BoardCaptionEditor } from "@/features/rules/components/board-caption-editor";
import { m } from "@/paraglide/messages.js";

export function BoardEditorHeader({
  title,
  answer,
  pieces,
  onTitle,
  onAnswer,
}: {
  title: string;
  answer: string;
  pieces: readonly BoardPiece[];
  onTitle: (title: string) => void;
  onAnswer: (answer: string) => void;
}) {
  const [answerOpen, setAnswerOpen] = useState(answer !== "");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="board-title" className="text-muted-foreground text-xs uppercase">
          {m.board_states_editor_question()}
        </Label>
        <Input
          id="board-title"
          className="flex-1"
          value={title}
          maxLength={200}
          onChange={(event) => onTitle(event.target.value)}
        />
        <ExpandToggle
          expanded={answerOpen}
          chevronPosition="end"
          className="text-muted-foreground flex items-center gap-1 text-xs uppercase"
          onClick={() => setAnswerOpen(!answerOpen)}
        >
          {m.board_states_editor_answer()}
        </ExpandToggle>
      </div>
      {answerOpen ? (
        <BoardCaptionEditor
          id="board-answer"
          value={answer}
          onChange={onAnswer}
          pieces={pieces}
          maxLength={2000}
          placeholder={m.board_states_editor_answer()}
        />
      ) : null}
    </div>
  );
}
