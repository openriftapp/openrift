import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMyOrganizations } from "@/features/tournaments/hooks/use-organizations";
import { m } from "@/paraglide/messages.js";

/** `value` is `"user"` for a personal tournament, else the organization id. */
export function HostField({
  value,
  disabled = false,
  className,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
}) {
  const { data } = useMyOrganizations();
  const hostItems = [
    { value: "user", label: m.tournaments_settings_host_personal() },
    ...data.items.map((org) => ({ value: org.id, label: org.name })),
  ];

  return (
    <Select
      items={hostItems}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next && next !== value) {
          onChange(next);
        }
      }}
    >
      <SelectTrigger
        className={className ?? "w-full"}
        aria-label={m.tournaments_settings_host_title()}
      >
        <SelectValue placeholder={m.tournaments_settings_host_title()} />
      </SelectTrigger>
      <SelectContent>
        {hostItems.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
