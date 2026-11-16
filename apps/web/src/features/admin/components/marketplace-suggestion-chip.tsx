import type { ProductSuggestion } from "@openrift/shared/marketplace-suggestions";
import { suggestionStrength } from "@openrift/shared/marketplace-suggestions";
import type { UnifiedMappingPrintingResponse } from "@openrift/shared/types/api/admin";
import { WandSparklesIcon } from "lucide-react";
import { useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { PrintingLabel } from "./marketplace-printing-label";

export function ProductSuggestionChip({
  suggestion,
  productExternalId,
  highlightFinish,
  highlightLanguage,
  highlightMarkers,
  onAssign,
  disabled,
}: {
  suggestion: ProductSuggestion & { printing: UnifiedMappingPrintingResponse };
  productExternalId: number;
  highlightFinish?: string;
  highlightLanguage?: string;
  highlightMarkers?: boolean;
  onAssign: (externalId: number, printingId: string) => Promise<unknown>;
  disabled: boolean;
}) {
  const { printing } = suggestion;
  const strength = suggestionStrength(suggestion);
  const isWeak = strength === "weak";
  const isStrong = strength === "strong";
  // The parent's `disabled` is shared across every chip in the marketplace, so
  // this local flag marks the clicked chip until its own save settles.
  const [pending, setPending] = useState(false);
  const assign = async () => {
    setPending(true);
    await onAssign(productExternalId, printing.printingId);
    setPending(false);
  };
  const busy = pending || disabled;
  const tooltip = isWeak
    ? "Accept weak suggestion (mirrors a sibling SKU's mapping)"
    : `Accept suggestion (score ${suggestion.score})`;
  return (
    // oxlint-disable-next-line react/forbid-elements -- semantic green/amber suggestion pill; no Button variant carries these colors
    <button
      type="button"
      title={tooltip}
      disabled={busy}
      onClick={() => void assign()}
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium disabled:opacity-50",
        isStrong &&
          "border-success/30 bg-success-soft text-success hover:bg-success/20 border-solid",
        !isStrong &&
          !isWeak &&
          "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 border-dashed",
        isWeak &&
          "border-warning/40 bg-warning-soft text-warning hover:bg-warning/20 border-dashed",
      )}
    >
      {pending ? (
        <Spinner className="size-3 shrink-0" />
      ) : (
        <WandSparklesIcon className="size-3 shrink-0" />
      )}
      <PrintingLabel
        printing={printing}
        highlightFinish={highlightFinish}
        highlightLanguage={highlightLanguage}
        highlightMarkers={highlightMarkers}
      />
    </button>
  );
}
