import type { SpanContext } from "@opentelemetry/api";
import { context, trace } from "@opentelemetry/api";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createLogger, traceContextMixin } from "./logger";

describe("createLogger", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates a logger with standard methods", () => {
    const log = createLogger("test");
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
  });

  it("defaults to info level", () => {
    vi.stubEnv("LOG_LEVEL", undefined);
    const log = createLogger("test");
    expect(log.level).toBe("info");
  });

  it("takes the default level from LOG_LEVEL", () => {
    vi.stubEnv("LOG_LEVEL", "silent");
    expect(createLogger("test").level).toBe("silent");
  });

  it("prefers an explicit level over LOG_LEVEL", () => {
    vi.stubEnv("LOG_LEVEL", "silent");
    expect(createLogger("test", "warn").level).toBe("warn");
  });

  it("accepts a custom level", () => {
    const log = createLogger("test", "debug");
    expect(log.level).toBe("debug");
  });
});

describe("traceContextMixin", () => {
  it("returns an empty object when no span is active", () => {
    expect(traceContextMixin()).toEqual({});
  });

  it("returns an empty object when the span context is invalid (no SDK)", () => {
    // The no-op tracer returns an all-zero span context; emitting it would make Loki treat it as a real link.
    const tracer = trace.getTracer("test");
    const span = tracer.startSpan("op");
    const ctx = trace.setSpan(context.active(), span);
    const result = context.with(ctx, traceContextMixin);
    expect(result).toEqual({});
    span.end();
  });

  it("returns trace_id and span_id when an SDK-issued span is active", () => {
    const fakeContext: SpanContext = {
      traceId: "0123456789abcdef0123456789abcdef",
      spanId: "0123456789abcdef",
      traceFlags: 1,
    };
    const original = trace.getActiveSpan;
    try {
      (trace as { getActiveSpan: () => unknown }).getActiveSpan = () => ({
        spanContext: () => fakeContext,
      });
      expect(traceContextMixin()).toEqual({
        trace_id: "0123456789abcdef0123456789abcdef",
        span_id: "0123456789abcdef",
      });
    } finally {
      (trace as { getActiveSpan: typeof original }).getActiveSpan = original;
    }
  });
});
