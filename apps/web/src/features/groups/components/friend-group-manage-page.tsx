import { Link } from "@tanstack/react-router";

import { Heading } from "@/components/heading";
import type { PageTocItem } from "@/components/layout/page-toc";
import { SettingsGroup } from "@/components/layout/settings-group";
import { SettingsLayout } from "@/components/layout/settings-layout";
import { TopBarBreadcrumbBar } from "@/components/layout/top-bar-breadcrumb";
import { ContactSharingPanel } from "@/features/groups/components/contact-sharing-panel";
import { DiscordPanel } from "@/features/groups/components/discord-panel";
import { AdminSettings } from "@/features/groups/components/friend-group-admin-settings";
import { LeaveOrDeletePanel } from "@/features/groups/components/leave-or-delete-panel";
import { ShareableCollectionsPanel } from "@/features/groups/components/shareable-collections-panel";
import { ShareableListsPanel } from "@/features/groups/components/shareable-lists-panel";
import { ShopsPanel } from "@/features/groups/components/shops-panel";
import { useFriendGroupDetail } from "@/features/groups/hooks/use-friend-groups";
import { cn, PAGE_PADDING, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { isAdmin } from "./friend-group-shell";

interface FriendGroupManagePageProps {
  slug: string;
}

function manageToc(admin: boolean): PageTocItem[] {
  const toc: PageTocItem[] = [
    { id: "group", label: m.groups_manage_toc_group() },
    { id: "group-settings", label: m.groups_manage_toc_settings(), level: 1 },
    { id: "banner", label: m.groups_manage_toc_banner(), level: 1 },
    { id: "invite-link", label: m.groups_invite_link_label(), level: 1 },
    { id: "discord", label: "Discord", level: 1 },
    { id: "shops", label: m.groups_manage_toc_shops(), level: 1 },
    { id: "sharing", label: m.groups_manage_toc_sharing() },
    { id: "contacts", label: m.groups_manage_toc_contacts(), level: 1 },
    { id: "lists", label: m.groups_manage_toc_lists(), level: 1 },
    { id: "collections", label: m.groups_nav_collections(), level: 1 },
    { id: "membership", label: m.groups_manage_toc_membership() },
  ];
  return admin ? toc : toc.slice(toc.findIndex((item) => item.id === "sharing"));
}

export function FriendGroupManagePage({ slug }: FriendGroupManagePageProps) {
  const { data } = useFriendGroupDetail(slug);
  const viewerRole = data.viewerRole ?? "member";
  const admin = isAdmin(viewerRole);

  return (
    <>
      <TopBarBreadcrumbBar
        segments={[
          { label: data.group.name, link: <Link to="/groups/$slug" params={{ slug }} /> },
          { label: m.groups_manage() },
        ]}
      />
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-6", PAGE_PADDING)}>
        <Heading level={1}>{m.groups_manage_heading({ group: data.group.name })}</Heading>

        <SettingsLayout toc={manageToc(admin)}>
          {admin ? (
            <SettingsGroup id="group" title={m.groups_manage_toc_group()}>
              <AdminSettings data={data} slug={slug} />
              <DiscordPanel slug={slug} />
              <ShopsPanel slug={slug} />
            </SettingsGroup>
          ) : null}
          <SettingsGroup id="sharing" title={m.groups_manage_toc_sharing()}>
            <ContactSharingPanel data={data} slug={slug} />
            <ShareableListsPanel slug={slug} />
            <ShareableCollectionsPanel slug={slug} />
          </SettingsGroup>
          <SettingsGroup id="membership" title={m.groups_manage_toc_membership()}>
            <LeaveOrDeletePanel data={data} slug={slug} />
          </SettingsGroup>
        </SettingsLayout>
      </div>
    </>
  );
}
