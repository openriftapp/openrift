import { DAY_MS, localDayDiff } from "@openrift/shared/format-date";

import { m } from "@/paraglide/messages.js";

export function shouldPromptResume(lastScanAt: number | null): boolean {
  return lastScanAt === null || Date.now() - lastScanAt >= DAY_MS;
}

export function describeLastScan(lastScanAt: number | null): string {
  if (lastScanAt === null) {
    return m.scan_resume_when_earlier_session();
  }
  const days = localDayDiff(new Date(lastScanAt), new Date());
  if (days <= 0) {
    return m.scan_resume_when_today();
  }
  if (days === 1) {
    return m.scan_resume_when_yesterday();
  }
  return m.scan_resume_when_days({ days });
}
