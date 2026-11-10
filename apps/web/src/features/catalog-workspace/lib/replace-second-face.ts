import { runReportedMutation } from "@/lib/run-reported-mutation";

type SecondFaceWrite = (input: { printingId: string; faceId: string }) => Promise<unknown>;

export type ReplaceSecondFaceOutcome = "replaced" | "unchanged" | "restored" | "lost";

/** The API refuses a second face while one is set, so the old face goes first
 *  and is set again when the new one is refused. */
export async function replaceSecondFace({
  remove,
  set,
  printingId,
  oldFaceId,
  newFaceId,
}: {
  remove: SecondFaceWrite;
  set: SecondFaceWrite;
  printingId: string;
  oldFaceId: string;
  newFaceId: string;
}): Promise<ReplaceSecondFaceOutcome> {
  if (!(await runReportedMutation(() => remove({ printingId, faceId: oldFaceId })))) {
    return "unchanged";
  }
  if (await runReportedMutation(() => set({ printingId, faceId: newFaceId }))) {
    return "replaced";
  }
  return (await runReportedMutation(() => set({ printingId, faceId: oldFaceId })))
    ? "restored"
    : "lost";
}
