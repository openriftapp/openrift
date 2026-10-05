import { useMutation } from "@tanstack/react-query";

import { uploadImageErrorMessage } from "@/features/contribute/lib/submission-upload-error";
import { postMultipart } from "@/lib/server-fns/upload";

async function uploadSubmissionImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);
  const { url } = await postMultipart<{ url: string }>("/api/v1/card-submissions/images", body, {
    messageForStatus: uploadImageErrorMessage,
  });
  return url;
}

export function useUploadSubmissionImage() {
  return useMutation({ mutationFn: uploadSubmissionImage });
}
