import { Input } from "@/components/ui/input";
import { m } from "@/paraglide/messages.js";

export function NameField({
  id,
  value,
  disabled = false,
  className,
  onChange,
}: {
  id: string;
  value: string;
  disabled?: boolean;
  className?: string;
  onChange: (name: string) => void;
}) {
  return (
    <Input
      id={id}
      value={value}
      maxLength={120}
      disabled={disabled}
      aria-label={m.tournaments_settings_name_aria()}
      placeholder="Summoner Skirmish"
      className={className}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
