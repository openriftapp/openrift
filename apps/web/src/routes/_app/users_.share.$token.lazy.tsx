import type { ListIntent } from "@openrift/shared/types/api/list";
import type { PublicUserBundleCollectionResponse } from "@openrift/shared/types/api/user-share";
import { Link, createLazyFileRoute } from "@tanstack/react-router";
import { BookOpenIcon, ChevronRightIcon, HandshakeIcon, HeartIcon, UsersIcon } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import { Badge } from "@/components/ui/badge";
import { CardLink } from "@/components/ui/card-link";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { IconChipTone } from "@/components/ui/icon-chip";
import { SectionHeading } from "@/components/ui/section-heading";
import { UserProfileHeader } from "@/features/groups/components/user-profile-header";
import { UserProfileListTile } from "@/features/groups/components/user-profile-list-tile";
import { UserProfileOverlap } from "@/features/groups/components/user-profile-overlap";
import { UserProfilePreviewFan } from "@/features/groups/components/user-profile-preview-fan";
import { UserProfileStats } from "@/features/groups/components/user-profile-stats";
import { usePublicUserBundle } from "@/features/groups/hooks/use-user-share";
import { useUserId } from "@/lib/auth-session";
import { getSiteUrl } from "@/lib/site-config";
import { cn, PAGE_WIDTH, PAGE_PADDING } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/users_/share/$token")({
  component: SharedUserBundlePage,
});

function sections(): {
  intent: Extract<ListIntent, "wish" | "trade">;
  heading: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: IconChipTone;
}[] {
  return [
    { intent: "wish", heading: m.user_profile_section_wish(), icon: HeartIcon, tone: "primary" },
    {
      intent: "trade",
      heading: m.user_profile_section_trade(),
      icon: HandshakeIcon,
      tone: "success",
    },
  ];
}

function SharedUserBundlePage() {
  const { token } = Route.useParams();
  const { data } = usePublicUserBundle(token);
  const { lists, collections } = data;
  const viewerUserId = useUserId();
  const showVisibility = viewerUserId !== null;
  const isEmpty = lists.length === 0 && collections.length === 0;

  return (
    <div className={cn(PAGE_PADDING, PAGE_WIDTH.capped, "flex flex-col gap-6 py-4")}>
      <UserProfileHeader data={data} shareUrl={`${getSiteUrl()}/users/share/${token}`} />
      <UserProfileStats stats={data.stats} />
      {isEmpty ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HeartIcon />
            </EmptyMedia>
            <EmptyTitle>{m.user_profile_empty_title()}</EmptyTitle>
            <EmptyDescription>{m.user_profile_empty_description()}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <UserProfileOverlap data={data} isOwner={data.owner.isViewer} />
          {sections().map(({ intent, heading, icon, tone }) => {
            const sectionLists = lists.filter((list) => list.intent === intent);
            if (sectionLists.length === 0) {
              return null;
            }
            return (
              <section key={intent} className="flex flex-col gap-3">
                <SectionHeading icon={icon} tone={tone}>
                  {heading}
                </SectionHeading>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {sectionLists.map((list) => (
                    <UserProfileListTile
                      key={list.id}
                      token={token}
                      list={list}
                      showVisibility={showVisibility}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {collections.length > 0 ? (
            <section className="flex flex-col gap-3">
              <SectionHeading icon={BookOpenIcon} tone="info">
                {m.user_profile_collections_heading()}
              </SectionHeading>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {collections.map((collection) => (
                  <BundleCollectionRow key={collection.id} collection={collection} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function BundleCollectionRow({ collection }: { collection: PublicUserBundleCollectionResponse }) {
  // Group-shared collections always link through one of the via-groups; pick
  // the first as the canonical route. Membership is required server-side.
  const viaGroup = collection.viaGroups[0];
  if (!viaGroup) {
    return null;
  }
  return (
    <CardLink
      className="gap-2 p-4"
      render={
        <Link
          to="/groups/$slug/collections/$collectionId"
          params={{ slug: viaGroup.slug, collectionId: collection.id }}
        />
      }
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-medium break-words">{collection.name}</span>
          {collection.description ? (
            <p className="text-muted-foreground line-clamp-2 text-sm">{collection.description}</p>
          ) : null}
        </div>
        <ChevronRightIcon className="text-muted-foreground/40 mt-0.5 size-4 shrink-0" />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {collection.viaGroups.map((group) => (
          <Badge
            key={group.id}
            variant="outline"
            className="text-2xs max-w-[10rem] gap-1"
            title={m.user_profile_shared_with({ group: group.name })}
          >
            <UsersIcon className="size-3 shrink-0" />
            <span className="truncate">{group.name}</span>
          </Badge>
        ))}
      </div>
      <div className="mt-auto flex justify-end pt-2">
        <UserProfilePreviewFan imageIds={collection.previewImageIds} />
      </div>
    </CardLink>
  );
}
