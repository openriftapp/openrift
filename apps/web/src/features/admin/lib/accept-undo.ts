import type { AcceptFieldResult } from "@openrift/shared/contracts/admin/card-mutations";
import { toError } from "@openrift/shared/strings";
import { toast } from "sonner";

import { runReportedMutation } from "@/lib/run-reported-mutation";
import { errorStatus } from "@/lib/server-fns/api-error";
import { isStaleServerFnError } from "@/lib/stale-bundle-reload";

interface AcceptInput {
  field?: string;
  value: unknown;
  source?: "provider" | "manual";
}

interface FieldHistory {
  inFlight: number;
  tail: Promise<void>;
  valueAfterTail: unknown;
  undoable: object[];
}

const histories = new Map<string, FieldHistory>();
const pendingUndos = new WeakMap<object, string>();

function fieldKey(input: AcceptInput): string {
  const target: Record<string, unknown> = { ...input };
  delete target.value;
  delete target.source;
  return JSON.stringify(Object.entries(target).toSorted(([a], [b]) => a.localeCompare(b)));
}

async function runAfter<T>(prior: Promise<void>, next: () => Promise<T>): Promise<T> {
  await prior;
  return next();
}

async function settled(attempt: Promise<unknown>): Promise<void> {
  await attempt;
}

function historyFor(key: string): FieldHistory {
  const existing = histories.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const created: FieldHistory = {
    inFlight: 0,
    tail: Promise.resolve(),
    valueAfterTail: undefined,
    undoable: [],
  };
  histories.set(key, created);
  return created;
}

function forgetIfIdle(key: string, history: FieldHistory) {
  if (history.inFlight === 0 && history.undoable.length === 0) {
    histories.delete(key);
  }
}

const OUT_OF_ORDER = "Undo the later change to this field first";

function isLatestRevert(revert: object): boolean {
  const key = pendingUndos.get(revert);
  const history = key === undefined ? undefined : histories.get(key);
  return history === undefined || history.undoable.at(-1) === revert;
}

function dropRevert(revert: object) {
  const key = pendingUndos.get(revert);
  const history = key === undefined ? undefined : histories.get(key);
  pendingUndos.delete(revert);
  if (key !== undefined && history !== undefined) {
    history.undoable = history.undoable.filter((entry) => entry !== revert);
    forgetIfIdle(key, history);
  }
}

/** Writes an accept's revert, refusing while a later accept on the same field still has its
 *  undo. A revert whose record is gone (404) leaves the field history as well. */
export async function revertAcceptedField<TInput extends object>(
  revert: TInput,
  write: (revert: TInput) => Promise<unknown>,
): Promise<void> {
  if (!isLatestRevert(revert)) {
    throw new Error(OUT_OF_ORDER);
  }
  let failure: unknown = null;
  try {
    await write(revert);
  } catch (error) {
    failure = error ?? new Error("Undo failed");
  }
  if (failure === null || (errorStatus(failure) === 404 && !isStaleServerFnError(failure))) {
    dropRevert(revert);
  }
  if (failure !== null) {
    throw toError(failure);
  }
}

/** The undo writes the value this accept replaced as a manual edit, so the source's value
 *  stays available to accept again. Accepts on one field run one after another, and a
 *  later one's undo restores what the earlier one wrote. `onAccepted` replaces the Undo
 *  toast and runs its revert through `revertAcceptedField`. Resolves `true` on success. */
export async function acceptFieldWithUndo<TInput extends AcceptInput>({
  accept,
  input,
  fieldLabel,
  sourceLabel,
  previousValue,
  onAccepted,
}: {
  accept: (input: TInput) => Promise<AcceptFieldResult>;
  input: NoInfer<TInput>;
  fieldLabel: string;
  sourceLabel: string;
  previousValue: unknown;
  onAccepted?: (revert: NoInfer<TInput>) => void;
}): Promise<boolean> {
  const key = fieldKey(input);
  const history = historyFor(key);
  const followsAnother = history.inFlight > 0;
  history.inFlight += 1;

  const run = async (): Promise<{ accepted: boolean; undo: NoInfer<TInput> | null }> => {
    const replaced = followsAnother ? history.valueAfterTail : previousValue;
    let result: AcceptFieldResult | undefined;
    const ok = await runReportedMutation(async () => {
      result = await accept(input);
    });
    history.valueAfterTail = ok ? input.value : replaced;
    history.inFlight -= 1;
    if (!ok || !result?.written) {
      forgetIfIdle(key, history);
      return { accepted: ok, undo: null };
    }
    const revert = { ...input, value: replaced ?? null, source: "manual" as const };
    history.undoable.push(revert);
    pendingUndos.set(revert, key);
    return { accepted: ok, undo: revert };
  };
  const attempt = followsAnother ? runAfter(history.tail, run) : run();
  history.tail = settled(attempt);
  const { accepted, undo } = await attempt;
  if (undo === null) {
    return accepted;
  }
  if (onAccepted !== undefined) {
    onAccepted(undo);
    return accepted;
  }
  toast.success(`Used ${fieldLabel} from ${sourceLabel}`, {
    action: {
      label: "Undo",
      onClick: () => {
        if (isLatestRevert(undo)) {
          void runReportedMutation(() => revertAcceptedField(undo, accept));
        } else {
          toast.error(OUT_OF_ORDER);
        }
      },
    },
  });
  return accepted;
}
