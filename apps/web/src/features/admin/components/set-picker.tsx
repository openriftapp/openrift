import { ComboboxPicker } from "@/components/combobox-picker";
import type { ComboboxPickerOption } from "@/components/combobox-picker";
import { useSets } from "@/features/cards/hooks/use-sets";

const NO_SET = "__no_set__";

export function SetPicker({
  value,
  onChange,
  noneLabel,
  placeholder = "Pick a set",
  label = "Set",
  size,
  className,
  id,
}: {
  value: string;
  onChange: (setId: string) => void;
  noneLabel?: string;
  placeholder?: string;
  label?: string;
  size?: "sm" | "default";
  className?: string;
  id?: string;
}) {
  const { data } = useSets();
  const options: ComboboxPickerOption[] = [
    ...(noneLabel === undefined ? [] : [{ value: NO_SET, label: noneLabel }]),
    ...data.sets.map((set) => ({
      value: set.id,
      label: set.name,
      prefix: set.slug,
      keywords: set.slug,
    })),
  ];
  const selected = value === "" ? (noneLabel === undefined ? null : NO_SET) : value;

  return (
    <ComboboxPicker
      options={options}
      value={selected}
      onChange={(next) => {
        if (next === null || next === NO_SET) {
          if (noneLabel !== undefined) {
            onChange("");
          }
          return;
        }
        onChange(next);
      }}
      placeholder={placeholder}
      searchPlaceholder="Search sets"
      emptyText="No matching sets"
      size={size}
      className={className}
      id={id}
      aria-label={label}
    />
  );
}
