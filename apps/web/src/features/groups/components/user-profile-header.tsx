import { formatMonthYear } from "@openrift/shared/format-date";
import type { PublicUserBundleResponse } from "@openrift/shared/types/api/user-share";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  LinkIcon,
  SparklesIcon,
  SwordsIcon,
  UsersIcon,
} from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { Heading } from "@/components/heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { ContactMethodChips } from "@/features/groups/components/contact-method-chips";
import { groupsInCommonLabel, lastActiveLabel } from "@/features/groups/lib/user-profile-copy";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { m } from "@/paraglide/messages.js";

function MetaItem({
  icon: Icon,
  children,
}: {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 shrink-0" />
      {children}
    </span>
  );
}

function CopyLinkButton({ url }: { url: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <Button variant="outline" onClick={() => void copy(url)}>
      {copied ? <CheckIcon className="text-success" /> : <LinkIcon />}
      {copied ? m.common_copied() : m.user_profile_copy_link()}
    </Button>
  );
}

export function UserProfileHeader({
  data,
  shareUrl,
}: {
  data: PublicUserBundleResponse;
  shareUrl: string;
}) {
  const { owner, groupsInCommon, contactMethods } = data;
  const groupsLabel = groupsInCommonLabel(groupsInCommon.map((group) => group.name));
  return (
    <Card className="gap-0 py-0">
      <div aria-hidden className="bg-muted/40 h-28 bg-[image:var(--hero-gradient)] sm:h-36" />
      <div className="-mt-10 flex flex-col gap-4 px-4 pb-5 sm:-mt-11 sm:flex-row sm:items-end sm:px-6">
        <UserAvatar
          name={owner.displayName}
          gravatarHash={owner.gravatarHash}
          size="lg"
          className="ring-card size-20 ring-4 sm:size-24 [&_[data-slot=avatar-fallback]]:text-2xl"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:pb-1">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level={1}>{owner.displayName}</Heading>
            {owner.isContributor ? (
              <Badge variant="subtle" className="gap-1">
                <SparklesIcon />
                {m.user_profile_contributor()}
              </Badge>
            ) : null}
          </div>
          {owner.bio ? <p className="text-muted-foreground">{owner.bio}</p> : null}
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <MetaItem icon={CalendarIcon}>
              {m.user_profile_member_since({ date: formatMonthYear(owner.memberSince) })}
            </MetaItem>
            {owner.lastActive ? (
              <MetaItem icon={ClockIcon}>{lastActiveLabel(owner.lastActive)}</MetaItem>
            ) : null}
            {owner.riotId ? <MetaItem icon={SwordsIcon}>{owner.riotId}</MetaItem> : null}
            {groupsLabel ? <MetaItem icon={UsersIcon}>{groupsLabel}</MetaItem> : null}
          </div>
          {contactMethods.length > 0 ? (
            <div className="mt-1 flex flex-col gap-1.5">
              <ContactMethodChips methods={contactMethods} />
              {owner.isViewer ? (
                <span className="text-muted-foreground text-xs">
                  {m.user_profile_contacts_note()}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="sm:pb-1">
          <CopyLinkButton url={shareUrl} />
        </div>
      </div>
    </Card>
  );
}
