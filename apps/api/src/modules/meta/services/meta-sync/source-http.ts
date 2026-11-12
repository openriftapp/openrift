import type { SourceStop } from "./source-stop.js";

export function isTransientStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 425 || status === 429;
}

export function httpFailureMessage(status: number, url: string, body: string): string {
  return `HTTP ${status} for ${url}: ${body.slice(0, 200)}`;
}

export class SourceHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
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
