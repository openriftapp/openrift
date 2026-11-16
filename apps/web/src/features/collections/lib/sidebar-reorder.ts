import type { SidebarVisibilityRow } from "@/lib/sidebar-visibility";
import { splitSidebarRows } from "@/lib/sidebar-visibility";

/** The new order after dropping `movedId` on `overId`, or null when nothing moves. */
export function sidebarReorder(
  rows: readonly SidebarVisibilityRow[],
  movedId: string,
  overId: string,
): string[] | null {
  const displayed = splitSidebarRows(rows, { expanded: true }).rows.map((row) => row.id);
  const oldIndex = displayed.indexOf(movedId);
  const newIndex = displayed.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return null;
  }
  const ordered = [...displayed];
  ordered.splice(oldIndex, 1);
  ordered.splice(newIndex, 0, movedId);
  return ordered;
}
