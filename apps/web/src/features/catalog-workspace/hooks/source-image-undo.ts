import { toError } from "@openrift/shared/strings";

import {
  activatePrintingImageFn,
  deletePrintingImageFn,
} from "@/features/admin/hooks/use-admin-image-mutations";
import type {
  QueryScope,
  WorkspaceUndoEntry,
} from "@/features/catalog-workspace/lib/workspace-undo";
import { undoScope } from "@/features/catalog-workspace/lib/workspace-undo";
import { errorStatus } from "@/lib/server-fns/api-error";
import { isStaleServerFnError } from "@/lib/stale-bundle-reload";
import { withWriteSignal } from "@/lib/write-signal";

export interface StoredSourceImage {
  imageId: string | null;
  replacedImageId: string | null;
  restorable: boolean;
}

function isGone(error: unknown): boolean {
  return errorStatus(error) === 404 && !isStaleServerFnError(error);
}

export function sourceImageUndo(
  stored: StoredSourceImage,
  mode: "main" | "additional",
  record: string,
  scope: QueryScope,
): WorkspaceUndoEntry | null {
  const { imageId, replacedImageId } = stored;
  if (!stored.restorable || imageId === null) {
    return null;
  }
  return {
    label:
      mode === "main"
        ? `Made a source image main on ${record}`
        : `Stored a source image on ${record}`,
    undoneLabel:
      replacedImageId === null
        ? `Undone: the source image is no longer stored on ${record}`
        : `Undone: the earlier main image is back on ${record}`,
    invalidates: undoScope(scope),
    undo: async (signal) => {
      const failure = await withWriteSignal(signal, () =>
        deletePrintingImageFn({ data: { imageId }, signal }),
      )
        .then(() => null)
        .catch((error: unknown) => error ?? new Error("Undo failed"));
      if (failure !== null && !isGone(failure)) {
        throw toError(failure);
      }
      if (replacedImageId !== null) {
        await withWriteSignal(signal, () =>
          activatePrintingImageFn({ data: { imageId: replacedImageId, active: true }, signal }),
        );
      }
    },
  };
}
