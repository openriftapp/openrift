import type {
  claimReferralResponseSchema,
  referralSummaryResponseSchema,
} from "@openrift/shared/contracts/referrals";
import type { z } from "zod";

export type ReferralSummaryResponse = z.infer<typeof referralSummaryResponseSchema>;

export type ClaimReferralResponse = z.infer<typeof claimReferralResponseSchema>;
