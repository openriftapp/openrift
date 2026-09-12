import { CONTACT_METHOD_LABELS } from "@openrift/shared/contact-methods";
import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { Link } from "@tanstack/react-router";

import { SettingsSection } from "@/components/layout/settings-section";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { TextLink } from "@/components/ui/text-link";
import { useContactMethods } from "@/features/account/hooks/use-contact-methods";
import { useUpdateGroupContactReveal } from "@/features/groups/hooks/use-friend-group-mutations";
import { useRequiredUserId } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

export function ContactSharingPanel({
  data,
  slug,
}: {
  data: FriendGroupDetailResponse;
  slug: string;
}) {
  const viewerId = useRequiredUserId();
  const { contactMethods } = useContactMethods();
  const reveal = useUpdateGroupContactReveal();

  const self = data.members.find((member) => member.userId === viewerId);
  const revealedIds = new Set((self?.contactMethods ?? []).map((method) => method.id));

  function toggle(methodId: string, next: boolean) {
    const ids = new Set(revealedIds);
    if (next) {
      ids.add(methodId);
    } else {
      ids.delete(methodId);
    }
    reveal.mutate({ slug, userId: viewerId, contactMethodIds: [...ids] });
  }

  return (
    <SettingsSection
      id="contacts"
      className="scroll-mt-28"
      title={m.groups_contacts_title()}
      description={
        <>
          {m.groups_contacts_description()}{" "}
          <TextLink variant="muted" render={<Link to="/profile" hash="contacts" />}>
            {m.groups_contacts_edit_link()}
          </TextLink>
          .
        </>
      }
    >
      {contactMethods.length === 0 ? (
        <p className="text-muted-foreground text-sm">{m.groups_contacts_empty()}</p>
      ) : (
        contactMethods.map((method) => (
          <Label
            key={method.id}
            className="flex items-center gap-3 font-normal"
            htmlFor={`reveal-${method.id}`}
          >
            <Checkbox
              id={`reveal-${method.id}`}
              checked={revealedIds.has(method.id)}
              onCheckedChange={(checked) => toggle(method.id, checked === true)}
              disabled={reveal.isPending}
            />
            <span className="text-muted-foreground text-sm">
              {CONTACT_METHOD_LABELS[method.type]}
            </span>
            <span className="truncate">{method.value}</span>
          </Label>
        ))
      )}
    </SettingsSection>
  );
}
