import { EMPTY_VALUE_TEXT } from "@/features/admin/lib/field-value-text";
import { textDiff } from "@/lib/text-diff";

export interface ValuePart {
  text: string;
  changed: boolean;
}

export function valueParts(current: string | undefined, proposed: string): ValuePart[] {
  const live = current === undefined || current === EMPTY_VALUE_TEXT ? "" : current;
  const kept = textDiff(live, proposed).filter((segment) => segment.type !== "removed");
  // A value that only lost something has no added part to mark, so all of it is marked.
  if (!kept.some((segment) => segment.type === "added")) {
    return [{ text: proposed, changed: live !== proposed }];
  }
  return kept.map((segment) => ({ text: segment.text, changed: segment.type === "added" }));
}
