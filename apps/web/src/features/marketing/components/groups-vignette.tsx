import { Heading } from "@/components/heading";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UserAvatarStack } from "@/components/user-avatar-stack";
import { GroupStripRow } from "@/features/groups/components/group-strip-row";
import { FIXTURE_GROUPS, FIXTURE_PEOPLE } from "@/features/marketing/lib/vignette-fixtures";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { Vignette, VignetteHeading } from "./vignette-parts";

function groupCards() {
  return [
    {
      name: FIXTURE_GROUPS.storeCrew,
      members: [
        FIXTURE_PEOPLE.alice,
        FIXTURE_PEOPLE.mira,
        FIXTURE_PEOPLE.nour,
        FIXTURE_PEOPLE.ravi,
      ],
      memberCount: 8,
      waiting: m.groups_index_trade_requests({ count: 2 }),
      canGet: 9,
      theydWant: 5,
      volume: m.groups_trade_volume_recent({ count: 12, days: 30 }),
      active: true,
    },
    {
      name: FIXTURE_GROUPS.riftClub,
      members: [FIXTURE_PEOPLE.sina, FIXTURE_PEOPLE.jonas],
      memberCount: 3,
      waiting: null,
      canGet: 3,
      theydWant: null,
      volume: m.groups_trade_volume_quiet({ days: 30 }),
      active: false,
    },
  ];
}

function thumbs(urls: string[]) {
  return urls.map((url) => ({ key: url, src: url }));
}

export function GroupsVignette({ thumbnailUrls }: { thumbnailUrls: string[] }) {
  return (
    <Vignette>
      <VignetteHeading>{m.marketing_groups_heading()}</VignetteHeading>
      <div className="flex flex-col gap-3">
        {groupCards().map((group, index) => (
          <Card key={group.name} className="gap-2.5 p-5">
            <div className="flex min-w-0 items-center gap-2">
              <Heading as="h3" className="min-w-0 flex-1 truncate">
                {group.name}
              </Heading>
              <UserAvatarStack
                members={group.members}
                totalCount={group.memberCount}
                size="sm"
                className="shrink-0"
              />
            </div>
            {group.waiting && (
              <Badge className="self-start whitespace-nowrap">{group.waiting}</Badge>
            )}
            <GroupStripRow
              items={thumbs(thumbnailUrls.slice(index * 3, index * 3 + 3))}
              count={group.canGet}
              label={m.groups_index_strip_incoming()}
            />
            {group.theydWant !== null && (
              <GroupStripRow
                items={thumbs(thumbnailUrls.slice(6, 8))}
                count={group.theydWant}
                label={m.groups_index_strip_outgoing()}
              />
            )}
            <p className="text-muted-foreground mt-auto flex items-center gap-1.5 pt-1.5 text-sm">
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  group.active ? "bg-success" : "bg-muted-foreground/50",
                )}
              />
              {group.volume}
            </p>
          </Card>
        ))}
      </div>
    </Vignette>
  );
}
