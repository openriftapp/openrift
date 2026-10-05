import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { legendDisplayName } from "@openrift/shared/card-name";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";

import { cardDetailQueryOptions } from "@/features/cards/lib/card-detail-queries";
import { ContributeForm } from "@/features/contribute/components/contribute-form";
import {
  ContributeBackToCard,
  ContributeFormFrame,
} from "@/features/contribute/components/contribute-form-frame";
import { prefillForNewPrinting } from "@/features/contribute/lib/contribute-json";
import { m } from "@/paraglide/messages.js";

const routeApi = getRouteApi("/_app/contribute_/card_/$cardSlug_/printing");

export function ContributeAddPrintingPage() {
  const { cardSlug } = routeApi.useParams();
  const { data } = useSuspenseQuery(cardDetailQueryOptions(cardSlug));
  const setSlugById = new Map(data.sets.map((s) => [s.id, s.slug]));
  const setNameById = new Map(data.sets.map((s) => [s.id, s.name]));
  const initial = prefillForNewPrinting(data.card, setSlugById, setNameById);

  return (
    <ContributeFormFrame
      title={m.contribute_page_add_printing_title()}
      back={<ContributeBackToCard cardSlug={cardSlug} />}
      lead={
        <ParaglideMessage
          message={m.contribute_page_add_printing_lead}
          inputs={{ name: legendDisplayName(data.card) }}
          markup={{ strong: ({ children }) => <span className="font-medium">{children}</span> }}
        />
      }
    >
      <ContributeForm initial={initial} lockedSlug={cardSlug} scope="printing" />
    </ContributeFormFrame>
  );
}
