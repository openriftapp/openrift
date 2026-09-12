import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, CheckIcon } from "lucide-react";

import { Heading } from "@/components/heading";
import { OrnamentRule } from "@/components/ui/ornament";
import { ClipFrame } from "@/features/marketing/components/clip-frame";
import { chapterAnchor, featureChapters } from "@/features/marketing/components/features-chapters";
import { CHAPTER_TILE_CLASS, ChapterTileBody } from "@/features/marketing/components/features-hero";
import { Reveal } from "@/features/marketing/components/reveal";
import { m } from "@/paraglide/messages.js";

import { HeroCtas } from "./hero-ctas";

function switchPoints(): string[] {
  return [m.marketing_closing_switch_point_free(), m.marketing_closing_switch_point_printings()];
}

export function LandingClosing() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 pb-20 md:gap-16 md:pb-28">
      <Reveal>
        <ClipFrame className="flex flex-col gap-5 p-8 md:p-12">
          <Heading level={1} as="h2">
            {m.marketing_closing_switch_title()}
          </Heading>
          <OrnamentRule className="w-40" />
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
          <Link
            to="/collections/import"
            className="text-primary group flex items-center gap-1.5 text-sm font-medium"
          >
            {m.collections_intro_import_link()}
            <ArrowRightIcon
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        </ClipFrame>
      </Reveal>

      <Reveal className="flex flex-col gap-5">
        <div className="flex flex-col gap-4">
          <Heading level={1} as="h2">
            {m.marketing_closing_more_title()}
          </Heading>
          <OrnamentRule className="w-40" />
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            {m.marketing_closing_more_body()}
          </p>
        </div>
        <nav
          aria-label={m.marketing_closing_chapters_nav_label()}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
        >
          {featureChapters().map((chapter) => (
            <ClipFrame key={chapter.id} tone="border" cut={12} className="h-full p-0">
              <Link to="/features" hash={chapterAnchor(chapter.id)} className={CHAPTER_TILE_CLASS}>
                <ChapterTileBody chapter={chapter} />
              </Link>
            </ClipFrame>
          ))}
        </nav>
        <Link
          to="/features"
          className="text-primary group flex items-center gap-1.5 text-sm font-medium"
        >
          {m.marketing_closing_see_everything()}
          <ArrowRightIcon
            aria-hidden="true"
            className="size-4 transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </Reveal>

      <Reveal className="flex flex-col items-center gap-4 text-center">
        <Heading level={1} as="h2" className="md:text-4xl">
          {m.marketing_closing_ready_title()}
        </Heading>
        <OrnamentRule className="w-56" />
        <HeroCtas />
      </Reveal>
    </section>
  );
}
