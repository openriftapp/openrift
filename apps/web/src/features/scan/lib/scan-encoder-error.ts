import { errorText } from "@/lib/error-text";
import { m } from "@/paraglide/messages.js";

/** onnxruntime-web can reject with a value that is not an Error. */
function matchableText(thrown: unknown): string {
  return errorText(thrown, String(thrown));
}

const OUT_OF_MEMORY_PATTERN = /out of memory|cannot enlarge memory|\boom\b/iu;

/**
 * onnxruntime resolves its wasm backend once per page; once backend init
 * fails, every later create fast-fails without re-running init.
 */
export function encoderCreateRetryable(thrown: unknown): boolean {
  return !matchableText(thrown).includes("no available backend found");
}

/**
 * Out-of-memory failures map to a fresh-tab message: nothing else recovers
 * (observed on iOS under tab memory pressure).
 */
export function encoderStartErrorMessage(thrown: unknown, fallback: string): string {
  if (OUT_OF_MEMORY_PATTERN.test(matchableText(thrown))) {
    return m.scan_encoder_out_of_memory();
  }
  if (thrown instanceof Error && thrown.message) {
    return thrown.message;
  }
  return fallback;
}
