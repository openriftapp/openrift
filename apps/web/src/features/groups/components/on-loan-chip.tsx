import { HandHeartIcon } from "lucide-react";

import { CountPill } from "@/components/ui/count-pill";
import { m } from "@/paraglide/messages.js";

export function OnLoanChip({
  count,
  totalCount,
  iconOnly,
}: {
  count: number;
  totalCount?: number;
  iconOnly?: boolean;
}) {
  const showTotal = totalCount !== undefined && totalCount !== count;
  if (count <= 0 && !showTotal) {
    return null;
  }
  const title = iconOnly
    ? m.loans_on_loan()
    : showTotal
      ? m.loans_on_loan_printing({ count, total: totalCount })
      : m.loans_on_loan_count({ count });
  return (
    <CountPill variant="ghost" title={title} aria-label={title}>
      <HandHeartIcon className="size-3" aria-hidden />
      {!iconOnly && (
        <>
          <span>{count}</span>
          {showTotal && <span className="opacity-60">({totalCount})</span>}
        </>
      )}
    </CountPill>
  );
}
