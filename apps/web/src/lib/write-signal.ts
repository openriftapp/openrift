import type {
  MutateOptions,
  MutationFunctionContext,
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";

/** A write whose request was aborted for taking too long; it may still have landed. */
export class WriteTimedOutError extends Error {
  override name = "WriteTimedOutError";
}

/** Runs a write request that was handed `signal`; once it has aborted, a failure rejects as timed out. */
export async function withWriteSignal<T>(
  signal: AbortSignal | undefined,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (signal?.aborted === true) {
      throw new WriteTimedOutError("The write got no answer in time", { cause: error });
    }
    throw error;
  }
}

/** The variables of one mutation call that was given an abort signal. */
export class SignalledVariables<TVariables> {
  readonly variables: TVariables;
  readonly signal: AbortSignal;

  constructor(variables: TVariables, signal: AbortSignal) {
    this.variables = variables;
    this.signal = signal;
  }
}

type Sent<TVariables> = TVariables | SignalledVariables<TVariables>;

/** `mutateAsync` bound to `signal`, for code that takes a plain write function. */
export function withSignal<TVariables, TData>(
  mutateAsync: (variables: TVariables, options?: { signal?: AbortSignal }) => Promise<TData>,
  signal?: AbortSignal,
): (variables: TVariables) => Promise<TData> {
  return (variables) => mutateAsync(variables, { signal });
}

/** The variables a call was made with, for code that reads them from the mutation cache. */
export function sentVariables<TVariables>(sent: Sent<TVariables>): TVariables {
  return sent instanceof SignalledVariables ? sent.variables : sent;
}

type SignalledMutateOptions<TData, TVariables, TOnMutateResult> = MutateOptions<
  TData,
  Error,
  TVariables,
  TOnMutateResult
> & { signal?: AbortSignal };

type SignalledMutateArgs<TData, TVariables, TOnMutateResult> = undefined extends TVariables
  ? [variables?: TVariables, options?: SignalledMutateOptions<TData, TVariables, TOnMutateResult>]
  : [variables: TVariables, options?: SignalledMutateOptions<TData, TVariables, TOnMutateResult>];

type WithSignalledCalls<TResult, TData, TVariables, TOnMutateResult> = TResult extends unknown
  ? Omit<TResult, "mutate" | "mutateAsync"> & {
      mutate: (...args: SignalledMutateArgs<TData, TVariables, TOnMutateResult>) => void;
      mutateAsync: (
        ...args: SignalledMutateArgs<TData, TVariables, TOnMutateResult>
      ) => Promise<TData>;
    }
  : never;

export type SignalledMutationResult<
  TData,
  TVariables,
  TOnMutateResult = unknown,
> = WithSignalledCalls<
  UseMutationResult<TData, Error, TVariables, TOnMutateResult>,
  TData,
  TVariables,
  TOnMutateResult
>;

/** `TSuccessResult` differs: mutation options pass `onSuccess` a defined result, call options may not. */
interface ResultCallbacks<TData, TVariables, TOnMutateResult, TSuccessResult> {
  onSuccess?: (
    data: TData,
    variables: TVariables,
    onMutateResult: TSuccessResult,
    context: MutationFunctionContext,
  ) => unknown;
  onError?: (
    error: Error,
    variables: TVariables,
    onMutateResult: TOnMutateResult | undefined,
    context: MutationFunctionContext,
  ) => unknown;
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
    onMutateResult: TOnMutateResult | undefined,
    context: MutationFunctionContext,
  ) => unknown;
}

function unwrapCallbacks<TData, TVariables, TOnMutateResult, TSuccessResult>({
  onSuccess,
  onError,
  onSettled,
}: ResultCallbacks<TData, TVariables, TOnMutateResult, TSuccessResult>): ResultCallbacks<
  TData,
  Sent<TVariables>,
  TOnMutateResult,
  TSuccessResult
> {
  return {
    ...(onSuccess && {
      onSuccess: (data, sent, result, context) =>
        onSuccess(data, sentVariables(sent), result, context),
    }),
    ...(onError && {
      onError: (error, sent, result, context) =>
        onError(error, sentVariables(sent), result, context),
    }),
    ...(onSettled && {
      onSettled: (data, error, sent, result, context) =>
        onSettled(data, error, sentVariables(sent), result, context),
    }),
  };
}

function sendArgs<TData, TVariables, TOnMutateResult>(
  variables: TVariables,
  { signal, ...callbacks }: SignalledMutateOptions<TData, TVariables, TOnMutateResult> = {},
) {
  return [
    signal === undefined ? variables : new SignalledVariables(variables, signal),
    unwrapCallbacks(callbacks),
  ] as const;
}

/**
 * A mutation whose `mutate` and `mutateAsync` take an optional `signal`, which reaches
 * `mutationFn`; a call aborted through it rejects with {@link WriteTimedOutError}.
 */
export function useSignalledMutation<TData, TVariables, TOnMutateResult = unknown>(
  options: Omit<UseMutationOptions<TData, Error, TVariables, TOnMutateResult>, "mutationFn"> & {
    mutationFn: (variables: TVariables, signal?: AbortSignal) => Promise<TData>;
  },
): SignalledMutationResult<TData, TVariables, TOnMutateResult> {
  const { mutationFn, onMutate, onSuccess, onError, onSettled, ...rest } = options;
  const mutation = useMutation<TData, Error, Sent<TVariables>, TOnMutateResult>({
    ...rest,
    mutationFn: (sent) => {
      const signal = sent instanceof SignalledVariables ? sent.signal : undefined;
      return withWriteSignal(signal, () => mutationFn(sentVariables(sent), signal));
    },
    ...(onMutate && {
      onMutate: (sent, context) => onMutate(sentVariables(sent), context),
    }),
    ...unwrapCallbacks({ onSuccess, onError, onSettled }),
  });
  const { mutate, mutateAsync } = mutation;
  return {
    ...mutation,
    variables: mutation.variables === undefined ? undefined : sentVariables(mutation.variables),
    mutate: (
      variables: TVariables,
      call?: SignalledMutateOptions<TData, TVariables, TOnMutateResult>,
    ) => {
      mutate(...sendArgs(variables, call));
    },
    mutateAsync: (
      variables: TVariables,
      call?: SignalledMutateOptions<TData, TVariables, TOnMutateResult>,
    ) => mutateAsync(...sendArgs(variables, call)),
  } as unknown as SignalledMutationResult<TData, TVariables, TOnMutateResult>;
}
