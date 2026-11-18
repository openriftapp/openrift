import { ORPCError, ValidationError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../errors.js";
import { makeReportingErrorInterceptor } from "./error-reporting-interceptor.js";

const captureException = vi.fn();
vi.mock("@sentry/bun", () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

const logError = vi.fn();
const log = { error: logError } as unknown as Parameters<typeof makeReportingErrorInterceptor>[0];

function outputValidationError(
  issues: { message: string; path?: unknown[] }[],
): ORPCError<string, unknown> {
  return new ORPCError("INTERNAL_SERVER_ERROR", {
    message: "Output validation failed",
    cause: new ValidationError({
      message: "Output validation failed",
      issues: issues as any,
      data: { secret: "never logged" },
    }),
  });
}

async function runThrowing(toThrow: unknown): Promise<unknown> {
  const interceptor = makeReportingErrorInterceptor(log);
  try {
    await interceptor({
      next: () => {
        throw toThrow;
      },
    });
  } catch (error) {
    return error;
  }
  return undefined;
}

describe("reporting error interceptor: server-fault classification", () => {
  beforeEach(() => {
    captureException.mockClear();
    logError.mockClear();
  });

  it.each([
    {
      name: "captures a 5xx ORPCError (a converted INTERNAL_ERROR AppError)",
      error: new ORPCError("INTERNAL_ERROR", { status: 500, message: "server fault" }),
      captures: 1,
    },
    {
      name: "does not capture a typed NOT_FOUND ORPCError",
      error: new ORPCError("NOT_FOUND", { status: 404, message: "missing" }),
      captures: 0,
    },
    {
      name: "does not capture a typed CONFLICT ORPCError",
      error: new ORPCError("CONFLICT", { status: 409, message: "conflict" }),
      captures: 0,
    },
    {
      name: "still captures a 5xx AppError that reaches the transport boundary unconverted",
      error: new AppError(500, "INTERNAL_ERROR", "boom"),
      captures: 1,
    },
    {
      name: "does not capture a sub-500 AppError",
      error: new AppError(404, "NOT_FOUND", "missing"),
      captures: 0,
    },
  ])("$name", async ({ error, captures }) => {
    await runThrowing(error);
    expect(captureException).toHaveBeenCalledTimes(captures);
  });

  it("reports an unmapped unique violation as a server fault and rethrows it unchanged", async () => {
    const uniqueViolation = Object.assign(new Error("duplicate key value"), {
      code: "23505",
      constraint_name: "uq_faces_identity",
    });
    const error = await runThrowing(uniqueViolation);
    expect(error).toBe(uniqueViolation);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("reports the offending field paths of an output-validation failure", async () => {
    await runThrowing(
      outputValidationError([
        { message: "Invalid option", path: ["defaultCurrency"] },
        { message: "Invalid input", path: [{ key: "completionScope" }, { key: "promos" }] },
        { message: "Invalid input" },
      ]),
    );
    const expected = [
      "defaultCurrency: Invalid option",
      "completionScope.promos: Invalid input",
      "Invalid input",
    ];
    expect(captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ extra: { validationIssues: expected } }),
    );
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ validationIssues: expected }),
      "oRPC handler error",
    );
  });

  it("does not report the rejected payload alongside the issues", async () => {
    await runThrowing(outputValidationError([{ message: "Invalid option", path: ["theme"] }]));
    expect(JSON.stringify(captureException.mock.calls[0]?.[1])).not.toContain("never logged");
  });

  it("omits the issue list for a fault that carries no validation cause", async () => {
    await runThrowing(new Error("kaboom"));
    expect(captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ extra: undefined }),
    );
  });

  it("maps a thrown AppError to an ORPCError at the boundary (safety net)", async () => {
    const rethrown = await runThrowing(new AppError(404, "NOT_FOUND", "missing"));
    expect(rethrown).toBeInstanceOf(ORPCError);
    expect((rethrown as ORPCError<string, unknown>).code).toBe("NOT_FOUND");
  });
});
