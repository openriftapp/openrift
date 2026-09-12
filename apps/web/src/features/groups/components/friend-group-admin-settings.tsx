import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { useNavigate } from "@tanstack/react-router";
import { KeyIcon, TriangleAlertIcon } from "lucide-react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GroupBannerPanel } from "@/features/groups/components/group-banner-panel";
import { InviteLinkPanel } from "@/features/groups/components/invite-link-panel";
import {
  useEnableFriendGroupCode,
  useUpdateFriendGroup,
} from "@/features/groups/hooks/use-friend-group-mutations";
import { groupSlugError } from "@/features/groups/lib/group-slug";
import { useServerSeededState } from "@/hooks/use-server-seeded-state";
import { m } from "@/paraglide/messages.js";

export function AdminSettings({ data, slug }: { data: FriendGroupDetailResponse; slug: string }) {
  const navigate = useNavigate();
  const update = useUpdateFriendGroup();
  const enableCode = useEnableFriendGroupCode();

  const [name, setName] = useServerSeededState(data.group.name);
  const [description, setDescription] = useServerSeededState(data.group.description ?? "");
  const [newSlug, setNewSlug] = useServerSeededState(data.group.slug);

  const trimmedName = name.trim();
  const trimmedSlug = newSlug.trim();
  const slugChanged = newSlug !== data.group.slug;
  const nameError = trimmedName.length === 0 ? m.groups_admin_name_required() : null;
  const slugError =
    trimmedSlug.length === 0 ? m.groups_admin_slug_required() : groupSlugError(trimmedSlug);

  async function handleSave() {
    if (nameError || slugError) {
      return;
    }
    const trimmedDescription = description.trim();
    const payload = {
      slug,
      name: trimmedName === data.group.name ? undefined : trimmedName,
      description:
        trimmedDescription === (data.group.description ?? "")
          ? undefined
          : trimmedDescription || null,
      newSlug: slugChanged ? trimmedSlug : undefined,
    };
    try {
      const result = await update.mutateAsync(payload);
      if (slugChanged) {
        void navigate({ to: "/groups/$slug/manage", params: { slug: result.slug } });
      }
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  return (
    <>
      <SettingsSection
        id="group-settings"
        className="scroll-mt-28"
        title={m.groups_admin_settings_title()}
        description={m.groups_admin_settings_description()}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fg-edit-name">{m.common_name()}</Label>
          <Input
            id="fg-edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          {nameError ? <FieldError className="text-xs">{nameError}</FieldError> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fg-edit-slug">{m.groups_admin_slug_label()}</Label>
          <Input
            id="fg-edit-slug"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
            maxLength={30}
          />
          {slugError ? <FieldError className="text-xs">{slugError}</FieldError> : null}
          {slugChanged && !slugError ? (
            <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <TriangleAlertIcon className="text-warning size-3.5 shrink-0" />
              {m.groups_admin_slug_warning()}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fg-edit-desc">{m.groups_admin_description_label()}</Label>
          <Textarea
            id="fg-edit-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={3}
          />
          <span className="text-muted-foreground text-xs">{m.groups_markdown_hint()}</span>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => void handleSave()}
            disabled={update.isPending || nameError !== null || slugError !== null}
          >
            {m.groups_admin_save_changes()}
          </Button>
        </div>
      </SettingsSection>
      <SettingsSection
        id="banner"
        className="scroll-mt-28"
        title={m.groups_manage_toc_banner()}
        description={m.groups_admin_banner_description()}
      >
        <GroupBannerPanel group={data.group} />
      </SettingsSection>
      <SettingsSection
        id="invite-link"
        className="scroll-mt-28"
        title={
          <span className="flex items-center gap-2">
            <KeyIcon className="size-4" />
            {m.groups_invite_link_label()}
          </span>
        }
      >
        {data.group.code ? (
          <InviteLinkPanel slug={slug} code={data.group.code} />
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">{m.groups_admin_invites_off()}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => enableCode.mutate(slug)}
              disabled={enableCode.isPending}
            >
              {m.groups_admin_enable_invites()}
            </Button>
          </div>
        )}
      </SettingsSection>
    </>
  );
}
