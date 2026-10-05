import { useNavigate } from "@tanstack/react-router";

import { CatalogCardPicker } from "@/features/cards/components/catalog-card-picker";
import { ContributeFormFrame } from "@/features/contribute/components/contribute-form-frame";
import { m } from "@/paraglide/messages.js";

export function ContributeFixPickerPage() {
  const navigate = useNavigate();

  return (
    <ContributeFormFrame
      title={m.contribute_choice_fix_title()}
      lead={m.contribute_page_fix_lead()}
    >
      <CatalogCardPicker
        label={m.contribute_picker_search_card()}
        onPick={(card) =>
          void navigate({ to: "/contribute/card/$cardSlug", params: { cardSlug: card.slug } })
        }
      />
    </ContributeFormFrame>
  );
}
