import type { PublicUserBundleResponse } from "@openrift/shared/types/api/user-share";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRightIcon } from "lucide-react";

import { PublicShareCta } from "@/components/signed-out-cta";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconChip } from "@/components/ui/icon-chip";
import { StatFigure } from "@/components/ui/stat-figure";
import { formatCount } from "@/lib/format";
import { m } from "@/paraglide/messages.js";

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
      <StatFigure
        size="hero"
        className="max-w-48"
        value={formatCount(overlap.theyWantYouHave)}
        label={m.user_profile_overlap_they_want()}
      />
      <StatFigure
        size="hero"
        className="max-w-48"
        value={formatCount(overlap.theyOfferYouWant)}
        label={m.user_profile_overlap_they_offer()}
      />
      {matchGroup && owner.userId ? (
        <Link
          to="/groups/$slug/members/$userId"
          params={{ slug: matchGroup.slug, userId: owner.userId }}
          className={buttonVariants({ className: "sm:ml-auto" })}
        >
          {m.user_profile_see_matches({ group: matchGroup.name })}
        </Link>
      ) : null}
    </Card>
  );
}
