import { errorMessage } from "@openrift/shared/strings";

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

export function rehostFailureReason(error: unknown): string {
  const code = errorCode(error);
  const name = error instanceof Error ? error.name : "";
  const message = errorMessage(error);

  if (code === "ENOENT") {
    return "file not found";
  }
  if (name === "TimeoutError" || name === "AbortError" || /timed? ?out/iu.test(message)) {
    return "timeout";
  }
  if (message.startsWith("Blocked download")) {
    return "download blocked";
  }
  const status = /^Download failed \((?<status>\d{3})\)/u.exec(message)?.groups?.status;
  if (status !== undefined) {
    return `HTTP ${status}`;
  }
  if (/not an image|unsupported image format|Input buffer|corrupt/iu.test(message)) {
    return "not an image";
  }
  if (/larger than/u.test(message)) {
    return "file too large";
  }
  if (/redirect/iu.test(message)) {
    return "redirect failed";
  }
  if ((code !== undefined && NETWORK_CODES.has(code)) || /fetch failed/iu.test(message)) {
    return "connection failed";
  }
  return "could not process the image";
}
