/**
 * Awaits a mutation and swallows its rejection; the QueryClient's default
 * `onError` (`reportMutationError`) already raises the error toast, unless the
 * mutation sets `meta.inlineError`, in which case `onFailure` shows it inline.
 * Resolves `true` when the mutation succeeded, `false` when it was rejected.
 */
export async function runReportedMutation(
  action: () => Promise<unknown>,
  onFailure?: (error: unknown) => void,
): Promise<boolean> {
  try {
    await action();
  } catch (error) {
    onFailure?.(error);
    return false;
  }
  return true;
}
