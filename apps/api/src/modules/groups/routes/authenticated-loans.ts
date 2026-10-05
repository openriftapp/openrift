import { loansContract } from "@openrift/shared/contracts/loans";
import type {
  LoanBorrowerOptionsResponse,
  LoanListResponse,
  LoanResponse,
} from "@openrift/shared/types/api/loan";
import { implement } from "@orpc/server";

import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";
import { toLoanResponse } from "../lib/loan-presenters.js";
import {
  acknowledgeLoan,
  confirmBorrowerReturn,
  createLoan,
  declareLoanReturn,
  deleteLoan,
  rejectLoan,
  reopenBorrowerReturn,
  returnLoanCopies,
  writeOffLoan,
} from "../services/loans.js";

const os = implement(loansContract).$context<ApiContext>().use(requireAuthedUser);

const RECENT_BORROWER_NAMES_LIMIT = 8;

/** Loan services throw `AppError` for state failures, mapped by the handler's appErrorInterceptor. */
export const loansRouter = {
  create: os.create.handler(({ input, context }): Promise<LoanResponse> =>
    createLoan(context.transact, {
      lenderUserId: context.userId,
      printingId: input.printingId,
      quantity: input.quantity,
      borrowerUserId: input.borrowerUserId,
      borrowerName: input.borrowerName,
      contextCollectionId: input.contextCollectionId,
    }),
  ),

  list: os.list.handler(async ({ context }): Promise<LoanListResponse> => {
    const { loans } = context.repos;
    const rows = await loans.listDtoRowsForUser(context.userId);
    return { items: rows.map((row) => toLoanResponse(row, context.userId)) };
  }),

  borrowerOptions: os.borrowerOptions.handler(
    async ({ context }): Promise<LoanBorrowerOptionsResponse> => {
      const { loans } = context.repos;
      const [members, recentNames] = await Promise.all([
        loans.coMembersForUser(context.userId),
        loans.recentBorrowerNames(context.userId, RECENT_BORROWER_NAMES_LIMIT),
      ]);
      return { members, recentNames };
    },
  ),

  acknowledge: os.acknowledge.handler(({ input, context }): Promise<LoanResponse> =>
    acknowledgeLoan(context.transact, input.id, context.userId),
  ),

  reject: os.reject.handler(({ input, context }): Promise<LoanResponse> =>
    rejectLoan(context.transact, input.id, context.userId),
  ),

  declareReturn: os.declareReturn.handler(({ input, context }): Promise<LoanResponse> =>
    declareLoanReturn(context.transact, input.id, context.userId, input.quantity),
  ),

  confirmReturn: os.confirmReturn.handler(({ input, context }): Promise<LoanResponse> =>
    confirmBorrowerReturn(context.transact, input.id, context.userId),
  ),

  reopenReturn: os.reopenReturn.handler(({ input, context }): Promise<LoanResponse> =>
    reopenBorrowerReturn(context.transact, input.id, context.userId),
  ),

  returnCopies: os.returnCopies.handler(({ input, context }): Promise<LoanResponse> =>
    returnLoanCopies(context.transact, input.id, context.userId, input.quantity),
  ),

  writeOff: os.writeOff.handler(({ input, context }): Promise<LoanResponse> =>
    writeOffLoan(context.transact, input.id, context.userId, input.removeCopies),
  ),

  remove: os.remove.handler(async ({ input, context }): Promise<{ deleted: boolean }> => {
    await deleteLoan(context.transact, input.id, context.userId);
    return { deleted: true };
  }),
};
