export function downloadUrl(href: string, filename: string): void {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  URL.revokeObjectURL(url);
}

export function downloadText(text: string, mime: string, filename: string): void {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export function downloadJson(data: unknown, filename: string): void {
  downloadText(JSON.stringify(data, null, 2), "application/json", filename);
}

export function downloadCsv(csv: string, filename: string): void {
  downloadText(csv, "text/csv;charset=utf-8", filename);
}

export function safeFilename(base: string, fallback: string): string {
  return base.replaceAll(/[^\w -]+/gu, "_").trim() || fallback;
}
