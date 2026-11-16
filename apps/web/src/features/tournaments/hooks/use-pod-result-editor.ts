import { useState } from "react";

import type { PodResultSubmission } from "@/features/tournaments/lib/swiss-results";
import { runReportedMutation } from "@/lib/run-reported-mutation";

/** Open/save state for one pod's result form; `run` serves any other save on the same pod. */
export function usePodResultEditor(
  save: (submission: PodResultSubmission) => Promise<unknown>,
  onSaved?: (submission: PodResultSubmission) => void,
) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setSaving(true);
    setError(null);
    const ok = await runReportedMutation(action, setError);
    setSaving(false);
    return ok;
  }

  async function submit(submission: PodResultSubmission) {
    const ok = await run(() => save(submission));
    if (ok) {
      onSaved?.(submission);
      setEditing(false);
    }
  }

  return {
    editing,
    saving,
    error,
    handleStart: () => {
      setError(null);
      setEditing(true);
    },
    handleCancel: () => setEditing(false),
    clearError: () => setError(null),
    submit,
    run,
  };
}
