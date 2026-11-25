import type { ImageOriginalOutput, ImageQuad } from "@openrift/shared/contracts/admin/card-images";
import { adminCardImagesContract } from "@openrift/shared/contracts/admin/card-images";
import { adminCardMutationsContract } from "@openrift/shared/contracts/admin/card-mutations";
import type {
  UploadCandidatesBody,
  UploadCandidatesResponse,
} from "@openrift/shared/contracts/admin/card-mutations";
import type { MutationMeta, QueryClient } from "@tanstack/react-query";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

import {
  adminKeys,
  CANDIDATE_REVIEW_SCOPE,
  IMAGE_FILE_SCOPE,
} from "@/features/admin/lib/admin-query-keys";
import { useMutationWithInvalidation } from "@/hooks/use-mutation-with-invalidation";
import { reportMutationError } from "@/lib/query-client";
import { getApiUrl } from "@/lib/server-fns/api-url";
import { withCookies } from "@/lib/server-fns/middleware";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { sentVariables } from "@/lib/write-signal";

export const deletePrintingImageFn = createServerFn({ method: "POST" })
  .validator((input: { imageId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardImagesContract, context.cookie).deleteImage({
      imageId: data.imageId,
    });
  });

export const activatePrintingImageFn = createServerFn({ method: "POST" })
  .validator((input: { imageId: string; active: boolean }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardImagesContract, context.cookie).activateImage({
      imageId: data.imageId,
      active: data.active,
    });
  });

const keepPrintingImageFn = createServerFn({ method: "POST" })
  .validator((input: { imageId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardImagesContract, context.cookie).keepImage({
      imageId: data.imageId,
    });
  });

export const unkeepPrintingImageFn = createServerFn({ method: "POST" })
  .validator((input: { imageId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardImagesContract, context.cookie).unkeepImage({
      imageId: data.imageId,
    });
  });

const rehostPrintingImageFn = createServerFn({ method: "POST" })
  .validator((input: { imageId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardImagesContract, context.cookie).rehostImage({
      imageId: data.imageId,
    });
  });

const unrehostPrintingImageFn = createServerFn({ method: "POST" })
  .validator((input: { imageId: string }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardImagesContract, context.cookie).unrehostImage({
      imageId: data.imageId,
    });
  });

type Rotation = 0 | 90 | 180 | 270;

const rotatePrintingImageFn = createServerFn({ method: "POST" })
  .validator((input: { imageId: string; rotation: Rotation }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardImagesContract, context.cookie).rotateImage({
      imageId: data.imageId,
      rotation: data.rotation,
    });
  });

const setNeedsTrimFn = createServerFn({ method: "POST" })
  .validator((input: { imageId: string; needsTrim: boolean }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardImagesContract, context.cookie).setNeedsTrim({
      imageId: data.imageId,
      needsTrim: data.needsTrim,
    });
  });

const setNeedsLevelsFn = createServerFn({ method: "POST" })
  .validator((input: { imageId: string; needsLevels: boolean }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardImagesContract, context.cookie).setNeedsLevels({
      imageId: data.imageId,
      needsLevels: data.needsLevels,
    });
  });

const setPrintingImageQuadFn = createServerFn({ method: "POST" })
  .validator((input: { imageId: string; quad: ImageQuad | null }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardImagesContract, context.cookie).setQuad({
      imageId: data.imageId,
      quad: data.quad,
    });
  });

const ensurePrintingImageOriginalFn = createServerFn({ method: "POST" })
  .validator((input: { imageId: string }) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<ImageOriginalOutput> =>
    apiOrpcClient(adminCardImagesContract, context.cookie).ensureOriginal({
      imageId: data.imageId,
    }),
  );

const addImageFromUrlFn = createServerFn({ method: "POST" })
  .validator(
    (input: { printingId: string; url: string; mode?: string; face?: "front" | "back" }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardImagesContract, context.cookie).addImageUrl({
      printingId: data.printingId,
      url: data.url,
      mode: data.mode as "main" | "additional" | undefined,
      face: data.face,
    });
  });

const setCandidatePrintingImageFn = createServerFn({ method: "POST" })
  .validator((input: { candidatePrintingId: string; mode: "main" | "additional" }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) =>
    apiOrpcClient(adminCardImagesContract, context.cookie).setImage({
      id: data.candidatePrintingId,
      mode: data.mode,
    }),
  );

const setFallbackArtFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      printingId: string;
      mode: "auto" | "pinned" | "none";
      imageFileId?: string;
      face?: "front" | "back";
    }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardImagesContract, context.cookie).setFallbackArt(data);
  });

const addFallbackArtUrlFn = createServerFn({ method: "POST" })
  .validator((input: { printingId: string; url: string; face?: "front" | "back" }) => input)
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    await apiOrpcClient(adminCardImagesContract, context.cookie).addFallbackArtUrl(data);
  });

const uploadFallbackArtFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      printingId: string;
      fileName: string;
      fileType: string;
      fileBase64: string;
      face?: "front" | "back";
    }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    const fileBytes = Uint8Array.from(atob(data.fileBase64), (c) => c.codePointAt(0) ?? 0);
    const blob = new Blob([fileBytes], { type: data.fileType });
    const formData = new FormData();
    formData.append("file", blob, data.fileName);
    if (data.face) {
      formData.append("face", data.face);
    }
    // FormData body — can't use fetchApi helper (it JSON.stringify's bodies).
    const res = await fetch(
      `${getApiUrl()}/api/admin/v1/cards/printing/${encodeURIComponent(data.printingId)}/fallback-art/upload`,
      {
        method: "POST",
        headers: { cookie: context.cookie },
        body: formData,
      },
    );
    if (!res.ok) {
      throw new Error(`Upload fallback art failed: ${res.status}`);
    }
    return res.json();
  });

const uploadCandidatesFn = createServerFn({ method: "POST" })
  .validator((input: UploadCandidatesBody) => input)
  .middleware([withCookies])
  .handler(({ context, data }): Promise<UploadCandidatesResponse> =>
    apiOrpcClient(adminCardMutationsContract, context.cookie).upload(data),
  );

type Scope = readonly (readonly unknown[])[];
const defaultScope: Scope = CANDIDATE_REVIEW_SCOPE;

function refetchScope(queryClient: QueryClient, scope: Scope) {
  for (const key of scope) {
    void queryClient.invalidateQueries({ queryKey: [...key] });
  }
}

export function useDeletePrintingImage(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (imageId: string, signal) => {
      await deletePrintingImageFn({ data: { imageId }, signal });
    },
    invalidates,
  });
}

export function useActivatePrintingImage(invalidates: Scope = defaultScope) {
  const queryClient = useQueryClient();
  return useMutationWithInvalidation({
    mutationFn: async ({ imageId, active }: { imageId: string; active: boolean }, signal) => {
      await activatePrintingImageFn({ data: { imageId, active }, signal });
    },
    onError: (error) => {
      refetchScope(queryClient, invalidates);
      reportMutationError(error, queryClient);
    },
    invalidates,
  });
}

export function useKeepPrintingImage(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (imageId: string, signal) => {
      await keepPrintingImageFn({ data: { imageId }, signal });
    },
    invalidates: [...invalidates, adminKeys.workspace],
  });
}

/** A rehost of a rehosted image writes a new image file, so it refreshes every view of it. */
export function useRehostPrintingImage() {
  const queryClient = useQueryClient();
  return useMutationWithInvalidation({
    mutationFn: async (imageId: string, signal) => {
      await rehostPrintingImageFn({ data: { imageId }, signal });
    },
    onError: (error) => {
      refetchScope(queryClient, IMAGE_FILE_SCOPE);
      reportMutationError(error, queryClient);
    },
    invalidates: IMAGE_FILE_SCOPE,
  });
}

export function useUnrehostPrintingImage(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (imageId: string, signal) => {
      await unrehostPrintingImageFn({ data: { imageId }, signal });
    },
    invalidates,
  });
}

const IMAGE_EDIT_MUTATION_KEY = ["admin", "image-edit"] as const;

/** Rotate, trim and straighten each write a new image file, so all of them refresh every view of it. */
export function useRotatePrintingImage() {
  return useMutationWithInvalidation({
    mutationKey: IMAGE_EDIT_MUTATION_KEY,
    mutationFn: async ({ imageId, rotation }: { imageId: string; rotation: Rotation }, signal) => {
      await rotatePrintingImageFn({ data: { imageId, rotation }, signal });
    },
    invalidates: IMAGE_FILE_SCOPE,
  });
}

export function useSetPrintingImageNeedsTrim() {
  return useMutationWithInvalidation({
    mutationKey: IMAGE_EDIT_MUTATION_KEY,
    mutationFn: async ({ imageId, needsTrim }: { imageId: string; needsTrim: boolean }, signal) => {
      await setNeedsTrimFn({ data: { imageId, needsTrim }, signal });
    },
    invalidates: IMAGE_FILE_SCOPE,
  });
}

export function useSetPrintingImageNeedsLevels() {
  return useMutationWithInvalidation({
    mutationKey: IMAGE_EDIT_MUTATION_KEY,
    mutationFn: async (
      { imageId, needsLevels }: { imageId: string; needsLevels: boolean },
      signal,
    ) => {
      await setNeedsLevelsFn({ data: { imageId, needsLevels }, signal });
    },
    invalidates: IMAGE_FILE_SCOPE,
  });
}

export function useSetPrintingImageQuad() {
  return useMutationWithInvalidation({
    mutationKey: IMAGE_EDIT_MUTATION_KEY,
    mutationFn: async ({ imageId, quad }: { imageId: string; quad: ImageQuad | null }, signal) => {
      await setPrintingImageQuadFn({ data: { imageId, quad }, signal });
    },
    invalidates: IMAGE_FILE_SCOPE,
  });
}

