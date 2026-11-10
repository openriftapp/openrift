/**
 * Awaits a mutation and swallows its rejection; the QueryClient's default
 * `onError` (`reportMutationError`) already raises the error toast.
 * Resolves `true` when the mutation succeeded, `false` when it was rejected.
 */
export async function runReportedMutation(action: () => Promise<unknown>): Promise<boolean> {
  try {
    await action();
  } catch {
    return false;
  }
  return true;
}
