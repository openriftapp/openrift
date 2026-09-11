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
import { useMyOrganizations } from "@/features/tournaments/hooks/use-organizations";
import { useUpdateTournament } from "@/features/tournaments/hooks/use-tournament-mutations";

export function HostSection({
  detail,
  locked,
}: {
  detail: TournamentDetailResponse;
  locked: boolean;
}) {
  const { data } = useMyOrganizations();
  const updateTournament = useUpdateTournament();
  const currentValue = detail.host.type === "user" ? "user" : (detail.host.orgId ?? "user");
  const hostItems = [
    { value: "user", label: "You (personal)" },
    ...data.items.map((org) => ({ value: org.id, label: org.name })),
  ];

  async function changeHost(value: string) {
    const host =
      value === "user"
        ? ({ type: "user" } as const)
        : ({ type: "organization", orgId: value } as const);
    try {
      await updateTournament.mutateAsync({ id: detail.id, host });
      toast.success("Host updated");
    } catch {
      // Reported by the global mutation error toast (see reportMutationError).
    }
  }

  return (
    <SettingsSection
      id="host"
      title="Host"
      description="An organization brings in its owners, managers, and judges. You can invite extra staff either way."
    >
      <Select
        items={hostItems}
        value={currentValue}
        disabled={locked || updateTournament.isPending}
        onValueChange={(value) => {
          if (value && value !== currentValue) {
            void changeHost(value);
          }
        }}
      >
        <SelectTrigger className="max-w-sm" aria-label="Host">
          <SelectValue placeholder="Host" />
        </SelectTrigger>
        <SelectContent>
          {hostItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingsSection>
  );
}
