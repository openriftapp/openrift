import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import { siDiscord, siGithub } from "simple-icons";

import { BrandGlyph } from "@/components/ui/brand-glyph";
import { OrnamentRule } from "@/components/ui/ornament";
import { useFeatureEnabled } from "@/hooks/use-feature-flags";
import { COMMIT_HASH } from "@/lib/env";
import { isOfficialInstance, OFFICIAL_HOST } from "@/lib/official-host";
import { getOperatorLinks } from "@/lib/operator-links";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function Footer({ className }: { className?: string }) {
  const developersEnabled = useFeatureEnabled("developers");
  const official = isOfficialInstance();
  const operatorLinks = getOperatorLinks();
  return (
    <footer className={cn("text-2xs text-muted-foreground/60 mx-auto text-center", className)}>
      <OrnamentRule className="mx-auto mb-3 w-56" />
      <p>
        <Link to="/features" className="hover:text-muted-foreground">
          {m.footer_features()}
        </Link>
        <span aria-hidden="true"> · </span>
        {official && (
          <>
            <Link to="/legal-notice" className="hover:text-muted-foreground">
              {m.footer_legal_notice()}
            </Link>
            <span aria-hidden="true"> · </span>
            <Link to="/privacy-policy" className="hover:text-muted-foreground">
              {m.footer_privacy_policy()}
            </Link>
            <span aria-hidden="true"> · </span>
          </>
        )}
        {!official && operatorLinks.legalNoticeUrl && (
          <>
            <a href={operatorLinks.legalNoticeUrl} className="hover:text-muted-foreground">
              {m.footer_legal_notice()}
            </a>
            <span aria-hidden="true"> · </span>
          </>
        )}
        {!official && operatorLinks.privacyPolicyUrl && (
          <>
            <a href={operatorLinks.privacyPolicyUrl} className="hover:text-muted-foreground">
              {m.footer_privacy_policy()}
            </a>
            <span aria-hidden="true"> · </span>
          </>
        )}
        <Link to="/support" className="hover:text-muted-foreground">
          {m.footer_support_us()}
        </Link>
        <span aria-hidden="true"> · </span>
        {developersEnabled && (
          <>
            <Link to="/developers" className="hover:text-muted-foreground">
              {m.footer_developers()}
            </Link>
            <span aria-hidden="true"> · </span>
          </>
        )}
        <a
          href={SOCIAL_LINKS.discordInvite}
          target="_blank"
          rel="noreferrer"
          className="hover:text-muted-foreground"
        >
          <BrandGlyph
            icon={siDiscord}
            fallback={ExternalLinkIcon}
            className="mr-0.5 mb-px inline size-2.5 align-middle"
          />
          Discord
        </a>
        <span aria-hidden="true"> · </span>
        <a
          href={SOCIAL_LINKS.githubCommits}
          target="_blank"
          rel="noreferrer"
          className="hover:text-muted-foreground"
        >
          <BrandGlyph
            icon={siGithub}
            fallback={ExternalLinkIcon}
            className="mr-0.5 mb-px inline size-2.5 align-middle"
          />
          {COMMIT_HASH}
        </a>
      </p>
      {!official && (
        <p className="mt-1">
          <ParaglideMessage
            message={m.footer_unofficial_instance}
            inputs={{}}
            markup={{
              link: ({ children }) => (
                <a
                  href={`https://${OFFICIAL_HOST}`}
                  rel="noreferrer"
                  className="hover:text-muted-foreground underline"
                >
                  {children}
                </a>
              ),
            }}
          />
        </p>
      )}
      <p className="mt-1">{m.footer_riot_disclaimer()}</p>
    </footer>
  );
}
