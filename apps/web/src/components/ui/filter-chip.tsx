import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { cn } from "@/lib/utils";

// Hand-authored primitive (not shadcn-scaffolded).

function FilterChip({
  label,
  icon,
  excluded = false,
  tone,
  wrap = false,
  onRemove,
  removeLabel,
  className,
}: {
  label: ReactNode;
  icon?: ReactNode;
  excluded?: boolean;
  tone?: "warning" | "error";
  wrap?: boolean;
  onRemove: () => void;
  removeLabel: string;
  className?: string;
}) {
  const variant =
    excluded || tone === "error" ? "destructive" : tone === "warning" ? "warning" : "secondary";
  return (
    <Badge
      data-excluded={excluded || undefined}
      variant={variant}
      className={cn(
        excluded && "border-destructive/40",
        wrap && "h-auto min-h-5 max-w-full rounded-lg text-left whitespace-normal",
        className,
      )}
    >
      {icon}
      <span className={cn(excluded && "line-through", wrap && "min-w-0 break-words")}>{label}</span>
      <ChipRemoveButton aria-label={removeLabel} onClick={onRemove} className="shrink-0" />
    </Badge>
  );
}

export { FilterChip };
