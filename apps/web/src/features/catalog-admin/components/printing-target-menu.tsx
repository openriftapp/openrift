import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ComparePrintingTarget } from "@/features/catalog-admin/lib/compare-actions";

export function PrintingTargetMenu({
  label,
  targets,
  size = "xs",
  className,
  onPick,
}: {
  label: string;
  targets: readonly ComparePrintingTarget[];
  size?: "xs" | "sm";
  className?: string;
  onPick: (printingId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size={size}
            className={className}
            disabled={targets.length === 0}
          >
            {label}
            <ChevronDownIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        {targets.map((target) => (
          <DropdownMenuItem key={target.id} onClick={() => onPick(target.id)}>
            {target.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
