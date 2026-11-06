import { SimpleSelect } from "@/components/ui/simple-select";
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
    <SimpleSelect
      items={hostItems}
      value={value}
      disabled={disabled}
      onChange={(next) => {
        if (next !== value) {
          onChange(next);
        }
      }}
      label={m.tournaments_settings_host_title()}
      placeholder={m.tournaments_settings_host_title()}
      className={className ?? "w-full"}
    />
  );
}
