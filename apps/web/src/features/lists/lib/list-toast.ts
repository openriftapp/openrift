import type { ListBulkAddResponse } from "@openrift/shared/types/api/list";

import { m } from "@/paraglide/messages.js";

export function describeListAdd(result: ListBulkAddResponse, listName: string): string {
  const tail =
    result.skipped > 0 ? ` ${m.lists_toast_not_owned_tail({ count: result.skipped })}` : "";
  if (result.added === 0 && result.updated === 0) {
    return `${m.lists_toast_nothing_added({ list: listName })}${tail}`;
  }
  if (result.added === 0) {
    return `${m.lists_toast_bumped({ list: listName })}${tail}`;
  }
  if (result.updated === 0) {
    return `${m.lists_toast_added({ count: result.added, list: listName })}${tail}`;
  }
  return `${m.lists_toast_added_bumped({ count: result.added, list: listName, bumped: result.updated })}${tail}`;
}
