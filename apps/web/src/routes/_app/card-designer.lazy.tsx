import { createLazyFileRoute } from "@tanstack/react-router";

import { PageHero } from "@/components/layout/page-hero";
import { CardDesignerPage } from "@/features/designer/components/card-designer-page";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/card-designer")({
  component: CardDesignerRoute,
});

function CardDesignerRoute() {
  return (
    <>
      <PageHero
        width="full"
        title={m.designer_page_title()}
        lead={m.designer_page_lead()}
        compactTitle
      />
      <div className={cn(PAGE_WIDTH.full, PAGE_PADDING_NO_TOP, "pt-3")}>
        <CardDesignerPage />
      </div>
    </>
  );
}
