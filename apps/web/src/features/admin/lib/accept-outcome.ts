import { pluralize } from "@openrift/shared/strings";
import { toast } from "sonner";

export interface AcceptSkip {
  label: string;
  reason: string;
}

export interface AcceptOutcome {
  kind: "success" | "warning" | "error" | "info";
  message: string;
}

interface AcceptOutcomeOptions {
  noun?: string;
  subject?: string;
}

export function describeAcceptOutcome(
  accepted: number,
  skipped: readonly AcceptSkip[],
  { noun = "printing", subject }: AcceptOutcomeOptions = {},
): AcceptOutcome {
  const lead = subject === undefined ? "" : `${subject}. `;
  const skips = skipped.map((entry) => `${entry.label} (${entry.reason})`).join(", ");
  const acceptedText = `Accepted ${accepted} ${pluralize(accepted, noun)}`;
  if (accepted > 0 && skipped.length === 0) {
    return { kind: "success", message: `${lead}${acceptedText}` };
  }
  if (accepted > 0) {
    return {
      kind: "warning",
      message: `${lead}${acceptedText}, skipped ${skipped.length}: ${skips}`,
    };
  }
  if (skipped.length > 0) {
    return {
      kind: subject === undefined ? "error" : "warning",
      message: `${lead}All skipped: ${skips}`,
    };
  }
  return {
    kind: subject === undefined ? "info" : "success",
    message: `${lead}No ${pluralize(2, noun)} to accept`,
  };
}

export function showAcceptOutcome(
  accepted: number,
  skipped: readonly AcceptSkip[],
  options?: AcceptOutcomeOptions,
): void {
  const { kind, message } = describeAcceptOutcome(accepted, skipped, options);
  toast[kind](message);
}
