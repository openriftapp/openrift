import { imageUrl } from "@openrift/shared/image-url";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { siGithub } from "simple-icons";

import { Heading } from "@/components/heading";
import {
  PageTopBar,
  PageTopBarHeightContext,
  PageTopBarSticky,
  PageTopBarTitle,
  useMeasuredHeight,
} from "@/components/layout/page-top-bar";
import { TextLink } from "@/components/ui/text-link";
import { landingSummaryQueryOptions } from "@/features/marketing/lib/landing-summary-query";
import { landingThumbnailCards } from "@/features/marketing/lib/landing-thumbnails";
import { useSession } from "@/lib/auth-session";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { BoxVignette } from "./box-vignette";
import { CatalogVignette } from "./catalog-vignette";
import { ChapterDivider } from "./chapter-divider";
import { ChatVignette } from "./chat-vignette";
import { cornerClip } from "./clip-frame";
import { CollectionsVignette } from "./collections-vignette";
import { DecksVignette } from "./decks-vignette";
import { DesignerVignette } from "./designer-vignette";
import { DiscordVignette } from "./discord-vignette";
import { FeatureCard } from "./feature-card";
import {
  ActionArrow,
  FEATURE_ACTION_CLASS,
  FEATURE_HEADING_CLASS,
  FeatureSection,
  SectionRule,
} from "./feature-section";
import { featureChapters } from "./features-chapters";
import { FeaturesHero } from "./features-hero";
import { FeaturesChipNav, FeaturesRail } from "./features-nav";
import { GroupsVignette } from "./groups-vignette";
import { ImportVignette } from "./import-vignette";
import { ListsVignette } from "./lists-vignette";
import { LoansVignette } from "./loans-vignette";
import { PricesVignette } from "./prices-vignette";
import { PromosVignette } from "./promos-vignette";
import { Reveal } from "./reveal";
import { RulesVignette } from "./rules-vignette";
import { ScanVignette } from "./scan-vignette";
import { ShareVignette } from "./share-vignette";
import { StageVignette } from "./stage-vignette";
import { TestVignette } from "./test-vignette";
import { TierListVignette } from "./tier-list-vignette";
import { TournamentsVignette } from "./tournaments-vignette";
import { TrackerVignette } from "./tracker-vignette";
import {
  TradeArrivedVignette,
  TradeMatchVignette,
  TradeRequestVignette,
  TradeReservedVignette,
  TradeSettleVignette,
  tradedCard,
} from "./trade-flow-vignettes";
import { VariantsVignette } from "./variants-vignette";

const CTA_CUT = 12;

interface FullSectionDef {
  id: string;
  title: string;
  description: string;
  action: ReactNode;
  vignette: ReactNode;
  emphasis?: boolean;
  flip?: boolean;
  eyebrow?: string;
  compact?: boolean;
}

interface CardSectionDef {
  id: string;
  title: string;
  description: string;
  action: ReactNode;
  vignette?: ReactNode;
}

interface ChapterContent {
  chapterId: string;
  fulls: FullSectionDef[];
  cards: CardSectionDef[];
}

function ClosingBlock({ signedOut }: { signedOut: boolean }) {
  return (
    <Reveal>
      <section className="flex flex-col items-start gap-4 py-14 sm:py-20">
        <Heading level={1} as="h2" className={FEATURE_HEADING_CLASS}>
          {m.marketing_features_closing_title()}
        </Heading>
        <SectionRule />
        <p className="text-muted-foreground max-w-prose">{m.marketing_features_closing_body()}</p>
        <p className="text-muted-foreground max-w-prose">
          {m.marketing_features_closing_languages()}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/cards"
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring font-heading inline-flex h-11 items-center px-7 font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
            style={{ clipPath: cornerClip(CTA_CUT) }}
          >
            {m.collections_activity_browse_cards()}
          </Link>
          {signedOut && (
            <span
              className="bg-border-accent inline-block p-px"
              style={{ clipPath: cornerClip(CTA_CUT) }}
            >
              <Link
                to="/signup"
                search={{ redirect: undefined, email: undefined }}
                className="bg-background hover:bg-secondary focus-visible:ring-ring font-heading inline-flex h-11 items-center px-7 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                style={{ clipPath: cornerClip(CTA_CUT) }}
              >
                {m.card_detail_nudge_signup()}
              </Link>
            </span>
          )}
        </div>
        <TextLink
          href={SOCIAL_LINKS.githubRepo}
          target="_blank"
          rel="noreferrer"
          className={FEATURE_ACTION_CLASS}
        >
          <svg role="img" viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true">
            <path d={siGithub.path} />
          </svg>
          {m.marketing_features_closing_github()}
        </TextLink>
      </section>
    </Reveal>
  );
}

