import { enumLabel } from "@openrift/shared/enum-label";
import { printingOnSide } from "@openrift/shared/printing-side";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound, getRouteApi } from "@tanstack/react-router";

import { cardDetailQueryOptions } from "@/features/cards/lib/card-detail-queries";
import {
  ContributeBackToCard,
  ContributeFormFrame,
} from "@/features/contribute/components/contribute-form-frame";
import { ImageSuggestForm } from "@/features/contribute/components/image-suggest-form";
import { useEnumOrders } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/contribute_/card_/$cardSlug_/printing_/$printingId_/image");

export function ImageSuggestPage() {
  const { cardSlug, printingId } = routeApi.useParams();
  const { side } = routeApi.useSearch();
  const { data } = useSuspenseQuery(cardDetailQueryOptions(cardSlug));
  const { labels } = useEnumOrders();
  const printing = printingOnSide(data.printings, printingId, side);
  if (!printing) {
    throw notFound();
  }
  const set = data.sets.find((s) => s.id === printing.setId);
  const setSlug = set?.slug ?? "";
  const setName = set?.name ?? "";

  return (
    <ContributeFormFrame
      title={m.contribute_page_suggest_image_title()}
      back={<ContributeBackToCard cardSlug={cardSlug} />}
      lead={
        <>
          {m.contribute_page_suggest_image_for()}{" "}
          <span className="text-foreground font-medium">
            {printing.printedName ?? data.card.name}
          </span>{" "}
          · {setName} · {enumLabel(labels.finishes, printing.finish)} · {printing.language || "EN"}
        </>
      }
    >
      <ImageSuggestForm
        key={printingId}
        card={data.card}
        printing={printing}
        setSlug={setSlug}
        setName={setName}
      />
    </ContributeFormFrame>
  );
}
