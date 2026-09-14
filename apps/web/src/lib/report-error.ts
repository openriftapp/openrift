import { createIsomorphicFn } from "@tanstack/react-start";

import { PROD } from "./env";

// Callers here ship in the entry chunk; each half loads its SDK behind a
// dynamic import, and a namespace import of the SDK would pull all of it in.
async function sendToServerSentry(error: unknown, tags: Record<string, string>): Promise<void> {
  try {
    const { captureException } = await import("@sentry/tanstackstart-react");
    captureException(error, { tags });
  } catch {
    /* The reporter itself is best-effort; a failed chunk load must not cascade. */
  }
}

async function sendToClientSentry(error: unknown, tags: Record<string, string>): Promise<void> {
  try {
    const { captureClientError } = await import("./sentry-client");
    captureClientError(error, tags);
  } catch {
    /* Best-effort, same as the server half. */
  }
}

const sendToSentry = createIsomorphicFn().server(sendToServerSentry).client(sendToClientSentry);

export function captureHandledError(error: unknown, tags: Record<string, string>): void {
  if (!PROD) {
    return;
  }
  void sendToSentry(error, tags);
}

async function sendUserToClientSentry(userId: string | null): Promise<void> {
  try {
    const { setClientUser } = await import("./sentry-client");
    setClientUser(userId);
  } catch {
    /* Best-effort, same as the error reporter above. */
  }
}

// Only React effects call this, so the server side stays the default no-op.
const sendUserToSentry = createIsomorphicFn().client(sendUserToClientSentry);

/** The internal user id only; Sentry's PII capture stays off. */
export function setSentryUser(userId: string | null): void {
  if (!PROD) {
    return;
  }
  void sendUserToSentry(userId);
}
