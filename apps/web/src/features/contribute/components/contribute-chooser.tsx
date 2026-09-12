import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ChevronRightIcon,
  ImagePlusIcon,
  LayersIcon,
  PencilLineIcon,
  PlusIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { Heading } from "@/components/heading";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { CardLink } from "@/components/ui/card-link";
import { ContributeHero } from "@/features/contribute/components/contribute-hero";
import { MyMissingImagesSection } from "@/features/contribute/components/my-missing-images-section";
import { YourSubmissionsCard } from "@/features/contribute/components/your-submissions-card";
import { cornerClip } from "@/features/marketing/components/clip-frame";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const CTA_CLIP = cornerClip(12);

function steps(): { title: string; description: string }[] {
  return [
    { title: m.contribute_step_send_title(), description: m.contribute_step_send_desc() },
    { title: m.contribute_step_review_title(), description: m.contribute_step_review_desc() },
    { title: m.contribute_step_live_title(), description: m.contribute_step_live_desc() },
  ];
}

export function ContributeChooser() {
  return (
    <div className="flex flex-col gap-8">
      <ContributeHero
        title={m.contribute_chooser_hero_title()}
        lead={m.contribute_chooser_hero_lead()}
        action={
          <Link
            to="/contribute/image"
            className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring font-heading mt-2 inline-flex h-11 items-center px-7 font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
            style={{ clipPath: CTA_CLIP }}
          >
            {m.contribute_add_missing_image()}
          </Link>
        }
      />

      <div className={cn(PAGE_WIDTH.capped, PAGE_PADDING_NO_TOP, "flex flex-col gap-8")}>
        <MyMissingImagesSection layout="tiles" />

        <section className="flex flex-col gap-4">
          <Heading level={2}>{m.contribute_chooser_ways_title()}</Heading>
          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceTile
              to="/contribute/card"
              icon={PlusIcon}
              title={m.contribute_choice_card_title()}
              description={m.contribute_choice_card_desc()}
              needs={m.contribute_choice_card_needs()}
            />
            <ChoiceTile
              to="/contribute/printing"
              icon={LayersIcon}
              title={m.contribute_choice_printing_title()}
              description={m.contribute_choice_printing_desc()}
              needs={m.contribute_choice_printing_needs()}
            />
            <ChoiceTile
              to="/contribute/image"
              icon={ImagePlusIcon}
              title={m.contribute_add_missing_image()}
              description={m.contribute_choice_image_desc()}
              needs={m.contribute_choice_image_needs()}
            />
            <ChoiceTile
              to="/contribute/fix"
              icon={PencilLineIcon}
              title={m.contribute_choice_fix_title()}
              description={m.contribute_choice_fix_desc()}
              needs={m.contribute_choice_fix_needs()}
            />
          </div>
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <Heading level={2}>{m.contribute_chooser_next_title()}</Heading>
            <ol className="flex flex-col gap-3">
              {steps().map((step, index) => (
                <li key={step.title} className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground font-heading flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                    {index + 1}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{step.title}</span>
                    <span className="text-muted-foreground text-sm">{step.description}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <YourSubmissionsCard className="lg:mt-10" />
        </section>
      </div>
    </div>
  );
}

function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="bg-muted text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
      <Icon className="size-5" />
    </span>
  );
}

function ChoiceTile({
  to,
  icon,
  title,
  description,
  needs,
}: {
  to: "/contribute/card" | "/contribute/printing" | "/contribute/image" | "/contribute/fix";
  icon: LucideIcon;
  title: string;
  description: string;
  needs: ReactNode;
}) {
  return (
    <CardLink render={<Link to={to} />}>
      <CardContent className="flex gap-4">
        <IconTile icon={icon} />
        <div className="flex flex-1 flex-col gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
          <span className="text-muted-foreground mt-1.5 flex items-center gap-1.5 text-xs">
            <Badge variant="secondary">{m.contribute_chooser_needs()}</Badge>
            {needs}
          </span>
        </div>
        <ChevronRightIcon className="text-muted-foreground size-4 self-center" />
      </CardContent>
    </CardLink>
  );
}
