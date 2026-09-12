import type { MetaCreditVisibility } from "@openrift/shared/types/enums";
import { META_CREDIT_VISIBILITIES } from "@openrift/shared/types/enums";
import { Link } from "@tanstack/react-router";

import { SettingsSection } from "@/components/layout/settings-section";
import { Callout } from "@/components/ui/callout";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";
import { MetaContributors } from "@/features/meta/components/meta-contributors";
import {
  useMetaCreditVisibility,
  useSetMetaCreditVisibility,
} from "@/features/meta/hooks/use-meta-submissions";
import {
  metaCreditPreview,
  metaCreditVisibilityHints,
  metaCreditVisibilityLabels,
} from "@/features/meta/lib/meta-submission-copy";
import { useFeatureEnabled } from "@/hooks/use-feature-flags";
import { useSession } from "@/lib/auth-session";
import { m } from "@/paraglide/messages.js";

function CreditPreview({
  creditedAs,
  usesDisplayNameFallback,
  visibility,
}: {
  creditedAs: string | null;
  usesDisplayNameFallback: boolean;
  visibility: MetaCreditVisibility;
}) {
  return (
    <Callout variant="inset" className="flex flex-col gap-1">
      <h3 className="font-medium">{m.profile_meta_credit_preview_title()}</h3>
      {creditedAs === null ? (
        <p className="text-muted-foreground text-sm">
          {visibility === "hidden"
            ? m.profile_meta_credit_preview_hidden()
            : m.profile_meta_credit_preview_no_name()}
        </p>
      ) : (
        <MetaContributors contributors={[creditedAs]} />
      )}
      {usesDisplayNameFallback && creditedAs !== null && (
        <p className="text-muted-foreground text-sm">
          {m.profile_meta_credit_fallback_before()}{" "}
          <TextLink variant="muted" render={<Link to="/profile" hash="account" />}>
            {m.profile_meta_credit_fallback_link()}
          </TextLink>{" "}
          {m.profile_meta_credit_fallback_after()}
        </p>
      )}
      {creditedAs === null && visibility !== "hidden" && (
        <p className="text-muted-foreground text-sm">
          <TextLink variant="muted" render={<Link to="/profile" hash="account" />}>
            {m.profile_meta_credit_no_name_link()}
          </TextLink>{" "}
          {m.profile_meta_credit_no_name_after()}
        </p>
      )}
    </Callout>
  );
}

// Credit rows are written regardless of this setting; the public read filters
// on it at render time, so toggling it retroactively (un)credits everything.
export function MetaCreditSection() {
  const metaEnabled = useFeatureEnabled("meta");
  const { data: session } = useSession();
  const { data, isPending } = useMetaCreditVisibility();
  const setVisibility = useSetMetaCreditVisibility();

  if (!metaEnabled) {
    return null;
  }

  const user = session?.user;
  const visibility = data?.visibility ?? "hidden";
  const preview = metaCreditPreview(visibility, { name: user?.name, riotId: user?.riotId });

  return (
    <SettingsSection
      title={m.profile_meta_credit_title()}
      description={m.profile_meta_credit_description()}
    >
      {isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <RadioGroup
          value={visibility}
          onValueChange={(next) =>
            setVisibility.mutate({ visibility: next as MetaCreditVisibility })
          }
          className="flex flex-col gap-3"
          aria-label={m.profile_meta_credit_title()}
        >
          {META_CREDIT_VISIBILITIES.map((option) => {
            const radioId = `meta-credit-${option}`;
            return (
              <div key={option} className="flex items-start gap-2">
                <RadioGroupItem
                  id={radioId}
                  value={option}
                  disabled={setVisibility.isPending}
                  className="mt-1"
                />
                <label htmlFor={radioId} className="cursor-pointer">
                  <span className="block">{metaCreditVisibilityLabels()[option]}</span>
                  <span className="text-muted-foreground block text-sm">
                    {metaCreditVisibilityHints()[option]}
                  </span>
                </label>
              </div>
            );
          })}
        </RadioGroup>
      )}

      <CreditPreview
        creditedAs={preview.creditedAs}
        usesDisplayNameFallback={preview.usesDisplayNameFallback}
        visibility={visibility}
      />
    </SettingsSection>
  );
}
