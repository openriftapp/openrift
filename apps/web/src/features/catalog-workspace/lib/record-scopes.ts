import { adminKeys } from "@/features/admin/lib/admin-query-keys";
import type { QueryScope } from "@/features/catalog-workspace/lib/workspace-undo";

export function cardRecordScope(cardSlug: string): QueryScope {
  return [
    adminKeys.cards.detail(cardSlug),
    adminKeys.printingDesk.all,
    adminKeys.workspaceHistory.all,
    adminKeys.audit.allEvents,
  ];
}

export function printingRecordScope(cardSlugs: readonly string[]): QueryScope {
  return [
    ...cardSlugs.map((cardSlug) => adminKeys.cards.detail(cardSlug)),
    adminKeys.printingDesk.all,
    adminKeys.workspaceHistory.all,
  ];
}
