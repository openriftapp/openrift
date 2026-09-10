import { PROD } from "./env";

async function sendToSentry(error: unknown, tags: Record<string, string>): Promise<void> {
  try {
    const Sentry = await import("@sentry/tanstackstart-react");
    Sentry.captureException(error, { tags });
  } catch {
    /* The reporter itself is best-effort; a failed chunk load must not cascade. */
  }
}

// Callers here ship in the entry chunk; the SDK stays behind a dynamic
// import so it doesn't land there too.
export function captureHandledError(error: unknown, tags: Record<string, string>): void {
  if (!PROD) {
    return;
  }
  void sendToSentry(error, tags);
}

async function sendUserToSentry(userId: string | null): Promise<void> {
  try {
    const Sentry = await import("@sentry/tanstackstart-react");
    Sentry.setUser(userId === null ? null : { id: userId });
  } catch {
    /* Best-effort, same as the error reporter above. */
  }
}

/** The internal user id only; Sentry's PII capture stays off. */
export function setSentryUser(userId: string | null): void {
  if (!PROD) {
    return;
  }
  void sendUserToSentry(userId);
}
