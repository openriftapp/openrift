import { ArrowLeftRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatListInput, parseListInput } from "@/features/catalog-admin/lib/card-field-form";

export function ListField({
  id,
  label,
  values,
  onChange,
}: {
  id: string;
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          id={id}
          value={formatListInput(values)}
          onChange={(event) => onChange(parseListInput(event.target.value))}
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Reverse ${label.toLowerCase()} order`}
          disabled={values.length < 2}
          onClick={() => onChange(values.toReversed())}
        >
          <ArrowLeftRightIcon />
        </Button>
      </div>
    </div>
  );
}

export function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="w-28 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
