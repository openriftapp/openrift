import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import { LanguagesIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/text-link";
import { applyDisplayLocale } from "@/features/account/hooks/use-preferences-sync";
import { localeBannerDecision } from "@/features/account/lib/locale-banner";
import { useLocaleBannerStore } from "@/features/account/stores/locale-banner-store";
import { useHydrated } from "@/hooks/use-hydrated";
import { useUserId } from "@/lib/auth-session";
import { DISPLAY_LOCALE_LABELS } from "@/lib/display-locale";
import { hasLocaleCookie } from "@/lib/locale-entry";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { cn, CONTAINER_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import type { Locale } from "@/paraglide/runtime.js";
import { getLocale } from "@/paraglide/runtime.js";

// Stays English: whoever wants it may not read the active locale.
const SWITCH_TO_ENGLISH = "Switch to English";

export function LocaleBanner() {
  const hydrated = useHydrated();
  const dismissed = useLocaleBannerStore((state) => state.dismissed);
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

  const decision = hydrated
    ? localeBannerDecision({
        active: getLocale(),
        hasCookie: hasLocaleCookie(document.cookie),
        browserTags: navigator.languages ?? [],
        dismissed,
      })
    : ({ kind: "hide" } as const);

  if (decision.kind === "hide") {
    return null;
  }
  const language = DISPLAY_LOCALE_LABELS[decision.locale];

  return (
    <div className="bg-primary/10 border-primary/20 border-b">
      <div
        className={cn(
          CONTAINER_WIDTH,
          "flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm",
        )}
      >
        <LanguagesIcon className="text-primary size-4 shrink-0" />
        <p className="min-w-0 flex-1">
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
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={m.locale_banner_dismiss()}
          onClick={dismiss}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
