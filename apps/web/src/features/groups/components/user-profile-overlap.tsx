import type { PublicUserBundleResponse } from "@openrift/shared/types/api/user-share";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { PublicShareCta } from "@/features/account/components/signed-out-cta";
import { m } from "@/paraglide/messages.js";

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
      <PublicShareCta title={m.user_profile_cta_title({ name: owner.displayName })}>
        {m.user_profile_cta_body()}
      </PublicShareCta>
    );
  }
  if (overlap.theyWantYouHave === 0 && overlap.theyOfferYouWant === 0) {
    return <p className="text-muted-foreground text-sm">{m.user_profile_no_overlap()}</p>;
  }
  const matchGroup = groupsInCommon[0];
  return (
    <Card className="ring-primary/40 flex-col gap-5 px-5 py-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="flex items-center gap-3 sm:min-w-52">
        <IconChip icon={ArrowLeftRightIcon} tone="primary" />
        <div className="flex flex-col">
          <span className="font-medium">{m.user_profile_overlap_title()}</span>
          <span className="text-muted-foreground text-xs">{m.user_profile_overlap_subtitle()}</span>
        </div>
      </div>
      <OverlapCount value={overlap.theyWantYouHave}>
        {m.user_profile_overlap_they_want()}
      </OverlapCount>
      <OverlapCount value={overlap.theyOfferYouWant}>
        {m.user_profile_overlap_they_offer()}
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
          {m.user_profile_see_matches({ group: matchGroup.name })}
        </Button>
      ) : null}
    </Card>
  );
}
