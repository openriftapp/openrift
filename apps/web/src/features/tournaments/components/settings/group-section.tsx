import type { TournamentDetailResponse } from "@openrift/shared/types/api/tournament";
import { toast } from "sonner";

import { SettingsSection } from "@/components/layout/settings-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFriendGroups } from "@/features/groups/hooks/use-friend-groups";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";
import { m } from "@/paraglide/messages.js";

export function GroupSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const { data } = useFriendGroups();
  const updateTournament = useUpdateTournament();
  const currentValue = detail.groupId ?? "none";
  const groupItems = [
    { value: "none", label: m.tournaments_settings_group_none() },
    ...data.items.map((group) => ({ value: group.id, label: group.name })),
  ];
  if (detail.groupId && !data.items.some((group) => group.id === detail.groupId)) {
    groupItems.push({
      value: detail.groupId,
      label: detail.groupName ?? m.tournaments_settings_group_linked(),
    });
  }

  async function changeGroup(value: string) {
    const groupId = value === "none" ? null : value;
    const successMessage =
      value === "none"
        ? m.tournaments_settings_group_unlinked_toast()
        : m.tournaments_settings_group_updated_toast();
    try {
      await updateTournament.mutateAsync({ id: detail.id, groupId });
      toast.success(successMessage);
    } catch {
      // Errors surface via the global mutation error toast.
    }
  }

  return (
    <SettingsSection
      id="group"
      title={m.tournaments_settings_group_title()}
      description={m.tournaments_settings_group_description()}
    >
      <Select
        items={groupItems}
        value={currentValue}
        disabled={locked || updateTournament.isPending}
        onValueChange={(value) => {
          if (value && value !== currentValue) {
            void changeGroup(value);
          }
        }}
      >
        <SelectTrigger className="max-w-sm" aria-label={m.tournaments_settings_group_title()}>
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
    </SettingsSection>
  );
}
