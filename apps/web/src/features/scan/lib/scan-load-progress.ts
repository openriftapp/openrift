export interface ResourceProgress {
  loaded: number;
  total: number;
  ready: boolean;
}

export interface DownloadProgress {
  encoder: ResourceProgress;
  bank: ResourceProgress;
}

export const INITIAL_DOWNLOAD_PROGRESS: DownloadProgress = {
  encoder: { loaded: 0, total: 0, ready: false },
  bank: { loaded: 0, total: 0, ready: false },
};

type ScanLoadPhase = "downloading" | "starting";

export interface ScanLoadProgress {
  percent: number;
  phase: ScanLoadPhase;
}

function fraction(resource: ResourceProgress): number {
  if (resource.ready) {
    return 1;
  }
  if (resource.total <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, resource.loaded / resource.total));
}

function downloaded(resource: ResourceProgress): boolean {
  return resource.ready || (resource.total > 0 && resource.loaded >= resource.total);
}

export function scanLoadProgress(progress: DownloadProgress): ScanLoadProgress {
  const parts = [fraction(progress.bank), fraction(progress.encoder)];
  const percent = Math.round((100 * parts.reduce((sum, part) => sum + part, 0)) / parts.length);
  const phase =
    downloaded(progress.bank) && downloaded(progress.encoder) ? "starting" : "downloading";
  return { percent, phase };
}
