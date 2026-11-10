import type { ReferralTier } from "@openrift/shared/referral";

import { m } from "@/paraglide/messages.js";

export function referralTierLabel(tier: ReferralTier): string | null {
  switch (tier) {
    case 0: {
      return null;
    }
    case 1: {
      return m.referral_tier_1();
    }
    case 2: {
      return m.referral_tier_2();
    }
    case 3: {
      return m.referral_tier_3();
    }
  }
}
