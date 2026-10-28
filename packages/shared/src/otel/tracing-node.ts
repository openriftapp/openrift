/**
 * `startTracing` must run before any module obtains a tracer.
 * Auto-instrumentation is omitted: under Bun, `import-in-the-middle`/`require-in-the-middle` have no
 * loader hooks to patch HTTP, pg, etc. Assembled from individual `@opentelemetry/sdk-*` packages,
 * not `sdk-node`: its CJS `require("@opentelemetry/context-async-hooks")` 500s the web
 * server's bundled build (no `node_modules` beside it). Node-only: keep behind a server-only import.
 */

import { context, propagation, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor, TracerProvider } from "@opentelemetry/sdk-trace";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

let provider: TracerProvider | undefined;

export function startTracing(serviceName: string): TracerProvider | undefined {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    return undefined;
  }

  provider = new TracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? serviceName,
      [ATTR_SERVICE_VERSION]: process.env.BUILD_ID ?? "dev",
    }),
    spanProcessors: [
      new BatchSpanProcessor({
        exporter: new OTLPTraceExporter({
          // Tempo's OTLP HTTP receiver expects POSTs to /v1/traces.
          url: `${endpoint.replace(/\/$/u, "")}/v1/traces`,
        }),
      }),
    ],
  });
  context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
  propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  trace.setGlobalTracerProvider(provider);

  return provider;
}

export async function shutdownTracing(timeoutMs = 2000): Promise<void> {
  if (!provider) {
    return;
  }
  const { promise: timedOut, resolve } = Promise.withResolvers<void>();
  const timer = setTimeout(resolve, timeoutMs);
  try {
    await Promise.race([provider.shutdown(), timedOut]);
  } catch {
    // best-effort
  } finally {
    clearTimeout(timer);
  }
}
