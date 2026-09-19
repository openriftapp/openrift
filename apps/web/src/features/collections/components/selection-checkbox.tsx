import { SelectionMark } from "@/components/ui/selection-mark";
import { m } from "@/paraglide/messages.js";

interface SelectionCheckboxProps {
  isSelected: boolean;
  onToggle: () => void;
}

export function SelectionCheckbox({ isSelected, onToggle }: SelectionCheckboxProps) {
  return (
    <SelectionMark
      label={m.collections_grid_select_card()}
      checked={isSelected}
      onCheckedChange={onToggle}
    />
  );
}
