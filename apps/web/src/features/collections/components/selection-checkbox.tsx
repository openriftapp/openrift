import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface SelectionCheckboxProps {
  isSelected: boolean;
  onToggle: () => void;
}

export function SelectionCheckbox({ isSelected, onToggle }: SelectionCheckboxProps) {
  return (
    <Checkbox
      aria-label={m.collections_grid_select_card()}
      checked={isSelected}
      onCheckedChange={onToggle}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "absolute top-1.5 right-1.5 z-20 size-5",
        !isSelected && "border-white/70 bg-black/30 hover:border-white",
      )}
    />
  );
}
