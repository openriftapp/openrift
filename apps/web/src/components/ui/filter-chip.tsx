import { MinusIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { ChipRemoveButton } from "@/components/ui/chip-remove-button";
import { cn } from "@/lib/utils";

// Hand-authored primitive (not shadcn-scaffolded).

function FilterChip({
  label,
  icon,
  excluded = false,
  onRemove,
  removeLabel,
  className,
}: {
  label: ReactNode;
  icon?: ReactNode;
  excluded?: boolean;
  onRemove: () => void;
  removeLabel: string;
  className?: string;
}) {
  return (
    <Badge
      data-excluded={excluded || undefined}
      variant={excluded ? "destructive" : "secondary"}
      className={cn(excluded && "border-destructive/40", className)}
    >
      {excluded ? <MinusIcon className="shrink-0" /> : null}
      {icon}
      <span className={cn(excluded && "line-through")}>{label}</span>
      <ChipRemoveButton aria-label={removeLabel} onClick={onRemove} />
    </Badge>
  );
}

export { FilterChip };
