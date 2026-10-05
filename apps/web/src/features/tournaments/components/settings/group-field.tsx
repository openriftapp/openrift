import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFriendGroups } from "@/features/groups/hooks/use-friend-groups";
import { m } from "@/paraglide/messages.js";

/** `value` is `"none"` or a group id; a linked group the viewer is not in shows as `linkedGroupName`. */
export function GroupField({
  value,
  linkedGroupName,
  disabled = false,
  className,
  onChange,
}: {
  value: string;
  linkedGroupName?: string | null;
  disabled?: boolean;
  className?: string;
  onChange: (value: string) => void;
}) {
  const { data } = useFriendGroups();
  const groupItems = [
    { value: "none", label: m.tournaments_settings_group_none() },
    ...data.items.map((group) => ({ value: group.id, label: group.name })),
  ];
  if (value !== "none" && !data.items.some((group) => group.id === value)) {
    groupItems.push({ value, label: linkedGroupName ?? m.tournaments_settings_group_linked() });
  }

  return (
    <Select
      items={groupItems}
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
        aria-label={m.tournaments_settings_group_title()}
      >
        <SelectValue placeholder={m.tournaments_settings_group_none()} />
      </SelectTrigger>
      <SelectContent>
        {groupItems.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
