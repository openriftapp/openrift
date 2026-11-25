import type {
  WorkspaceQueueItem,
  WorkspaceRecordFilter,
  WorkspaceRecordsInput,
  WorkspaceRecordsResponse,
} from "@openrift/shared/contracts/admin/catalog-workspace";
import { WORKSPACE_RECORD_FILTERS } from "@openrift/shared/contracts/admin/catalog-workspace";

import type { AdminAccess } from "../../../middleware/require-admin.js";
import type { DeskRecordScope } from "../lib/workspace-presenters.js";
import { toWorkspaceFaceRow, toWorkspacePrintingRow } from "../lib/workspace-presenters.js";
import type { WorkspaceRecordsPage } from "../repositories/workspace-records.js";
import { offsetCursor } from "../repositories/workspace-records.js";
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

function toPage<R, T>(
  result: WorkspaceRecordsPage<R>,
  limit: number,
  present: (row: R) => T,
  offset: number,
): { rows: T[]; nextCursor: string | null; total: number } {
  const page = result.rows.slice(0, limit);
  const nextCursor = result.rows.length > limit ? String(offset + limit) : null;
  return { rows: page.map((row) => present(row)), nextCursor, total: result.total };
}

const IMAGE_REASONS: ReadonlySet<string> = new Set(["new-image", "image-rehost-failed"]);

interface FaceWork {
  pendingImages: number;
  pendingFields: number;
}

export function faceWorkCounts(items: readonly WorkspaceQueueItem[]): Map<string, FaceWork> {
  const work = new Map<string, FaceWork>();
  for (const item of items) {
    if (item.owner !== "face") {
      continue;
    }
    const entry = work.get(item.ownerId) ?? { pendingImages: 0, pendingFields: 0 };
    if (IMAGE_REASONS.has(item.reason)) {
      entry.pendingImages += Math.max(item.decisions, 1);
    } else {
      entry.pendingFields += Math.max(item.fields.length, 1);
    }
    work.set(item.ownerId, entry);
  }
  return work;
}

export async function listWorkspaceRecords(
  repos: Pick<WorkspaceRepos, "workspaceRecords" | "printingDesk" | "adminEvents">,
  options: {
    access: AdminAccess | null;
    userId: string;
    input: WorkspaceRecordsInput;
    loadFaceItems?: () => Promise<readonly WorkspaceQueueItem[]>;
  },
): Promise<WorkspaceRecordsResponse> {
  const { input } = options;
  const limit = input.limit ?? DEFAULT_LIMIT;
  let desk: DeskRecordScope | undefined;
  if (isDeskOnly(options.access)) {
    desk = await deskPrintingScope(repos, options.userId);
  }
  const sort =
    input.sort === undefined ? undefined : { key: input.sort, direction: input.direction ?? "asc" };
  const offset = offsetCursor(input.cursor);
  const query = {
    q: input.q,
    limit,
    cursor: input.cursor,
    setSlug: input.set,
    sort,
    printingIds:
      desk === undefined ? undefined : [...new Set([...desk.promoIds, ...desk.createdIds])],
  };
  if (input.kind === "face") {
    const work = faceWorkCounts((await options.loadFaceItems?.()) ?? []);
    const filter = narrowFilter("face", input.filter);
    const result = await repos.workspaceRecords.listFaceRecords({
      ...query,
      filter: filter === "needs-review" ? undefined : filter,
      faceIds: filter === "needs-review" ? [...work.keys()] : undefined,
    });
    return toPage(
      result,
      limit,
      (row) => ({ ...toWorkspaceFaceRow(row), ...work.get(row.id) }),
      offset,
    );
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
  return toPage(result, limit, (row) => toWorkspacePrintingRow(row, desk), offset);
}
