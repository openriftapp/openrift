import { Link } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";

import { Heading } from "@/components/heading";
import { OrnamentRule } from "@/components/ui/ornament";
import { TextLink } from "@/components/ui/text-link";
import { ClipFrame } from "@/features/marketing/components/clip-frame";
import { CHAPTER_TILE_CLASS, ChapterTileBody } from "@/features/marketing/components/features-hero";
import { Reveal } from "@/features/marketing/components/reveal";
import { chapterAnchor, featureChapters } from "@/features/marketing/lib/features-chapters";
import { useFeatureEnabled } from "@/hooks/use-feature-flags";
import { m } from "@/paraglide/messages.js";

import { ActionArrow, FEATURE_ACTION_CLASS, SectionRule } from "./feature-section";
import { HeroCtas } from "./hero-ctas";

function switchPoints(): string[] {
  return [
    m.marketing_closing_switch_point_free(),
    m.marketing_closing_switch_point_printings(),
    m.marketing_closing_switch_point_languages(),
  ];
}

export function LandingClosing() {
  const scannerEnabled = useFeatureEnabled("scanner");
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 pb-20 md:gap-16 md:pb-28">
      <Reveal>
        <ClipFrame className="flex flex-col gap-5 p-8 md:p-12">
          <Heading level={1} as="h2">
            {m.marketing_closing_switch_title()}
          </Heading>
          <SectionRule />
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            {m.marketing_closing_switch_body()}
          </p>
          <ul className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-8">
            {switchPoints().map((point) => (
              <li key={point} className="flex items-center gap-2">
                <CheckIcon aria-hidden="true" className="text-primary size-4 shrink-0" />
                {point}
              </li>
            ))}
          </ul>
          <TextLink className={FEATURE_ACTION_CLASS} render={<Link to="/collections/import" />}>
            {m.collections_intro_import_link()}
            <ActionArrow />
          </TextLink>
        </ClipFrame>
      </Reveal>

      <Reveal className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          <Heading level={1} as="h2">
            {m.marketing_closing_more_title()}
          </Heading>
          <SectionRule />
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            {m.marketing_closing_more_body()}
          </p>
        </div>
        <nav
          aria-label={m.marketing_closing_chapters_nav_label()}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
        >
          {featureChapters({ scanner: scannerEnabled }).map((chapter) => (
            <ClipFrame key={chapter.id} tone="border" cut={12} className="h-full p-0">
              <Link to="/features" hash={chapterAnchor(chapter.id)} className={CHAPTER_TILE_CLASS}>
                <ChapterTileBody chapter={chapter} />
              </Link>
            </ClipFrame>
          ))}
        </nav>
        <TextLink className={FEATURE_ACTION_CLASS} render={<Link to="/features" />}>
          {m.marketing_closing_see_everything()}
          <ActionArrow />
        </TextLink>
      </Reveal>

      <Reveal className="flex flex-col items-center gap-4 text-center">
        <Heading level={1} as="h2" className="md:text-4xl">
          {m.marketing_closing_ready_title()}
        </Heading>
        <OrnamentRule className="w-56" />
        <HeroCtas source="home-closing" />
      </Reveal>
    </section>
  );
}
