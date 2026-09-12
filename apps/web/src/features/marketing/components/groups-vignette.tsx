import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { ArtStrip, Vignette, VignetteHeading } from "./vignette-parts";

function groupCards() {
  return [
    {
      name: "Thursday store crew",
      members: ["Alice", "Mira", "Nour", "Ravi"],
      extraMembers: 4,
      waiting: m.groups_index_trade_requests_other({ count: 2 }),
      canGet: 9,
      canGetExtra: 5,
      theydWant: 5,
      theydWantExtra: 3,
      volume: m.groups_trade_volume_recent_other({ count: 12, days: 30 }),
      active: true,
    },
    {
      name: "Bothfeld Rift Club",
      members: ["Sina", "Jonas"],
      extraMembers: 1,
      waiting: null,
      canGet: 3,
      canGetExtra: 1,
      theydWant: null,
      theydWantExtra: 0,
      volume: m.groups_trade_volume_quiet({ days: 30 }),
      active: false,
    },
  ];
}

export function GroupsVignette({ thumbnailUrls }: { thumbnailUrls: string[] }) {
  return (
    <Vignette>
      <VignetteHeading>{m.marketing_groups_heading()}</VignetteHeading>
      <div className="flex flex-col gap-3">
        {groupCards().map((group, index) => (
          <Card key={group.name} className="gap-2.5 p-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 flex-1 truncate font-medium">{group.name}</span>
              <span className="flex shrink-0 items-center -space-x-1">
                {group.members.map((member) => (
                  <UserAvatar
                    key={member}
                    name={member}
                    size="sm"
                    className="bg-card ring-card ring-2"
                  />
                ))}
                <span className="text-muted-foreground pl-3 text-xs tabular-nums">
                  +{group.extraMembers}
                </span>
              </span>
            </div>
            {group.waiting && <Badge className="self-start">{group.waiting}</Badge>}
            <div className="flex min-w-0 items-center gap-2.5">
              <ArtStrip
                urls={thumbnailUrls.slice(index * 3, index * 3 + 3)}
                extra={group.canGetExtra}
              />
              <span className="text-muted-foreground min-w-0 truncate text-sm">
                <span className="text-foreground font-medium">{group.canGet}</span>{" "}
                {m.groups_index_strip_incoming()}
              </span>
            </div>
            {group.theydWant !== null && (
              <div className="flex min-w-0 items-center gap-2.5">
                <ArtStrip urls={thumbnailUrls.slice(6, 8)} extra={group.theydWantExtra} />
                <span className="text-muted-foreground min-w-0 truncate text-sm">
                  <span className="text-foreground font-medium">{group.theydWant}</span>{" "}
                  {m.groups_index_strip_outgoing()}
                </span>
              </div>
            )}
            <p className="text-muted-foreground flex items-center gap-1.5 pt-0.5 text-sm">
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
