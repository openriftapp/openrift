import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { m } from "@/paraglide/messages.js";

export function BoardEditorTitleDialog({
  title,
  open,
  onOpenChange,
  onTitle,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTitle: (title: string) => void;
}) {
  const [draft, setDraft] = useState(title);
  const trimmed = draft.trim();
  const apply = () => {
    onTitle(trimmed);
    onOpenChange(false);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setDraft(title);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{m.board_states_editor_rename()}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed !== "") {
              apply();
            }
          }}
        >
          <Field>
            <FieldLabel htmlFor="board-title">{m.board_states_editor_question()}</FieldLabel>
            <Input
              id="board-title"
              value={draft}
              maxLength={200}
              onChange={(event) => setDraft(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {m.common_cancel()}
            </Button>
            <Button type="submit" disabled={trimmed === ""}>
              {m.board_states_editor_rename()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
