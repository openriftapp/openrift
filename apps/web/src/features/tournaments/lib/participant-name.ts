import { memberName } from "@/lib/member-name";

/** The API sends no name for a participant whose account was deleted. */
export function participantName(displayName: string | null): string {
  return memberName(displayName, displayName === null);
}
