import { errorMessage } from "@openrift/shared/strings";

import type { SourceStop } from "./source-stop.js";

export function isTransientStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 425 || status === 429;
}

export function httpFailureMessage(status: number, url: string, body: string): string {
  return `HTTP ${status} for ${url}: ${body.slice(0, 200)}`;
}

export class SourceHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SourceHttpError";
    this.status = status;
  }

  get permanent(): boolean {
    return this.status >= 400 && !isTransientStatus(this.status);
  }
}

export class SourceThrottledError extends SourceHttpError {
  constructor(url: string, message = `The source kept throttling: ${url}`) {
    super(429, message);
    this.name = "SourceThrottledError";
  }
}

/** A successful answer whose non-empty body the caller could not parse. */
export class SourceMalformedBodyError extends SourceHttpError {
  constructor(status: number, url: string, cause: unknown) {
    super(status, `Unreadable answer from ${url}: ${errorMessage(cause)}`, { cause });
    this.name = "SourceMalformedBodyError";
  }
}

export class RunDeadlineError extends Error {
  constructor(url: string) {
    super(`The run's time budget ends before ${url} could be requested`);
    this.name = "RunDeadlineError";
  }
}

export class SourceBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceBlockedError";
  }
}

export function sourceStopOf(error: unknown): SourceStop | null {
  if (error instanceof SourceBlockedError) {
    return "block";
  }
  return isThrottle(error) ? "pause" : null;
}

export function isTransientSourceFailure(error: unknown): boolean {
  return error instanceof SourceHttpError && !error.permanent && sourceStopOf(error) === null;
}

export function isPermanentRefusal(error: unknown): boolean {
  return error instanceof SourceHttpError && error.permanent;
}

export function isGone(error: unknown): boolean {
  return error instanceof SourceHttpError && (error.status === 404 || error.status === 410);
}

export function isThrottle(error: unknown): boolean {
  return error instanceof SourceHttpError && error.status === 429;
}

export function isHtmlChallenge(status: number, text: string): boolean {
  return status < 500 && text.trimStart().startsWith("<");
}
