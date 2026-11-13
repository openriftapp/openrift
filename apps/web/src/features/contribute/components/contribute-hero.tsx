import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, CameraIcon } from "lucide-react";
import type { ReactNode } from "react";

import { CardFanOutline } from "@/components/card-fan";
import { PAGE_HERO_EYEBROW_CLASS, PageHero } from "@/components/layout/page-hero";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function ContributeHero({
  title,
  lead,
  action,
  back = false,
}: {
  title: string;
  lead: ReactNode;
  action?: ReactNode;
  back?: boolean;
}) {
  return (
    <PageHero
      eyebrow={
        back ? (
          <Link
            to="/contribute"
            className={cn(
              PAGE_HERO_EYEBROW_CLASS,
              "hover:text-primary/80 inline-flex items-center gap-1.5",
            )}
          >
            <ArrowLeftIcon className="size-3.5" />
            {m.contribute_hero_eyebrow()}
          </Link>
        ) : (
          m.contribute_hero_eyebrow()
        )
      }
      title={title}
      lead={lead}
      aside={<HeroCardFan />}
      compactTitle
    >
      {action}
    </PageHero>
  );
}

function HeroCardFan() {
  return (
    <div className="relative hidden h-56 w-72 shrink-0 md:block" aria-hidden="true">
      <CardFanOutline
        size="lg"
        anchor="flush"
        icon={CameraIcon}
        caption={m.contribute_hero_photo_placeholder()}
      />
    </div>
  );
}
