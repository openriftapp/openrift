import type { AdminGrowthDay } from "@openrift/shared/contracts/admin/dashboard";
import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  HandshakeIcon,
  HeartIcon,
  LayersIcon,
  SwordsIcon,
  TrophyIcon,
  UsersIcon,
  UsersRoundIcon,
} from "lucide-react";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { GrowthChart, GrowthRangeToggle } from "@/features/admin/components/growth-chart";
import { useAdminDashboard } from "@/features/admin/hooks/use-admin-dashboard";
import type { GrowthRange } from "@/features/admin/lib/growth";
import { GROWTH_RANGE_CAPTIONS, countAdded, toGrowthSeries } from "@/features/admin/lib/growth";

function StatTile({
  icon: Icon,
  label,
  value,
  days,
  range,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  days: AdminGrowthDay[];
  range: GrowthRange;
  to?: LinkProps["to"];
}) {
  const series = toGrowthSeries(days, range);
  const added = countAdded(series);

  const body = (
    <>
      <CardHeader>
        <CardTitle className="text-muted-foreground flex items-center gap-1.5">
          <Icon className="size-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div>
          <p className="font-heading text-2xl font-semibold tabular-nums">
            {value.toLocaleString()}
          </p>
          <p className="text-muted-foreground text-xs">
            +{added.toLocaleString()} {GROWTH_RANGE_CAPTIONS[range]}
          </p>
        </div>
        <GrowthChart series={series} label={label} compact />
      </CardContent>
    </>
  );

  if (to !== undefined) {
    return <CardLink render={<Link to={to} />}>{body}</CardLink>;
  }

  return <Card>{body}</Card>;
}

export function DashboardPage() {
  const { data } = useAdminDashboard();
  const { app, growth } = data;
  const [range, setRange] = useState<GrowthRange>("30d");

  return (
    <div className="space-y-4">
      <AdminPageTopBar
        title="Dashboard"
        actions={<GrowthRangeToggle value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <StatTile
          icon={UsersIcon}
          label="Users"
          value={app.totalUsers}
          days={growth.users}
          range={range}
          to="/admin/users"
        />
        <StatTile
          icon={LayersIcon}
          label="Collections"
          value={app.totalCollections}
          days={growth.collections}
          range={range}
        />
        <StatTile
          icon={SwordsIcon}
          label="User decks"
          value={app.totalUserDecks}
          days={growth.userDecks}
          range={range}
        />
        <StatTile
          icon={TrophyIcon}
          label="Meta event decks"
          value={app.totalMetaDecks}
          days={growth.metaDecks}
          range={range}
        />
        <StatTile
          icon={HeartIcon}
          label="Wishlists"
          value={app.totalWishlists}
          days={growth.wishlists}
          range={range}
        />
        <StatTile
          icon={HandshakeIcon}
          label="Tradelists"
          value={app.totalTradelists}
          days={growth.tradelists}
          range={range}
        />
        <StatTile
          icon={UsersRoundIcon}
          label="Friend groups"
          value={app.totalFriendGroups}
          days={growth.friendGroups}
          range={range}
        />
      </div>
    </div>
  );
}
