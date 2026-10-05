import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function ValueWithUnpriced({
  value,
  unpriced,
  className,
}: {
  value: string;
  unpriced: number;
  className?: string;
}) {
  return (
    <span className={cn("text-muted-foreground text-xs", className)}>
      {value}
      {unpriced > 0 ? (
        <span className="text-muted-foreground/60 ml-1">
          {m.common_unpriced({ count: unpriced })}
        </span>
      ) : null}
    </span>
  );
}
