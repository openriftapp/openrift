import { MinusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function FlagBadge({
  label,
  state,
  count,
  onClick,
  triggerStyle = "chip",
}: {
  label: string;
  state: boolean | null;
  count?: number;
  onClick: () => void;
  /** "chip" = panel badge; "button" = outline button matching the compact bar. */
  triggerStyle?: "chip" | "button";
}) {
  const isActive = state !== null;
  const isExcluded = state === false;
  const isZero = count !== undefined && count === 0;
  const content = (
    <>
      {isExcluded && <MinusIcon className="size-3 shrink-0" />}
      <span className={cn(isExcluded && "line-through")}>{label}</span>
      {count !== undefined && <span className="tabular-nums opacity-60">{count}</span>}
      {isExcluded && <span className="sr-only"> {m.cards_filter_excluded_state()}</span>}
    </>
  );
  if (triggerStyle === "button") {
    return (
      <Button
        variant={isExcluded ? "outline-destructive" : "control"}
        size="sm"
        data-active={state === true || undefined}
        className={cn("gap-1", isZero && !isActive && "opacity-40")}
        onClick={onClick}
      >
        {content}
      </Button>
    );
  }
  return (
    <Badge
      variant={state === true ? "default" : "outline"}
      className={cn(
        "gap-1",
        isExcluded && "border-destructive/40 text-destructive",
        isZero && !isActive && "opacity-40",
      )}
      render={<Pressable aria-pressed={state === true} onClick={onClick} />}
    >
      {content}
    </Badge>
  );
}
