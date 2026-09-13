import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { Link } from "@tanstack/react-router";
import { SettingsIcon } from "lucide-react";
import { Fragment } from "react";

import { Eyebrow, Heading } from "@/components/heading";
import { MarkdownText } from "@/components/markdown-text";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { UserAvatarStack } from "@/components/user-avatar-stack";
import { CardFan, CardFanOutline } from "@/features/cards/components/card-fan";
import { useCards } from "@/features/cards/hooks/use-cards";
import { frontImageId } from "@/features/cards/lib/card-meta";
import { useCollections } from "@/features/collections/hooks/use-collections";
import { useFriendGroupActivity } from "@/features/groups/hooks/use-friend-groups";
import { GROUP_BANNER_FRAME } from "@/features/groups/lib/banner-frame";
import { distinctPrintingIds } from "@/features/groups/lib/friend-group-activity";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const HERO_AVATARS = 5;

interface HeroStat {
  key: string;
  to: "/groups/$slug/members" | "/groups/$slug/shared" | "/groups/$slug/trades";
  label: string;
}

const HERO_WASH = [
  "radial-gradient(90% 130% at 85% 10%, color-mix(in oklab, var(--border-accent) 26%, transparent), transparent 62%)",
  "radial-gradient(70% 120% at 65% 100%, color-mix(in oklab, oklch(0.5 0.11 300) 14%, transparent), transparent 65%)",
  "linear-gradient(color-mix(in oklab, var(--muted) 50%, var(--background)), var(--background))",
].join(", ");

export function FriendGroupHero({ slug, data }: { slug: string; data: FriendGroupDetailResponse }) {
  const { data: activity } = useFriendGroupActivity(slug);
  const { printingsById } = useCards();
  const { data: collections } = useCollections();

  const covers = distinctPrintingIds(
    activity.events.filter((event) => event.kind === "trade-completed" || event.kind === "match"),
  )
    .flatMap((printingId) => {
      const imageId = frontImageId(printingsById[printingId]);
      return imageId ? [{ key: printingId, imageId }] : [];
    })
    .slice(0, 4);

  const groupCollectionCount = collections.filter(
    (collection) => collection.groupId === data.group.id,
  ).length;
  const meta: HeroStat[] = [
    {
      key: "members",
      to: "/groups/$slug/members",
      label: m.groups_member_count({ count: data.members.length }),
    },
    ...(groupCollectionCount > 0
      ? [
          {
            key: "collections",
            to: "/groups/$slug/shared" as const,
            label: m.groups_hero_group_collections({ count: groupCollectionCount }),
          },
        ]
      : []),
    ...(data.cardsTradedCount > 0
      ? [
          {
            key: "traded",
            to: "/groups/$slug/trades" as const,
            label: m.groups_hero_cards_traded({ count: data.cardsTradedCount }),
          },
        ]
      : []),
  ];

  const shownMembers = data.members.slice(0, HERO_AVATARS);
  const banner = data.group.bannerUrl;

  return (
    <section className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col pt-4")}>
      {banner ? (
        <div className={cn(GROUP_BANNER_FRAME, "relative overflow-hidden rounded-lg")}>
          <img
            src={banner}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: `50% ${data.group.bannerPosition}%` }}
          />
          <Button
            variant="outline"
            size="sm"
            className="absolute top-3 right-3 border-white/20 bg-black/60 text-white shadow-md backdrop-blur-sm hover:border-white/30 hover:bg-black/70 hover:text-white"
            render={<Link to="/groups/$slug/manage" params={{ slug }} />}
          >
            <SettingsIcon />
            {m.groups_manage()}
          </Button>
        </div>
      ) : null}
      <div
        className={cn(
          "relative flex gap-6",
          banner
            ? "flex-col items-start gap-4 pt-5 sm:flex-row sm:items-end sm:gap-6"
            : "items-end overflow-hidden",
        )}
        style={banner ? undefined : { backgroundImage: HERO_WASH }}
      >
        {banner ? null : (
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-3 right-3 z-10"
            render={<Link to="/groups/$slug/manage" params={{ slug }} />}
          >
            <SettingsIcon />
            {m.groups_manage()}
          </Button>
        )}
        <div className={cn("flex min-w-0 flex-1 flex-col gap-2.5", banner ? null : "py-6 pl-5")}>
          <Eyebrow variant="kicker">{m.groups_hero_kicker()}</Eyebrow>
          <Heading level={1} className="text-3xl text-balance">
            {data.group.name}
          </Heading>
          {data.group.description ? (
            <MarkdownText
              text={data.group.description}
              links="labeled"
              className="text-muted-foreground"
            />
          ) : null}
          <p className="text-muted-foreground text-sm">
            {meta.map((stat, index) => (
              <Fragment key={stat.key}>
                {index > 0 ? " · " : null}
                <TextLink variant="muted" render={<Link to={stat.to} params={{ slug }} />}>
                  {stat.label}
                </TextLink>
              </Fragment>
            ))}
          </p>
          {banner ? null : (
            <UserAvatarStack
              members={shownMembers}
              totalCount={data.members.length}
              className="mt-1"
              avatarClassName="bg-background ring-background"
            />
          )}
        </div>
        {banner ? (
          <UserAvatarStack
            members={shownMembers}
            totalCount={data.members.length}
            className="shrink-0"
            avatarClassName="bg-background ring-background"
          />
        ) : (
          /* CardFan positions absolutely; this div is its relative host, and
               the wrapper's overflow-hidden crops the bottom-anchored cards. */
          <div aria-hidden="true" className="relative hidden h-36 w-72 shrink-0 self-end sm:block">
            {covers.length === 0 ? <CardFanOutline /> : <CardFan covers={covers} />}
          </div>
        )}
      </div>
    </section>
  );
}
