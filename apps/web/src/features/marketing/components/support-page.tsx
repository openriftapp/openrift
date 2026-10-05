import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { enumLabel } from "@openrift/shared/enum-label";
import { ExternalLinkIcon, HeartIcon } from "lucide-react";
import { Suspense } from "react";
import { siDiscord, siGithub, siGithubsponsors, siKofi, siX } from "simple-icons";

import { CopyTextButton } from "@/components/copy-text-button";
import { Heading } from "@/components/heading";
import { PageHero } from "@/components/layout/page-hero";
import { MarketplaceLink } from "@/components/marketplace-link";
import { BrandGlyph } from "@/components/ui/brand-glyph";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import { CardText } from "@/features/cards/components/card-text";
import { ShareButton } from "@/features/marketing/components/share-button";
import { useEnumOrders } from "@/hooks/use-enums";
import { getFilterIconPath } from "@/lib/icons";
import { getSiteUrl } from "@/lib/site-config";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const GITHUB_SPONSORS_URL = "https://github.com/sponsors/eikowagenknecht";
const KOFI_URL = "https://ko-fi.com/eikowagenknecht";

interface SupportTier {
  rarity: string;
  price: string;
  effect: string;
}

function tiers(): SupportTier[] {
  return [
    { rarity: "common", price: "$1/mo", effect: m.marketing_support_tier_common_effect() },
    { rarity: "uncommon", price: "$3/mo", effect: m.marketing_support_tier_uncommon_effect() },
    { rarity: "rare", price: "$5/mo", effect: m.marketing_support_tier_rare_effect() },
    { rarity: "epic", price: "$10/mo", effect: m.marketing_support_tier_epic_effect() },
    { rarity: "showcase", price: "$25/mo", effect: m.marketing_support_tier_showcase_effect() },
  ];
}

function TierCard({ tier, label }: { tier: SupportTier; label: string }) {
  const rarityIcon = getFilterIconPath("rarities", tier.rarity, { size: "full" });
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {rarityIcon && (
            <img src={rarityIcon} alt={label} width={28} height={28} className="size-5" />
          )}
          <span>{label}</span>
          <span className="text-muted-foreground ml-auto text-sm font-normal">{tier.price}</span>
        </CardTitle>
        <CardDescription className="italic">
          <Suspense fallback={tier.effect}>
            <CardText text={tier.effect} interactive={false} />
          </Suspense>
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function SupportPage() {
  const siteUrl = getSiteUrl();
  const shareText = m.marketing_support_share_text({ url: siteUrl });
  const tweetText = encodeURIComponent(shareText);
  const { labels } = useEnumOrders();

  return (
    <>
      <PageHero title={m.marketing_support_title()} lead={m.marketing_support_intro_p1()} />
      <div className={cn(PAGE_WIDTH.capped, "flex flex-1 flex-col pt-3", PAGE_PADDING_NO_TOP)}>
        <div className="text-muted-foreground mb-10 space-y-3 leading-relaxed">
          <p>{m.marketing_support_intro_p2()}</p>
          <p>{m.marketing_support_intro_p3()}</p>
        </div>

        <section className="mb-10">
          <Heading className="mb-1">{m.marketing_support_fuel_title()}</Heading>
          <p className="text-muted-foreground mb-4">
            {m.marketing_support_fuel_lead()}{" "}
            <span className="italic">{m.marketing_support_fuel_lead_italic()}</span>
          </p>
          <div className="space-y-3">
            {tiers().map((tier) => (
              <TierCard
                key={tier.rarity}
                tier={tier}
                label={enumLabel(labels.rarities, tier.rarity)}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={KOFI_URL}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants(), "gap-2")}
            >
              <BrandGlyph icon={siKofi} fallback={ExternalLinkIcon} />
              {m.marketing_support_kofi()}
            </a>
            <a
              href={GITHUB_SPONSORS_URL}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
            >
              <BrandGlyph icon={siGithubsponsors} fallback={ExternalLinkIcon} />
              {m.marketing_support_sponsor()}
            </a>
          </div>
          <p className="text-muted-foreground mt-2">{m.marketing_support_recurring_note()}</p>
        </section>

        <section className="mb-10">
          <Heading className="mb-1">{m.marketing_support_widen_title()}</Heading>
          <p className="text-muted-foreground mb-4">{m.marketing_support_widen_lead()}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ShareButton
              label={m.marketing_support_star_github()}
              icon={<BrandGlyph icon={siGithub} fallback={ExternalLinkIcon} />}
              href={SOCIAL_LINKS.githubRepo}
            />
            <ShareButton
              label={m.marketing_support_share_x()}
              icon={<BrandGlyph icon={siX} fallback={ExternalLinkIcon} />}
              href={`https://x.com/intent/tweet?text=${tweetText}`}
            />
            <CopyTextButton
              label={m.marketing_support_share_copy()}
              value={shareText}
              normalizeLineBreaks={false}
              size="lg"
              className="w-full gap-2"
            />
          </div>
        </section>

        <section className="mb-10">
          <Heading className="mb-1">{m.marketing_support_shop_title()}</Heading>
          <p className="text-muted-foreground">
            <ParaglideMessage
              message={m.marketing_support_shop}
              markup={{
                link: ({ children }) => (
                  <TextLink
                    render={
                      <MarketplaceLink
                        marketplace="tcgplayer"
                        href="https://partner.tcgplayer.com/openrift?u=https%3A%2F%2Fwww.tcgplayer.com%2F"
                      />
                    }
                  >
                    {children}
                  </TextLink>
                ),
                link2: ({ children }) => (
                  <TextLink
                    render={
                      <MarketplaceLink
                        marketplace="cardtrader"
                        href="https://www.cardtrader.com/?share_code=openrift"
                      />
                    }
                  >
                    {children}
                  </TextLink>
                ),
              }}
            />
          </p>
        </section>

        <section className="mb-10">
          <Heading className="mb-1">{m.marketing_support_party_title()}</Heading>
          <p className="text-muted-foreground mb-4">{m.marketing_support_party_lead()}</p>
          <a
            href={SOCIAL_LINKS.discordInvite}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants(), "gap-2 bg-[#5865F2] text-white [a]:hover:bg-[#4752C4]")}
          >
            <BrandGlyph icon={siDiscord} fallback={ExternalLinkIcon} />
            {m.marketing_support_join_discord()}
          </a>
        </section>

        <section className="mb-10">
          <Heading className="mb-1">{m.marketing_support_gear_title()}</Heading>
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground font-medium italic">
              {m.marketing_support_gear_soon()}
            </p>
            <p className="text-muted-foreground">{m.marketing_support_gear_body()}</p>
            <p className="text-muted-foreground italic">
              <Suspense fallback={m.marketing_support_gear_mug()}>
                <CardText text={m.marketing_support_gear_mug()} interactive={false} />
              </Suspense>
            </p>
          </div>
        </section>

        <section className="text-muted-foreground mt-auto max-w-prose">
          <p>{m.marketing_support_footer_p1()}</p>
          <p className="mt-2 font-medium">{m.marketing_support_footer_p2()}</p>
          <HeartIcon className="text-primary/40 mx-auto mt-4 size-5" />
        </section>
      </div>
    </>
  );
}
