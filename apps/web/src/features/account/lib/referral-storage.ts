import { DAY_MS } from "@openrift/shared/format-date";
import { REFERRAL_CODE_PATTERN } from "@openrift/shared/referral";

const STORAGE_KEY = "openrift-pending-referral";
const TTL_MS = 30 * DAY_MS;

interface PendingReferral {
  code: string;
  expiresAt: number;
}

function read(storage: Storage, now: number): PendingReferral | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) {
    return null;
  }
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("code" in parsed) ||
    !("expiresAt" in parsed) ||
    typeof parsed.code !== "string" ||
    typeof parsed.expiresAt !== "number" ||
    !REFERRAL_CODE_PATTERN.test(parsed.code) ||
    parsed.expiresAt <= now
  ) {
    return null;
  }
  return { code: parsed.code, expiresAt: parsed.expiresAt };
}

function withStorage<T>(fallback: T, run: (storage: Storage) => T): T {
  try {
    return run(globalThis.localStorage);
  } catch {
    return fallback;
  }
}

export function rememberReferral(code: string, now = Date.now()): void {
  withStorage(undefined, (storage) => {
    if (read(storage, now) !== null) {
      return;
    }
    const value: PendingReferral = { code, expiresAt: now + TTL_MS };
    storage.setItem(STORAGE_KEY, JSON.stringify(value));
  });
}

export function pendingReferral(now = Date.now()): string | null {
  return withStorage(null, (storage) => read(storage, now)?.code ?? null);
}

export function forgetReferral(): void {
  withStorage(undefined, (storage) => storage.removeItem(STORAGE_KEY));
}
