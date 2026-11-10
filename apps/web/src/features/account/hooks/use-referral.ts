import { referralsContract } from "@openrift/shared/contracts/referrals";
import { readReferralCode, withReferralCode } from "@openrift/shared/referral";
import type {
  ClaimReferralResponse,
  ReferralSummaryResponse,
} from "@openrift/shared/types/api/referral";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

import { referralKeys } from "@/features/account/lib/account-query-keys";
import {
  forgetReferral,
  pendingReferral,
  rememberReferral,
} from "@/features/account/lib/referral-storage";
import { useHydrated } from "@/hooks/use-hydrated";
import { useUserId } from "@/hooks/use-session";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";

const getReferralFn = createServerFn({ method: "GET" })
  .middleware([withCookies])
  .handler(({ context }): Promise<ReferralSummaryResponse> =>
    apiOrpcClient(referralsContract, context.cookie).get(),
  );

const claimReferralFn = createServerFn({ method: "POST" })
  .validator((input: { code: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<ClaimReferralResponse> =>
    apiOrpcClient(referralsContract, context.cookie).claim(data),
  );

export function useReferral(): { data?: ReferralSummaryResponse; isLoading: boolean } {
  const userId = useUserId();
  const hydrated = useHydrated();
  const { data, isLoading } = useQuery({
    queryKey: referralKeys.summary(userId ?? ""),
    queryFn: () => getReferralFn(),
    enabled: Boolean(userId) && hydrated,
    staleTime: 5 * 60 * 1000,
  });
  return { data, isLoading };
}

export function useReferralCode(): string | null {
  return useReferral().data?.code ?? null;
}

export function useReferralUrl(url: string): string;
export function useReferralUrl(url: string | null): string | null;
export function useReferralUrl(url: string | null): string | null {
  const code = useReferralCode();
  return url === null ? null : withReferralCode(url, code);
}

export function useReferralCapture(userId: string | null): void {
  useEffect(() => {
    const code = readReferralCode(globalThis.location.hash);
    if (code === null) {
      return;
    }
    rememberReferral(code);
    const { pathname, search } = globalThis.location;
    globalThis.history.replaceState(globalThis.history.state, "", `${pathname}${search}`);
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const code = pendingReferral();
    if (code === null) {
      return;
    }
    void (async () => {
      try {
        await claimReferralFn({ data: { code } });
        forgetReferral();
      } catch {
        // kept for the next load
      }
    })();
  }, [userId]);
}
