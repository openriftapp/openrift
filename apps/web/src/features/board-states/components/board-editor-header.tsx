import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { m } from "@/paraglide/messages.js";

export function BoardEditorHeader({
  title,
  onTitle,
}: {
  title: string;
  onTitle: (title: string) => void;
}) {
  return (
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
    </div>
  );
}
