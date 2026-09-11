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

import { isAdmin } from "./friend-group-shell";

interface FriendGroupManagePageProps {
  slug: string;
}

const ADMIN_TOC: PageTocItem[] = [
  { id: "group", label: "Group" },
  { id: "group-settings", label: "Settings", level: 1 },
  { id: "banner", label: "Banner", level: 1 },
  { id: "invite-link", label: "Invite link", level: 1 },
  { id: "discord", label: "Discord", level: 1 },
  { id: "shops", label: "Shops", level: 1 },
  { id: "sharing", label: "Sharing" },
  { id: "contacts", label: "Contacts", level: 1 },
  { id: "lists", label: "Lists", level: 1 },
  { id: "collections", label: "Collections", level: 1 },
  { id: "membership", label: "Membership" },
];

const MEMBER_TOC: PageTocItem[] = ADMIN_TOC.slice(
  ADMIN_TOC.findIndex((item) => item.id === "sharing"),
);

export function FriendGroupManagePage({ slug }: FriendGroupManagePageProps) {
  const { data } = useFriendGroupDetail(slug);
  const viewerRole = data.viewerRole ?? "member";
  const admin = isAdmin(viewerRole);

  return (
    <>
      <TopBarBreadcrumbBar
        segments={[
          { label: data.group.name, link: <Link to="/groups/$slug" params={{ slug }} /> },
          { label: "Manage" },
        ]}
      />
      <div className={cn(PAGE_WIDTH.capped, "flex flex-col gap-6", PAGE_PADDING)}>
        <Heading level={1}>Manage {data.group.name}</Heading>

        <SettingsLayout toc={admin ? ADMIN_TOC : MEMBER_TOC}>
          {admin ? (
            <SettingsGroup id="group" title="Group">
              <AdminSettings data={data} slug={slug} />
              <DiscordPanel slug={slug} />
              <ShopsPanel slug={slug} />
            </SettingsGroup>
          ) : null}
          <SettingsGroup id="sharing" title="Sharing">
            <ContactSharingPanel data={data} slug={slug} />
            <ShareableListsPanel slug={slug} />
            <ShareableCollectionsPanel slug={slug} />
          </SettingsGroup>
          <SettingsGroup id="membership" title="Membership">
            <LeaveOrDeletePanel data={data} slug={slug} />
          </SettingsGroup>
        </SettingsLayout>
      </div>
    </>
  );
}
