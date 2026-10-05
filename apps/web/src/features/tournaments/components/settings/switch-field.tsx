import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function SwitchField({
  id,
  label,
  hint,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const row = (
    <div className="flex items-center gap-3">
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
  if (hint === undefined) {
    return row;
  }
  return (
    <div className="flex flex-col gap-1.5">
      {row}
      <span className="text-muted-foreground text-sm">{hint}</span>
    </div>
  );
}
