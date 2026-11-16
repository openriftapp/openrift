import type { ErrorCode } from "@openrift/shared/error-codes";
import { ORPCError } from "@orpc/client";
import { notFound } from "@tanstack/react-router";

/**
 * Thrown by {@link fetchApi} on a non-ok response. The prototype does not
 * survive a server-function boundary (see `status-error-adapter.ts`); check via
 * {@link isApiError}, never `instanceof`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: ErrorCode;
  readonly details?: unknown;
  readonly diagnostic: string;

  constructor(
    message: string,
    opts: { status: number; code?: ErrorCode; details?: unknown; diagnostic: string },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.details = opts.details;
    this.diagnostic = opts.diagnostic;
  }
}

/** ApiError's shape after crossing a server-function boundary (prototype and `details` dropped). */
export interface ApiErrorShape extends Error {
  status?: number;
  code?: ErrorCode;
  details?: unknown;
  diagnostic?: string;
}

/**
 * Whether `error` is the API's 401 (expired/missing/revoked session). Matched
 * structurally on `status === 401`, not via {@link isApiError}, so it covers
 * both the raw-fetch {@link ApiError} and oRPC's `ORPCError` (`name: "Error"`).
 */
export function isSessionExpiredError(error: unknown): boolean {
  return errorStatus(error) === 401;
}

/** The HTTP status an error carries, for both {@link ApiError} and `ORPCError`. */
export function errorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

const NOT_FOUND_SENTINEL_NAME = "NotFoundSentinel";

/**
 * The sentinel a server function throws for a typed 404. `status-error-adapter.ts` carries its
 * name and status across the server-function boundary; the message stays for Sentry's ignore list.
 */
export function notFoundError(): Error {
  const error = Object.assign(new Error("NOT_FOUND"), { status: 404 });
  error.name = NOT_FOUND_SENTINEL_NAME;
  return error;
}

export function isNotFoundSentinel(error: unknown): boolean {
  return (
    errorStatus(error) === 404 && (error as { name?: unknown }).name === NOT_FOUND_SENTINEL_NAME
  );
}

/** Resolves an oRPC call, turning the contract's typed NOT_FOUND into {@link notFoundError}. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    throw error instanceof ORPCError && error.defined && error.code === "NOT_FOUND"
      ? notFoundError()
      : error;
  }
}

export async function notFoundOnSentinel<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    throw isNotFoundSentinel(error) ? notFound() : error;
  }
}

export function isRetryableError(error: unknown): boolean {
  const status = errorStatus(error);
  return status === undefined || status >= 500 || status === 408 || status === 429;
}

/** Structural (not `instanceof`) check: the prototype is lost crossing a server-function boundary. */
export function isApiError(value: unknown): value is ApiErrorShape {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { name?: unknown }).name === "ApiError" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

/**
 * Builds the {@link ApiError} for a non-ok response from the standard `{ error, code, details }`
 * envelope; any other body (an HTML error page, better-auth) gets `fallbackMessage`.
 */
export async function apiErrorFromResponse(
  res: { status: number; statusText: string; text: () => Promise<string> },
  errorTitle: string,
  request: { method?: string; url: string },
  fallbackMessage = errorTitle,
): Promise<ApiError> {
  const raw = await res.text().catch(() => "<no body>");
  let message = fallbackMessage;
  let code: ErrorCode | undefined;
  let details: unknown;
  try {
    const parsed = JSON.parse(raw) as { error?: unknown; code?: unknown; details?: unknown };
    if (typeof parsed.error === "string") {
      message = parsed.error;
      code = typeof parsed.code === "string" ? (parsed.code as ErrorCode) : undefined;
      details = parsed.details;
    }
  } catch {
    // A non-JSON body keeps fallbackMessage.
  }
  const label = request.method ? `${request.method} ${request.url}` : request.url;
  const diagnostic = `${label} → ${res.status} ${res.statusText}\n${raw}`;
  console.error(`[${errorTitle}]`, {
    url: request.url,
    method: request.method,
    status: res.status,
    body: raw,
  });
  return new ApiError(message, { status: res.status, code, details, diagnostic });
}
