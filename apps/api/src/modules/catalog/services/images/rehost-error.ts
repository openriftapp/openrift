import { errorMessage } from "@openrift/shared/strings";

import type { DownloadFailure } from "./download.js";
import { DownloadError } from "./download.js";

const NETWORK_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
]);

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const { code, cause } = error as { code?: unknown; cause?: unknown };
  return typeof code === "string" ? code : errorCode(cause);
}

function downloadFailureReason(failure: DownloadFailure): string {
  switch (failure.kind) {
    case "blocked": {
      return "download blocked";
    }
    case "http": {
      return `HTTP ${failure.status}`;
    }
    case "not-an-image": {
      return "not an image";
    }
    case "too-large": {
      return "file too large";
    }
    case "redirect": {
      return "redirect failed";
    }
    case "timeout": {
      return "timeout";
    }
    case "connection": {
      return "connection failed";
    }
  }
}

export function rehostFailureReason(error: unknown): string {
  if (error instanceof DownloadError) {
    return downloadFailureReason(error.failure);
  }
  const code = errorCode(error);
  const name = error instanceof Error ? error.name : "";

  if (code === "ENOENT") {
    return "file not found";
  }
  if (name === "TimeoutError" || name === "AbortError") {
    return "timeout";
  }
  // sharp throws plain errors with no code; its messages carry no URL.
  if (/unsupported image format|Input buffer|corrupt/iu.test(errorMessage(error))) {
    return "not an image";
  }
  if (code !== undefined && NETWORK_CODES.has(code)) {
    return "connection failed";
  }
  return "could not process the image";
}
