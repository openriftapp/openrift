import {
  activatePrintingImageFn,
  deletePrintingImageFn,
} from "@/features/admin/hooks/use-admin-image-mutations";
import type {
  QueryScope,
  WorkspaceUndoEntry,
} from "@/features/catalog-workspace/lib/workspace-undo";
import { undoScope } from "@/features/catalog-workspace/lib/workspace-undo";
import { withWriteSignal } from "@/lib/write-signal";

export interface StoredSourceImage {
  imageId: string | null;
  replacedImageId: string | null;
  restorable: boolean;
}

/** Undo for an image stored from a source: deletes it and puts the earlier main image back. */
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
      await withWriteSignal(signal, () => deletePrintingImageFn({ data: { imageId }, signal }));
      if (replacedImageId !== null) {
        await withWriteSignal(signal, () =>
          activatePrintingImageFn({ data: { imageId: replacedImageId, active: true }, signal }),
        );
      }
    },
  };
}
