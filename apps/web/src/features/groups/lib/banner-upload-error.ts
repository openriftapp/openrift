const UPLOAD_STATUS_MESSAGES: Record<number, string> = {
  400: "That file is not an image. A JPG, PNG or WebP picture works.",
  403: "Only group admins can change the banner.",
  413: "That picture is larger than 20 MB. Send a smaller one.",
  429: "That is every banner upload for today. Try again tomorrow.",
};

export function bannerUploadErrorMessage(status: number): string {
  return UPLOAD_STATUS_MESSAGES[status] ?? "The upload did not go through. Try again in a moment.";
}
