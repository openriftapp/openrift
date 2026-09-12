import { enumLabel } from "@openrift/shared/enum-label";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useState } from "react";

import { Heading } from "@/components/heading";
import { RowList, RowListItem, RowListLink } from "@/components/ui/row-list";
import { Skeleton } from "@/components/ui/skeleton";
import { cardDetailQueryOptions } from "@/features/cards/hooks/use-card-detail";
import { CardSlugPicker } from "@/features/contribute/components/card-slug-picker";
import { ContributeHero } from "@/features/contribute/components/contribute-hero";
import { MyMissingImagesSection } from "@/features/contribute/components/my-missing-images-section";
import { useEnumOrders, useLanguageLabels } from "@/hooks/use-enums";
import { cn, PAGE_PADDING_NO_TOP, PAGE_WIDTH } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/contribute_/image")({
  component: ContributeImagePickerPage,
});

function ContributeImagePickerPage() {
  const [cardSlug, setCardSlug] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-8">
      <ContributeHero
        back
        title={m.contribute_add_missing_image()}
        lead={m.contribute_page_image_lead()}
      />

      <div className={cn(PAGE_WIDTH.capped, PAGE_PADDING_NO_TOP, "flex flex-col gap-8")}>
        <MyMissingImagesSection />

        <section className="flex flex-col gap-3">
          <Heading level={2}>{m.contribute_page_image_any_other()}</Heading>
          <CardSlugPicker onPick={setCardSlug} />
          {cardSlug === null ? null : (
            <Suspense fallback={<Skeleton className="h-40 w-full" />}>
              <PrintingChoices key={cardSlug} cardSlug={cardSlug} />
            </Suspense>
          )}
        </section>
      </div>
    </div>
  );
}

function PrintingChoices({ cardSlug }: { cardSlug: string }) {
  const { data } = useSuspenseQuery(cardDetailQueryOptions(cardSlug));
  const { labels } = useEnumOrders();
  const languageLabels = useLanguageLabels();
  const setNameById = new Map(data.sets.map((s) => [s.id, s.name]));

  return (
    <RowList>
      {data.printings.map((printing) => (
        <RowListItem key={printing.id}>
          <RowListLink
            render={
              <Link
                to="/contribute/card/$cardSlug/printing/$printingId/image"
                params={{ cardSlug, printingId: printing.id }}
              />
            }
            className="justify-between"
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{printing.printedName ?? data.card.name}</span>
              <span className="text-muted-foreground truncate text-sm">
                {setNameById.get(printing.setId) ?? ""} · {printing.publicCode} ·{" "}
                {enumLabel(labels.finishes, printing.finish)} ·{" "}
                {enumLabel(languageLabels, printing.language)}
              </span>
            </span>
            {printing.images.length > 0 && (
              <span className="text-muted-foreground shrink-0 text-sm">
                {m.contribute_page_image_on_file()}
              </span>
            )}
          </RowListLink>
        </RowListItem>
      ))}
    </RowList>
  );
}
