import { formatMonthYear } from "@openrift/shared/format-date";
import type { PublicUserBundleResponse } from "@openrift/shared/types/api/user-share";
import {
  CalendarIcon,
  ClockIcon,
  HeartHandshakeIcon,
  LinkIcon,
  SparklesIcon,
  SwordsIcon,
  UsersIcon,
} from "lucide-react";
import type { ComponentType, ReactNode, SVGProps } from "react";

import { CopyTextButton } from "@/components/copy-text-button";
import { Heading } from "@/components/heading";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { useReferralUrl } from "@/features/account/hooks/use-referral";
import { referralTierLabel } from "@/features/account/lib/referral-tier-label";
import { ContactMethodChips } from "@/features/groups/components/contact-method-chips";
import { UserProfileStats } from "@/features/groups/components/user-profile-stats";
import { groupsInCommonLabel, lastActiveLabel } from "@/features/groups/lib/user-profile-copy";
import { DATE_WORDS } from "@/lib/date-words";
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

export function UserProfileHeader({
  data,
  shareUrl,
}: {
  data: PublicUserBundleResponse;
  shareUrl: string;
}) {
  const { owner, groupsInCommon, contactMethods } = data;
  const groupsLabel = groupsInCommonLabel(groupsInCommon.map((group) => group.name));
  const referralLabel = referralTierLabel(owner.referralTier);
  const ownShareUrl = useReferralUrl(shareUrl);
  return (
    <Card className="gap-4 p-4 sm:p-5">
      <div className="flex items-center gap-4">
        <UserAvatar
          name={owner.displayName}
          gravatarHash={owner.gravatarHash}
          size="lg"
          className="size-16 sm:size-20 [&_[data-slot=avatar-fallback]]:text-2xl"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level={1}>{owner.displayName}</Heading>
            {owner.isContributor ? (
              <Badge variant="subtle" className="gap-1">
                <SparklesIcon />
                {m.user_profile_contributor()}
              </Badge>
            ) : null}
            {referralLabel ? (
              <Badge variant="subtle" className="gap-1">
                <HeartHandshakeIcon />
                {referralLabel}
              </Badge>
            ) : null}
          </div>
          <div className="text-muted-foreground text-sm">
            <MetaItem icon={CalendarIcon}>
              {m.user_profile_member_since({
                date: formatMonthYear(owner.memberSince, DATE_WORDS),
              })}
            </MetaItem>
          </div>
        </div>
      </div>
      {owner.bio ? <p className="text-muted-foreground">{owner.bio}</p> : null}
      {owner.lastActive || owner.riotId || groupsLabel ? (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {owner.lastActive ? (
            <MetaItem icon={ClockIcon}>{lastActiveLabel(owner.lastActive)}</MetaItem>
          ) : null}
          {owner.riotId ? <MetaItem icon={SwordsIcon}>{owner.riotId}</MetaItem> : null}
          {groupsLabel ? <MetaItem icon={UsersIcon}>{groupsLabel}</MetaItem> : null}
        </div>
      ) : null}
      {contactMethods.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <ContactMethodChips methods={contactMethods} />
          {owner.isViewer ? (
            <span className="text-muted-foreground text-xs">{m.user_profile_contacts_note()}</span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <UserProfileStats stats={data.stats} />
        <CopyTextButton
          value={owner.isViewer ? ownShareUrl : shareUrl}
          label={m.user_profile_copy_link()}
          icon={LinkIcon}
          normalizeLineBreaks={false}
        />
      </div>
    </Card>
  );
}
