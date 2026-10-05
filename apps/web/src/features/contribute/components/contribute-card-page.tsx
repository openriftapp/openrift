import { ContributeForm } from "@/features/contribute/components/contribute-form";
import { ContributeFormFrame } from "@/features/contribute/components/contribute-form-frame";
import { emptyFormState } from "@/features/contribute/lib/contribute-json";
import { m } from "@/paraglide/messages.js";

export function ContributeCardPage() {
  return (
    <ContributeFormFrame
      title={m.contribute_page_card_title()}
      lead={m.contribute_page_card_lead()}
    >
      <ContributeForm initial={emptyFormState()} />
    </ContributeFormFrame>
  );
}
