import type { PublicUserBundleResponse } from "@openrift/shared/types/api/user-share";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { PublicShareCta } from "@/features/account/components/signed-out-cta";

function OverlapCount({ value, children }: { value: number; children: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-heading min-w-8 text-3xl font-semibold tabular-nums">
        {value.toLocaleString("en-US")}
      </span>
      <span className="text-muted-foreground max-w-48 text-sm">{children}</span>
    </div>
  );
}

/** Anonymous viewers get the sign-in nudge instead (client-only, since the page is publicly cached for them). */
export function UserProfileOverlap({
  data,
  isOwner,
}: {
  data: PublicUserBundleResponse;
  isOwner: boolean;
}) {
  const { owner, overlap, groupsInCommon } = data;
  if (overlap === null) {
    if (isOwner) {
      return null;
    }
    return (
      <PublicShareCta title={`See what you could trade with ${owner.displayName}`}>
        Sign in and OpenRift matches their wants and offers against your lists.
      </PublicShareCta>
    );
  }
  if (overlap.theyWantYouHave === 0 && overlap.theyOfferYouWant === 0) {
    return (
      <p className="text-muted-foreground text-sm">Nothing on their lists matches yours yet.</p>
    );
  }
  const matchGroup = groupsInCommon[0];
  return (
    <Card className="ring-primary/40 flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex items-center gap-3 sm:min-w-52">
        <IconChip icon={ArrowLeftRightIcon} tone="primary" />
        <div className="flex flex-col">
          <span className="font-medium">Overlap with your lists</span>
          <span className="text-muted-foreground text-xs">Across the lists you can see here</span>
        </div>
      </div>
      <OverlapCount value={overlap.theyWantYouHave}>
        cards they want that sit in your tradelists
      </OverlapCount>
      <OverlapCount value={overlap.theyOfferYouWant}>
        cards they offer that are on your wishlists
      </OverlapCount>
      {matchGroup && owner.userId ? (
        <Button
          className="sm:ml-auto"
          render={
            <Link
              to="/groups/$slug/members/$userId"
              params={{ slug: matchGroup.slug, userId: owner.userId }}
            />
          }
        >
          See matches in {matchGroup.name}
        </Button>
      ) : null}
    </Card>
  );
}
