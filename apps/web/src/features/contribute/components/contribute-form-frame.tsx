import { useCanGoBack, useRouter } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";

import {
  PageDescription,
  PageTopBar,
  PageTopBarBack,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { cn, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface ContributeFormFrameProps {
  title: string;
  lead?: ReactNode;
  back?: ReactNode;
  children: ReactNode;
}

export function ContributeFormFrame({ title, lead, back, children }: ContributeFormFrameProps) {
  return (
    <>
      <PageTopBarSticky width="capped">
        <PageTopBar>
          {back ?? <PageTopBarBack to="/contribute" aria-label={m.contribute_back()} />}
          <PageTopBarTitle>{title}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.capped, "px-safe flex flex-col gap-6 pt-3 pb-12")}>
        {lead ? <PageDescription>{lead}</PageDescription> : null}
        {children}
      </div>
    </>
  );
}

/** Goes back in history when there is somewhere to go, else to the card's page. */
export function ContributeBackToCard({ cardSlug }: { cardSlug: string }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (canGoBack) {
      event.preventDefault();
      router.history.back();
    }
  };

  return (
    <PageTopBarBack
      to="/cards/$cardSlug/{-$printingSlug}"
      params={{ cardSlug }}
      aria-label={m.contribute_back()}
      onClick={handleClick}
    />
  );
}
