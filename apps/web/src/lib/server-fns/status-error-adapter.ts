import type { ErrorCode } from "@openrift/shared/error-codes";
import { createSerializationAdapter } from "@tanstack/react-router";

import type { ApiErrorShape } from "./api-error";

type StatusError = ApiErrorShape & { status: number };

interface SerializedStatusError {
  name: string;
  message: string;
  status: number;
  code?: ErrorCode;
  diagnostic?: string;
}

function isStatusError(value: unknown): value is StatusError {
  return value instanceof Error && typeof (value as { status?: unknown }).status === "number";
}

/**
 * Router-core's default error plugin keeps only `message`, so without this a
 * server function's 4xx reaches the client with no status.
 */
export const statusErrorAdapter = createSerializationAdapter({
  key: "status-error",
  test: isStatusError,
  toSerializable: (error): SerializedStatusError => ({
    name: error.name,
    message: error.message,
    status: error.status,
    code: typeof error.code === "string" ? error.code : undefined,
    diagnostic: typeof error.diagnostic === "string" ? error.diagnostic : undefined,
  }),
  fromSerializable: ({ name, message, status, code, diagnostic }): StatusError => {
    const error: StatusError = Object.assign(new Error(message), { status, code, diagnostic });
    error.name = name;
    return error;
  },
});
