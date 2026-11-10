import { nextReferralThreshold, referralTier, withReferralCode } from "@openrift/shared/referral";
import { HeartHandshakeIcon } from "lucide-react";

import { SettingsSection } from "@/components/layout/settings-section";
import { ShareLinkRow } from "@/components/share/share-link-row";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useReferral } from "@/features/account/hooks/use-referral";
import { referralTierLabel } from "@/features/account/lib/referral-tier-label";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

export function ReferralSection() {
  const { data } = useReferral();

  return (
    <SettingsSection title={m.referral_title()} description={m.referral_description()}>
      {data ? <ReferralBody {...data} /> : <Skeleton className="h-10 w-full" />}
    </SettingsSection>
  );
}

function ReferralBody({
  code,
  signedUp,
  counted,
}: {
  code: string;
  signedUp: number;
  counted: number;
}) {
  const tierLabel = referralTierLabel(referralTier(counted));
  const next = nextReferralThreshold(counted);
  const notYetCounted = signedUp - counted;

  return (
    <div className="flex flex-col gap-3">
      <ShareLinkRow
        url={withReferralCode(`${getSiteUrl()}/`, code)}
        label={m.referral_link_label()}
      />
      <div className="flex flex-wrap items-center gap-2">
        {tierLabel ? (
          <Badge variant="subtle" className="gap-1">
            <HeartHandshakeIcon />
            {tierLabel}
          </Badge>
        ) : null}
        <span className="text-muted-foreground text-sm">
          {m.referral_counted({ count: counted })}
          {notYetCounted > 0 ? ` ${m.referral_not_yet_counted({ count: notYetCounted })}` : null}
        </span>
      </div>
      <p className="text-muted-foreground text-sm">
        {next === null
          ? m.referral_rules_top()
          : m.referral_rules_next({ count: next - counted, threshold: next })}
      </p>
    </div>
  );
}
