export function readAsDataUrl(blob: Blob): Promise<string> {
  // oxlint-disable-next-line promise/avoid-new -- wrapping the FileReader callback API
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(reader.result as string);
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Failed to read file."));
    });
    reader.readAsDataURL(blob);
  });
}
