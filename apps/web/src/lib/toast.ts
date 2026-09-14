import type { ExternalToast, toast as SonnerToast } from "sonner";

// Stays up until dismissed, for error toasts (network/mutation failures) that
// are easy to miss against auto-dismissing success toasts.
export const PERSISTENT_ERROR_TOAST: ExternalToast = {
  duration: Infinity,
  closeButton: true,
};

let loadedToast: typeof SonnerToast | undefined;

// The shell's own call sites load sonner on first use so it stays out of the
// entry chunk; page code imports `toast` from sonner directly.
export async function loadSonner(): Promise<typeof SonnerToast> {
  if (!loadedToast) {
    const module = await import("sonner");
    loadedToast = module.toast;
  }
  return loadedToast;
}

async function showErrorLater(message: string, options?: ExternalToast): Promise<void> {
  const toast = await loadSonner();
  toast.error(message, options);
}

async function showMessageLater(message: string, options?: ExternalToast): Promise<void> {
  const toast = await loadSonner();
  toast(message, options);
}

export function toastError(message: string, options?: ExternalToast): void {
  if (loadedToast) {
    loadedToast.error(message, options);
    return;
  }
  void showErrorLater(message, options);
}

export function toastMessage(message: string, options?: ExternalToast): void {
  if (loadedToast) {
    loadedToast(message, options);
    return;
  }
  void showMessageLater(message, options);
}
