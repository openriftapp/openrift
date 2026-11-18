import type { FriendGroupDetailResponse } from "@openrift/shared/types/api/friend-group";
import { Link } from "@tanstack/react-router";
import { SettingsIcon } from "lucide-react";
import type { ReactElement } from "react";
import { Fragment } from "react";

import { CardFan, CardFanOutline } from "@/components/card-fan";
import { Eyebrow, Heading } from "@/components/heading";
import { MarkdownText } from "@/components/markdown-text";
import { buttonVariants } from "@/components/ui/button";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { TextLink } from "@/components/ui/text-link";
import { UserAvatarStack } from "@/components/user-avatar-stack";
import { useCards } from "@/features/cards/hooks/use-cards";
import { printingArt } from "@/features/cards/lib/card-meta";
import { useCollections } from "@/features/collections/hooks/use-collections";
import { useFriendGroupActivity } from "@/features/groups/hooks/use-friend-groups";
import { GROUP_BANNER_FRAME } from "@/features/groups/lib/banner-frame";
import { distinctPrintingIds } from "@/features/groups/lib/friend-group-activity";
import { HERO_WASH } from "@/lib/accent-wash";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const HERO_AVATARS = 5;

interface HeroStat {
  key: string;
  link: ReactElement;
  label: string;
}

export function FriendGroupHero({ slug, data }: { slug: string; data: FriendGroupDetailResponse }) {
  const { data: activity } = useFriendGroupActivity(slug);
  const { printingsById } = useCards();
  const { data: collections } = useCollections();

  const covers = distinctPrintingIds(
    activity.events.filter((event) => event.kind === "trade-completed" || event.kind === "match"),
  )
    .flatMap((printingId) => {
      const { imageId, landscape } = printingArt(printingsById[printingId]);
      return imageId ? [{ key: printingId, imageId, landscape }] : [];
    })
    .slice(0, 4);

  const groupCollectionCount = collections.filter(
    (collection) => collection.groupId === data.group.id,
  ).length;
  const meta: HeroStat[] = [
    {
      key: "members",
      link: <Link to="/groups/$slug/members" params={{ slug }} />,
      label: m.groups_member_count({ count: data.members.length }),
    },
    ...(groupCollectionCount > 0
      ? [
          {
            key: "collections",
            link: <Link to="/groups/$slug/shared" params={{ slug }} />,
            label: m.groups_hero_group_collections({ count: groupCollectionCount }),
          },
        ]
      : []),
    ...(data.cardsTradedCount > 0
      ? [
          {
            key: "traded",
            link: <Link to="/trades" search={{ group: slug }} />,
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
          <ImgWithFallback
            src={banner}
            alt=""
            className="h-full w-full object-cover"
            style={{ objectPosition: `50% ${data.group.bannerPosition}%` }}
            fallback={null}
          />
          <Link
            to="/groups/$slug/manage"
            params={{ slug }}
            className={buttonVariants({
              variant: "outline",
              size: "sm",
              className:
                "absolute top-3 right-3 border-white/20 bg-black/60 text-white shadow-md backdrop-blur-sm hover:border-white/30 hover:bg-black/70 hover:text-white",
            })}
          >
            <SettingsIcon />
            {m.groups_manage()}
          </Link>
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
          <Link
            to="/groups/$slug/manage"
            params={{ slug }}
            className={buttonVariants({
              variant: "ghost",
              size: "sm",
              className: "absolute top-3 right-3 z-10",
            })}
          >
            <SettingsIcon />
            {m.groups_manage()}
          </Link>
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
                <TextLink variant="muted" render={stat.link}>
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
