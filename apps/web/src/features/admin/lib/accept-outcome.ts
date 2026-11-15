import { errorMessage, pluralize } from "@openrift/shared/strings";
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

interface NewCardAcceptResult {
  cardSlug: string;
  skipped: readonly { shortCode: string; reason: string }[];
}

export async function acceptEachNewCard(
  names: readonly string[],
  accept: (name: string) => Promise<NewCardAcceptResult>,
  onProgress: (done: number) => void,
): Promise<{ accepted: number; skipped: AcceptSkip[] }> {
  let accepted = 0;
  const skipped: AcceptSkip[] = [];
  for (const [index, name] of names.entries()) {
    try {
      const result = await accept(name);
      accepted++;
      skipped.push(
        ...result.skipped.map((entry) => ({
          label: `${result.cardSlug} ${entry.shortCode}`,
          reason: entry.reason,
        })),
      );
    } catch (error) {
      skipped.push({ label: name, reason: errorMessage(error) });
    }
    onProgress(index + 1);
  }
  return { accepted, skipped };
}

export function showAcceptOutcome(
  accepted: number,
  skipped: readonly AcceptSkip[],
  options?: AcceptOutcomeOptions,
): void {
  const { kind, message } = describeAcceptOutcome(accepted, skipped, options);
  toast[kind](message);
}
