import { createLazyFileRoute } from "@tanstack/react-router";

import {
  PageDescription,
  PageTopBar,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { CardDesignerPage } from "@/features/designer/components/card-designer-page";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/card-designer")({
  component: CardDesignerRoute,
});

function CardDesignerRoute() {
  return (
    <>
      <PageTopBarSticky width="full">
        <PageTopBar>
          <PageTopBarTitle>{m.designer_page_title()}</PageTopBarTitle>
        </PageTopBar>
      </PageTopBarSticky>
      <div className={cn(PAGE_WIDTH.full, PAGE_PADDING_NO_TOP, "flex flex-col gap-8 pt-3")}>
        <PageDescription>{m.designer_page_description()}</PageDescription>
        <CardDesignerPage />
      </div>
    </>
  );
}
