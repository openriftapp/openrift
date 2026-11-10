import { createLogger } from "@openrift/shared/logger";
import { context, trace } from "@opentelemetry/api";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from "@opentelemetry/sdk-trace";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "./app.js";

const exporter = new InMemorySpanExporter();
const provider = new TracerProvider({
  spanProcessors: [new SimpleSpanProcessor({ exporter })],
});
const contextManager = new AsyncLocalStorageContextManager();

beforeAll(() => {
  trace.setGlobalTracerProvider(provider);
  context.setGlobalContextManager(contextManager.enable());
});

afterAll(async () => {
  contextManager.disable();
  await provider.shutdown();
  trace.disable();
  context.disable();
});

afterEach(() => {
  exporter.reset();
});

function buildApp() {
  return createApp({
    db: {} as any,
    auth: {
      handler: () => new Response("ok"),
      api: { getSession: () => null },
      $Infer: { Session: { user: null, session: null } },
    } as any,
    config: {
      port: 3000,
      databaseUrl: "postgres://mock",
      isDev: false,
      corsOrigin: undefined,
      auth: { secret: "test-secret", adminEmail: undefined, google: undefined, discord: undefined },
      smtp: { configured: false },
    } as any,
    log: createLogger("test", "silent"),
  });
}

async function requestLines(app: ReturnType<typeof buildApp>, method: string): Promise<string[]> {
  const res = await app.fetch(new Request("http://localhost/metrics"));
  const body = await res.text();
  return body
    .split("\n")
    .filter(
      (line) => line.startsWith("http_requests_total{") && line.includes(`method="${method}"`),
    );
}

function serverSpan() {
  return exporter
    .getFinishedSpans()
    .find((span) => span.instrumentationScope.name === "openrift-api/http");
}

describe("route labels through the oRPC catch-all", () => {
  it("labels a matched procedure with its contract path template", async () => {
    const app = buildApp();

    const res = await app.fetch(new Request("http://localhost/api/v1/decks/deck-abc-123"));
    expect(res.status).toBe(401);

    const lines = await requestLines(app, "GET");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('route="/api/v1/decks/{id}"');
    expect(lines.join("\n")).not.toContain("deck-abc-123");

    const span = serverSpan();
    expect(span?.name).toBe("GET /api/v1/decks/{id}");
    expect(span?.attributes["http.route"]).toBe("/api/v1/decks/{id}");
    expect(span?.attributes["url.path"]).toBe("/api/v1/decks/deck-abc-123");
  });

  it("labels a matched procedure whose request body fails to decode", async () => {
    const app = buildApp();

    const res = await app.fetch(
      new Request("http://localhost/api/v1/trades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }),
    );
    expect(res.status).toBe(400);

    const lines = await requestLines(app, "POST");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('route="/api/v1/trades"');
    expect(serverSpan()?.name).toBe("POST /api/v1/trades");
  });

  it("keeps one bounded label for requests that match no procedure", async () => {
    const app = buildApp();

    await app.fetch(new Request("http://localhost/api/v1/no-such-thing/one"));
    await app.fetch(new Request("http://localhost/api/v1/no-such-thing/two"));

    const lines = await requestLines(app, "GET");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('route="/api/*"');
    expect(lines[0]).toContain('status="404"');

    const spans = exporter
      .getFinishedSpans()
      .filter((span) => span.instrumentationScope.name === "openrift-api/http");
    expect(spans.map((span) => span.name)).toEqual(["GET <unmatched>", "GET <unmatched>"]);
    expect(spans[0]?.attributes["http.route"]).toBe("<unmatched>");
  });
});