/** True while a rotate, trim, contrast or straighten of this image is in flight; a second one would lose the file swap. */
export function useImageEditPending(imageId: string): boolean {
  const running = useIsMutating({
    mutationKey: IMAGE_EDIT_MUTATION_KEY,
    predicate: (mutation) =>
      (sentVariables(mutation.state.variables) as { imageId?: string } | undefined)?.imageId ===
      imageId,
  });
  return running > 0;
}

export function useEnsurePrintingImageOriginal() {
  return useMutationWithInvalidation({
    meta: { inlineError: true },
    mutationFn: (imageId: string, signal): Promise<ImageOriginalOutput> =>
      ensurePrintingImageOriginalFn({ data: { imageId }, signal }),
    invalidates: [],
  });
}

export function useAddImageFromUrl(invalidates: Scope = defaultScope, meta?: MutationMeta) {
  return useMutationWithInvalidation({
    meta,
    mutationFn: (
      {
        printingId,
        ...body
      }: {
        printingId: string;
        url: string;
        mode?: "main" | "additional";
        face?: "front" | "back";
      },
      signal,
    ) => addImageFromUrlFn({ data: { printingId, ...body }, signal }),
    invalidates,
  });
}

const uploadPrintingImageFn = createServerFn({ method: "POST" })
  .validator(
    (input: {
      printingId: string;
      fileName: string;
      fileType: string;
      fileBase64: string;
      mode?: string;
      face?: string;
      credit?: string;
    }) => input,
  )
  .middleware([withCookies])
  .handler(async ({ context, data }) => {
    const fileBytes = Uint8Array.from(atob(data.fileBase64), (c) => c.codePointAt(0) ?? 0);
    const blob = new Blob([fileBytes], { type: data.fileType });
    const formData = new FormData();
    formData.append("file", blob, data.fileName);
    if (data.mode) {
      formData.append("mode", data.mode);
    }
    if (data.face) {
      formData.append("face", data.face);
    }
    if (data.credit) {
      formData.append("credit", data.credit);
    }
    // FormData body — can't use fetchApi helper (it JSON.stringify's bodies).
    const res = await fetch(
      `${getApiUrl()}/api/admin/v1/cards/printing/${encodeURIComponent(data.printingId)}/upload-image`,
      {
        method: "POST",
        headers: { cookie: context.cookie },
        body: formData,
      },
    );
    if (!res.ok) {
      throw new Error(`Upload printing image failed: ${res.status}`);
    }
    return res.json();
  });

/**
 * Chunked because `String.fromCodePoint` spreads the byte array as arguments,
 * and a whole image at once overflows the call stack.
 */
async function toBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const CHUNK = 32_768;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCodePoint(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export function useUploadPrintingImage(invalidates: Scope = defaultScope, meta?: MutationMeta) {
  return useMutationWithInvalidation({
    meta,
    mutationFn: async (
      {
        printingId,
        file,
        mode,
        face,
        credit,
      }: {
        printingId: string;
        file: File;
        mode?: "main" | "additional";
        face?: "front" | "back";
        credit?: string;
      },
      signal,
    ) =>
      uploadPrintingImageFn({
        data: {
          printingId,
          fileName: file.name,
          fileType: file.type,
          fileBase64: await toBase64(file),
          mode,
          face,
          credit,
        },
        signal,
      }),
    invalidates,
  });
}

export function useSetCandidatePrintingImage(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (
      {
        candidatePrintingId,
        mode,
      }: {
        candidatePrintingId: string;
        mode: "main" | "additional";
      },
      signal,
    ) => setCandidatePrintingImageFn({ data: { candidatePrintingId, mode }, signal }),
    invalidates,
  });
}

/** Set a printing's substitute-art override: derive it, pin a held image, or suppress it. */
export function useSetFallbackArt(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (
      input: {
        printingId: string;
        mode: "auto" | "pinned" | "none";
        imageFileId?: string;
        face?: "front" | "back";
      },
      signal,
    ) => {
      await setFallbackArtFn({ data: input, signal });
    },
    invalidates,
  });
}

export function useAddFallbackArtUrl(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (
      input: { printingId: string; url: string; face?: "front" | "back" },
      signal,
    ) => {
      await addFallbackArtUrlFn({ data: input, signal });
    },
    invalidates,
  });
}

export function useUploadFallbackArt(invalidates: Scope = defaultScope) {
  return useMutationWithInvalidation({
    mutationFn: async (
      {
        printingId,
        file,
        face,
      }: {
        printingId: string;
        file: File;
        face?: "front" | "back";
      },
      signal,
    ) =>
      uploadFallbackArtFn({
        data: {
          printingId,
          face,
          fileName: file.name,
          fileType: file.type,
          fileBase64: await toBase64(file),
        },
        signal,
      }),
    invalidates,
  });
}

export function useUploadCandidates() {
  return useMutationWithInvalidation({
    meta: { inlineError: true },
    mutationFn: (payload: UploadCandidatesBody, signal) =>
      uploadCandidatesFn({ data: payload, signal }),
    invalidates: [...CANDIDATE_REVIEW_SCOPE, adminKeys.sources],
  });
}
