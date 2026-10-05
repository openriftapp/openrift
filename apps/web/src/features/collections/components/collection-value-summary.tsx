import { centsToDollars } from "@openrift/shared/money";

import { ValueWithUnpriced } from "@/features/cards/components/value-with-unpriced";

interface CollectionValueSummaryProps {
  valueCents: number | null | undefined;
  unpricedCount: number | null | undefined;
  formatValue: (value: number) => string;
}

// A missing or zero value renders nothing, not "$0.00".
export function CollectionValueSummary({
  valueCents,
  unpricedCount,
  formatValue,
}: CollectionValueSummaryProps) {
  if (!valueCents) {
    return null;
  }
  return (
    <ValueWithUnpriced
      value={formatValue(centsToDollars(valueCents))}
      unpriced={unpricedCount ?? 0}
      className="min-w-0 truncate"
    />
  );
}
