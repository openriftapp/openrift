import { createIsomorphicFn } from "@tanstack/react-start";

export interface OperatorLinks {
  legalNoticeUrl?: string;
  privacyPolicyUrl?: string;
}

export function sanitizeOperatorUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export const getOperatorLinks = createIsomorphicFn()
  .server((): OperatorLinks => ({
    legalNoticeUrl: sanitizeOperatorUrl(process.env.LEGAL_NOTICE_URL),
    privacyPolicyUrl: sanitizeOperatorUrl(process.env.PRIVACY_POLICY_URL),
  }))
  .client((): OperatorLinks => ({
    legalNoticeUrl: sanitizeOperatorUrl(globalThis.__OPENRIFT_CONFIG__?.legalNoticeUrl),
    privacyPolicyUrl: sanitizeOperatorUrl(globalThis.__OPENRIFT_CONFIG__?.privacyPolicyUrl),
  }));
