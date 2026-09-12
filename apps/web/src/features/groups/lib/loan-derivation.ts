import type { LoanResponse, LoanStatus } from "@openrift/shared/types/api/loan";

import { m } from "@/paraglide/messages.js";

export function loanStatusLabel(status: LoanStatus): string {
  switch (status) {
    case "active": {
      return m.loans_status_active();
    }
    case "returned": {
      return m.loans_status_returned();
    }
    case "written_off": {
      return m.loans_status_written_off();
    }
  }
}

export function outstandingQuantity(loan: LoanResponse): number {
  return Math.max(0, loan.quantity - loan.returnedQuantity);
}

export function loanCounterpartyLabel(loan: LoanResponse): string {
  return loan.counterparty?.name ?? loan.counterpartyName ?? m.loans_former_member();
}

/** An empty `lenders` means the loans feed hasn't loaded yet, not that there are none. */
export function borrowedReasonText(count: number, lenders: readonly string[]): string {
  if (lenders.length === 0) {
    return count === 1
      ? m.loans_borrowed_reason_friend_one({ count })
      : m.loans_borrowed_reason_friend_other({ count });
  }
  const names =
    lenders.length === 1
      ? (lenders[0] ?? "")
      : m.loans_borrowed_names_join({
          names: lenders.slice(0, -1).join(", "),
          last: lenders.at(-1) ?? "",
        });
  return count === 1
    ? m.loans_borrowed_reason_one({ count, names })
    : m.loans_borrowed_reason_other({ count, names });
}

export type LoanSection = "attention" | "lent" | "borrowed" | "history";

/** A borrower's rejected loans are hidden entirely; they stay visible to the lender. */
export function loanSection(loan: LoanResponse): LoanSection | null {
  if (loan.status !== "active") {
    return "history";
  }
  if (loan.role === "borrower") {
    if (loan.rejectedAt !== null) {
      return null;
    }
    return loan.actionNeeded === "acknowledge" ? "attention" : "borrowed";
  }
  return loan.rejectedAt === null ? "lent" : "attention";
}
