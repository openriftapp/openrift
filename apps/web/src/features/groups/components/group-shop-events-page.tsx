import { isGroupAdminRole } from "@openrift/shared/friend-group-roles";
import { Link, getRouteApi } from "@tanstack/react-router";
import { SettingsIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { CalendarFeedButton } from "@/features/groups/components/calendar-feed-dialog";
import { FriendGroupSectionFrame } from "@/features/groups/components/friend-group-shell";
import { ShopEventsContent } from "@/features/groups/components/shop-events-page";
import { useFriendGroupDetail } from "@/features/groups/hooks/use-friend-groups";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/_authenticated/groups/$slug_/shops");

export function GroupShopEventsPage() {
  const { slug } = routeApi.useParams();
  const { data } = useFriendGroupDetail(slug);
  return (
    <FriendGroupSectionFrame
      slug={slug}
      title={m.groups_nav_shop_events()}
      actions={
        <>
          <CalendarFeedButton slug={slug} kind="shop_events" />
          {isGroupAdminRole(data.viewerRole) ? (
            <Link
              to="/groups/$slug/manage"
              params={{ slug }}
              hash="shops"
              className={buttonVariants({ variant: "ghost" })}
            >
              <SettingsIcon className="size-4" />
              {m.groups_shops_manage()}
            </Link>
          ) : null}
        </>
      }
      render={(detail) => <ShopEventsContent slug={slug} data={detail} />}
    />
  );
}
