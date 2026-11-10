import { referralsContract } from "@openrift/shared/contracts/referrals";
import type {
  ClaimReferralResponse,
  ReferralSummaryResponse,
} from "@openrift/shared/types/api/referral";
import { implement } from "@orpc/server";

import { assertFound } from "../../../lib/assertions.js";
import { withUniqueShareToken } from "../../../lib/share-token.js";
import { requireAuthedUser } from "../../../orpc/base.js";
import type { ApiContext } from "../../../orpc/context.js";

const os = implement(referralsContract).$context<ApiContext>().use(requireAuthedUser);

export const referralsRouter = {
  get: os.get.handler(async ({ context }): Promise<ReferralSummaryResponse> => {
    const { referrals } = context.repos;
    const userId = context.userId;
    const existing = await referrals.getCode(userId);
    const code =
      existing ??
      (await withUniqueShareToken((candidate) => referrals.setCodeIfMissing(userId, candidate), {
        constraint: "users_referral_code_unique",
      }));
    assertFound(code, "User not found");
    const counts = await referrals.counts(userId);
    return { code, ...counts };
  }),

  claim: os.claim.handler(async ({ input, context }): Promise<ClaimReferralResponse> => {
    const claimed = await context.repos.referrals.claim(context.userId, input.code);
    return { claimed };
  }),
};
