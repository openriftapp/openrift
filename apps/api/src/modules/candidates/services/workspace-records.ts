import type {
  WorkspaceRecordFilter,
  WorkspaceRecordsInput,
  WorkspaceRecordsResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { WORKSPACE_RECORD_FILTERS } from "@openrift/shared/contracts/admin/catalog-workspace";

import { buildKeysetCursor } from "../../../lib/keyset-cursor.js";
import type { AdminAccess } from "../../../middleware/require-admin.js";
import type { DeskRecordScope } from "../lib/workspace-presenters.js";
import { toWorkspaceFaceRow, toWorkspacePrintingRow } from "../lib/workspace-presenters.js";
import type { WorkspaceRecordsPage } from "../repositories/workspace-records.js";
import type { WorkspaceRepos } from "./workspace-queue.js";
import { deskPrintingScope, isDeskOnly } from "./workspace-queue.js";

const DEFAULT_LIMIT = 100;

function narrowFilter<K extends keyof typeof WORKSPACE_RECORD_FILTERS>(
  kind: K,
  filter?: WorkspaceRecordFilter,
): (typeof WORKSPACE_RECORD_FILTERS)[K][number] | undefined {
  const allowed: readonly WorkspaceRecordFilter[] = WORKSPACE_RECORD_FILTERS[kind];
  return filter !== undefined && allowed.includes(filter)
    ? (filter as (typeof WORKSPACE_RECORD_FILTERS)[K][number])
    : undefined;
}

function toPage<R extends { id: string; updatedAt: Date }, T>(
  result: WorkspaceRecordsPage<R>,
  limit: number,
  present: (row: R) => T,
): { rows: T[]; nextCursor: string | null; total: number } {
  const page = result.rows.slice(0, limit);
  const last = page.at(-1);
  return {
    rows: page.map((row) => present(row)),
    nextCursor:
      result.rows.length > limit && last ? buildKeysetCursor(last.updatedAt, last.id) : null,
    total: result.total,
  };
}

export async function listWorkspaceRecords(
  repos: Pick<WorkspaceRepos, "workspaceRecords" | "printingDesk" | "adminEvents">,
  options: { access: AdminAccess | null; userId: string; input: WorkspaceRecordsInput },
): Promise<WorkspaceRecordsResponse> {
  const { input } = options;
  const limit = input.limit ?? DEFAULT_LIMIT;
  let desk: DeskRecordScope | undefined;
  if (isDeskOnly(options.access)) {
    desk = await deskPrintingScope(repos, options.userId);
  }
  const query = {
    q: input.q,
    limit,
    cursor: input.cursor,
    printingIds:
      desk === undefined ? undefined : [...new Set([...desk.promoIds, ...desk.createdIds])],
  };
  if (input.kind === "face") {
    const result = await repos.workspaceRecords.listFaceRecords({
      ...query,
      filter: narrowFilter("face", input.filter),
    });
    return toPage(result, limit, (row) => toWorkspaceFaceRow(row));
  }
  let mineIds: string[] | undefined;
  if (input.filter === "mine") {
    mineIds =
      desk === undefined
        ? await repos.adminEvents.printingIdsCreatedBy(options.userId)
        : [...desk.createdIds];
  }
  const result = await repos.workspaceRecords.listPrintingRecords({
    ...query,
    filter: narrowFilter("printing", input.filter),
    mineIds,
  });
  return toPage(result, limit, (row) => toWorkspacePrintingRow(row, desk));
}
