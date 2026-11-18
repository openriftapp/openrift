import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";

import { SettingsSection } from "@/components/layout/settings-section";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useUpdateGroupTradeAutoAccept } from "@/features/groups/hooks/use-friend-group-mutations";
import { useRequiredUserId } from "@/hooks/use-session";
import { m } from "@/paraglide/messages.js";

export function TradeAutoAcceptPanel({
  data,
  slug,
}: {
  data: FriendGroupDetailResponse;
  slug: string;
}) {
  const viewerId = useRequiredUserId();
  const update = useUpdateGroupTradeAutoAccept();
  const self = data.members.find((member) => member.userId === viewerId);
  if (self === undefined) {
    return null;
  }
  const settings = {
    autoAcceptOffers: self.autoAcceptOffers,
    autoAcceptRequests: self.autoAcceptRequests,
  };
  const rows = [
    {
      key: "autoAcceptOffers",
      label: m.groups_auto_accept_offers_label(),
      hint: m.groups_auto_accept_offers_hint(),
    },
    {
      key: "autoAcceptRequests",
      label: m.groups_auto_accept_requests_label(),
      hint: m.groups_auto_accept_requests_hint(),
    },
  ] as const;

  return (
    <SettingsSection
      id="auto-accept"
      className="scroll-mt-28"
      title={m.groups_auto_accept_title()}
      description={m.groups_auto_accept_description()}
    >
      {rows.map((row) => (
        <Label
          key={row.key}
          className="flex items-start gap-3 font-normal"
          htmlFor={`auto-accept-${row.key}`}
        >
          <Checkbox
            id={`auto-accept-${row.key}`}
            className="mt-0.5"
            checked={settings[row.key]}
            onCheckedChange={(checked) =>
              update.mutate({ slug, userId: viewerId, ...settings, [row.key]: checked === true })
            }
            disabled={update.isPending}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span>{row.label}</span>
            <span className="text-muted-foreground text-sm">{row.hint}</span>
          </span>
        </Label>
      ))}
    </SettingsSection>
  );
}
