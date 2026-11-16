import { ORPCError, ValidationError } from "@orpc/server";

import { AppError } from "../errors.js";

interface ValidationIssue {
  path: string;
  message: string;
}

function isInputValidationError(
  error: unknown,
): error is ORPCError<"BAD_REQUEST", unknown> & { cause: ValidationError } {
  return (
    error instanceof ORPCError &&
    error.code === "BAD_REQUEST" &&
    error.cause instanceof ValidationError
  );
}

export async function appErrorInterceptor<T>(options: { next: () => Promise<T> }): Promise<T> {
  try {
    return await options.next();
  } catch (error) {
    if (error instanceof AppError) {
      throw new ORPCError(error.code, { status: error.status, message: error.message });
    }
    if (isInputValidationError(error)) {
      const issues: ValidationIssue[] = error.cause.issues.map((issue) => ({
        path: (issue.path ?? [])
          .map((segment) => String(typeof segment === "object" ? segment.key : segment))
          .join("."),
        message: issue.message,
      }));
      throw new ORPCError("BAD_REQUEST", {
        status: error.status,
        message: error.message,
        data: { issues },
        cause: error.cause,
      });
    }
    throw error;
  }
}
