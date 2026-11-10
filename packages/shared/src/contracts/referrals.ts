import { REFERRAL_CODE_PATTERN } from "@openrift/shared/referral";
import { z } from "zod";

import { authedRoute } from "./_base.js";

export const referralSummaryResponseSchema = z.object({
  code: z.string(),
  signedUp: z.number().int().nonnegative(),
  counted: z.number().int().nonnegative(),
});

export const claimReferralSchema = z.object({
  code: z.string().regex(REFERRAL_CODE_PATTERN),
});

export const claimReferralResponseSchema = z.object({
  claimed: z.boolean(),
});

export const referralsContract = {
  get: authedRoute
    .route({ method: "GET", path: "/api/v1/referral", tags: ["Referrals"] })
    .output(referralSummaryResponseSchema),
  claim: authedRoute
    .route({ method: "POST", path: "/api/v1/referral/claim", tags: ["Referrals"] })
    .input(claimReferralSchema)
    .output(claimReferralResponseSchema),
};

export type ReferralsContract = typeof referralsContract;
