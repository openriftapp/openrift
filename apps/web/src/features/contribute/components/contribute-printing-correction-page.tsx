import { enumLabel } from "@openrift/shared/enum-label";
import { useSuspenseQuery } from "@tanstack/react-query";
import { notFound, getRouteApi } from "@tanstack/react-router";

import { cardDetailQueryOptions } from "@/features/cards/lib/card-detail-queries";
import { ContributeForm } from "@/features/contribute/components/contribute-form";
import {
  ContributeBackToCard,
  ContributeFormFrame,
} from "@/features/contribute/components/contribute-form-frame";
import { prefillFromCard } from "@/features/contribute/lib/contribute-json";
import { useEnumOrders, useLanguageLabels } from "@/hooks/use-enums";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/contribute_/card_/$cardSlug_/printing_/$printingId");

export function ContributePrintingCorrectionPage() {
  const { cardSlug, printingId } = routeApi.useParams();
  const { data } = useSuspenseQuery(cardDetailQueryOptions(cardSlug));
  const { labels } = useEnumOrders();
  const languageLabels = useLanguageLabels();
  const printing = data.printings.find((p) => p.id === printingId);
  if (!printing) {
    throw notFound();
  }
  const setSlugById = new Map(data.sets.map((s) => [s.id, s.slug]));
  const setNameById = new Map(data.sets.map((s) => [s.id, s.name]));
  const initial = prefillFromCard(data.card, [printing], setSlugById, setNameById);

  return (
    <ContributeFormFrame
      title={m.contribute_page_fix_printing_title()}
      back={<ContributeBackToCard cardSlug={cardSlug} />}
      lead={
        <>
          <span className="text-foreground font-medium">
            {printing.printedName ?? data.card.name}
          </span>{" "}
          · {setNameById.get(printing.setId) ?? ""} · {printing.publicCode} ·{" "}
          {enumLabel(labels.finishes, printing.finish)} ·{" "}
          {enumLabel(languageLabels, printing.language)}
        </>
      }
    >
      <ContributeForm initial={initial} lockedSlug={cardSlug} scope="printing" />
    </ContributeFormFrame>
  );
}
