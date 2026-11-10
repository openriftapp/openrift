export const REFERRAL_TIER_THRESHOLDS = [1, 5, 25] as const;

export type ReferralTier = 0 | 1 | 2 | 3;

export function referralTier(counted: number): ReferralTier {
  let tier: ReferralTier = 0;
  for (const [index, threshold] of REFERRAL_TIER_THRESHOLDS.entries()) {
    if (counted >= threshold) {
      tier = (index + 1) as ReferralTier;
    }
  }
  return tier;
}

export function nextReferralThreshold(counted: number): number | null {
  return REFERRAL_TIER_THRESHOLDS.find((threshold) => counted < threshold) ?? null;
}

export const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9]{12}$/u;

const HASH_KEY = "r";

export function withReferralCode(url: string, code: string | null | undefined): string {
  if (!code) {
    return url;
  }
  const hashIndex = url.indexOf("#");
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex);
  return `${base}#${HASH_KEY}=${code}`;
}

export function readReferralCode(hash: string): string | null {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const code = params.get(HASH_KEY);
  return code !== null && REFERRAL_CODE_PATTERN.test(code) ? code : null;
}
