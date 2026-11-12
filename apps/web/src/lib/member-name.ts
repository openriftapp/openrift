import { m } from "@/paraglide/messages.js";

export function memberName(name: string | null | undefined, closed?: boolean): string {
  if (closed) {
    return m.common_former_member();
  }
  return name?.trim() || m.common_unnamed_member();
}