export function FeaturesPage() {
  const { data } = useQuery(landingSummaryQueryOptions);
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [topBarSlot, setTopBarSlot] = useState<HTMLDivElement | null>(null);
  const topBarHeight = useMeasuredHeight(topBarSlot);
  const thumbnailUrls = (data?.thumbnailIds ?? []).map((id) => imageUrl(id, "400w"));
  const legendUrls = (data?.legendThumbnailIds ?? []).map((id) => imageUrl(id, "400w"));
  const taggedThumbnails = (data?.thumbnails ?? []).map((thumb) => ({
    url: imageUrl(thumb.imageId, "400w"),
    rarity: thumb.rarity,
    domains: thumb.domains,
  }));
  const thumbnailCards = landingThumbnailCards(data?.thumbnails);
  const tradedFlowCard = tradedCard(thumbnailCards.slice(15));
  const tradeStripUrls = thumbnailUrls.slice(16, 22);

  useEffect(() => {
    // Not under `vite dev`: preloadRoute pulls the whole card-browser module
    // graph one request at a time there. MODE, not DEV: vitest sets DEV too.
    if (typeof requestIdleCallback === "undefined" || import.meta.env.MODE === "development") {
      return;
    }
    const handle = requestIdleCallback(() => {
      void router.preloadRoute({ to: "/cards" });
    });
    return () => cancelIdleCallback(handle);
  }, [router]);

  function sectionAction(label: string, to: string): ReactNode {
    return (
      <TextLink className={FEATURE_ACTION_CLASS} render={<Link to={to} />}>
        {label}
        <ActionArrow />
      </TextLink>
    );
  }

  const chapters: ChapterContent[] = [
    {
      chapterId: "collect",
      fulls: [
        {
          id: "catalog",
          title: m.marketing_features_catalog_title(),
          description: m.marketing_features_catalog_description(),
          action: sectionAction(m.marketing_features_action_open_catalog(), "/cards"),
          vignette: <CatalogVignette thumbnails={taggedThumbnails} cardCount={data?.cardCount} />,
        },
        {
          id: "import",
          title: m.marketing_features_import_title(),
          description: m.marketing_features_import_description(),
          action: sectionAction(m.marketing_features_action_import_now(), "/collections/import"),
          vignette: <ImportVignette />,
          flip: true,
        },
        {
          id: "scan",
          title: m.marketing_features_scan_title(),
          description: m.marketing_features_scan_description(),
          action: sectionAction(m.marketing_features_action_open_scanner(), "/scan"),
          vignette: <ScanVignette cards={thumbnailCards.slice(8, 12)} />,
          emphasis: true,
        },
        {
          id: "collections",
          title: m.marketing_features_collections_title(),
          description: m.marketing_features_collections_description(),
          action: sectionAction(m.marketing_features_action_open_collections(), "/collections"),
          vignette: <CollectionsVignette thumbnailUrls={thumbnailUrls.slice(4, 7)} />,
          flip: true,
        },
        {
          id: "lists",
          title: m.marketing_features_lists_title(),
          description: m.marketing_features_lists_description(),
          action: sectionAction(m.marketing_features_action_open_your_lists(), "/collections"),
          vignette: <ListsVignette />,
        },
        {
          id: "prices",
          title: m.marketing_features_prices_title(),
          description: m.marketing_features_prices_description(),
          action: sectionAction(m.marketing_features_action_open_catalog(), "/cards"),
          vignette: <PricesVignette />,
          flip: true,
        },
      ],
      cards: [
        {
          id: "promos",
          title: m.marketing_features_promos_title(),
          description: m.marketing_features_promos_description(),
          action: sectionAction(m.marketing_features_action_see_all_promos(), "/promos"),
          vignette: <PromosVignette sections={data?.promoSections} />,
        },
      ],
    },
    {
      chapterId: "build",
      fulls: [
        {
          id: "decks",
          title: m.marketing_features_decks_title(),
          description: m.marketing_features_decks_description(),
          action: sectionAction(m.marketing_features_action_build_a_deck(), "/decks"),
          vignette: <DecksVignette />,
        },
      ],
      cards: [
        {
          id: "variants",
          title: m.marketing_features_variants_title(),
          description: m.marketing_features_variants_description(),
          action: sectionAction(m.marketing_features_action_open_your_decks(), "/decks"),
          vignette: <VariantsVignette />,
        },
        {
          id: "test",
          title: m.marketing_features_test_title(),
          description: m.marketing_features_test_description(),
          action: sectionAction(m.marketing_features_action_open_your_decks(), "/decks"),
          vignette: <TestVignette thumbnailUrls={thumbnailUrls.slice(18, 23)} />,
        },
        {
          id: "box",
          title: m.marketing_features_box_title(),
          description: m.marketing_features_box_description(),
          action: sectionAction(m.marketing_features_action_open_your_decks(), "/decks"),
          vignette: <BoxVignette />,
        },
      ],
    },
    {
      chapterId: "play",
      fulls: [
        {
          id: "tournaments",
          title: m.marketing_features_tournaments_title(),
          description: m.marketing_features_tournaments_description(),
          action: sectionAction(m.marketing_features_action_open_tournaments(), "/tournaments"),
          vignette: <TournamentsVignette />,
          flip: true,
        },
      ],
      cards: [
        {
          id: "rules",
          title: m.marketing_features_rules_title(),
          description: m.marketing_features_rules_description(),
          action: sectionAction(m.marketing_features_action_open_rules(), "/rules"),
          vignette: <RulesVignette />,
        },
        {
          id: "tracker",
          title: m.marketing_features_tracker_title(),
          description: m.marketing_features_tracker_description(),
          action: sectionAction(m.marketing_features_action_open_tracker(), "/match-tracker"),
          vignette: <TrackerVignette thumbnailUrls={thumbnailUrls.slice(12, 14)} />,
        },
      ],
    },
    {
      chapterId: "community",
      fulls: [
        {
          id: "groups",
          title: m.marketing_features_groups_title(),
          description: m.marketing_features_groups_description(),
          action: sectionAction(m.marketing_features_action_open_your_groups(), "/groups"),
          vignette: <GroupsVignette thumbnailUrls={tradeStripUrls} />,
        },
        {
          id: "trade-match",
          eyebrow: m.marketing_features_trade_eyebrow_1(),
          compact: true,
          title: m.marketing_features_trade_match_title(),
          description: m.marketing_features_trade_match_description(),
          action: sectionAction(m.marketing_features_action_open_your_groups(), "/groups"),
          vignette: <TradeMatchVignette thumbnailUrls={tradeStripUrls} />,
          flip: true,
        },
        {
          id: "trade-request",
          eyebrow: m.marketing_features_trade_eyebrow_2(),
          compact: true,
          title: m.marketing_features_trade_request_title(),
          description: m.marketing_features_trade_request_description(),
          action: sectionAction(m.marketing_features_action_open_your_trades(), "/trades"),
          vignette: <TradeRequestVignette card={tradedFlowCard} />,
        },
        {
          id: "trade-reserved",
          eyebrow: m.marketing_features_trade_eyebrow_3(),
          compact: true,
          title: m.marketing_features_trade_reserved_title(),
          description: m.marketing_features_trade_reserved_description(),
          action: sectionAction(m.marketing_features_action_open_your_trades(), "/trades"),
          vignette: <TradeReservedVignette card={tradedFlowCard} />,
          flip: true,
        },
        {
          id: "trade-settle",
          eyebrow: m.marketing_features_trade_eyebrow_4(),
          compact: true,
          title: m.marketing_features_trade_settle_title(),
          description: m.marketing_features_trade_settle_description(),
          action: sectionAction(m.marketing_features_action_open_your_trades(), "/trades"),
          vignette: <TradeSettleVignette />,
        },
        {
          id: "trade-arrived",
          eyebrow: m.marketing_features_trade_eyebrow_5(),
          compact: true,
          title: m.marketing_features_trade_arrived_title(),
          description: m.marketing_features_trade_arrived_description(),
          action: sectionAction(
            m.marketing_features_action_open_your_collections(),
            "/collections",
          ),
          vignette: <TradeArrivedVignette card={tradedFlowCard} />,
          flip: true,
        },
      ],
      cards: [
        {
          id: "loans",
          title: m.marketing_features_loans_title(),
          description: m.marketing_features_loans_description(),
          action: sectionAction(m.marketing_features_action_open_your_loans(), "/loans"),
          vignette: <LoansVignette />,
        },
        {
          id: "share",
          title: m.marketing_features_share_title(),
          description: m.marketing_features_share_description(),
          action: sectionAction(m.marketing_features_action_open_your_decks(), "/decks"),
          vignette: <ShareVignette />,
        },
        {
          id: "discord",
          title: m.marketing_features_discord_title(),
          description: m.marketing_features_discord_description(),
          action: (
            <TextLink
              href={SOCIAL_LINKS.discordBotInvite}
              target="_blank"
              rel="noreferrer"
              className={FEATURE_ACTION_CLASS}
            >
              {m.marketing_features_action_add_bot()}
              <ActionArrow />
            </TextLink>
          ),
          vignette: <DiscordVignette card={thumbnailCards[14]} />,
        },
      ],
    },
    {
      chapterId: "create",
      fulls: [
        {
          id: "stage",
          title: m.marketing_features_stage_title(),
          description: m.marketing_features_stage_description(),
          action: sectionAction(m.marketing_features_action_open_stage(), "/stage"),
          vignette: <StageVignette thumbnailUrls={thumbnailUrls.slice(23, 24)} />,
        },
        {
          id: "tier-lists",
          title: m.marketing_features_tier_lists_title(),
          description: m.marketing_features_tier_lists_description(),
          action: sectionAction(m.marketing_features_action_open_tier_lists(), "/tier-lists"),
          vignette: <TierListVignette legendUrls={legendUrls} />,
          flip: true,
        },
      ],
      cards: [
        {
          id: "chat-lookups",
          title: m.marketing_features_chat_title(),
          description: m.marketing_features_chat_description(),
          action: (
            <TextLink
              className={FEATURE_ACTION_CLASS}
              render={<Link to="/help/$slug" params={{ slug: "chat-commands" }} />}
            >
              {m.marketing_features_action_setup_command()}
              <ActionArrow />
            </TextLink>
          ),
          vignette: <ChatVignette />,
        },
        {
          id: "designer",
          title: m.marketing_features_designer_title(),
          description: m.marketing_features_designer_description(),
          action: sectionAction(m.marketing_features_action_open_designer(), "/card-designer"),
          vignette: <DesignerVignette />,
        },
      ],
    },
  ];

  const chapterList = featureChapters();

  return (
    <PageTopBarHeightContext value={topBarHeight}>
      <PageTopBarSticky width="capped" ref={setTopBarSlot}>
        <PageTopBar>
          <PageTopBarTitle>{m.footer_features()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>
      <FeaturesChipNav chapters={chapterList} />
      <FeaturesRail chapters={chapterList} />
      <FeaturesHero chapters={chapterList} thumbnailUrls={thumbnailUrls.slice(0, 5)} />
      <div className={cn(PAGE_WIDTH.capped, PAGE_PADDING_NO_TOP)}>
        {chapters.map((content) => {
          const chapter = chapterList.find((entry) => entry.id === content.chapterId);
          if (!chapter) {
            return null;
          }
          return (
            <div key={chapter.id}>
              <ChapterDivider chapter={chapter} />
              {content.fulls.map((section) => (
                <FeatureSection key={section.id} {...section} />
              ))}
              {content.cards.length > 0 && (
                <div className="grid gap-6 pt-2 pb-12 sm:grid-cols-2 sm:gap-8 sm:pb-16">
                  {content.cards.map((card) => (
                    <FeatureCard key={card.id} {...card} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <ClosingBlock signedOut={!isPending && !session?.user} />
      </div>
    </PageTopBarHeightContext>
  );
}
