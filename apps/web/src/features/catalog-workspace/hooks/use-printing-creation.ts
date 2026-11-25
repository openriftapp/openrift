import { useAdminAccess } from "@/features/admin/hooks/use-admin";
import {
  useAcceptPrintingGroup,
  useAcceptPrintingGroups,
} from "@/features/admin/hooks/use-admin-card-mutations";
import {
  useAddImageFromUrl,
  useUploadPrintingImage,
} from "@/features/admin/hooks/use-admin-image-mutations";
import { useUpdateDeskPrinting } from "@/features/admin/hooks/use-printing-desk";
import { IMAGE_FILE_SCOPE } from "@/features/admin/lib/admin-query-keys";
import type { CreationDraft } from "@/features/catalog-workspace/lib/creation-draft";
import {
  plannedImageUploads,
  printingFollowUpFields,
  toAcceptInput,
} from "@/features/catalog-workspace/lib/creation-draft";
import { creationFailureText, uploadCredit } from "@/features/catalog-workspace/lib/image-credit";
import type { QueryScope } from "@/features/catalog-workspace/lib/workspace-undo";
import { useSession } from "@/hooks/use-session";
import { errorText } from "@/lib/error-text";
import { runReportedMutation } from "@/lib/run-reported-mutation";

type UploadImage = { kind: "file"; file: File } | { kind: "url"; url: string };

interface PrintingImageUpload {
  printingId: string;
  image: UploadImage;
  mode: "main" | "additional";
  face: "front" | "back";
}

export function usePrintingImageUpload() {
  const { data: access } = useAdminAccess();
  const { data: session } = useSession();
  const uploadFile = useUploadPrintingImage(IMAGE_FILE_SCOPE, { inlineError: true });
  const addFromUrl = useAddImageFromUrl(IMAGE_FILE_SCOPE, { inlineError: true });
  const credit = uploadCredit({
    isAdmin: access?.isAdmin === true,
    uploaderName: session?.user.name,
  });

  function upload(
    signal: AbortSignal | undefined,
    { printingId, image, mode, face }: PrintingImageUpload,
  ): Promise<unknown> {
    return image.kind === "file"
      ? uploadFile.mutateAsync({ printingId, file: image.file, mode, face, credit }, { signal })
      : addFromUrl.mutateAsync({ printingId, url: image.url, mode, face }, { signal });
  }

  return { upload, credit, pending: uploadFile.isPending || addFromUrl.isPending };
}

/** Saves what the create call leaves out: the dates, the note and the images. */
export function useCreationFollowUps() {
  const updateDesk = useUpdateDeskPrinting({ inlineError: true });
  const images = usePrintingImageUpload();

  async function finish(
    signal: AbortSignal,
    printingId: string,
    draft: CreationDraft,
    options: { fields: boolean; urls: boolean },
  ): Promise<string | null> {
    const failed: string[] = [];
    const reasons = new Set<string>();
    const noteReason = (error: unknown) => reasons.add(errorText(error, "unknown error"));
    const followUp = options.fields ? printingFollowUpFields(draft) : null;
    if (
      followUp !== null &&
      !(await runReportedMutation(
        () => updateDesk.mutateAsync({ printingId, ...followUp }, { signal }),
        noteReason,
      ))
    ) {
      failed.push("the dates and note");
    }
    for (const { image, mode, face } of plannedImageUploads(draft)) {
      if (image.kind !== "file" && !options.urls) {
        continue;
      }
      const upload: PrintingImageUpload = {
        printingId,
        image: image.kind === "file" ? image : { kind: "url", url: image.url },
        mode,
        face,
      };
      if (!(await runReportedMutation(() => images.upload(signal, upload), noteReason))) {
        failed.push("an image");
      }
    }
    return failed.length === 0 ? null : creationFailureText(failed, [...reasons]);
  }

  return { finish, pending: updateDesk.isPending || images.pending };
}

interface AcceptedDraft {
  printingId: string | null;
  failure: string | null;
}

export function useAcceptPrintingDrafts(scope: QueryScope) {
  const { data: access } = useAdminAccess();
  const isAdmin = access?.isAdmin === true;
  const acceptGroup = useAcceptPrintingGroup(scope, { inlineError: true });
  const acceptGroups = useAcceptPrintingGroups(scope, { inlineError: true });
  const followUps = useCreationFollowUps();

  async function accept(
    signal: AbortSignal,
    draft: CreationDraft,
    cardId?: string,
  ): Promise<AcceptedDraft> {
    let created: Awaited<ReturnType<typeof acceptGroup.mutateAsync>> | undefined;
    let failure: string | null = null;
    const ok = await runReportedMutation(
      async () => {
        created = await acceptGroup.mutateAsync(toAcceptInput(draft, cardId), { signal });
      },
      (error) => {
        failure = errorText(error, "Could not create the printing.");
      },
    );
    if (!ok || !created) {
      return { printingId: null, failure };
    }
    const printingId = created.printingId;
    return {
      printingId,
      failure: isAdmin
        ? await followUps.finish(signal, printingId, draft, { fields: true, urls: true })
        : null,
    };
  }

  /** Creates every draft in one request, then saves each one's follow-ups. */
  async function acceptAll(
    signal: AbortSignal,
    drafts: readonly { label: string; draft: CreationDraft }[],
    cardId: string,
  ): Promise<{ notCreated: string[]; partial: string[] }> {
    if (drafts.length === 0) {
      return { notCreated: [], partial: [] };
    }
    const groups = drafts.map(({ draft }) => {
      const { cardId: _cardId, ...group } = toAcceptInput(draft, cardId);
      return group;
    });
    let created: Awaited<ReturnType<typeof acceptGroups.mutateAsync>> | undefined;
    let failure: string | null = null;
    const ok = await runReportedMutation(
      async () => {
        created = await acceptGroups.mutateAsync({ cardId, groups }, { signal });
      },
      (error) => {
        failure = errorText(error, "Could not create the printings.");
      },
    );
    if (!ok || !created) {
      const reason = failure === null ? "" : ` (${failure})`;
      return { notCreated: drafts.map(({ label }) => `${label}${reason}`), partial: [] };
    }
    const partial: string[] = [];
    if (isAdmin) {
      for (let index = 0; index < drafts.length; index += 1) {
        const entry = drafts[index];
        const printingId = created.printingIds[index];
        if (entry === undefined || printingId === undefined) {
          continue;
        }
        const { label, draft } = entry;
        const followUpFailure = await followUps.finish(signal, printingId, draft, {
          fields: true,
          urls: true,
        });
        if (followUpFailure !== null) {
          partial.push(`${label}: ${followUpFailure}`);
        }
      }
    }
    return { notCreated: [], partial };
  }

  return {
    accept,
    acceptAll,
    pending: acceptGroup.isPending || acceptGroups.isPending || followUps.pending,
  };
}
