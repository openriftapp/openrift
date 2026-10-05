import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import { LanguagesIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SiteBannerStrip } from "@/components/layout/site-banner-strip";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { applyDisplayLocale } from "@/features/account/hooks/use-preferences-sync";
import type { LocaleBannerDecision } from "@/features/account/lib/locale-banner";
import { useLocaleBannerStore } from "@/features/account/stores/locale-banner-store";
import { useUserId } from "@/hooks/use-session";
import { DISPLAY_LOCALE_LABELS } from "@/lib/display-locale";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";

// Stays English: whoever wants it may not read the active locale.
const SWITCH_TO_ENGLISH = "Switch to English";

export function LocaleBanner({
  decision,
}: {
  decision: Exclude<LocaleBannerDecision, { kind: "hide" }>;
}) {
  const dismiss = useLocaleBannerStore((state) => state.dismiss);
  const userId = useUserId();
  const [pending, setPending] = useState(false);

  const switchTo = async (locale: Locale) => {
    setPending(true);
    if (!(await applyDisplayLocale(locale, { persist: userId !== null }))) {
      setPending(false);
      toast.error(m.profile_display_locale_error());
    }
  };

  const language = DISPLAY_LOCALE_LABELS[decision.locale];

  return (
    <SiteBannerStrip
      icon={<LanguagesIcon />}
      dismissLabel={m.locale_banner_dismiss()}
      onDismiss={dismiss}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
        <p className="min-w-0 lg:flex-1">
          {decision.kind === "notice" ? (
            <ParaglideMessage
              message={m.locale_banner_notice}
              inputs={{ language }}
              markup={{
                link: ({ children }) => (
                  <TextLink href={SOCIAL_LINKS.discordInvite} target="_blank" rel="noreferrer">
                    {children}
                  </TextLink>
                ),
              }}
            />
          ) : (
            m.locale_banner_suggest({ language })
          )}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {decision.kind === "notice" && userId !== null && (
            <TextLink render={<Link to="/profile" hash="display" />}>
              {m.locale_banner_settings_link()}
            </TextLink>
          )}
          {decision.kind === "notice" ? (
            <Button
              variant="outline"
              size="xs"
              lang="en"
              disabled={pending}
              onClick={() => void switchTo("en")}
            >
              {SWITCH_TO_ENGLISH}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="xs"
              lang={decision.locale}
              disabled={pending}
              onClick={() => void switchTo(decision.locale)}
            >
              {language}
            </Button>
          )}
        </div>
      </div>
    </SiteBannerStrip>
  );
}
