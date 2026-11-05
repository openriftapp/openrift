import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { m } from "@/paraglide/messages.js";

import { LoansPage } from "./loans-page";

let coarsePointer = false;

vi.mock("@/hooks/use-coarse-pointer", () => ({ useCoarsePointer: () => coarsePointer }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock("@/features/cards/hooks/use-cards", () => ({ useCards: () => ({ allCards: [] }) }));
vi.mock("@/features/groups/hooks/use-loans", () => ({
  useLoans: () => ({ data: { items: [] } }),
  useAcknowledgeLoan: () => ({}),
  useConfirmBorrowerReturn: () => ({}),
  useDeclareLoanReturn: () => ({}),
  useDeleteLoan: () => ({}),
  useRejectLoan: () => ({}),
  useReopenBorrowerReturn: () => ({}),
  useReturnLoanCopies: () => ({}),
  useWriteOffLoan: () => ({}),
}));

describe("LoansPage empty state", () => {
  beforeEach(() => {
    coarsePointer = false;
  });

  it("tells mouse users to right-click", () => {
    render(<LoansPage />);
    expect(screen.getByText(m.loans_empty_description())).toBeTruthy();
    expect(m.loans_empty_description()).toContain("right-click");
  });

  it("tells touch users to press and hold", () => {
    coarsePointer = true;
    render(<LoansPage />);
    expect(screen.getByText(m.loans_empty_description_touch())).toBeTruthy();
    expect(m.loans_empty_description_touch()).toContain("press and hold");
    expect(screen.queryByText(m.loans_empty_description())).toBeNull();
  });
});
