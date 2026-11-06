import { Label } from "@/components/ui/label";
import { SimpleSelect } from "@/components/ui/simple-select";
import { Switch } from "@/components/ui/switch";

export interface AdminFilterOption<T extends string = string> {
  value: T;
  label: string;
}

/**
 * `label` is required: the trigger shows the selection alone, so without it
 * the trigger reaches a screen reader as an unnamed combobox.
 */
export function AdminFilterSelect<T extends string = string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly AdminFilterOption<T>[];
  label: string;
  className?: string;
}) {
  return (
    <SimpleSelect
      items={options}
      value={value}
      onChange={onChange}
      label={label}
      className={className}
    />
  );
}

/**
 * A boolean filter in an admin toolbar's filter row. The label is clickable, so
 * `id` has to be unique on the page.
 */
export function AdminFilterSwitch({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id}>{children}</Label>
    </div>
  );
}
