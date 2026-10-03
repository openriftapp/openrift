import { Button } from "@/components/ui/button";
import { m } from "@/paraglide/messages.js";

export function MetaDecklistsToggle({
  pressed,
  count,
  onPressedChange,
}: {
  pressed: boolean;
  count: number;
  onPressedChange: (pressed: boolean) => void;
}) {
  return (
    <Button
      type="button"
      variant="control"
      size="sm"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
    >
      {m.meta_events_holdings_decks()}
      <span className="text-muted-foreground text-2xs tabular-nums">{count}</span>
    </Button>
  );
}
